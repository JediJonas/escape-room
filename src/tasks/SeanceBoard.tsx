import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { BOARD_LETTERS, type BoardPoint, type BoardTouch, START_CELL, type SeanceView, findCellCenter, findEchoGlowPoint, findGlowProgress, findPointOnSegment } from '../../supabase/functions/game/seance.ts';
import { LIFT_GRACE_MS, clampToBoard, describeSeanceStatus, CATCH_UP_SPEED, holdGlowProgress, isFingerOnGlow, shouldReportArrival } from './seanceBoard.ts';
import './seance.css';

/** Raden under brädet uppdateras så här ofta, så att meddelandet om vem som släppte försvinner. */
const STATUS_TICK_MS = 1000;
const PERCENT = 100;
/** Startrutan är den tomma platsen efter Ö, där planchetten står när den vilar (Jonas 2026-11-23). */
const BOARD_CELLS = [...BOARD_LETTERS, ''];
const START_POINT = findCellCenter(START_CELL);

function toPercent(point: BoardPoint): { left: string; top: string } {
  return { left: `${point.x * PERCENT}%`, top: `${point.y * PERCENT}%` };
}

/** Planchetten når samma bokstav en gång per varv. Ett nytt varv börjar när någon har brutit kontakten. */
function describeLetterTurn(seance: SeanceView): string {
  return `${seance.brokenBy?.atMs ?? 0}:${seance.letterIndex}`;
}

/** Bokstäverna på brädet, med en tom plats sist. */
function BoardLetters() {
  return (
    <div className="seance-letters" aria-hidden="true">
      {BOARD_CELLS.map((symbol, cell) => <span key={cell}>{symbol}</span>)}
    </div>
  );
}

/**
 * Brädet i seansen. En gemensam planchett glider över brädet, och alla följer
 * den med fingret (Jonas 2026-11-23). Planchetten ritas direkt i varje
 * bildruta, förbi React, eftersom den rör sig hela tiden. Bara när fingret
 * kommer till planchetten, lämnar den eller lyfts säger mobilen till servern,
 * och när planchetten når en bokstav. Se docs/motorn.md, Rörelser går förbi
 * React. I koden heter planchettens väg glow, efter skenet som fanns före den.
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
  const boardRef = useRef<HTMLDivElement>(null);
  const planchetteRef = useRef<HTMLDivElement>(null);
  /** Var spelarens finger är på brädet, eller null. */
  const finger = useRef<BoardPoint | null>(null);
  const pointerId = useRef<number | null>(null);
  const liftTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reportedOn = useRef(false);
  const latest = useRef({ seance, clockOffsetMs, onTouch });
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    latest.current = { seance, clockOffsetMs, onTouch };
  }, [seance, clockOffsetMs, onTouch]);

  // Servern vet om fingret räknas. Efter en bruten kontakt följer ingen.
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
      // Mitt eget finger har lämnat planchetten: jag stoppar den här direkt, utan att vänta på servern.
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
      // När meddelandet är klart går planchetten tillbaka till den tomma platsen och står still.
      if (planchetteRef.current) Object.assign(planchetteRef.current.style, toPercent(current.isComplete ? START_POINT : glow.point));
      if (!current.isComplete) {
        // Under respiten efter ett lyft finger räknas fingret som kvar.
        const isTouching = pointerId.current !== null || liftTimer.current !== null;
        const isOn = isTouching && isFingerOnGlow({ finger: finger.current, glow: glow.point, wasOn: reportedOn.current });
        if (isOn !== reportedOn.current) {
          reportedOn.current = isOn;
          send(isOn ? 'onGlow' : 'offGlow');
        }
        // Servern tickar inte, så den som ser planchetten nå bokstaven säger till. Det som räknas är
        // serverns läge, inte det som visas. Mobilerna turas om, i den ordning de kom till planchetten.
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

  /** Fingret räknas i rutnätet med bokstäverna, också när det är på brädets kant. */
  function moveFinger(event: PointerEvent<HTMLDivElement>) {
    const box = boardRef.current?.getBoundingClientRect();
    if (!box) return;
    finger.current = clampToBoard({ x: (event.clientX - box.left) / box.width, y: (event.clientY - box.top) / box.height });
  }

  function press(event: PointerEvent<HTMLDivElement>) {
    // När meddelandet är klart står brädet still, så att fingret kan zooma och svara (Jonas 2026-11-18).
    if (!canTouch || seance.isComplete || pointerId.current !== null) return;
    pointerId.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    if (liftTimer.current) clearTimeout(liftTimer.current);
    liftTimer.current = null;
    moveFinger(event);
  }

  function move(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId === pointerId.current) moveFinger(event);
  }

  /** Ett finger som kommer tillbaka inom respiten har inte släppt. */
  function release(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerId !== pointerId.current) return;
    pointerId.current = null;
    liftTimer.current = setTimeout(() => {
      liftTimer.current = null;
      finger.current = null;
      const { seance: current, onTouch: send } = latest.current;
      reportedOn.current = false;
      // Servern avgör om seansen har hunnit börja och kontakten bryts.
      if (!current.isComplete) send('lifted');
    }, LIFT_GRACE_MS);
  }

  const status = describeSeanceStatus(seance, nowMs + clockOffsetMs, canTouch);
  const boardAnswer = seance.isComplete ? answer : undefined;
  return (
    <section className="seance" aria-label="Seansen">
      <div className="seance-frame">
        <div
          className="seance-board-image"
          aria-label={canTouch ? 'Brädet. Håll fingret på planchetten och följ den.' : 'Brädet'}
          onPointerDown={press}
          onPointerMove={move}
          onPointerUp={release}
          onPointerCancel={release}
          onContextMenu={(event) => event.preventDefault()}
        >
          <div ref={boardRef} className="seance-board">
            <BoardLetters />
            <div ref={planchetteRef} className="seance-planchette" style={toPercent(START_POINT)} />
          </div>
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
 * Brädet när ingen seans pågår. Har brädet något att säga, som VERA efter att
 * gruppen har svarat, glider planchetten av sig själv, om och om igen
 * (Jonas 2026-11-18). Den räknas ur serverns tid, så att alla mobiler visar
 * samma bokstav. Annars står planchetten stilla på den tomma platsen
 * (Jonas 2026-11-23).
 */
export function EchoBoard({ message, clockOffsetMs }: { message: string | null; clockOffsetMs: number }) {
  const planchetteRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ message, clockOffsetMs });

  useEffect(() => {
    latest.current = { message, clockOffsetMs };
  }, [message, clockOffsetMs]);

  useEffect(() => {
    let frame = 0;
    const draw = () => {
      const { message: current, clockOffsetMs: offset } = latest.current;
      if (planchetteRef.current && current !== null) Object.assign(planchetteRef.current.style, toPercent(findEchoGlowPoint(current, Date.now() + offset)));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <section className="seance" aria-label="Brädet">
      <div className="seance-frame">
        <div className="seance-board-image" aria-label={message === null ? 'Brädet' : 'Brädet. Planchetten rör sig av sig själv.'}>
          <div className="seance-board">
            <BoardLetters />
            <div ref={planchetteRef} className="seance-planchette" style={toPercent(START_POINT)} />
          </div>
        </div>
      </div>
    </section>
  );
}
