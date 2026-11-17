/**
 * Spelet efter väntrummet: att starta, gå vidare i uppdraget och vara på en
 * plats. Rena funktioner som tar ett tillstånd och ger ett nytt, se
 * docs/motorn.md.
 */

import { type ClockView, describeClock, pauseClock, resumeClock, startClock } from './clock.ts';
import { type Mission, type Place, type SceneStep, listPlaces } from './mission.ts';
import { describeViewer, sortByJoinOrder } from './lobby.ts';
import type { PlaceId } from './places.ts';
import { type RoleAssignment, dealRoles } from './roles.ts';
import type { GameRecord, GameState, PlayerRecord } from './state.ts';

export type GameRefusal = 'notLeader' | 'gameStarted' | 'tooFewPlayers' | 'notRunning' | 'unknownPlace' | 'notAtPlace';

export type StateChange = { state: GameState } | { refusal: GameRefusal };

/** Gruppen kommer till ett steg: rollerna delas ut på nytt, eller tas bort om steget saknar roller. */
function enterStep(state: GameState, mission: Mission, players: readonly PlayerRecord[], stepIndex: number): GameState {
  const cleared = { ...state, stepIndex, readyPlayerIds: [] };
  const roles = mission.steps[stepIndex].roles;
  if (!roles) return { ...cleared, roleByPlayer: {} };
  const deal = dealRoles({ roles, players: sortByJoinOrder(players), prominentHistory: state.prominentHistory });
  return { ...cleared, roleByPlayer: deal.roleByPlayer, prominentHistory: deal.prominentHistory };
}

/** Nästa steg, eller slut efter det sista. */
function moveOn(state: GameState, mission: Mission, players: readonly PlayerRecord[]): GameState {
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= mission.steps.length) return { ...state, status: 'finished', roleByPlayer: {}, readyPlayerIds: [] };
  return enterStep(state, mission, players, nextIndex);
}

function isAtGoal(step: SceneStep, state: GameState, playerId: string): boolean {
  return step.goTo !== undefined && state.placeByPlayer[playerId] === step.goTo;
}

/**
 * En scen som bara skickar spelarna till en plats är klar när spelaren är
 * framme. Annars trycker spelaren Klar när hon har läst och gjort sitt
 * (Jonas 2026-11-17).
 */
function isDoneWhenArrived(step: SceneStep): boolean {
  return step.goTo !== undefined && step.textAtPlace === undefined;
}

function isPlayerDone(step: SceneStep, state: GameState, playerId: string): boolean {
  return isDoneWhenArrived(step) ? isAtGoal(step, state, playerId) : state.readyPlayerIds.includes(playerId);
}

/** Går vidare när alla är klara, så att ingen behöver vänta på spelledaren. */
function moveOnIfAllDone(state: GameState, mission: Mission, players: readonly PlayerRecord[]): GameState {
  const step = mission.steps[state.stepIndex];
  const isAllDone = state.status === 'running' && players.length > 0 && players.every((player) => isPlayerDone(step, state, player.id));
  return isAllDone ? moveOn(state, mission, players) : state;
}

export function startGame({ state, mission, players, starter, usesPlaceCards, minutes, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  starter: PlayerRecord;
  usesPlaceCards: boolean;
  minutes: number;
  nowMs: number;
}): StateChange {
  if (!starter.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'lobby') return { refusal: 'gameStarted' };
  if (players.length < mission.minPlayers) return { refusal: 'tooFewPlayers' };
  return { state: enterStep({ ...state, status: 'running', usesPlaceCards, clock: startClock(minutes, nowMs) }, mission, players, 0) };
}

/** Spelledaren går vidare utan att vänta på alla, till exempel när någon har gått iväg. */
export function advanceStep({ state, mission, players, player }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
}): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'running') return { refusal: 'notRunning' };
  return { state: moveOn(state, mission, players) };
}

