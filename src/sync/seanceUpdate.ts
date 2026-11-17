/**
 * Seansens läge kommer i gruppens kanal, och resten av vyn i spelarens
 * kanal. De två kan komma i fel ordning, så mobilen behåller alltid det
 * nyaste läget av seansen. Rena funktioner utan nät. Se docs/motorn.md.
 */

import { type SeanceView, viewSeanceAs } from '../../supabase/functions/game/seance.ts';
import type { PlayerView, SeanceUpdate } from '../../supabase/functions/game/views.ts';

/** Seansen i vyn, om vyn är i samma spel och samma steg. */
function findSeance(view: PlayerView, gameId: string, stepNumber: number): SeanceView | null {
  if (view.type !== 'game' || view.gameId !== gameId || view.step.number !== stepNumber) return null;
  return view.step.seance;
}

/** Lägger in ett nytt läge från gruppens kanal. Ett äldre läge än det som visas hoppas över. */
export function applySeanceUpdate(view: PlayerView, update: SeanceUpdate): PlayerView {
  const current = findSeance(view, update.gameId, update.stepNumber);
  if (view.type !== 'game' || !current || current.anchorMs > update.seance.anchorMs) return view;
  // Den som inte är med i seansen följer aldrig skenet.
  const seance = viewSeanceAs(update.seance, view.me.isPlaying ? view.me.name : '');
  return { ...view, step: { ...view.step, seance } };
}

/**
 * En ny vy från spelarens kanal eller ett svar från servern. Har gruppens
 * kanal redan gett ett nyare läge av seansen behålls det.
 */
export function keepNewerSeance(previous: PlayerView | null, next: PlayerView): PlayerView {
  if (!previous || next.type !== 'game' || !next.step.seance) return next;
  const current = findSeance(previous, next.gameId, next.step.number);
  if (!current || current.anchorMs <= next.step.seance.anchorMs) return next;
  return { ...next, step: { ...next.step, seance: current } };
}
