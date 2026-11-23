/** Hur nedräkningen skrivs. Rena funktioner, så att de går att testa. */

const MS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

/** Skriver tiden kvar som minuter och sekunder, till exempel 59:07. Under noll blir det 0:00. */
export function formatRemaining(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.ceil(remainingMs / MS_PER_SECOND));
  const minutes = Math.floor(totalSeconds / SECONDS_PER_MINUTE);
  const seconds = totalSeconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Klockan blir röd när det är fem minuter kvar (Jonas 2026-11-23). */
const LOW_TIME_MINUTES = 5;
const LOW_TIME_MS = LOW_TIME_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

export function isLowTime(remainingMs: number): boolean {
  return remainingMs <= LOW_TIME_MS;
}
