/**
 * Läckkontrollen: spelar varje uppdrag med alla gruppstorlekar och letar i
 * varje vy efter det som spelaren inte ska se. Se docs/motorn.md, Vyn och
 * läckkontrollen.
 */

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, choosePlace, giveHint, showSolution, startGame } from './game.ts';
import { chooseMemoryRoom, moveInCellar, playKey, touchBoard, turnClock } from './taskActions.ts';
import { dealKeys } from './piano.ts';
import { sortByJoinOrder } from './lobby.ts';
import { MAX_PLAYERS } from './lobby.ts';
import { readDialTime } from './rooms.ts';
import { listParticipants } from './participants.ts';
import { type Mission, listPlaces, listSolutionTexts } from './mission.ts';
import { MISSIONS } from './missions/index.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

function createPlayers(count: number): PlayerRecord[] {
  return Array.from({ length: count }, (_, index) => ({ id: `player-${index}`, gameId: 'g', userId: `user-${index}`, name: `Spelare ${index}`, isLeader: index === 0, joinedAtMs: index }));
}

function readState(change: ReturnType<typeof startGame>): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

function findLongestPartWithoutName(text: string): string {
  return text.split('{name}').reduce((longest, part) => (part.length > longest.length ? part : longest), '');
}

/** Varje text i steget som bara vissa ska se: platsens text, alla bitar, ledtrådarna och facit. */
function listSecrets(mission: Mission, stepIndex: number): string[] {
  const step = mission.steps[stepIndex];
  return [
    ...(step.textAtPlace ? [step.textAtPlace] : []),
    ...(step.roles ?? []).flatMap((role) => role.pieces),
    ...(step.hints ?? []),
    ...listSolutionTexts(step, listPlaces(mission)),
    ...(step.type === 'rooms' ? step.rooms.flatMap((room) => room.pieces) : []),
    // Texterna efteråt har den instängdas namn i sig, så den längsta delen utan namnet räcker.
    ...(step.type === 'cellar' ? [step.foundText, step.othersFoundText, step.caughtText].map(findLongestPartWithoutName) : []),
  ];
}

/** Platsen som spelaren ska till: rollens egen plats, annars stegets. */
function findGoal(mission: Mission, state: GameState, player: PlayerRecord) {
  const step = mission.steps[state.stepIndex];
  const role = step.roles?.find((candidate) => candidate.id === state.roleByPlayer[player.id]?.roleId);
  return role?.goTo ?? step.goTo;
}

function isAtGoal(mission: Mission, state: GameState, player: PlayerRecord): boolean {
  const goal = findGoal(mission, state, player);
  return goal !== undefined && state.placeByPlayer[player.id] === goal;
}

function goToGoals(mission: Mission, state: GameState, players: PlayerRecord[], movers: PlayerRecord[]): GameState {
  let moved = state;
  for (const player of movers) {
    const goal = findGoal(mission, moved, player);
    if (goal) moved = readState(choosePlace({ state: moved, mission, players, player, placeId: goal, nowMs: 0 }));
  }
  return moved;
}

function checkStep(mission: Mission, state: GameState, players: PlayerRecord[]) {
  const game = { id: 'g', joinCode: 'BCDF', missionId: mission.id, state };
  const secrets = listSecrets(mission, state.stepIndex);
  const shown = new Set<string>();
  for (const viewer of players) {
    const view = buildGameView({ game, mission, players, viewer });
    const text = JSON.stringify(view);
    const allowed = new Set([
      ...(view.step.role?.pieces ?? []),
      ...listMemoryPieces(view),
      // Texten efteråt i källaren är bara den som spelaren själv ska se.
      ...secrets.filter((secret) => view.step.cellar?.outcomeText?.includes(secret)),
      ...(view.step.textAtPlace ? [view.step.textAtPlace] : []),
      ...view.step.hints,
      // Facit får bara synas hos spelledaren, och bara när hon har bett om det.
      ...(viewer.isLeader && state.isSolutionShown ? listSolutionTexts(mission.steps[state.stepIndex], view.places) : []),
    ]);
    for (const secret of secrets) {
      if (text.includes(secret)) assert.ok(allowed.has(secret), `${mission.id} steg ${state.stepIndex + 1}, ${viewer.name} ser någon annans: ${secret}`);
    }
    // Melodin finns bara i mobilen som spelar den.
    if (view.step.piano?.melody) assert.equal(state.piano?.melodyPlayerId, viewer.id, `${viewer.name} får melodin fast den spelas från en annan mobil`);
    // Ingen vy berättar något om de andra spelarna.
    for (const other of players.filter((player) => player.id !== viewer.id)) assert.ok(!text.includes(other.id), `${viewer.name} ser ${other.id}`);
    for (const piece of [...(view.step.role?.pieces ?? []), ...listMemoryPieces(view)]) {
      assert.ok(!shown.has(piece), `${mission.id} steg ${state.stepIndex + 1}: två spelare ser samma bit: ${piece}`);
      shown.add(piece);
    }
  }
  // Alla bitar som behövs finns hos någon.
  for (const role of mission.steps[state.stepIndex].roles ?? []) {
    const roleHolders = players.filter((player) => state.roleByPlayer[player.id]?.roleId === role.id);
    // En roll med egen plats visar bitarna först där, så de räknas när alla är framme.
    if (role.goTo !== undefined && !roleHolders.every((player) => isAtGoal(mission, state, player))) continue;
    const holders = roleHolders.length;
    const reachable = Math.min(role.pieces.length, holders * (role.maxPiecesPerPlayer ?? role.pieces.length));
    // De viktigaste bitarna, de första, ska alltid finnas hos någon.
    assert.ok(role.pieces.slice(0, reachable).every((piece) => shown.has(piece)), `${mission.id} steg ${state.stepIndex + 1}: en bit i ${role.id} har ingen`);
  }
}

