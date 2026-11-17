/**
 * Spelet efter väntrummet: att starta, gå vidare i uppdraget och vara på en
 * plats. Rena funktioner som tar ett tillstånd och ger ett nytt, se
 * docs/motorn.md.
 */

import { type ClockView, describeClock, pauseClock, resumeClock, startClock } from './clock.ts';
import { type AnswerStep, type Mission, type MissionStep, type Place, type Role, listPlaces } from './mission.ts';
import { describeViewer, sortByJoinOrder } from './lobby.ts';
import type { PlaceId } from './places.ts';
import { dealRoles } from './roles.ts';
import type { GameRecord, GameState, PlayerRecord } from './state.ts';

export type GameRefusal = 'notLeader' | 'gameStarted' | 'tooFewPlayers' | 'notRunning' | 'unknownPlace' | 'notAtPlace' | 'notATask' | 'wrongAnswer' | 'noMoreHints';

export type StateChange = { state: GameState } | { refusal: GameRefusal };

/** Gruppen kommer till ett steg: rollerna delas ut på nytt, eller tas bort om steget saknar roller. */
function enterStep(state: GameState, mission: Mission, players: readonly PlayerRecord[], stepIndex: number): GameState {
  const cleared = { ...state, stepIndex, readyPlayerIds: [], hintsGiven: 0, isSolutionShown: false };
  const roles = mission.steps[stepIndex].roles;
  if (!roles) return { ...cleared, roleByPlayer: {} };
  const deal = dealRoles({ roles, players: sortByJoinOrder(players), prominentHistory: state.prominentHistory });
  return { ...cleared, roleByPlayer: deal.roleByPlayer, prominentHistory: deal.prominentHistory };
}

function finish(state: GameState): GameState {
  return { ...state, status: 'finished', roleByPlayer: {}, readyPlayerIds: [] };
}

/**
 * Nästa steg, eller slut efter det sista. Är sista steget en scen är den
 * slutet: spelet tar slut när gruppen kommer dit, så att ingen behöver
 * trycka Klar på sluttexten.
 */
function moveOn(state: GameState, mission: Mission, players: readonly PlayerRecord[]): GameState {
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= mission.steps.length) return finish(state);
  const entered = enterStep(state, mission, players, nextIndex);
  const isEnding = nextIndex === mission.steps.length - 1 && mission.steps[nextIndex].type === 'scene';
  return isEnding ? finish(entered) : entered;
}

function findRole(step: MissionStep, state: GameState, playerId: string): Role | undefined {
  const roleId = state.roleByPlayer[playerId]?.roleId;
  return step.roles?.find((role) => role.id === roleId);
}

/**
 * Platsen som spelaren ska till i steget. En roll kan ha en egen plats, så
 * att gruppen delar på sig. Annars gäller stegets plats, om det har någon.
 */
function findGoal(step: MissionStep, state: GameState, playerId: string): PlaceId | undefined {
  return findRole(step, state, playerId)?.goTo ?? step.goTo;
}

function isAtGoal(step: MissionStep, state: GameState, playerId: string): boolean {
  const goal = findGoal(step, state, playerId);
  return goal !== undefined && state.placeByPlayer[playerId] === goal;
}

/**
 * En scen som bara skickar spelarna till en plats är klar när spelaren är
 * framme. Finns något att läsa där trycker spelaren Klar när hon har läst och
 * gjort sitt (Jonas 2026-11-17).
 */
function isDoneWhenArrived(step: MissionStep): boolean {
  const hasRolesWithOwnPlace = step.roles?.some((role) => role.goTo !== undefined) ?? false;
  return step.goTo !== undefined && step.textAtPlace === undefined && !hasRolesWithOwnPlace;
}

/** En scen utan plats att gå till, eller med text på platsen, klaras med Klar. En uppgift klaras genom att lösas. */
function usesReadyButton(step: MissionStep): boolean {
  return step.type === 'scene' && !isDoneWhenArrived(step);
}

