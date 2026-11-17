/**
 * Uppgiftstypen Samtidigt, så som Seansen använder den. Brädet har alla
 * bokstäver, och alla håller sin planchett på ett sken. Skenet glider
 * långsamt mot nästa bokstav i meddelandet, men bara medan allas
 * planchetter följer med. Halkar någon efter stannar det och väntar. Når
 * skenet bokstaven stannar det en stund och bokstaven lyser. Meddelandet
 * skrivs inte ut, så att gruppen själv får prata ihop sig om vad det säger.
 * Lyfter någon fingret börjar meddelandet om (Jonas 2026-11-17).
 *
 * Servern tickar inte. Den sparar var skenet var vid en viss tid och om det
 * rör sig, och räknar fram var det är nu vid varje anrop. Mobilerna räknar
 * på samma sätt och ritar skenet själva. Se docs/motorn.md, Tid.
 *
 * Rena funktioner utan klocka: serverns tid skickas in.
 */

import type { PlayerRecord } from './state.ts';

/** Brädets bokstäver i ordning, rad för rad. Den sista rutan är skenets start och har ingen bokstav. */
export const BOARD_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ';
export const BOARD_COLUMNS = 5;
export const BOARD_ROWS = 6;
export const START_CELL = BOARD_LETTERS.length;

/** Hur fort skenet glider, i rutor per sekund. Långsamt, så att alla hinner följa med (Jonas 2026-11-17). */
const GLOW_CELLS_PER_SECOND = 0.6;
const MS_PER_SECOND = 1000;

/** Hur länge skenet står kvar på en bokstav innan det glider vidare, så att gruppen hinner se och säga den. */
export const GLOW_PAUSE_MS = 3000;

/** Bokstäverna som ett meddelande får ha. Mellanslag skiljer orden. */
export const SEANCE_LETTERS = /^[A-ZÅÄÖ]+( [A-ZÅÄÖ]+)*$/;

const HALF = 0.5;

/** En punkt på brädet, från 0 till 1 åt båda håll. */
export type BoardPoint = { x: number; y: number };

export type SeanceState = {
  /** Bokstaven som skenet är på väg till. Lika med antalet bokstäver när meddelandet är klart. */
  letterIndex: number;
  /** De vars planchett är på skenet. */
  followerIds: string[];
  /** Hur långt skenet har kommit mot bokstaven, från 0 till 1, vid serverns tid anchorMs. */
  progress: number;
  anchorMs: number;
  /** Skenet står kvar på den senaste bokstaven till den här tiden. */
  pauseUntilMs: number | null;
  /** Den som senast bröt kontakten, så att gruppen ser vem som släppte. */
  brokenBy: { playerId: string; atMs: number } | null;
};

/** Det spelaren gör med planchetten. Mobilen avgör själv om planchetten är på skenet. */
export type BoardTouch = 'onGlow' | 'offGlow' | 'lifted' | 'arrived';

export function readBoardTouch(touch: unknown): BoardTouch | null {
  return touch === 'onGlow' || touch === 'offGlow' || touch === 'lifted' || touch === 'arrived' ? touch : null;
}

/** Meddelandets bokstäver utan mellanslag. Skenet stannar bara på bokstäver. */
export function splitMessage(message: string): string[] {
  return [...message.replaceAll(' ', '')];
}

export function findCellCenter(cell: number): BoardPoint {
  const column = cell % BOARD_COLUMNS;
  const row = Math.floor(cell / BOARD_COLUMNS);
  return { x: (column + HALF) / BOARD_COLUMNS, y: (row + HALF) / BOARD_ROWS };
}

/** Avståndet räknas i rutor, så att det blir lika åt båda håll fast rutorna inte är kvadratiska. */
export function measureDistanceInCells(first: BoardPoint, second: BoardPoint): number {
  return Math.hypot((first.x - second.x) * BOARD_COLUMNS, (first.y - second.y) * BOARD_ROWS);
}

/** Sträckan som skenet glider mot en bokstav: från förra bokstaven, eller från starten. */
export type GlowSegment = { from: BoardPoint; to: BoardPoint; durationMs: number };