/** Bitarna i spelarens egna rum i minnet. */
function listMemoryPieces(view: ReturnType<typeof buildGameView>): string[] {
  return view.step.rooms?.myRooms.flatMap((room) => room.pieces) ?? [];
}

/**
 * Någon vrider golvuret till rätt tid, och alla väljer rum tills inget rum
 * står tomt. Är spelarna färre än rummen tar någon ett rum till, så att
 * gruppen ser alla rum i samma minne (Jonas 2026-11-18). Minnet får stå kvar,
 * så att ledtrådarna och facit kontrolleras i samma steg. Sist kontrolleras
 * att varje bit i varje rum har setts av någon.
 */
function visitAllRooms(mission: Mission, state: GameState, players: PlayerRecord[], participants: PlayerRecord[]): GameState {
  const step = mission.steps[state.stepIndex];
  if (step.type !== 'rooms' || !state.rooms) return state;
  const clockRoom = mission.house?.rooms.find((room) => room.things.some((thing) => thing.opensSteps?.includes(step.id)))?.place;
  const [turner] = participants;
  let visited: GameState = clockRoom ? { ...state, placeByPlayer: { ...state.placeByPlayer, [turner.id]: clockRoom } } : state;
  visited = readState(turnClock({ state: visited, mission, players: participants, player: turner, minutes: readDialTime(step.solution.time), nowMs: 0 }));
  let isChoosing = true;
  while (isChoosing) {
    isChoosing = false;
    for (const player of participants) {
      for (const room of step.rooms) {
        const chosen = chooseMemoryRoom({ state: visited, mission, players: participants, player, placeId: room.place, nowMs: 0 });
        if ('state' in chosen) {
          visited = chosen.state;
          isChoosing = true;
          break;
        }
      }
    }
  }
  checkStep(mission, visited, players);
  const seen = new Set<string>();
  for (const viewer of participants) {
    const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: mission.id, state: visited }, mission, players, viewer });
    for (const piece of listMemoryPieces(view)) seen.add(piece);
  }
  assert.ok(step.rooms.every((room) => visited.rooms?.seenPlaces.includes(room.place)), `${mission.id}: gruppen såg inte alla rum i ett minne med ${participants.length} spelare`);
  for (const room of step.rooms) for (const piece of room.pieces) assert.ok(seen.has(piece), `${mission.id}: ingen ser ${piece} med ${participants.length} spelare`);
  return visited;
}

/** Den instängda hittar dörren, och vyerna kontrolleras med det dolda rummet framme. */
function findCellarDoor(mission: Mission, state: GameState, players: PlayerRecord[], participants: PlayerRecord[]): GameState {
  const step = mission.steps[state.stepIndex];
  if (step.type !== 'cellar') return state;
  const trapped = participants.find((player) => state.roleByPlayer[player.id]?.roleId === step.trappedRoleId);
  assert.ok(trapped, `${mission.id}: ingen är instängd med ${participants.length} spelare`);
  const found = readState(moveInCellar({ state, mission, player: trapped, move: { type: 'openDoor', yawDeg: step.solution.doorYawDeg }, nowMs: 1 }));
  assert.equal(found.cellar?.outcome, 'found');
  checkStep(mission, found, players);
  return found;
}

/**
 * Alla går till pianot och spelar melodin. Först slår någon an en annan ton,
 * som inte ska räknas, och vyerna kontrolleras efter varje ton.
 */