function isPlayerDone(step: MissionStep, state: GameState, playerId: string): boolean {
  if (step.type !== 'scene') return false;
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
  if (!usesReadyButton(step)) return { state };
  if (findGoal(step, state, player.id) !== undefined && !isAtGoal(step, state, player.id)) return { refusal: 'notAtPlace' };
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

/** Stora och små bokstäver och extra mellanslag spelar ingen roll i ett svar. */
export function normalizeAnswer(answer: string): string {
  return answer.trim().replace(/\s+/g, ' ').toLocaleLowerCase('sv');
}

/** Den aktuella uppgiften, eller ett nej om gruppen är i en scen eller spelet inte är igång. */
function findCurrentTask(state: GameState, mission: Mission): { step: AnswerStep } | { refusal: GameRefusal } {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const step = mission.steps[state.stepIndex];
  return step.type === 'answer' ? { step } : { refusal: 'notATask' };
}

/** Vem som helst i gruppen kan svara. Ett rätt svar för alla vidare. */
export function submitAnswer({ state, mission, players, answer }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  answer: unknown;
}): StateChange {
  const task = findCurrentTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  const given = typeof answer === 'string' ? normalizeAnswer(answer) : '';
  const isRight = given !== '' && task.step.solution.answers.some((correct) => normalizeAnswer(correct) === given);
  return isRight ? { state: moveOn(state, mission, players) } : { refusal: 'wrongAnswer' };
}

/** Spelledaren ger gruppen nästa ledtråd. Alla får den samtidigt. */
export function giveHint({ state, mission, player }: { state: GameState; mission: Mission; player: PlayerRecord }): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  const task = findCurrentTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  if (state.hintsGiven >= task.step.hints.length) return { refusal: 'noMoreHints' };
  return { state: { ...state, hintsGiven: state.hintsGiven + 1 } };
}

/** Facit visas bara hos spelledaren, och bara när hon ber om det. */
export function showSolution({ state, mission, player }: { state: GameState; mission: Mission; player: PlayerRecord }): StateChange {
  if (!player.isLeader) return { refusal: 'notLeader' };
  const task = findCurrentTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  return { state: { ...state, isSolutionShown: true } };
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
    type: MissionStep['type'];
    /** Om spelaren trycker Klar i steget, eller blir klar av att komma fram. */
    usesReadyButton: boolean;
    isMeDone: boolean;
    /** Ledtrådarna som gruppen har fått, och hur många uppgiften har. */
    hints: string[];
    hintCount: number;
    /** Bara hos spelledaren och bara när hon har bett om det. */
    solution: string | null;
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

/** Spelarens roll och bitar. En roll med egen plats visar bitarna först när spelaren är där. */
function describeRole(step: MissionStep, state: GameState, viewerId: string) {
  const role = findRole(step, state, viewerId);
  const assignment = state.roleByPlayer[viewerId];
  if (!role || !assignment) return null;
  const isHidden = role.goTo !== undefined && !isAtGoal(step, state, viewerId);
  const pieces = isHidden ? [] : assignment.pieceIndexes.map((index) => role.pieces[index]).filter((piece) => piece !== undefined);
  return { title: role.title, pieces };
}

function describeStep(step: MissionStep, state: GameState, places: readonly Place[], viewerId: string) {
  const goal = findGoal(step, state, viewerId);
  const isAtStepPlace = goal === step.goTo && isAtGoal(step, state, viewerId);
  return {
    text: step.text,
    goTo: findPlace(places, goal),
    textAtPlace: isAtStepPlace ? step.textAtPlace ?? null : null,
    role: describeRole(step, state, viewerId),
  };
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
      ...describeStep(step, state, places, viewer.id),
      type: step.type,
      usesReadyButton: usesReadyButton(step),
      isMeDone: isPlayerDone(step, state, viewer.id),
      hints: step.hints?.slice(0, state.hintsGiven) ?? [],
      hintCount: step.hints?.length ?? 0,
      solution: viewer.isLeader && state.isSolutionShown && step.solution ? step.solution.answers[0] : null,
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
