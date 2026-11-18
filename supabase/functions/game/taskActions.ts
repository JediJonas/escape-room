/**
 * Handlingarna i uppgifter som har ett eget läge: seansen, golvuret,
 * källaren och pianot. Rena funktioner som game.ts, men i en egen fil så att den inte
 * växer med varje ny uppgiftstyp.
 */

import { type CellarMove, applyCellarMove } from './cellar.ts';
import { type GameRefusal, type StateChange, findCurrentTask, findGoal, findRole, isAtGoal, markTrappedArrival, moveOn, moveOnIfAllDone } from './game.ts';
import { searchRoom, walk } from './house.ts';
import type { Mission, MissionStep, FlashbackStep } from './mission.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import { type FlashbackState, advanceFlashback, chooseFlashbackRoom as chooseRoom, isRemembering, isFlashbackSolved, snapDial, startFlashback, turnClock as turnClockHands } from './flashback.ts';
import { type BoardTouch, applyBoardTouch } from './seance.ts';
import { isPianoSolved, pressKey, startPiano } from './piano.ts';
import { sortByJoinOrder } from './lobby.ts';
import type { GameState, PlayerRecord } from './state.ts';

/**
 * En spelares planchett i seansen. Den sista som kommer fram till skenet tar
 * bokstaven, och den som lyfter fingret får meddelandet att börja om.
 */
export function touchBoard({ state, mission, players, player, touch, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  touch: BoardTouch;
  nowMs: number;
}): StateChange {
  const task = findCurrentTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  if (task.step.type !== 'seance' || !state.seance) return { refusal: 'notATask' };
  const seance = applyBoardTouch({
    seance: state.seance,
    message: task.step.solution.message,
    participantIds: players.map((participant) => participant.id),
    playerId: player.id,
    touch,
    nowMs,
  });
  return { state: { ...state, seance } };
}

/** Uppdragets första uppgift av en typ, med var i uppdraget den står. */
function findTaskStep<Type extends 'flashback' | 'piano'>(mission: Mission, type: Type): { step: Extract<MissionStep, { type: Type }>; index: number } | null {
  const index = mission.steps.findIndex((step) => step.type === type);
  return index === -1 ? null : { step: mission.steps[index] as Extract<MissionStep, { type: Type }>, index };
}

/** Om gruppen redan har klarat uppgiften, i berättelsen eller innan den kom dit. */
function isTaskDone(state: GameState, step: MissionStep, index: number): boolean {
  return index < state.stepIndex || state.solvedSteps.includes(step.id);
}

/**
 * En uppgift som är klar. Är det steget gruppen är på går den vidare. Annars
 * sparas den, och gruppen går förbi den när berättelsen kommer dit
 * (Jonas 2026-11-18). Väntar scenen före på just den här uppgiften, som
 * urklippen på golvuret, går gruppen vidare förbi båda om alla har läst.
 */
function solveTask(state: GameState, mission: Mission, players: readonly PlayerRecord[], index: number): GameState {
  if (index === state.stepIndex) return moveOn(state, mission, players);
  const saved = { ...state, solvedSteps: [...state.solvedSteps, mission.steps[index].id] };
  const current = mission.steps[state.stepIndex];
  const endsCurrent = current.type === 'scene' && current.endsWithStep === mission.steps[index].id;
  return endsCurrent ? moveOnIfAllDone(saved, mission, players) : saved;
}

/**
 * Rummen minns, framförd till nu. Golvuret går att vrida hela tiden, så
 * minnet kan komma innan berättelsen har kommit dit (Jonas 2026-11-18).
 */
function findFlashbackTask(state: GameState, mission: Mission, nowMs: number): { step: FlashbackStep; index: number; flashback: FlashbackState } | { refusal: GameRefusal } {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const task = findTaskStep(mission, 'flashback');
  if (!task || isTaskDone(state, task.step, task.index)) return { refusal: 'notATask' };
  return { ...task, flashback: advanceFlashback(state.flashback ?? startFlashback(task.step), task.step, nowMs) };
}

function saveFlashback({ state, mission, players, task, flashback }: { state: GameState; mission: Mission; players: readonly PlayerRecord[]; task: { step: FlashbackStep; index: number }; flashback: FlashbackState }): GameState {
  const saved = { ...state, flashback };
  return isFlashbackSolved(flashback, task.step) ? solveTask(saved, mission, players, task.index) : saved;
}

/** Rummet där saken som öppnar steget står, till exempel salongen med golvuret. */
function findOpenerPlace(mission: Mission, stepId: string): PlaceId | undefined {
  return mission.house?.rooms.find((room) => room.things.some((thing) => thing.opensSteps?.includes(stepId)))?.place;
}

function isAtOpener(state: GameState, mission: Mission, player: PlayerRecord, stepId: string): boolean {
  const place = findOpenerPlace(mission, stepId);
  return place === undefined || state.placeByPlayer[player.id] === place;
}

/**
 * Spelaren vrider golvurets visare. Står de på rätt tid börjar hela huset
 * minnas. När gruppen har klarat Rummen minns går visarna fortfarande att
 * vrida, men huset minns inte mer.
 */