function playWholeMelody(mission: Mission, state: GameState, players: PlayerRecord[], participants: PlayerRecord[]): GameState {
  const step = mission.steps[state.stepIndex];
  if (step.type !== 'piano' || !state.piano) return state;
  const pianoPlace = mission.house?.rooms.find((room) => room.things.some((thing) => thing.opensSteps?.includes(step.id)))?.place;
  const placeByPlayer = { ...state.placeByPlayer };
  if (pianoPlace) for (const player of participants) placeByPlayer[player.id] = pianoPlace;
  let played: GameState = { ...state, placeByPlayer };
  const melodyPlayerId = state.piano.melodyPlayerId;
  const keysByPlayer = dealKeys(step.keys, sortByJoinOrder(participants).map((player) => player.id).filter((id) => id !== melodyPlayerId));
  const ownerOf = (key: string) => participants.find((player) => keysByPlayer[player.id]?.includes(key));
  const wrongKey = step.keys.find((key) => key !== step.solution.melody[0].note);
  assert.ok(wrongKey && ownerOf(wrongKey), `${mission.id}: ingen har en fel tangent med ${participants.length} spelare`);
  played = readState(playKey({ state: played, mission, players: participants, player: ownerOf(wrongKey)!, key: wrongKey }));
  assert.equal(played.stepIndex, state.stepIndex);
  for (const tone of step.solution.melody) {
    checkStep(mission, played, players);
    const owner = ownerOf(tone.note);
    assert.ok(owner, `${mission.id}: ingen har tangenten ${tone.note} med ${participants.length} spelare`);
    played = readState(playKey({ state: played, mission, players: participants, player: owner, key: tone.note }));
  }
  assert.notEqual(played.stepIndex, state.stepIndex, `${mission.id}: melodin förde inte gruppen vidare`);
  return played;
}

/** Lång nog för att skenet ska hinna fram till vilken bokstav som helst. */
const GLIDE_WAIT_MS = 60_000;

/** Alla följer skenet genom hela meddelandet, och vyerna kontrolleras efter varje bokstav. */
function followWholeSeance(mission: Mission, state: GameState, players: PlayerRecord[], participants: PlayerRecord[]): GameState {
  let followed = state;
  let nowMs = 0;
  while (followed.seance && !buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: mission.id, state: followed }, mission, players, viewer: participants[0] }).step.seance?.isComplete) {
    for (const player of participants) followed = readState(touchBoard({ state: followed, mission, players: participants, player, touch: 'onGlow', nowMs }));
    nowMs += GLIDE_WAIT_MS;
    followed = readState(touchBoard({ state: followed, mission, players: participants, player: participants[0], touch: 'arrived', nowMs }));
    checkStep(mission, followed, players);
  }
  return followed;
}

for (const mission of MISSIONS) {
  test(`${mission.id}: ingen vy läcker något, med ${mission.minPlayers} till ${MAX_PLAYERS} spelare, med och utan spelledaren`, () => {
    for (const leaderPlays of [true, false]) for (let playerCount = mission.minPlayers; playerCount <= MAX_PLAYERS; playerCount += 1) {
      // Spelledaren som står utanför räknas inte, så det behövs en spelare till.
      const players = createPlayers(leaderPlays ? playerCount : Math.min(playerCount + 1, MAX_PLAYERS));
      const [leader] = players;
      let state = readState(startGame({ state: createInitialState(), mission, players, starter: leader, leaderPlays, minutes: 60, nowMs: 0 }));
      const participants = listParticipants(state, players);
      while (state.status === 'running') {
        // Var annan spelare går till rätt plats, så att både de som är där och de som inte är det kontrolleras.
        state = goToGoals(mission, state, participants, participants.filter((_, index) => index % 2 === 0));
        checkStep(mission, state, players);
        // När rollerna har egna platser kontrolleras vyerna igen med alla framme.
        if (mission.steps[state.stepIndex].roles?.some((role) => role.goTo !== undefined)) {
          state = goToGoals(mission, state, participants, participants);
          checkStep(mission, state, players);
        }
        // I en seans kontrolleras vyerna efter varje bokstav, när någon ser den.
        if (mission.steps[state.stepIndex].type === 'seance') state = followWholeSeance(mission, state, players, participants);
        state = visitAllRooms(mission, state, players, participants);
        state = findCellarDoor(mission, state, players, participants);
        // Pianot kontrolleras med ledtrådarna och facit framme innan melodin spelas, eftersom den för gruppen vidare.
        if (mission.steps[state.stepIndex].type === 'piano') {
          while (state.hintsGiven < (mission.steps[state.stepIndex].hints?.length ?? 0)) state = readState(giveHint({ state, mission, player: leader }));
          state = readState(showSolution({ state, mission, player: leader }));
          checkStep(mission, state, players);
          state = playWholeMelody(mission, state, players, participants);
          continue;
        }
        // I en uppgift kontrolleras vyerna igen med alla ledtrådar och facit framme.
        if (mission.steps[state.stepIndex].type !== 'scene') {
          while (state.hintsGiven < (mission.steps[state.stepIndex].hints?.length ?? 0)) state = readState(giveHint({ state, mission, player: leader }));
          state = readState(showSolution({ state, mission, player: leader }));
          checkStep(mission, state, players);
        }
        state = readState(advanceStep({ state, mission, players: participants, player: leader }));
      }
    }
  });
}
