/**
 * Hur länge en inforuta står kvar. Rena funktioner, så att de går att testa.
 */

/** Den kortaste tiden, så att även en kort ledtråd hinner läsas. */
const MIN_MS = 5000;
/** Den längsta tiden, så att rutan inte skymmer saken för länge. */
const MAX_MS = 15_000;
/** Ungefär så lång tid tar ett tecken att läsa högt för gruppen. */
const MS_PER_CHARACTER = 70;

/** Hur länge rutan står kvar, efter hur lång texten är. */
export function readingMs(text: string): number {
  return Math.min(MAX_MS, Math.max(MIN_MS, text.length * MS_PER_CHARACTER));
}
