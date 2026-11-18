/**
 * Spelledarens grepp om hela spelet: att pausa och att avsluta. Rena
 * funktioner som tar ett tillstånd och ger ett nytt, se docs/motorn.md.
 */

import { pauseClock, resumeClock } from './clock.ts';
import { type StateChange, finish } from './game.ts';
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
  const clock = isPaused ? pauseClock(state.clock, nowMs) : resumeClock(state.clock, nowMs);
  return { state: { ...state, clock } };
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
