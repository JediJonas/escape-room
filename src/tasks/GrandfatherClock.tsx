import { type PointerEvent, useEffect, useState } from 'react';
import { DIAL_HOURS, snapDial } from '../../supabase/functions/game/rooms.ts';
import { angleFromCenter, dragMinuteHand, findHandAngles, formatDialTime } from './clockDial.ts';
import './rooms.css';

const DIAL_SIZE = 200;
const CENTER = DIAL_SIZE / 2;
const NUMERAL_RADIUS = 78;
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const TICK_MS = 8;
/** Visarnas längd från mitten och hur långt de sticker ut bakåt. */
const HOUR_HAND = { length: 45, tail: 8 };
const MINUTE_HAND = { length: 68, tail: 12 };
/** Svarar inte servern inom så här lång tid visas dess tid igen. */
const PENDING_MS = 5000;

/** En kort darrning när visarna hakar i, där mobilen kan det. */
function tick() {
  navigator.vibrate?.(TICK_MS);
}

/** Pågående vridning med fingret, från en vinkel. */
type Turn = { minutes: number; angle: number };

/**
 * Golvurets urtavla. Spelaren drar minutvisaren med fingret. Att vrida
 * mobilen som en ratt togs bort (Jonas 2026-11-18). Visarna hakar i var
 * femte minut, och tiden skickas till servern när spelaren släpper. Servern
 * avgör om huset minns. Se docs/koncept.md, Nu och 1962.
 */
export function GrandfatherClock({ dialMinutes, canTurn, onTurn }: {
  /** Var visarna står hos servern. */
  dialMinutes: number;
  canTurn: boolean;
  onTurn: (minutes: number) => void;
}) {
  const [turn, setTurn] = useState<Turn | null>(null);
  // Tiden spelaren släppte på, och serverns tid då. Den visas tills servern
  // har svarat med en ny tid, så att visarna inte hoppar tillbaka en stund.
  const [pending, setPending] = useState<{ minutes: number; fromServer: number } | null>(null);
  const waiting = pending?.fromServer === dialMinutes ? pending.minutes : null;
  const shownMinutes = turn ? snapDial(turn.minutes) : (waiting ?? dialMinutes);
  const hands = findHandAngles(shownMinutes);

  useEffect(() => {
    if (pending === null) return undefined;
    const timer = setTimeout(() => setPending(null), PENDING_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  function pointAngle(event: PointerEvent<SVGSVGElement>): number {
    const box = event.currentTarget.getBoundingClientRect();
    return angleFromCenter(event.clientX - box.left - box.width / 2, event.clientY - box.top - box.height / 2);
  }

  function startDrag(event: PointerEvent<SVGSVGElement>) {
    if (!canTurn) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setTurn({ minutes: shownMinutes, angle: pointAngle(event) });
  }

  function drag(event: PointerEvent<SVGSVGElement>) {
    if (!turn) return;
    const angle = pointAngle(event);
    const minutes = dragMinuteHand(turn.minutes, turn.angle, angle);
    if (snapDial(minutes) !== snapDial(turn.minutes)) tick();
    setTurn({ minutes, angle });
  }

  function endDrag() {
    if (!turn) return;
    const snapped = snapDial(turn.minutes);
    setTurn(null);
    if (snapped === dialMinutes) return;
    setPending({ minutes: snapped, fromServer: dialMinutes });
    onTurn(snapped);
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
    </div>
  );
}
