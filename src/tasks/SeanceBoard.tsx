import { type PointerEvent, useEffect, useRef, useState } from 'react';
import type { BoardTouch, SeanceView } from '../../supabase/functions/game/seance.ts';
import { type BoardPoint, LIFT_GRACE_MS, clampToBoard, describeSeanceStatus, findGlowPoint, isPlanchetteOnGlow } from './seanceBoard.ts';
import './seance.css';

/** Raden under brädet uppdateras så här ofta, så att meddelandet om vem som släppte försvinner. */
const STATUS_TICK_MS = 1000;
const PERCENT = 100;

function toPercent(point: BoardPoint): { left: string; top: string } {
  return { left: `${point.x * PERCENT}%`, top: `${point.y * PERCENT}%` };
}

/**
 * Brädet i seansen. Skenet och planchetten ritas direkt i varje bildruta,
 * förbi React, eftersom fingret rör sig många gånger i sekunden. Bara när
 * planchetten kommer till skenet eller lämnar det säger mobilen till servern.
 * Se docs/motorn.md, Rörelser går förbi React.
 */
export function SeanceBoard({ seance, clockOffsetMs, canTouch, onTouch }: {
  seance: SeanceView;
  clockOffsetMs: number;
  /** Spelledaren som står utanför ser brädet men har ingen planchett. */
  canTouch: boolean;
  onTouch: (touch: BoardTouch, letterIndex: number) => void;
}) {
  const glowRef = useRef<HTMLDivElement>(null);
  const planchetteRef = useRef<HTMLDivElement>(null);
  const planchette = useRef<BoardPoint | null>(null);
  const pointerId = useRef<number | null>(null);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedOn = useRef(false);
  const latest = useRef({ seance, clockOffsetMs, onTouch });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    latest.current = { seance, clockOffsetMs, onTouch };
  }, [seance, clockOffsetMs, onTouch]);

  // Servern vet om planchetten räknas. En ny bokstav börjar alltid utan någon på skenet.
  useEffect(() => {
    reportedOn.current = seance.isMeOnGlow;
  }, [seance.letterIndex, seance.isMeOnGlow]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), STATUS_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const { seance: current, clockOffsetMs: offset, onTouch: send } = latest.current;
      const glow = findGlowPoint(current, Date.now() + offset);
      if (glowRef.current) Object.assign(glowRef.current.style, toPercent(glow.point));
      if (planchetteRef.current) {
        planchetteRef.current.hidden = planchette.current === null;
        if (planchette.current) Object.assign(planchetteRef.current.style, toPercent(planchette.current));
      }
      // Under respiten efter ett lyft finger räknas planchetten som kvar.
      const isTouching = pointerId.current !== null || liftTimer.current !== null;
      const isOn = isTouching && isPlanchetteOnGlow({ planchette: planchette.current, glow: glow.point, hasArrived: glow.hasArrived, wasOn: reportedOn.current });
      if (!current.isComplete && isOn !== reportedOn.current) {
        reportedOn.current = isOn;
        send(isOn ? 'onGlow' : 'offGlow', current.letterIndex);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => () => {
    if (liftTimer.current) clearTimeout(liftTimer.current);
  }, []);

  function movePlanchette(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    planchette.current = clampToBoard({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height });
  }

  function press(event: PointerEvent<HTMLDivElement>) {
    if (!canTouch || pointerId.current !== null) return;
    pointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (liftTimer.current) clearTimeout(liftTimer.current);
    liftTimer.current = null;
    movePlanchette(event);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId === pointerId.current) movePlanchette(event);
  }

  /** Ett finger som kommer tillbaka inom respiten har inte släppt. */
  function release(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== pointerId.current) return;
    pointerId.current = null;
    liftTimer.current = setTimeout(() => {
      liftTimer.current = null;
      planchette.current = null;
      const { seance: current, onTouch: send } = latest.current;
      const hasStarted = current.letterIndex > 0 || reportedOn.current;
      reportedOn.current = false;
      if (hasStarted && !current.isComplete) send('lifted', current.letterIndex);
    }, LIFT_GRACE_MS);
  }

  const isWaiting = !seance.isComplete && seance.followerCount < seance.playerCount;
  return (
    <section className="seance" aria-label="Seansen">
      {/* Raden finns alltid, så att brädet inte flyttar sig under fingret när en bokstav dyker upp. */}
      <p className="seance-letter" role="status">
        {seance.myLetter && (
          <>
            <span className="seance-letter-hint">{seance.myLetter.startsWord && seance.letterIndex > 1 ? 'Nytt ord. Säg högt:' : 'Säg högt:'}</span>
            {seance.myLetter.letter}
          </>
        )}
      </p>
      <div
        className={`seance-board${seance.isComplete ? ' is-complete' : ''}`}
        aria-label={canTouch ? 'Brädet. Håll fingret på planchetten och följ skenet.' : 'Brädet'}
        onPointerDown={press}
        onPointerMove={move}
        onPointerUp={release}
        onPointerCancel={release}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div ref={glowRef} className={`seance-glow${isWaiting ? ' is-waiting' : ''}`} />
        <div ref={planchetteRef} className="seance-planchette" hidden />
      </div>
      <p className="hint seance-status" role="status">{describeSeanceStatus(seance, nowMs + clockOffsetMs)}</p>
    </section>
  );
}
