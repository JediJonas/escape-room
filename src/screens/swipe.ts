/**
 * Bläddring i en hög med papper. Rena funktioner, så att de går att testa.
 */

/** Så här långt måste fingret dra i sidled för att bläddra, i pixlar. */
export const SWIPE_PX = 50;

/** Vilket papper som ligger överst efter en dragning. Höger till vänster går framåt. */
export function swipeTarget(index: number, count: number, dx: number): number {
  if (dx <= -SWIPE_PX) return Math.min(index + 1, count - 1);
  if (dx >= SWIPE_PX) return Math.max(index - 1, 0);
  return index;
}
