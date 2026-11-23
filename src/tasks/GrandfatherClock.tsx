import { type PointerEvent, useEffect, useState } from 'react';
import { DIAL_HOURS, snapDial } from '../../supabase/functions/game/flashback.ts';
import { angleFromCenter, dragMinuteHand, findHandAngles, formatDialTime } from './clockDial.ts';
import { Pendulum } from './Pendulum.tsx';
import './flashback.css';

/*
 * Urtavlan i bilden av golvuret är oval. Visarna och siffrorna ritas ovanpå,
 * i en ruta som är lika stor som tavlan i bilden, räknat i bildens pixlar
 * (Jonas 2026-11-23). Rutans läge i bilden står i flashback.css.
 */
const DIAL = { width: 310, height: 278 };
const CENTER = { x: DIAL.width / 2, y: DIAL.height / 2 };
/** Siffrorna står på en oval innanför tavlans kant. */
const NUMERAL_RADIUS = { x: 124, y: 107 };
const ROMAN = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
const TICK_MS = 8;
/** Visarnas längd från mitten och hur långt de sticker ut bakåt. */
const HOUR_HAND = { length: 62, tail: 12 };
const MINUTE_HAND = { length: 96, tail: 16 };
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

  const { x: cx, y: cy } = CENTER;
  return (
    <div className="grandfather-clock">
      {/* Golvuret är en tecknad bild med tom urtavla och tomt pendelfönster (Jonas 2026-11-23). */}
      <div className="clock-case">
        <svg
          viewBox={`0 0 ${DIAL.width} ${DIAL.height}`}
          className={canTurn ? 'clock-face can-turn' : 'clock-face'}
          role="img"
          aria-label={`Golvuret står på ${formatDialTime(shownMinutes)}`}
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          {ROMAN.map((numeral, hour) => {
            const radians = (hour / DIAL_HOURS) * 2 * Math.PI;
            return (
              <text key={numeral} x={cx + Math.sin(radians) * NUMERAL_RADIUS.x} y={cy - Math.cos(radians) * NUMERAL_RADIUS.y} className="clock-numeral" textAnchor="middle" dominantBaseline="central">
                {numeral}
              </text>
            );
          })}
          <line x1={cx} y1={cy + HOUR_HAND.tail} x2={cx} y2={cy - HOUR_HAND.length} className="clock-hand hour" transform={`rotate(${hands.hour} ${cx} ${cy})`} />
          <line x1={cx} y1={cy + MINUTE_HAND.tail} x2={cx} y2={cy - MINUTE_HAND.length} className="clock-hand minute" transform={`rotate(${hands.minute} ${cx} ${cy})`} />
          <circle cx={cx} cy={cy} r={6} className="clock-pin" />
        </svg>
        <Pendulum />
      </div>
    </div>
  );
}
