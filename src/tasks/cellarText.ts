/** Det som räknas fram ur källarens vy i mobilen. Rena funktioner, så att de går att testa. */

import type { CellarView } from '../../supabase/functions/game/cellar.ts';

/** Hur nära det är, från 0 när den instängda kommer fram till 1 när det når henne. */
export function measureThreat(cellar: CellarView, serverNowMs: number): number {
  if (cellar.catchMs === null) return 0;
  const startMs = cellar.catchMs - cellar.totalMs;
  return Math.min(1, Math.max(0, (serverNowMs - startMs) / cellar.totalMs));
}

const THREAT_WORDS = [
  { from: 0.85, text: 'Det är alldeles intill.' },
  { from: 0.6, text: 'Det är nära nu.' },
  { from: 0.3, text: 'Något rör sig i mörkret.' },
  { from: 0, text: 'Det är tyst i källaren.' },
];

export function describeThreat(threat: number): string {
  return THREAT_WORDS.find((word) => threat >= word.from)?.text ?? '';
}

export function isLampLit(cellar: CellarView, serverNowMs: number): boolean {
  return cellar.litUntilMs !== null && serverNowMs < cellar.litUntilMs;
}

/** Om tiden har gått ut utan att servern vet om det, så att mobilen ska säga till. */
export function hasTimeRunOut(cellar: CellarView, serverNowMs: number): boolean {
  return cellar.outcome === null && cellar.catchMs !== null && serverNowMs >= cellar.catchMs;
}
