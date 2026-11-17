/**
 * Spelet efter väntrummet: att starta, gå vidare i uppdraget och vara på en
 * plats. Rena funktioner som tar ett tillstånd och ger ett nytt, se
 * docs/motorn.md.
 */

import { type Mission, type Place, type SceneStep, listPlaces } from './mission.ts';
import { describeViewer, sortByJoinOrder } from './lobby.ts';
import type { PlaceId } from './places.ts';
import { type RoleAssignment, dealRoles } from './roles.ts';
import type { GameRecord, GameState, PlayerRecord } from './state.ts';

export type GameRefusal = 'notLeader' | 'gameStarted' | 'tooFewPlayers' | 'notRunning' | 'unknownPlace';

export type StateChange = { state: GameState } | { refusal: GameRefusal };

/** Gruppen kommer till ett steg: rollerna delas ut på nytt, eller tas bort om steget saknar roller. */
function enterStep(state: GameState, mission: Mission, players: readonly PlayerRecord[], stepIndex: number): GameState {
  const roles = mission.steps[stepIndex].roles;
  if (!roles) return { ...state, stepIndex, roleByPlayer: {} };
  const deal = dealRoles({ roles, players: sortByJoinOrder(players), prominentHistory: state.prominentHistory });
  return { ...state, stepIndex, roleByPlayer: deal.roleByPlayer, prominentHistory: deal.prominentHistory };
}

export function startGame({ state, mission, players, starter, usesPlaceCards }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  starter: PlayerRecord;
  usesPlaceCards: boolean;
}): StateChange {
  if (!starter.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'lobby') return { refusal: 'gameStarted' };
  if (players.length < mission.minPlayers) return { refusal: 'tooFewPlayers' };
  return { state: enterStep({ ...state, status: 'running', usesPlaceCards }, mission, players, 0) };
}

/** Går till nästa steg. Efter det sista är spelet slut. */
export function advanceStep({ state, mission, players, player }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
}): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= mission.steps.length) return { state: { ...state, status: 'finished', roleByPlayer: {} } };
  return { state: enterStep(state, mission, players, nextIndex) };
}

/** Spelaren är på en plats, oavsett om hon skannade kortet eller valde i listan. */
export function choosePlace({ state, mission, player, placeId }: {
  state: GameState;
  mission: Mission;
  player: PlayerRecord;
  placeId: unknown;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const place = listPlaces(mission).find((candidate) => candidate.id === placeId);
  if (!place) return { refusal: 'unknownPlace' };
  return { state: { ...state, placeByPlayer: { ...state.placeByPlayer, [player.id]: place.id } } };
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
  };
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
  const myPlace = findPlace(places, game.state.placeByPlayer[viewer.id]);
  const stepIndex = Math.min(game.state.stepIndex, mission.steps.length - 1);
  return {
    type: 'game',
    gameId: game.id,
    missionTitle: mission.title,
    me: describeViewer(viewer),
    isFinished: game.state.status === 'finished',
    usesPlaceCards: game.state.usesPlaceCards,
    step: { number: stepIndex + 1, count: mission.steps.length, ...describeStep(mission.steps[stepIndex], places, myPlace, game.state.roleByPlayer[viewer.id]) },
    myPlace,
    places,
    playerCount: players.length,
  };
}
