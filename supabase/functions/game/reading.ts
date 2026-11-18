/**
 * Det som går att läsa igen, som urklippen i byrån. Den som lämnar dem med
 * Tillbaka har läst dem, och brädet frågar VEM ÄR JAG först när alla har
 * läst och gruppen har sett Rummen minns (Jonas 2026-11-18). Se
 * docs/koncept.md, Tidningsurklippen.
 */

import { type StateChange, advanceStep, moveOn, moveOnIfAllDone } from './game.ts';
import { findReadSteps, hasRead } from './found.ts';
import type { Mission } from './mission.ts';
import type { GameState, PlayerRecord } from './state.ts';

/**
 * Spelaren har lämnat det hon kan läsa igen, som urklippen i byrån, och har
 * därmed läst det. Det räknas också innan berättelsen har kommit dit, och
 * den sista som läser kan föra gruppen vidare (Jonas 2026-11-18).
 */
export function markRead({ state, mission, players, player, thingId }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  thingId: unknown;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const stepIds = findReadSteps(mission, thingId).filter((stepId) => !hasRead(state.foundReaders, stepId, player.id));
  if (stepIds.length === 0) return { state };
  const foundReaders = { ...state.foundReaders };
  for (const stepId of stepIds) foundReaders[stepId] = [...(foundReaders[stepId] ?? []), player.id];
  return { state: moveOnIfAllDone({ ...state, foundReaders }, mission, players) };
}

/**
 * Hoppa över uppgiften i urklippen, som väntar på två saker. Ett tryck räknar
 * alla som lästa och hoppar över Rummen minns om den inte är löst, så att
 * spelledaren inte behöver veta vilka som har läst (Jonas 2026-11-18). I andra
 * steg går gruppen vidare som vanligt.
 */
export function skipReading({ state, mission, players, player, nowMs = 0 }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  /** Serverns tid, för att se om huset minns just nu. */
  nowMs?: number;
}): StateChange {
  const step = mission.steps[state.stepIndex];
  if (!player.isLeader || state.status !== 'running' || step.type !== 'scene' || step.endsWithStep === undefined) return advanceStep({ state, mission, players, player, nowMs });
  const unread = step.foundTitle === undefined ? [] : players.filter((candidate) => !hasRead(state.foundReaders, step.id, candidate.id));
  const foundReaders = { ...state.foundReaders, [step.id]: [...(state.foundReaders[step.id] ?? []), ...unread.map((candidate) => candidate.id)] };
  const solvedSteps = state.solvedSteps.includes(step.endsWithStep) ? state.solvedSteps : [...state.solvedSteps, step.endsWithStep];
  return { state: moveOn({ ...state, foundReaders, solvedSteps }, mission, players) };
}