/** Spelaren har läst och gjort sitt i steget. Den sista som blir klar för gruppen vidare. */
export function markReady({ state, mission, players, player }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const step = mission.steps[state.stepIndex];
  if (step.goTo !== undefined && !isAtGoal(step, state, player.id)) return { refusal: 'notAtPlace' };
  if (state.readyPlayerIds.includes(player.id)) return { state };
  return { state: moveOnIfAllDone({ ...state, readyPlayerIds: [...state.readyPlayerIds, player.id] }, mission, players) };
}

/** Spelaren är på en plats, oavsett om hon skannade kortet eller valde i listan. */
export function choosePlace({ state, mission, players, player, placeId }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  placeId: unknown;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const place = listPlaces(mission).find((candidate) => candidate.id === placeId);
  if (!place) return { refusal: 'unknownPlace' };
  return { state: moveOnIfAllDone({ ...state, placeByPlayer: { ...state.placeByPlayer, [player.id]: place.id } }, mission, players) };
}

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
 * Det en spelare ser under spelet. Texten på en plats finns bara med hos den
 * som är där.
 */
export type GameView = {
  type: 'game';
  gameId: string;
  missionTitle: string;
  me: { playerId: string; name: string; isLeader: boolean };
  isFinished: boolean;
  usesPlaceCards: boolean;
  step: {
    number: number;
    count: number;
    text: string;
    goTo: Place | null;
    textAtPlace: string | null;
    /** Spelarens roll i steget och bara hennes egna bitar. */
    role: { title: string; pieces: string[] } | null;
    /** Om spelaren trycker Klar i steget, eller blir klar av att komma fram. */
    usesReadyButton: boolean;
    isMeDone: boolean;
  };
  /** Bara hos spelledaren: vilka som är klara med steget. */
  progress: { name: string; isMe: boolean; isDone: boolean }[] | null;
  clock: ClockView | null;
  myPlace: Place | null;
  places: Place[];
  /** Antal spelare, så att spelledaren ser att alla är kvar. */
  playerCount: number;
};

function findPlace(places: readonly Place[], placeId: PlaceId | undefined): Place | null {
  return places.find((place) => place.id === placeId) ?? null;
}

function describeRole(step: SceneStep, assignment: RoleAssignment | undefined) {
  const role = step.roles?.find((candidate) => candidate.id === assignment?.roleId);
  if (!role || !assignment) return null;
  return { title: role.title, pieces: assignment.pieceIndexes.map((index) => role.pieces[index]).filter((piece) => piece !== undefined) };
}

function describeStep(step: SceneStep, places: readonly Place[], myPlace: Place | null, assignment: RoleAssignment | undefined) {
  const goTo = findPlace(places, step.goTo);
  const isAtPlace = goTo !== null && myPlace?.id === goTo.id;
  return { text: step.text, goTo, textAtPlace: isAtPlace ? step.textAtPlace ?? null : null, role: describeRole(step, assignment) };
}

export function buildGameView({ game, mission, players, viewer }: {
  game: GameRecord;
  mission: Mission;
  players: readonly PlayerRecord[];
  viewer: PlayerRecord;
}): GameView {
  const places = listPlaces(mission);
  const { state } = game;
  const myPlace = findPlace(places, state.placeByPlayer[viewer.id]);
  const stepIndex = Math.min(state.stepIndex, mission.steps.length - 1);
  const step = mission.steps[stepIndex];
  const isRunning = state.status === 'running';
  return {
    type: 'game',
    gameId: game.id,
    missionTitle: mission.title,
    me: describeViewer(viewer),
    isFinished: state.status === 'finished',
    usesPlaceCards: state.usesPlaceCards,
    step: {
      number: stepIndex + 1,
      count: mission.steps.length,
      ...describeStep(step, places, myPlace, state.roleByPlayer[viewer.id]),
      usesReadyButton: !isDoneWhenArrived(step),
      isMeDone: isPlayerDone(step, state, viewer.id),
    },
    progress: viewer.isLeader && isRunning
      ? sortByJoinOrder(players).map((player) => ({ name: player.name, isMe: player.id === viewer.id, isDone: isPlayerDone(step, state, player.id) }))
      : null,
    clock: isRunning && state.clock ? describeClock(state.clock) : null,
    myPlace,
    places,
    playerCount: players.length,
  };
}
