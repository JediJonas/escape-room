import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { BOARD_LETTERS, type BoardPoint, type BoardTouch, START_CELL, type SeanceView, findEchoGlowPoint, findGlowProgress, findPointOnSegment } from '../../supabase/functions/game/seance.ts';
import { LIFT_GRACE_MS, clampToBoard, describeSeanceStatus, CATCH_UP_SPEED, holdGlowProgress, isPlanchetteOnGlow, shouldReportArrival } from './seanceBoard.ts';
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
export function SeanceBoard({ seance, clockOffsetMs, canTouch, onTouch, answer }: {
  seance: SeanceView;
  clockOffsetMs: number;
  /** Spelledaren som står utanför ser brädet men har ingen planchett. */
  canTouch: boolean;
  onTouch: (touch: BoardTouch) => void;
  /**
   * Svarsrutan längst ner, när brädet har ställt en fråga som gruppen svarar
   * på, som VEM ÄR JAG (Jonas 2026-11-18). Spelaren lämnar brädet med
   * Tillbaka överst, som alla saker.
   */
  answer?: ReactNode;
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
    let shown: { turn: string; progress: number; atMs: number } | null = null;
    let arrival: { turn: string; reachedAtMs: number; sentAtMs: number | null } = { turn: '', reachedAtMs: 0, sentAtMs: null };
    const draw = () => {
      const { seance: current, clockOffsetMs: offset, onTouch: send } = latest.current;
      const turn = describeLetterTurn(current);
      // Min egen planchett har lämnat skenet: jag stoppar det här direkt, utan att vänta på servern.
      const isMeOff = current.isMeOnGlow && !reportedOn.current;
      const isHeld = current.movesFromMs === null || isMeOff;
      const frameMs = Date.now();
      const computed = findGlowProgress(current, frameMs + offset);
      const { durationMs } = current.segment;
      const sinceLastMs = shown ? frameMs - shown.atMs : 0;
      const progress = holdGlowProgress({
        computed,
        shown: shown?.turn === turn ? shown.progress : null,
        isHeld,
        maxStep: durationMs > 0 ? (CATCH_UP_SPEED * sinceLastMs) / durationMs : 1,
      });
      shown = { turn, progress, atMs: frameMs };
      const glow = { point: findPointOnSegment(current.segment, progress), hasArrived: progress >= 1 };
      if (glowRef.current) Object.assign(glowRef.current.style, toPercent(glow.point));
      if (planchetteRef.current) {
        planchetteRef.current.hidden = planchette.current === null;
        if (planchette.current) Object.assign(planchetteRef.current.style, toPercent(planchette.current));
      }
      if (!current.isComplete) {
        // Under respiten efter ett lyft finger räknas planchetten som kvar.
        const isTouching = pointerId.current !== null || liftTimer.current !== null;
        const isOn = isTouching && isPlanchetteOnGlow({ planchette: planchette.current, glow: glow.point, wasOn: reportedOn.current });
        if (isOn !== reportedOn.current) {
          reportedOn.current = isOn;
          send(isOn ? 'onGlow' : 'offGlow');
        }
        // Servern tickar inte, så den som ser skenet nå bokstaven säger till. Det som räknas är
        // serverns läge, inte det som visas. Mobilerna turas om, i den ordning de kom till skenet.
        const nowMs = Date.now();
        if (computed >= 1 && current.movesFromMs !== null && isOn && current.myFollowOrder !== null) {
          if (arrival.turn !== turn) arrival = { turn, reachedAtMs: nowMs, sentAtMs: null };
          if (shouldReportArrival({ nowMs, reachedAtMs: arrival.reachedAtMs, sentAtMs: arrival.sentAtMs, followOrder: current.myFollowOrder })) {
            arrival.sentAtMs = nowMs;
            send('arrived');
          }
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
    // När skenet har slocknat står brädet still, så att fingret kan zooma och svara (Jonas 2026-11-18).
    if (!canTouch || seance.isComplete || pointerId.current !== null) return;
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
  const status = describeSeanceStatus(seance, nowMs + clockOffsetMs, canTouch);
  const boardAnswer = seance.isComplete ? answer : undefined;
  return (
    <section className="seance" aria-label="Seansen">
      <div className="seance-frame">
        <div
          className="seance-board"
          aria-label={canTouch ? 'Brädet. Håll fingret på planchetten och följ skenet.' : 'Brädet'}
          onPointerDown={press}
          onPointerMove={move}
          onPointerUp={release}
          onPointerCancel={release}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div className="seance-letters" aria-hidden="true">
            {BOARD_CELLS.map((symbol, cell) => (
              <span key={symbol} className={cell === START_CELL ? 'is-start' : undefined}>{symbol}</span>
            ))}
          </div>
          <div ref={glowRef} className={`seance-glow${isWaiting ? ' is-waiting' : ''}`} hidden={seance.isComplete} />
          <div ref={planchetteRef} className="seance-planchette" hidden />
        </div>
      </div>
      {/* Rutan i underkant syns bara när den har något att säga. */}
      {(status || boardAnswer) && (
        <div className="seance-status">
          <p role="status">{status}</p>
          {boardAnswer}
        </div>
      )}
    </section>
  );
}

/**
 * Brädet när det bokstaverar av sig självt, om och om igen, som VERA efter att
 * gruppen har svarat (Jonas 2026-11-18). Ingen planchett och inget skickas.
 * Skenet räknas ur serverns tid, så att alla mobiler visar samma bokstav.
 */
/**
 * Brädet när ingen seans pågår. Har brädet något att säga bokstaverar det av
 * sig självt, och annars står det stilla utan sken (Jonas 2026-11-23).
 */
export function EchoBoard({ message, clockOffsetMs }: { message: string | null; clockOffsetMs: number }) {
  const glowRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ message, clockOffsetMs });

  useEffect(() => {
    latest.current = { message, clockOffsetMs };
  }, [message, clockOffsetMs]);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const { message: current, clockOffsetMs: offset } = latest.current;
      if (glowRef.current && current !== null) Object.assign(glowRef.current.style, toPercent(findEchoGlowPoint(current, Date.now() + offset)));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="seance" aria-label="Brädet">
      <div className="seance-frame">
        <div className="seance-board" aria-label={message === null ? 'Brädet' : 'Brädet. Skenet rör sig av sig självt.'}>
          <div className="seance-letters" aria-hidden="true">
            {BOARD_CELLS.map((symbol, cell) => (
              <span key={symbol} className={cell === START_CELL ? 'is-start' : undefined}>{symbol}</span>
            ))}
          </div>
          {message !== null && <div ref={glowRef} className="seance-glow" />}
        </div>
      </div>
    </section>
  );
}
