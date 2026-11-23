/**
 * Uppgiftstypen Samtidigt, så som Seansen använder den. Brädet har alla
 * bokstäver, och en gemensam planchett glider långsamt mot nästa bokstav i
 * meddelandet, men bara medan allas fingrar följer med (Jonas 2026-11-23).
 * Halkar någon efter stannar den och väntar. Når planchetten bokstaven
 * stannar den en stund. Inget lyser och meddelandet
 * skrivs inte ut, så att gruppen själv får prata ihop sig om vad det säger.
 * Lyfter någon fingret börjar meddelandet om (Jonas 2026-11-17).
 *
 * Servern tickar inte. Den sparar var planchetten var vid en viss tid och om
 * den rör sig, och räknar fram var den är nu vid varje anrop. Mobilerna
 * räknar på samma sätt och ritar planchetten själva. Se docs/motorn.md, Tid.
 * I koden heter planchettens väg glow, efter skenet som fanns före
 * planchetten.
 *
 * Rena funktioner utan klocka: serverns tid skickas in.
 */

import type { PlayerRecord } from './state.ts';

/** Brädets bokstäver i ordning, rad för rad. Den sista rutan är planchettens start och har ingen bokstav. */
export const BOARD_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÅÄÖ';
export const BOARD_COLUMNS = 5;
export const BOARD_ROWS = 6;
export const START_CELL = BOARD_LETTERS.length;

/** Hur fort planchetten glider, i rutor per sekund. Långsamt, så att alla hinner följa med (Jonas 2026-11-17). */
const GLOW_CELLS_PER_SECOND = 0.6;
const MS_PER_SECOND = 1000;

/** Hur länge planchetten står kvar på en bokstav innan den glider vidare, så att gruppen hinner se och säga den. */
export const GLOW_PAUSE_MS = 3000;

/** Bokstäverna som ett meddelande får ha. Mellanslag skiljer orden. */
export const SEANCE_LETTERS = /^[A-ZÅÄÖ]+( [A-ZÅÄÖ]+)*$/;

const HALF = 0.5;

/** En punkt på brädet, från 0 till 1 åt båda håll. */
export type BoardPoint = { x: number; y: number };

export type SeanceState = {
  /** Bokstaven som planchetten är på väg till. Lika med antalet bokstäver när meddelandet är klart. */
  letterIndex: number;
  /** De vars finger är på planchetten. */
  followerIds: string[];
  /** Hur långt planchetten har kommit mot bokstaven, från 0 till 1, vid serverns tid anchorMs. */
  progress: number;
  anchorMs: number;
  /** Planchetten står kvar på den senaste bokstaven till den här tiden. */
  pauseUntilMs: number | null;
  /** Den som senast bröt kontakten, så att gruppen ser vem som släppte. */
  brokenBy: { playerId: string; atMs: number } | null;
};

/** Det spelaren gör med fingret. Mobilen avgör själv om fingret är på planchetten. */
export type BoardTouch = 'onGlow' | 'offGlow' | 'lifted' | 'arrived';

export function readBoardTouch(touch: unknown): BoardTouch | null {
  return touch === 'onGlow' || touch === 'offGlow' || touch === 'lifted' || touch === 'arrived' ? touch : null;
}

/** Meddelandets bokstäver utan mellanslag. Planchetten stannar bara på bokstäver. */
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

/** Sträckan som planchetten glider mot en bokstav: från förra bokstaven, eller från starten. */
export type GlowSegment = { from: BoardPoint; to: BoardPoint; durationMs: number };

function findSegmentBetween(fromCell: number, toCell: number): GlowSegment {
  const from = findCellCenter(fromCell);
  const to = findCellCenter(toCell);
  return { from, to, durationMs: (measureDistanceInCells(from, to) / GLOW_CELLS_PER_SECOND) * MS_PER_SECOND };
}

export function findSegment(letters: readonly string[], letterIndex: number): GlowSegment {
  const findCell = (index: number) => (index < 0 ? START_CELL : BOARD_LETTERS.indexOf(letters[index]));
  return findSegmentBetween(findCell(letterIndex - 1), findCell(letterIndex));
}

/** Planchetten står still vid starten tills alla följer, så tiden den startar spelar ingen roll. */
export function startSeance(): SeanceState {
  return { letterIndex: 0, followerIds: [], progress: 0, anchorMs: 0, pauseUntilMs: null, brokenBy: null };
}

export function isSeanceComplete(seance: SeanceState, message: string): boolean {
  return seance.letterIndex >= splitMessage(message).length;
}