export function findSegment(letters: readonly string[], letterIndex: number): GlowSegment {
  const findCell = (index: number) => (index < 0 ? START_CELL : BOARD_LETTERS.indexOf(letters[index]));
  const from = findCellCenter(findCell(letterIndex - 1));
  const to = findCellCenter(findCell(letterIndex));
  return { from, to, durationMs: (measureDistanceInCells(from, to) / GLOW_CELLS_PER_SECOND) * MS_PER_SECOND };
}

/** Skenet står still vid starten tills alla följer, så tiden det startar spelar ingen roll. */
export function startSeance(): SeanceState {
  return { letterIndex: 0, followerIds: [], progress: 0, anchorMs: 0, pauseUntilMs: null, brokenBy: null };
}

export function isSeanceComplete(seance: SeanceState, message: string): boolean {
  return seance.letterIndex >= splitMessage(message).length;
}

function isEveryoneFollowing(seance: SeanceState, participantIds: readonly string[]): boolean {
  return participantIds.length > 0 && participantIds.every((id) => seance.followerIds.includes(id));
}

/** När skenet börjar röra sig igen: efter pausen på förra bokstaven, eller när det senast stod still. */
function findMoveStartMs(seance: SeanceState): number {
  return Math.max(seance.anchorMs, seance.pauseUntilMs ?? seance.anchorMs);
}

/**
 * För skenet fram till serverns tid. Rör det sig och når en bokstav är
 * bokstaven tagen, och skenet står kvar en stund innan det glider vidare.
 */
export function advanceSeance({ seance, message, participantIds, nowMs }: {
  seance: SeanceState;
  message: string;
  participantIds: readonly string[];
  nowMs: number;
}): SeanceState {
  const letters = splitMessage(message);
  let current = seance;
  while (!isSeanceComplete(current, message) && isEveryoneFollowing(current, participantIds)) {
    const { durationMs } = findSegment(letters, current.letterIndex);
    const startMs = findMoveStartMs(current);
    const arrivesAtMs = startMs + (1 - current.progress) * durationMs;
    if (arrivesAtMs > nowMs) {
      const progress = durationMs > 0 ? current.progress + Math.max(0, nowMs - startMs) / durationMs : 1;
      return { ...current, progress, anchorMs: nowMs };
    }
    current = { ...current, letterIndex: current.letterIndex + 1, progress: 0, anchorMs: arrivesAtMs, pauseUntilMs: arrivesAtMs + GLOW_PAUSE_MS };
  }
  return { ...current, anchorMs: Math.max(current.anchorMs, nowMs) };
}

/**
 * För in en spelares planchett, efter att skenet har förts fram till nu.
 * Att lyfta fingret bryter kontakten och meddelandet börjar om från starten,
 * men bara om skenet har hunnit röra sig.
 */
export function applyBoardTouch({ seance, message, participantIds, playerId, touch, nowMs }: {
  seance: SeanceState;
  message: string;
  participantIds: readonly string[];
  playerId: string;
  touch: BoardTouch;
  nowMs: number;
}): SeanceState {
  const advanced = advanceSeance({ seance, message, participantIds, nowMs });
  if (isSeanceComplete(advanced, message) || touch === 'arrived') return advanced;
  const others = advanced.followerIds.filter((id) => id !== playerId);
  if (touch === 'lifted') {
    const hasStarted = advanced.letterIndex > 0 || advanced.progress > 0;
    if (!hasStarted) return { ...advanced, followerIds: others };
    return { ...advanced, letterIndex: 0, followerIds: [], progress: 0, anchorMs: nowMs, pauseUntilMs: null, brokenBy: { playerId, atMs: nowMs } };
  }
  return { ...advanced, followerIds: touch === 'onGlow' ? [...others, playerId] : others };
}

/**
 * Om något som spelarna ser har ändrats. Var skenet är räknar mobilerna ut
 * själva, så en handling som bara för skenet fram behöver inga nya vyer.
 */
export function hasSeanceChanged(before: SeanceState, after: SeanceState): boolean {
  return before.letterIndex !== after.letterIndex
    || before.brokenBy?.atMs !== after.brokenBy?.atMs
    || [...before.followerIds].sort().join() !== [...after.followerIds].sort().join();
}

