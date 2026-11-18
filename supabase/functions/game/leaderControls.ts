/**
 * Spelledarens grepp om hela spelet: att pausa och att avsluta. Rena
 * funktioner som tar ett tillstånd och ger ett nytt, se docs/motorn.md.
 */

import { pauseClock, resumeClock } from './clock.ts';
import { type StateChange, finish } from './game.ts';
import type { CellarState } from './cellar.ts';
import type { FlashbackState } from './flashback.ts';
import type { SeanceState } from './seance.ts';
import type { GameState, PlayerRecord } from './state.ts';

/** Pausar eller fortsätter nedräkningen. Bara spelledaren får göra det. */
export function setPaused({ state, player, isPaused, nowMs }: {
  state: GameState;
  player: PlayerRecord;
  isPaused: boolean;
  nowMs: number;
}): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'running' || !state.clock) return { refusal: 'notRunning' };
  if (isPaused) return { state: { ...state, clock: pauseClock(state.clock, nowMs) } };
  const pausedMs = state.clock.pausedAtMs === null ? 0 : Math.max(0, nowMs - state.clock.pausedAtMs);
  return { state: { ...shiftTimers(state, pausedMs), clock: resumeClock(state.clock, nowMs) } };
}

const later = (ms: number | null, byMs: number) => (ms === null ? null : ms + byMs);

/**
 * Pausen stoppar allt som går på tid, inte bara nedräkningen: minnet i
 * Rummen minns, skenet på brädet och källaren. När spelet fortsätter flyttas
 * deras tider fram lika länge som pausen varade, så att inget har hunnit gå
 * under pausen (Jonas 2026-11-18).
 */
function shiftTimers(state: GameState, byMs: number): GameState {
  if (byMs === 0) return state;
  const shiftFlashback = (flashback: FlashbackState): FlashbackState => ({ ...flashback, remembersUntilMs: later(flashback.remembersUntilMs, byMs) });
  const shiftSeance = (seance: SeanceState): SeanceState => ({
    ...seance,
    anchorMs: seance.anchorMs + byMs,
    pauseUntilMs: later(seance.pauseUntilMs, byMs),
    brokenBy: seance.brokenBy && { ...seance.brokenBy, atMs: seance.brokenBy.atMs + byMs },
  });
  const shiftCellar = (cellar: CellarState): CellarState => ({ ...cellar, arrivedAtMs: later(cellar.arrivedAtMs, byMs), litUntilMs: later(cellar.litUntilMs, byMs) });
  return {
    ...state,
    flashback: state.flashback && shiftFlashback(state.flashback),
    seance: state.seance && shiftSeance(state.seance),
    cellar: state.cellar && shiftCellar(state.cellar),
  };
}

/**
 * Spelledaren avslutar spelet för alla, var gruppen än är. Det går inte att
 * ångra. Alla mobiler visar att spelet är slut och glömmer det, som när
 * uppdraget tar slut av sig självt (Jonas 2026-11-18).
 */
export function endGame({ state, player }: { state: GameState; player: PlayerRecord }): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'running') return { refusal: 'notRunning' };
  return { state: { ...finish(state), isEndedByLeader: true } };
}