export function turnClock({ state, mission, players, player, minutes, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  minutes: unknown;
  nowMs: number;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const flashbackStep = findTaskStep(mission, 'flashback');
  if (!flashbackStep) return { refusal: 'notATask' };
  if (!isAtOpener(state, mission, player, flashbackStep.step.id)) return { refusal: 'notAtPlace' };
  const task = findFlashbackTask(state, mission, nowMs);
  if ('refusal' in task) {
    const isNumber = typeof minutes === 'number' && Number.isFinite(minutes);
    return { state: isNumber && state.flashback ? { ...state, flashback: { ...state.flashback, dialMinutes: snapDial(minutes) } } : state };
  }
  if (isFlashbackSolved(task.flashback, task.step)) return { state: saveFlashback({ state, mission, players, task, flashback: task.flashback }) };
  const turned = turnClockHands({ flashback: task.flashback, step: task.step, minutes, nowMs });
  if ('refusal' in turned) return turned;
  return { state: { ...state, flashback: turned.flashback } };
}

/**
 * Spelaren väljer sitt rum i minnet och står sedan där, också när minnet har
 * bleknat. Tar hon ett rum till står hon kvar i det första.
 */
export function chooseFlashbackRoom({ state, mission, players, player, placeId, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  placeId: unknown;
  nowMs: number;
}): StateChange {
  const task = findFlashbackTask(state, mission, nowMs);
  if ('refusal' in task) return task;
  const chosen = chooseRoom({ flashback: task.flashback, step: task.step, playerId: player.id, participantIds: players.map((participant) => participant.id), placeId, nowMs });
  if ('refusal' in chosen) return chosen;
  const isFirstRoom = !task.flashback.choices.some((choice) => choice.playerId === player.id);
  const placeByPlayer = isFirstRoom && isPlaceId(placeId) ? { ...state.placeByPlayer, [player.id]: placeId } : state.placeByPlayer;
  return { state: { ...state, flashback: chosen.flashback, placeByPlayer } };
}

/**
 * En mobil säger till att minnet har bleknat. Alla mobiler kan säga det,
 * men servern avgör. Har gruppen sett alla rummen går den vidare.
 */
export function fadeFlashback({ state, mission, players, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  nowMs: number;
}): StateChange {
  const task = findFlashbackTask(state, mission, nowMs);
  if ('refusal' in task) return task;
  if (task.flashback === state.flashback) return { state };
  return { state: saveFlashback({ state, mission, players, task, flashback: task.flashback }) };
}

/**
 * En spelare slår an en tangent på pianot, som går att spela på hela tiden.
 * Är de senaste tonerna melodin är uppgiften klar, också innan berättelsen
 * har kommit dit (Jonas 2026-11-18). Efteråt låter tangenterna bara.
 */
export function playKey({ state, mission, players, player, key }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  key: unknown;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const task = findTaskStep(mission, 'piano');
  if (!task) return { refusal: 'notATask' };
  if (!isAtOpener(state, mission, player, task.step.id)) return { refusal: 'notAtPlace' };
  const participantIds = sortByJoinOrder(players).map((participant) => participant.id);
  const piano = state.piano ?? startPiano(null);
  const pressed = pressKey({ piano, step: task.step, playerId: player.id, participantIds, key });
  if ('refusal' in pressed) return pressed;
  if (isTaskDone(state, task.step, task.index)) return { state };
  const played = { ...state, piano: pressed.piano };
  return { state: isPianoSolved(pressed.piano, task.step) ? solveTask(played, mission, players, task.index) : played };
}

/** Medan huset minns står var och en kvar i sitt rum, och dörrarna är stängda (Jonas 2026-11-17). */
function isHouseRemembering(state: GameState, mission: Mission, nowMs: number): boolean {
  return mission.steps.some((step) => step.type === 'flashback') && state.flashback !== null && isRemembering(state.flashback, nowMs);
}

/**
 * En handling i källaren. Hann det fram sätts uppdragets markering, så att
 * senare steg och slut kan läsa den.
 */
export function moveInCellar({ state, mission, player, move, nowMs }: {
  state: GameState;
  mission: Mission;
  player: PlayerRecord;
  move: CellarMove;
  nowMs: number;
}): StateChange {
  const task = findCurrentTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  if (task.step.type !== 'cellar' || !state.cellar) return { refusal: 'notATask' };
  const { step } = task;
  const isTrapped = findRole(step, state, player.id)?.id === step.trappedRoleId;
  const result = applyCellarMove({ cellar: state.cellar, step, move, isTrapped, isTrappedHere: isTrapped && isAtGoal(step, state, player.id), nowMs });
  if ('refusal' in result) return result;
  const isNewlyCaught = result.cellar.outcome === 'caught' && state.cellar.outcome !== 'caught';
  const marks = isNewlyCaught && !state.marks.includes(step.markWhenCaught) ? [...state.marks, step.markWhenCaught] : state.marks;
  return { state: { ...state, cellar: result.cellar, marks } };
}

/** Spelaren går genom en dörr i huset. */
export function walkThroughDoor({ state, mission, player, placeId, nowMs }: {
  state: GameState;
  mission: Mission;
  player: PlayerRecord;
  placeId: unknown;
  nowMs: number;
}): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  if (!mission.house) return { refusal: 'unknownPlace' };
  if (isHouseRemembering(state, mission, nowMs)) return { refusal: 'houseRemembers' };
  // Den låsta källardörren öppnas bara för den som ska ner (Jonas 2026-11-18).
  const mayEnterLocked = findGoal(mission.steps[state.stepIndex], state, player.id) === placeId;
  const walked = walk({ state, house: mission.house, playerId: player.id, placeId, mayEnterLocked });
  return 'state' in walked ? { state: markTrappedArrival(walked.state, mission, player.id, nowMs) } : walked;
}

/** Spelaren letar i rummet där hon står. Det hon hittar står sedan i rummets lista för alla. */
export function searchHere({ state, mission, player }: { state: GameState; mission: Mission; player: PlayerRecord }): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  if (!mission.house) return { refusal: 'unknownPlace' };
  return { state: searchRoom({ state, mission, house: mission.house, playerId: player.id }) };
}