function isEveryoneFollowing(seance: SeanceState, participantIds: readonly string[]): boolean {
  return participantIds.length > 0 && participantIds.every((id) => seance.followerIds.includes(id));
}

/** När planchetten börjar röra sig igen: efter pausen på förra bokstaven, eller när den senast stod still. */
function findMoveStartMs(seance: SeanceState): number {
  return Math.max(seance.anchorMs, seance.pauseUntilMs ?? seance.anchorMs);
}

/**
 * För planchetten fram till serverns tid. Rör den sig och når en bokstav är
 * bokstaven tagen, och planchetten står kvar en stund innan den glider vidare.
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
 * För in en spelares finger, efter att planchetten har förts fram till nu.
 * Att lyfta fingret bryter kontakten och meddelandet börjar om från starten,
 * men bara om planchetten har hunnit röra sig.
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
 * Om något som spelarna ser har ändrats. Var planchetten är räknar mobilerna
 * ut själva, så en handling som bara för planchetten fram behöver inga nya vyer.
 */
export function hasSeanceChanged(before: SeanceState, after: SeanceState): boolean {
  return before.letterIndex !== after.letterIndex
    || before.brokenBy?.atMs !== after.brokenBy?.atMs
    || [...before.followerIds].sort().join() !== [...after.followerIds].sort().join();
}

/**
 * Det alla ser av seansen. Meddelandet finns inte med, bara rutan där planchetten
 * står. Det är samma för alla, så servern kan skicka det en gång i gruppens
 * kanal i stället för en vy till varje spelare (Jonas 2026-11-17).
 */
export type SharedSeanceView = {
  segment: GlowSegment;
  /** Hur långt planchetten har kommit mot bokstaven vid serverns tid anchorMs. */
  progress: number;
  /** Serverns tid för läget. Den växer med varje ändring, så mobilen kan se vilket läge som är nyast. */
  anchorMs: number;
  /** Serverns tid då planchetten börjar röra sig, eller null om den står still och väntar. */
  movesFromMs: number | null;
  letterIndex: number;
  letterCount: number;
  /** Namnen på dem som planchetten väntar på, så att gruppen kan ropa på dem (Jonas 2026-11-17). */
  waitingFor: string[];
  /**
   * Namnen på dem vars finger är på planchetten, i den ordning de kom dit. Varje
   * mobil ser själv om hennes namn finns med. Namnen är unika i ett spel, och
   * ingen vy får innehålla någon annans id.
   */
  followers: string[];
  isComplete: boolean;
  /** Namnet på den som bröt kontakten senast, och när. */
  brokenBy: { name: string; atMs: number } | null;
};

/** Det en spelare ser av seansen: det alla ser och om hennes egen planchett räknas. */
export type SeanceView = SharedSeanceView & {
  isMeOnGlow: boolean;
  /** Var i ordningen spelaren kom till planchetten, från 0, eller null om hon inte följer. */
  myFollowOrder: number | null;
};

export function describeSharedSeance({ seance, message, players, participantIds }: {
  seance: SeanceState;
  message: string;
  /** Alla i spelet, för namnet på den som bröt kontakten. */
  players: readonly PlayerRecord[];
  participantIds: readonly string[];
}): SharedSeanceView {
  const letters = splitMessage(message);
  const isComplete = isSeanceComplete(seance, message);
  // När meddelandet är klart står planchetten kvar på sista bokstaven hos servern.
  const segment = findSegment(letters, isComplete ? letters.length - 1 : seance.letterIndex);
  const isMoving = !isComplete && isEveryoneFollowing(seance, participantIds);
  const breaker = players.find((player) => player.id === seance.brokenBy?.playerId);
  const findName = (id: string) => players.find((player) => player.id === id)?.name ?? '';
  return {
    segment,
    progress: isComplete ? 1 : seance.progress,
    anchorMs: seance.anchorMs,
    movesFromMs: isMoving ? findMoveStartMs(seance) : null,
    letterIndex: seance.letterIndex,
    letterCount: letters.length,
    waitingFor: participantIds
      .filter((id) => !seance.followerIds.includes(id))
      .map(findName)
      .filter((name) => name !== ''),
    followers: seance.followerIds.map(findName).filter((name) => name !== ''),
    isComplete,
    brokenBy: seance.brokenBy && breaker ? { name: breaker.name, atMs: seance.brokenBy.atMs } : null,
  };
}

