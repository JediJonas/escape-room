/**
 * Pendeln i golvuret, som spelaren gungar med fingret när glasluckan är
 * öppen (Jonas 2026-11-18). Rena funktioner, så att de går att testa.
 */

/** Så här många pixlar i sidled flyttar pendeln en grad. */
const PX_PER_DEGREE = 6;
/** Längre än så här går inte pendeln att dra ut, i grader. */
export const MAX_SWING_DEGREES = 14;
/** Tiden för ett helt fram och tillbaka, i millisekunder. */
const PERIOD_MS = 1600;
/** Hur snabbt gungningen dör ut. Efter så här lång tid är den ungefär en tredjedel. */
const DECAY_MS = 2500;
/** Under så här många grader står pendeln still igen. */
export const REST_DEGREES = 0.3;

/** Pendelns vinkel medan fingret drar den. Åt höger är positivt. */
export function dragPendulum(dx: number): number {
  return Math.max(-MAX_SWING_DEGREES, Math.min(MAX_SWING_DEGREES, dx / PX_PER_DEGREE));
}

/** Pendelns vinkel en stund efter att den släpptes från en vinkel. Gungningen dör ut. */
export function swingPendulum(releasedAt: number, elapsedMs: number): number {
  const angle = releasedAt * Math.exp(-elapsedMs / DECAY_MS) * Math.cos((2 * Math.PI * elapsedMs) / PERIOD_MS);
  return Math.abs(releasedAt * Math.exp(-elapsedMs / DECAY_MS)) < REST_DEGREES ? 0 : angle;
}