/** Det en spelare ser av seansen. Meddelandet finns inte med, bara rutan där skenet står. */
export type SeanceView = {
  segment: GlowSegment;
  /** Hur långt skenet har kommit mot bokstaven vid serverns tid anchorMs. */
  progress: number;
  anchorMs: number;
  /** Serverns tid då skenet börjar röra sig, eller null om det står still och väntar. */
  movesFromMs: number | null;
  /** Rutan där skenet står efter en tagen bokstav, för att lysa upp bokstaven hos alla. */
  takenCell: number | null;
  letterIndex: number;
  letterCount: number;
  /** Namnen på dem som skenet väntar på, så att gruppen kan ropa på dem (Jonas 2026-11-17). */
  waitingFor: string[];
  isMeOnGlow: boolean;
  isComplete: boolean;
  /** Namnet på den som bröt kontakten senast, och när. */
  brokenBy: { name: string; atMs: number } | null;
};

export function describeSeance({ seance, message, players, participantIds, viewerId }: {
  seance: SeanceState;
  message: string;
  /** Alla i spelet, för namnet på den som bröt kontakten. */
  players: readonly PlayerRecord[];
  participantIds: readonly string[];
  viewerId: string;
}): SeanceView {
  const letters = splitMessage(message);
  const isComplete = isSeanceComplete(seance, message);
  const takenIndex = seance.letterIndex - 1;
  // När meddelandet är klart står skenet kvar på sista bokstaven.
  const segment = findSegment(letters, isComplete ? letters.length - 1 : seance.letterIndex);
  const isMoving = !isComplete && isEveryoneFollowing(seance, participantIds);
  const breaker = players.find((player) => player.id === seance.brokenBy?.playerId);
  return {
    segment,
    progress: isComplete ? 1 : seance.progress,
    anchorMs: seance.anchorMs,
    movesFromMs: isMoving ? findMoveStartMs(seance) : null,
    takenCell: takenIndex >= 0 ? BOARD_LETTERS.indexOf(letters[takenIndex]) : null,
    letterIndex: seance.letterIndex,
    letterCount: letters.length,
    waitingFor: participantIds
      .filter((id) => !seance.followerIds.includes(id))
      .map((id) => players.find((player) => player.id === id)?.name ?? '')
      .filter((name) => name !== ''),
    isMeOnGlow: seance.followerIds.includes(viewerId),
    isComplete,
    brokenBy: seance.brokenBy && breaker ? { name: breaker.name, atMs: seance.brokenBy.atMs } : null,
  };
}

/**
 * Var skenet är vid serverns tid, räknat på samma sätt som på servern, och om
 * det har nått bokstaven. Mobilen ritar skenet med den här.
 */
export function findGlowPoint(seance: SeanceView, serverNowMs: number): { point: BoardPoint; hasArrived: boolean } {
  const { from, to, durationMs } = seance.segment;
  const moved = seance.movesFromMs === null || durationMs <= 0 ? 0 : Math.max(0, serverNowMs - seance.movesFromMs) / durationMs;
  const progress = Math.min(1, seance.progress + moved);
  const isMovingZeroLength = seance.movesFromMs !== null && durationMs <= 0;
  return {
    point: { x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress },
    hasArrived: progress >= 1 || isMovingZeroLength,
  };
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Läser en sparad seans, eller null om den saknas eller är trasig. */
export function readSeanceState(saved: unknown): SeanceState | null {
  if (!saved || typeof saved !== 'object') return null;
  const fields = saved as Record<string, unknown>;
  if (!Number.isInteger(fields.letterIndex) || !isStringList(fields.followerIds)) return null;
  if (!isFiniteNumber(fields.progress) || !isFiniteNumber(fields.anchorMs)) return null;
  const pauseUntilMs = isFiniteNumber(fields.pauseUntilMs) ? fields.pauseUntilMs : null;
  const broken = fields.brokenBy as Record<string, unknown> | null | undefined;
  const brokenBy = broken && typeof broken.playerId === 'string' && isFiniteNumber(broken.atMs) ? { playerId: broken.playerId, atMs: broken.atMs } : null;
  return { letterIndex: fields.letterIndex as number, followerIds: fields.followerIds, progress: fields.progress, anchorMs: fields.anchorMs, pauseUntilMs, brokenBy };
}
