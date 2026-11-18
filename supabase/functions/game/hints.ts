/**
 * Ledtrådarna i ett steg. Spelledaren har en knapp, Ge ledtråd, som alltid
 * finns i menyn när gruppen har något olöst, och servern väljer vilken
 * ledtråd som kommer (Jonas 2026-11-18). Först kommer att en sak som ingen
 * har hittat finns i huset, sedan att alla inte har läst urklippen, sedan
 * uppgiftens ledtrådar och sist urklippens. Se docs/koncept.md.
 */

import { type GameRefusal, type StateChange, findAwaitedTask, usesReadyButton } from './game.ts';
import { describeUnreadHint, givesUnreadHint } from './found.ts';
import { type HouseThing, isFound } from './house.ts';
import type { Mission, MissionStep, TaskStep } from './mission.ts';
import type { GameState, PlayerRecord } from './state.ts';

type NextHint = { kind: 'find'; thingId: string } | { kind: 'unread' } | { kind: 'task' } | { kind: 'reading' };

/** Uppgiften vars ledtrådar hör till steget: steget självt, eller uppgiften som en scen väntar på. */
function findHintTask(step: MissionStep, mission: Mission): TaskStep | null {
  if (step.type !== 'scene') return step;
  const awaited = mission.steps.find((candidate) => candidate.id === step.endsWithStep);
  return awaited && awaited.type !== 'scene' ? awaited : null;
}

/** Uppgiften som gruppen kan få hjälp med nu, om den inte redan är klarad. */
export function findOpenTask(step: MissionStep, state: GameState, mission: Mission): TaskStep | null {
  if (step.type === 'scene') return findAwaitedTask(step, state, mission);
  return usesReadyButton(step, state) ? null : step;
}

function listThings(mission: Mission): HouseThing[] {
  return mission.house?.rooms.flatMap((room) => room.things) ?? [];
}

function readingHintsOf(step: MissionStep): string[] {
  return step.type === 'scene' ? step.readingHints ?? [] : [];
}

function findNextHint(step: MissionStep, state: GameState, mission: Mission, participantIds: readonly string[]): NextHint | null {
  if (state.status !== 'running') return null;
  const task = findOpenTask(step, state, mission);
  const readingHints = readingHintsOf(step);
  if (task === null && readingHints.length === 0) return null;
  // Sakerna som steget behöver: den som öppnar steget och den som öppnar uppgiften det väntar på.
  const neededStepIds = [step.id, task?.id];
  const unfound = listThings(mission).find((thing) => thing.findHint !== undefined
    && thing.opensSteps?.some((stepId) => neededStepIds.includes(stepId))
    && !isFound(thing, state) && !state.findHintsGiven.includes(thing.id));
  if (unfound) return { kind: 'find', thingId: unfound.id };
  if (givesUnreadHint(step, state, participantIds)) return { kind: 'unread' };
  if (task && state.hintsGiven < task.hints.length) return { kind: 'task' };
  if (state.readingHintsGiven < readingHints.length) return { kind: 'reading' };
  return null;
}

/** Spelledaren ger gruppen nästa ledtråd. Alla får den samtidigt. */
export function giveHint({ state, mission, players, player }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
}): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const step = mission.steps[state.stepIndex];
  const next = findNextHint(step, state, mission, players.map((candidate) => candidate.id));
  if (!next) {
    const hasHelp = findOpenTask(step, state, mission) !== null || readingHintsOf(step).length > 0;
    return { refusal: (hasHelp ? 'noMoreHints' : 'notATask') satisfies GameRefusal };
  }
  if (next.kind === 'find') return { state: { ...state, findHintsGiven: [...state.findHintsGiven, next.thingId] } };
  if (next.kind === 'unread') return { state: { ...state, isUnreadHintGiven: true } };
  if (next.kind === 'task') return { state: { ...state, hintsGiven: state.hintsGiven + 1 } };
  return { state: { ...state, readingHintsGiven: state.readingHintsGiven + 1 } };
}

export type HintsView = {
  /** Ledtrådarna som gruppen har fått i steget, i den ordning de kom. */
  hints: string[];
  /** Bara hos spelledaren: om gruppen har något olöst som Ge ledtråd hör till. */
  hasHelp: boolean;
  /** Bara hos spelledaren: om det finns fler ledtrådar att ge. */
  canGiveHint: boolean;
};

/**
 * Ledtrådarna i den ordning de ges. Det som hittas kommer alltid först och
 * urklippens skrivna ledtrådar sist, så ordningen går att räkna fram.
 */
export function describeHints({ step, state, mission, participantIds, isLeader }: {
  step: MissionStep;
  state: GameState;
  mission: Mission;
  participantIds: readonly string[];
  isLeader: boolean;
}): HintsView {
  const things = listThings(mission);
  const find = state.findHintsGiven.flatMap((thingId) => things.find((thing) => thing.id === thingId)?.findHint ?? []);
  const unread = state.isUnreadHintGiven && step.type === 'scene' && step.foundTitle !== undefined ? [describeUnreadHint(step.foundTitle)] : [];
  const task = findHintTask(step, mission)?.hints.slice(0, state.hintsGiven) ?? [];
  const written = readingHintsOf(step).slice(0, state.readingHintsGiven);
  const isRunning = state.status === 'running';
  const hasHelp = isLeader && isRunning && (findOpenTask(step, state, mission) !== null || readingHintsOf(step).length > 0);
  return {
    hints: [...find, ...unread, ...task, ...written],
    hasHelp,
    canGiveHint: hasHelp && findNextHint(step, state, mission, participantIds) !== null,
  };
}
