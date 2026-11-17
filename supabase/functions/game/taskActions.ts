/**
 * Handlingarna i uppgifter som har ett eget läge: seansen, golvuret och
 * källaren. Rena funktioner som game.ts, men i en egen fil så att den inte
 * växer med varje ny uppgiftstyp.
 */

import { type CellarMove, applyCellarMove } from './cellar.ts';
import { type GameRefusal, type StateChange, findCurrentTask, findRole, isAtGoal, moveOn } from './game.ts';
import { searchRoom, walk } from './house.ts';
import type { Mission, RoomsStep } from './mission.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import { type RoomsState, advanceRooms, chooseMemoryRoom as chooseRoom, isRemembering, isRoomsSolved, turnClock as turnClockHands } from './rooms.ts';
import { type BoardTouch, applyBoardTouch } from './seance.ts';
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

/** Rummen minns, framförd till nu. Har minnet bleknat efter sista rummet går gruppen vidare. */
function findRoomsTask(state: GameState, mission: Mission, nowMs: number): { step: RoomsStep; rooms: RoomsState } | { refusal: GameRefusal } {
  const task = findCurrentTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  if (task.step.type !== 'rooms' || !state.rooms) return { refusal: 'notATask' };
  return { step: task.step, rooms: advanceRooms(state.rooms, task.step, nowMs) };
}

function saveRooms({ state, mission, players, step, rooms }: { state: GameState; mission: Mission; players: readonly PlayerRecord[]; step: RoomsStep; rooms: RoomsState }): GameState {
  const saved = { ...state, rooms };
  return isRoomsSolved(rooms, step) ? moveOn(saved, mission, players) : saved;
}

/** Rummet där saken som öppnar steget står, till exempel salongen med golvuret. */
function findOpenerPlace(mission: Mission, stepId: string): PlaceId | undefined {
  return mission.house?.rooms.find((room) => room.things.some((thing) => thing.opensStep === stepId))?.place;
}

/** Spelaren vrider golvurets visare. Står de på rätt tid börjar hela huset minnas. */
export function turnClock({ state, mission, players, player, minutes, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  minutes: unknown;
  nowMs: number;
}): StateChange {
  const task = findRoomsTask(state, mission, nowMs);
  if ('refusal' in task) return task;
  const clockPlace = findOpenerPlace(mission, task.step.id);
  if (clockPlace !== undefined && state.placeByPlayer[player.id] !== clockPlace) return { refusal: 'notAtPlace' };
  if (isRoomsSolved(task.rooms, task.step)) return { state: saveRooms({ state, mission, players, step: task.step, rooms: task.rooms }) };
  const turned = turnClockHands({ rooms: task.rooms, step: task.step, minutes, nowMs });
  if ('refusal' in turned) return turned;
  return { state: { ...state, rooms: turned.rooms } };
}

/** Spelaren väljer sitt rum i minnet och står sedan där, också när minnet har bleknat. */
export function chooseMemoryRoom({ state, mission, player, placeId, nowMs }: {
  state: GameState;
  mission: Mission;
  player: PlayerRecord;
  placeId: unknown;
  nowMs: number;
}): StateChange {
  const task = findRoomsTask(state, mission, nowMs);
  if ('refusal' in task) return task;
  const chosen = chooseRoom({ rooms: task.rooms, step: task.step, playerId: player.id, placeId, nowMs });
  if ('refusal' in chosen) return chosen;
  const placeByPlayer = isPlaceId(placeId) ? { ...state.placeByPlayer, [player.id]: placeId } : state.placeByPlayer;
  return { state: { ...state, rooms: chosen.rooms, placeByPlayer } };
}

/**
 * En mobil säger till att minnet har bleknat. Alla mobiler kan säga det,
 * men servern avgör. Har gruppen sett alla rummen går den vidare.
 */
export function fadeMemory({ state, mission, players, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  nowMs: number;
}): StateChange {
  const task = findRoomsTask(state, mission, nowMs);
  if ('refusal' in task) return task;
  if (task.rooms === state.rooms) return { state };
  return { state: saveRooms({ state, mission, players, step: task.step, rooms: task.rooms }) };
}

/** Medan huset minns står var och en kvar i sitt rum, och dörrarna är stängda (Jonas 2026-11-17). */
function isHouseRemembering(state: GameState, mission: Mission, nowMs: number): boolean {
  return mission.steps[state.stepIndex]?.type === 'rooms' && state.rooms !== null && isRemembering(state.rooms, nowMs);
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
  return walk({ state, house: mission.house, playerId: player.id, placeId });
}

/** Spelaren letar i rummet där hon står. Det hon hittar står sedan i rummets lista för alla. */
export function searchHere({ state, mission, player }: { state: GameState; mission: Mission; player: PlayerRecord }): StateChange {
  if (state.status !== 'running') return { refusal: 'notRunning' };
  if (!mission.house) return { refusal: 'unknownPlace' };
  return { state: searchRoom({ state, mission, house: mission.house, playerId: player.id }) };
}
