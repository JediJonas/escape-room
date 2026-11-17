import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { DIAL_HOURS, snapDial } from '../../supabase/functions/game/rooms.ts';
import { watchMotion } from '../device/motion.ts';
import { WHEEL_MINUTES_PER_DEGREE, angleFromCenter, dragMinuteHand, findHandAngles, formatDialTime, isGravityFlipped, readWheelAngle, wrapAngleDelta } from './clockDial.ts';
import './rooms.css';

const DIAL_SIZE = 200;
const CENTER = DIAL_SIZE / 2;
const NUMERAL_RADIUS = 78;
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const TICK_MS = 8;
/** Visarnas längd från mitten och hur långt de sticker ut bakåt. */
const HOUR_HAND = { length: 45, tail: 8 };
const MINUTE_HAND = { length: 68, tail: 12 };

/** En kort darrning när visarna hakar i, där mobilen kan det. */
function tick() {
  navigator.vibrate?.(TICK_MS);
}

/** Pågående vridning: med fingret från en vinkel, eller med mobilen från ett grepp. */
type Turn = { minutes: number; angle: number };

/**
 * Golvurets urtavla. Spelaren vrider minutvisaren med fingret, eller håller
 * in knappen och vrider mobilen som en ratt. Visarna hakar i var femte
 * minut, och tiden skickas till servern när spelaren släpper. Servern avgör
 * om huset minns. Se docs/koncept.md, Nu och 1962.
 */
export function GrandfatherClock({ dialMinutes, canTurn, onTurn }: {
  /** Var visarna står hos servern. */
  dialMinutes: number;
  canTurn: boolean;
  onTurn: (minutes: number) => void;
}) {
  const [turn, setTurn] = useState<Turn | null>(null);
  const [hasWheel, setHasWheel] = useState(false);
  const [isGripping, setIsGripping] = useState(false);
  const wheel = useRef<{ isFlipped: boolean; angle: number; minutes: number } | null>(null);
  const lastGravity = useRef<{ x: number | null; y: number | null } | null>(null);
  const shownMinutes = turn ? snapDial(turn.minutes) : dialMinutes;
  const hands = findHandAngles(shownMinutes);

  useEffect(() => {
    if (!canTurn) return undefined;
    return watchMotion({
      onOrientation: () => undefined,
      onMovement: (event) => {
        const gravity = event.accelerationIncludingGravity;
        if (!gravity || gravity.x === null || gravity.y === null) return;
        lastGravity.current = { x: gravity.x, y: gravity.y };
        setHasWheel(true);
        const grip = wheel.current;
        if (!grip) return;
        const angle = readWheelAngle(gravity, grip.isFlipped);
        if (angle === null) return;
        const minutes = grip.minutes + wrapAngleDelta(angle - grip.angle) * WHEEL_MINUTES_PER_DEGREE;
        setTurn((current) => {
          if (current && snapDial(current.minutes) !== snapDial(minutes)) tick();
          return { minutes, angle };
        });
      },
    });
  }, [canTurn]);

  function release(minutes: number) {
    setTurn(null);
    onTurn(snapDial(minutes));
  }

  function pointAngle(event: PointerEvent<SVGSVGElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    return angleFromCenter(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2);
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (!canTurn) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setTurn({ minutes: dialMinutes, angle: pointAngle(event) });
  }

  function drag(event: PointerEvent<SVGSVGElement>) {
    if (!turn || isGripping) return;
    const angle = pointAngle(event);
    const minutes = dragMinuteHand(turn.minutes, turn.angle, angle);
    if (snapDial(minutes) !== snapDial(turn.minutes)) tick();
    setTurn({ minutes, angle });
  }

  function endDrag() {
    if (turn && !isGripping) release(turn.minutes);
  }

  function grip() {
    const gravity = lastGravity.current;
    const isFlipped = gravity ? isGravityFlipped(gravity) : false;
    const angle = gravity ? readWheelAngle(gravity, isFlipped) : null;
    if (angle === null) return;
    wheel.current = { isFlipped, angle, minutes: dialMinutes };
    setIsGripping(true);
    setTurn({ minutes: dialMinutes, angle });
  }

  function letGo() {
    wheel.current = null;
    setIsGripping(false);
    if (turn) release(turn.minutes);
  }

  return (
    <div className="grandfather-clock">
      <svg
        viewBox={`0 0 ${DIAL_SIZE} ${DIAL_SIZE}`}
        className={canTurn ? 'clock-face can-turn' : 'clock-face'}
        role="img"
        aria-label={`Golvuret står på ${formatDialTime(shownMinutes)}`}
        onPointerDown={startDrag}
        onPointerMove={drag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <circle cx={CENTER} cy={CENTER} r={96} className="clock-rim" />
        <circle cx={CENTER} cy={CENTER} r={90} className="clock-dial" />
        {ROMAN.map((numeral, hour) => {
          const radians = (hour / DIAL_HOURS) * 2 * Math.PI;
          return (
            <text key={numeral} x={CENTER + Math.sin(radians) * NUMERAL_RADIUS} y={CENTER - Math.cos(radians) * NUMERAL_RADIUS} className="clock-numeral" textAnchor="middle" dominantBaseline="central">
              {numeral}
            </text>
          );
        })}
        <line x1={CENTER} y1={CENTER + HOUR_HAND.tail} x2={CENTER} y2={CENTER - HOUR_HAND.length} className="clock-hand hour" transform={`rotate(${hands.hour} ${CENTER} ${CENTER})`} />
        <line x1={CENTER} y1={CENTER + MINUTE_HAND.tail} x2={CENTER} y2={CENTER - MINUTE_HAND.length} className="clock-hand minute" transform={`rotate(${hands.minute} ${CENTER} ${CENTER})`} />
        <circle cx={CENTER} cy={CENTER} r={4} className="clock-pin" />
      </svg>
      {canTurn && hasWheel && (
        <button
          type="button"
          className={isGripping ? 'wheel-grip is-gripping' : 'wheel-grip secondary'}
          onPointerDown={grip}
          onPointerUp={letGo}
          onPointerCancel={letGo}
          onContextMenu={(event) => event.preventDefault()}
        >
          {isGripping ? 'Vrid mobilen som en ratt' : 'Håll in och vrid mobilen'}
        </button>
      )}
    </div>
  );
}
