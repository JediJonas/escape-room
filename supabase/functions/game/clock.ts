/**
 * Gruppens nedräkning. Servern sparar starttiden och hur länge spelet har
 * varit pausat, och mobilen räknar ner själv. Se docs/motorn.md, Tid.
 */

const MS_PER_MINUTE = 60_000;

/** Speltiderna som spelledaren kan välja, se docs/koncept.md, Tiden. */
const SHORT_GAME_MINUTES = 45;
export const DEFAULT_GAME_MINUTES = 60;
const LONG_GAME_MINUTES = 75;
export const GAME_MINUTES = [SHORT_GAME_MINUTES, DEFAULT_GAME_MINUTES, LONG_GAME_MINUTES] as const;

export type GameClock = {
  durationMs: number;
  startedAtMs: number;
  /** Satt medan spelet är pausat. */
  pausedAtMs: number | null;
  /** Hur länge spelet har varit pausat före den pågående pausen. */
  pausedTotalMs: number;
};

/** Det mobilen behöver för att räkna ner. Beror inte på när vyn byggs. */
export type ClockView =
  | { isPaused: false; endsAtMs: number }
  | { isPaused: true; remainingMs: number };

/** Ett okänt antal minuter blir standardtiden, så att ett gammalt anrop ändå startar. */
export function readGameMinutes(minutes: unknown): number {
  return GAME_MINUTES.find((allowed) => allowed === minutes) ?? DEFAULT_GAME_MINUTES;
}

export function startClock(minutes: number, nowMs: number): GameClock {
  return { durationMs: minutes * MS_PER_MINUTE, startedAtMs: nowMs, pausedAtMs: null, pausedTotalMs: 0 };
}

/** Drar av tid från nedräkningen, till exempel för ett fel svar. */
export function shortenClock(clock: GameClock, minutes: number): GameClock {
  return { ...clock, durationMs: clock.durationMs - minutes * MS_PER_MINUTE };
}

/** Att pausa ett pausat spel ändrar ingenting. */
export function pauseClock(clock: GameClock, nowMs: number): GameClock {
  return clock.pausedAtMs === null ? { ...clock, pausedAtMs: nowMs } : clock;
}

export function resumeClock(clock: GameClock, nowMs: number): GameClock {
  if (clock.pausedAtMs === null) return clock;
  return { ...clock, pausedAtMs: null, pausedTotalMs: clock.pausedTotalMs + Math.max(0, nowMs - clock.pausedAtMs) };
}

export function describeClock(clock: GameClock): ClockView {
  const endsAtMs = clock.startedAtMs + clock.pausedTotalMs + clock.durationMs;
  if (clock.pausedAtMs === null) return { isPaused: false, endsAtMs };
  return { isPaused: true, remainingMs: endsAtMs - clock.pausedAtMs };
}

/** Tid kvar enligt serverns klocka. Blir negativ när tiden har gått ut. */
export function findRemainingMs(clock: ClockView, serverNowMs: number): number {
  return clock.isPaused ? clock.remainingMs : clock.endsAtMs - serverNowMs;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Läser en sparad klocka, eller null om den saknas eller är trasig. */
export function readGameClock(saved: unknown): GameClock | null {
  if (!saved || typeof saved !== 'object') return null;
  const fields = saved as Record<string, unknown>;
  if (!isFiniteNumber(fields.durationMs) || !isFiniteNumber(fields.startedAtMs) || !isFiniteNumber(fields.pausedTotalMs)) return null;
  if (fields.pausedAtMs !== null && !isFiniteNumber(fields.pausedAtMs)) return null;
  return { durationMs: fields.durationMs, startedAtMs: fields.startedAtMs, pausedAtMs: fields.pausedAtMs, pausedTotalMs: fields.pausedTotalMs };
}
