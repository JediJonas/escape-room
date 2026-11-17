import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { BOARD_LETTERS, type BoardPoint, type BoardTouch, START_CELL, type SeanceView, findGlowPoint } from '../../supabase/functions/game/seance.ts';
import { LIFT_GRACE_MS, clampToBoard, describeSeanceStatus, findLitCell, isPlanchetteOnGlow } from './seanceBoard.ts';
import './seance.css';

/** Raden under brädet uppdateras så här ofta, så att meddelandet om vem som släppte försvinner. */
const STATUS_TICK_MS = 1000;
const PERCENT = 100;
/** Startrutan har en måne i stället för en bokstav. */
const START_SYMBOL = '☽';
const BOARD_CELLS = [...BOARD_LETTERS, START_SYMBOL];

function toPercent(point: BoardPoint): { left: string; top: string } {
  return { left: `${point.x * PERCENT}%`, top: `${point.y * PERCENT}%` };
}

/** Skenet når samma bokstav en gång per varv. Ett nytt varv börjar när någon har brutit kontakten. */
function describeLetterTurn(seance: SeanceView): string {
  return `${seance.brokenBy?.atMs ?? 0}:${seance.letterIndex}`;
}

/**
 * Brädet i seansen. Skenet, planchetten och den upplysta bokstaven ritas
 * direkt i varje bildruta, förbi React, eftersom de rör sig hela tiden. Bara
 * när planchetten kommer till skenet, lämnar det eller lyfts säger mobilen
 * till servern, och när skenet når en bokstav. Se docs/motorn.md, Rörelser
 * går förbi React.
 */
export function SeanceBoard({ seance, text, clockOffsetMs, canTouch, onTouch }: {
  seance: SeanceView;
  /** Uppgiftens text. Den står där bokstaven visas, så länge ingen bokstav syns. */
  text: string;
  clockOffsetMs: number;
  /** Spelledaren som står utanför ser brädet men har ingen planchett. */
  canTouch: boolean;
  onTouch: (touch: BoardTouch) => void;
}) {
  const glowRef = useRef<HTMLDivElement>(null);
  const planchetteRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const planchette = useRef<BoardPoint | null>(null);
  const pointerId = useRef<number | null>(null);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedOn = useRef(false);
  const arrivedTurn = useRef('');
  const latest = useRef({ seance, clockOffsetMs, onTouch });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    latest.current = { seance, clockOffsetMs, onTouch };
  }, [seance, clockOffsetMs, onTouch]);

  // Servern vet om planchetten räknas. Efter en bruten kontakt följer ingen.
  useEffect(() => {
    reportedOn.current = seance.isMeOnGlow;
  }, [seance.letterIndex, seance.isMeOnGlow, seance.brokenBy?.atMs]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), STATUS_TICK_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let frame = 0;
    let litCell: number | null = null;
    const draw = () => {
      const { seance: current, clockOffsetMs: offset, onTouch: send } = latest.current;
      const glow = findGlowPoint(current, Date.now() + offset);
      if (glowRef.current) Object.assign(glowRef.current.style, toPercent(glow.point));
      if (planchetteRef.current) {
        planchetteRef.current.hidden = planchette.current === null;
        if (planchette.current) Object.assign(planchetteRef.current.style, toPercent(planchette.current));
      }
      const nextLit = findLitCell(current, glow.point);
      if (nextLit !== litCell) {
        if (litCell !== null) cellRefs.current[litCell]?.classList.remove('is-lit');
        if (nextLit !== null) cellRefs.current[nextLit]?.classList.add('is-lit');
        litCell = nextLit;
      }
      if (!current.isComplete) {
        // Under respiten efter ett lyft finger räknas planchetten som kvar.
        const isTouching = pointerId.current !== null || liftTimer.current !== null;
        const isOn = isTouching && isPlanchetteOnGlow({ planchette: planchette.current, glow: glow.point, wasOn: reportedOn.current });
        if (isOn !== reportedOn.current) {
          reportedOn.current = isOn;
          send(isOn ? 'onGlow' : 'offGlow');
        }
        // Servern tickar inte, så den som ser skenet nå bokstaven säger till.
        const turn = describeLetterTurn(current);
        if (glow.hasArrived && current.movesFromMs !== null && isOn && arrivedTurn.current !== turn) {
          arrivedTurn.current = turn;
          send('arrived');
        }
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
      reportedOn.current = false;
      // Servern avgör om seansen har hunnit börja och kontakten bryts.
      if (!current.isComplete) send('lifted');
    }, LIFT_GRACE_MS);
  }

  const isWaiting = !seance.isComplete && seance.movesFromMs === null;
  return (
    <section className="seance" aria-label="Seansen">
      {/* Raden har fast höjd, så att brädet inte flyttar sig under fingret när en bokstav dyker upp. */}
      <p className="seance-letter" role="status">
        {seance.myLetter
          ? (
            <>
              <span className="seance-letter-hint">{seance.myLetter.startsWord && seance.letterIndex > 1 ? 'Nytt ord. Säg högt:' : 'Säg högt:'}</span>
              {seance.myLetter.letter}
            </>
          )
          : <span className="seance-instruction">{text}</span>}
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
        <div className="seance-letters" aria-hidden="true">
          {BOARD_CELLS.map((symbol, cell) => (
            <span key={symbol} ref={(element) => { cellRefs.current[cell] = element; }} className={cell === START_CELL ? 'is-start' : undefined}>{symbol}</span>
          ))}
        </div>
        <div ref={glowRef} className={`seance-glow${isWaiting ? ' is-waiting' : ''}`} />
        <div ref={planchetteRef} className="seance-planchette" hidden />
      </div>
      <p className="hint seance-status" role="status">{describeSeanceStatus(seance, nowMs + clockOffsetMs, canTouch)}</p>
    </section>
  );
}