/** Det spelaren ser, räknat ur det alla ser. Mobilen gör samma sak när läget kommer i gruppens kanal. */
export function viewSeanceAs(shared: SharedSeanceView, viewerName: string): SeanceView {
  const order = shared.followers.indexOf(viewerName);
  return { ...shared, isMeOnGlow: order >= 0, myFollowOrder: order >= 0 ? order : null };
}

export function describeSeance(input: Parameters<typeof describeSharedSeance>[0] & { viewerId: string }): SeanceView {
  const viewerName = input.players.find((player) => player.id === input.viewerId)?.name ?? '';
  return viewSeanceAs(describeSharedSeance(input), viewerName);
}

/**
 * Var planchetten är vid serverns tid, räknat på samma sätt som på servern,
 * och om den har nått bokstaven. Mobilen ritar planchetten med den här.
 */
export function findGlowProgress(seance: SeanceView, serverNowMs: number): number {
  const { durationMs } = seance.segment;
  if (seance.movesFromMs === null) return seance.progress;
  // En sträcka utan längd, när samma bokstav kommer två gånger, är framme direkt.
  if (durationMs <= 0) return 1;
  return Math.min(1, seance.progress + Math.max(0, serverNowMs - seance.movesFromMs) / durationMs);
}

/** Punkten på sträckan, där 0 är början och 1 är bokstaven. */
/**
 * Hur stor del av planchettens fart som är jämn. Resten följer en mjuk kurva, så
 * att planchetten börjar sakta, går fortast mitt på sträckan och bromsar in mot
 * bokstaven (Jonas 2026-11-17). Det börjar då med 30 procent av medelfarten
 * och går som fortast med 135 procent.
 */
const STEADY_SHARE = 0.3;
const SMOOTHSTEP_SQUARE = 3;

/** Var på sträckan planchetten syns, när en viss del av tiden har gått. Tiden går jämnt, men farten varierar. */
export function easeGlow(progress: number): number {
  // Kurvan smoothstep: 3p² − 2p³.
  const smooth = progress * progress * (SMOOTHSTEP_SQUARE - 2 * progress);
  return STEADY_SHARE * progress + (1 - STEADY_SHARE) * smooth;
}

export function findPointOnSegment(segment: GlowSegment, progress: number): BoardPoint {
  const { from, to } = segment;
  const share = easeGlow(progress);
  return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share };
}

/** Hur länge planchetten vilar vid starten innan brädet bokstaverar ekot igen. */
export const ECHO_REST_MS = 5000;

/** Ekots sträckor: till varje bokstav och sist tillbaka till starten, med vilan efter var och en. */
function listEchoLegs(message: string): { segment: GlowSegment; restMs: number }[] {
  const letters = splitMessage(message);
  return [
    ...letters.map((_, index) => ({ segment: findSegment(letters, index), restMs: GLOW_PAUSE_MS })),
    { segment: findSegmentBetween(BOARD_LETTERS.indexOf(letters[letters.length - 1]), START_CELL), restMs: ECHO_REST_MS },
  ];
}

/** Hur lång tid ett varv av ekot tar. */
export function findEchoLapMs(message: string): number {
  return listEchoLegs(message).reduce((sum, leg) => sum + leg.segment.durationMs + leg.restMs, 0);
}

/**
 * Planchetten när brädet bokstaverar av sig självt, om och om igen, som VERA efter
 * att gruppen har svarat (Jonas 2026-11-18). Den glider som i seansen och
 * stannar på varje bokstav, går tillbaka till starten och vilar där. Allt
 * räknas ur serverns tid, så att brädet visar samma sak i alla mobiler utan
 * att något skickas.
 */
export function findEchoGlowPoint(message: string, serverNowMs: number): BoardPoint {
  const legs = listEchoLegs(message);
  const lapMs = findEchoLapMs(message);
  let leftMs = ((serverNowMs % lapMs) + lapMs) % lapMs;
  for (const { segment, restMs } of legs) {
    if (leftMs < segment.durationMs) return findPointOnSegment(segment, leftMs / segment.durationMs);
    leftMs -= segment.durationMs;
    if (leftMs < restMs) return segment.to;
    leftMs -= restMs;
  }
  return findCellCenter(START_CELL);
}

export function findGlowPoint(seance: SeanceView, serverNowMs: number): { point: BoardPoint; hasArrived: boolean } {
  const progress = findGlowProgress(seance, serverNowMs);
  return { point: findPointOnSegment(seance.segment, progress), hasArrived: progress >= 1 };
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
