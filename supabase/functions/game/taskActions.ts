/**
 * Handlingarna i uppgifter som har ett eget läge: seansen, rummen och
 * källaren. Rena funktioner som game.ts, men i en egen fil så att den inte
 * växer med varje ny uppgiftstyp.
 */

import { type CellarMove, applyCellarMove } from './cellar.ts';
import { type StateChange, findCurrentTask, findRole, isAtGoal, moveOn } from './game.ts';
import type { Mission } from './mission.ts';
import { chooseGuest as chooseGuestInRoom, isRoomsSolved } from './rooms.ts';
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

/**
 * Spelaren väljer vem som stod i rummet där hon är. När alla rum har rätt
 * gäst går gruppen vidare.
 */
export function chooseGuest({ state, mission, players, player, guest, nowMs }: {
  state: GameState;
  mission: Mission;
  players: readonly PlayerRecord[];
  player: PlayerRecord;
  guest: unknown;
  nowMs: number;
}): StateChange {
  const task = findCurrentTask(state, mission);
  if ('refusal' in task) return { refusal: task.refusal };
  if (task.step.type !== 'rooms' || !state.rooms) return { refusal: 'notATask' };
  const choice = chooseGuestInRoom({ rooms: state.rooms, step: task.step, playerId: player.id, placeId: state.placeByPlayer[player.id], guest, nowMs });
  if ('refusal' in choice) return choice;
  const chosen = { ...state, rooms: choice.rooms };
  return { state: isRoomsSolved(choice.rooms, task.step) ? moveOn(chosen, mission, players) : chosen };
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
