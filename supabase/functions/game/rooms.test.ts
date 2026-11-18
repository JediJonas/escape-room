import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, markReady, startGame } from './game.ts';
import { chooseMemoryRoom, fadeMemory, turnClock, walkThroughDoor } from './taskActions.ts';
import type { Mission, RoomsStep } from './mission.ts';
import { getMission } from './missions/index.ts';
import { advanceRooms, chooseMemoryRoom as chooseRoom, describeRooms, isRoomsSolved, listChoosablePlaces, readDialTime, readRoomsState, snapDial, startRooms, turnClock as turnHands } from './rooms.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

const MINUTE_MS = 60_000;
const PIECES = ['gäst', 'sak', 'klocka'];
const STEP: RoomsStep = {
  id: 'rummen-minns',
  type: 'rooms',
  text: 'Vrid visarna.',
  clockStart: '4.40',
  memoryMinutes: 3,
  memoryLabel: 'kvart över nio, 1962',
  rooms: (['B', 'C', 'D', 'E'] as const).map((place) => ({ place, pieces: PIECES.map((piece) => `${place} ${piece}`) })),
  hints: ['a', 'b', 'c'],
  solution: { time: '21.15' },
};
const PLACES = [{ id: 'B', name: 'Hallen' }, { id: 'C', name: 'Köket' }, { id: 'D', name: 'Biblioteket' }, { id: 'E', name: 'Sovrummet' }] as const;
const NINE_FIFTEEN = 555;
const SEVEN = ['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

test('tiderna läses som minuter på en tolvtimmars urtavla, och visarna hakar i var femte minut', () => {
  assert.equal(readDialTime('21.15'), NINE_FIFTEEN);
  assert.equal(readDialTime('9.15'), NINE_FIFTEEN);
  assert.equal(readDialTime('4.40'), 280);
  assert.equal(readDialTime('21.17'), null);
  assert.equal(readDialTime('25.00'), null);
  assert.equal(snapDial(557.4), NINE_FIFTEEN);
  assert.equal(snapDial(-5), 715);
  assert.equal(snapDial(720 + NINE_FIFTEEN), NINE_FIFTEEN);
});

test('fel tid flyttar bara visarna, rätt tid får huset att minnas i några minuter', () => {
  const rooms = startRooms(STEP);
  assert.equal(rooms.dialMinutes, 280);
  const wrong = turnHands({ rooms, step: STEP, minutes: 600, nowMs: 0 });
  assert.deepEqual(wrong, { rooms: { ...rooms, dialMinutes: 600 } });
  const right = turnHands({ rooms, step: STEP, minutes: NINE_FIFTEEN + 2, nowMs: 1000 });
  assert.ok('rooms' in right);
  assert.equal(right.rooms.remembersUntilMs, 1000 + 3 * MINUTE_MS);
  assert.deepEqual(turnHands({ rooms: right.rooms, step: STEP, minutes: 0, nowMs: 2000 }), { refusal: 'houseRemembers' });
});

test('rummen fylls jämnt: ett rum går bara att välja om inget annat rum har färre', () => {
  const started = turnHands({ rooms: startRooms(STEP), step: STEP, minutes: NINE_FIFTEEN, nowMs: 0 });
  assert.ok('rooms' in started);
  let rooms = started.rooms;
  const choose = (playerId: string, placeId: string) => {
    const chosen = chooseRoom({ rooms, step: STEP, playerId, participantIds: SEVEN, placeId, nowMs: 1 });
    assert.ok('rooms' in chosen, JSON.stringify(chosen));
    rooms = chosen.rooms;
  };
  choose('p0', 'B');
  assert.deepEqual(chooseRoom({ rooms, step: STEP, playerId: 'p1', participantIds: SEVEN, placeId: 'B', nowMs: 1 }), { refusal: 'roomFull' });
  assert.deepEqual(chooseRoom({ rooms, step: STEP, playerId: 'p0', participantIds: SEVEN, placeId: 'C', nowMs: 1 }), { refusal: 'alreadyChosen' });
  for (const [playerId, placeId] of [['p1', 'C'], ['p2', 'D'], ['p3', 'E']]) choose(playerId, placeId);
  // Med sex spelare blir det två i två av rummen och en i de andra, aldrig tre i ett.
  choose('p4', 'B');
  assert.deepEqual(listChoosablePlaces(rooms, STEP), ['C', 'D', 'E']);
  choose('p5', 'D');
  assert.deepEqual(chooseRoom({ rooms, step: STEP, playerId: 'p6', participantIds: SEVEN, placeId: 'B', nowMs: 1 }), { refusal: 'roomFull' });
  // Två i hallen delar på bitarna. Den som står ensam ser allt.
  assert.deepEqual(describeRooms({ rooms, step: STEP, places: PLACES, viewerId: 'p0', participantIds: SEVEN }).myRooms[0]?.pieces, ['B gäst', 'B klocka']);
  assert.deepEqual(describeRooms({ rooms, step: STEP, places: PLACES, viewerId: 'p4', participantIds: SEVEN }).myRooms[0]?.pieces, ['B sak']);
  assert.deepEqual(describeRooms({ rooms, step: STEP, places: PLACES, viewerId: 'p1', participantIds: SEVEN }).myRooms[0]?.pieces, ['C gäst', 'C sak', 'C klocka']);
  assert.deepEqual(chooseRoom({ rooms, step: STEP, playerId: 'p6', participantIds: SEVEN, placeId: 'C', nowMs: 3 * MINUTE_MS }), { refusal: 'notRemembering' });
});

test('är spelarna färre än rummen tar de ett tomt rum till när alla har valt, så att två ser alla fyra', () => {
  const started = turnHands({ rooms: startRooms(STEP), step: STEP, minutes: NINE_FIFTEEN, nowMs: 0 });
  assert.ok('rooms' in started);
  let rooms = started.rooms;
  const two = ['p0', 'p1'];
  const choose = (playerId: string, placeId: string) => chooseRoom({ rooms, step: STEP, playerId, participantIds: two, placeId, nowMs: 1 });
  const take = (playerId: string, placeId: string) => {
    const chosen = choose(playerId, placeId);
    assert.ok('rooms' in chosen, JSON.stringify(chosen));
    rooms = chosen.rooms;
  };
  const choiceOf = (viewerId: string) => describeRooms({ rooms, step: STEP, places: PLACES, viewerId, participantIds: two }).choice;
  take('p0', 'B');
  // Ett rum till går först när alla har valt.
  assert.equal(choiceOf('p0'), 'waitForOthers');
  assert.deepEqual(choose('p0', 'C'), { refusal: 'alreadyChosen' });
  take('p1', 'C');
  assert.equal(choiceOf('p0'), 'takeAnother');
  assert.deepEqual(choose('p0', 'C'), { refusal: 'roomFull' });
  take('p0', 'D');
  // Nu har Anna två rum, så Bo tar det sista.
  assert.equal(choiceOf('p0'), 'done');
  assert.deepEqual(choose('p0', 'E'), { refusal: 'alreadyChosen' });
  take('p1', 'E');
  assert.equal(choiceOf('p1'), 'done');
  const anna = describeRooms({ rooms, step: STEP, places: PLACES, viewerId: 'p0', participantIds: two });
  assert.deepEqual(anna.myRooms.map((room) => [room.place.name, room.pieces.length]), [['Hallen', 3], ['Biblioteket', 3]]);
  assert.deepEqual(rooms.seenPlaces, ['B', 'C', 'D', 'E']);
});

test('när minnet bleknar går visarna tillbaka, och uppgiften är klar först när alla rum är sedda', () => {
  const started = turnHands({ rooms: startRooms(STEP), step: STEP, minutes: NINE_FIFTEEN, nowMs: 0 });
  assert.ok('rooms' in started);
  const chosen = chooseRoom({ rooms: started.rooms, step: STEP, playerId: 'p0', participantIds: ['p0'], placeId: 'B', nowMs: 1 });
  assert.ok('rooms' in chosen);
  assert.equal(advanceRooms(chosen.rooms, STEP, 3 * MINUTE_MS - 1), chosen.rooms);
  const faded = advanceRooms(chosen.rooms, STEP, 3 * MINUTE_MS);
  assert.deepEqual(faded, { dialMinutes: 280, remembersUntilMs: null, choices: [], seenPlaces: ['B'] });
  assert.equal(isRoomsSolved(faded, STEP), false);
  assert.equal(isRoomsSolved({ ...faded, seenPlaces: ['B', 'C', 'D', 'E'] }, STEP), true);
  assert.equal(isRoomsSolved({ ...chosen.rooms, seenPlaces: ['B', 'C', 'D', 'E'] }, STEP), false);
});

test('sparade rum läses, och det gamla formatet med gäster ersätts', () => {
  const rooms = { dialMinutes: 280, remembersUntilMs: 9, choices: [{ playerId: 'p0', place: 'B' as const }], seenPlaces: ['B' as const] };
  assert.deepEqual(readRoomsState(JSON.parse(JSON.stringify(rooms))), rooms);
  assert.equal(readRoomsState({ visitsByPlayer: {}, solvedPlaces: [] }), null);
  assert.deepEqual(readRoomsState({ dialMinutes: 280, remembersUntilMs: 'snart', choices: [{ playerId: 'p0', place: 'Q' }], seenPlaces: ['B', 'Q'] }), { dialMinutes: 280, remembersUntilMs: null, choices: [], seenPlaces: ['B'] });
});

const FULL = getMission('den-femte-gasten')!;
const MISSION: Mission = { ...FULL, steps: [STEP, { id: 'slut', type: 'scene', text: 'Slut.' }] };
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));

function readState(change: { state: GameState } | { refusal: string }): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

test('med tre spelare ser gruppen alla rum i ett minne, dörrarna är stängda under minnet, och sedan går gruppen vidare', () => {
  const [anna, bo, cia] = PLAYERS;
  let state = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: anna, leaderPlays: true, minutes: 60, nowMs: 0 }));
  // Golvuret står i salongen, och alla börjar i hallen.
  assert.deepEqual(turnClock({ state, mission: MISSION, players: PLAYERS, player: anna, minutes: NINE_FIFTEEN, nowMs: 0 }), { refusal: 'notAtPlace' });
  state = readState(walkThroughDoor({ state, mission: MISSION, player: anna, placeId: 'F', nowMs: 0 }));
  let nowMs = 0;
  const remember = () => {
    state = readState(turnClock({ state, mission: MISSION, players: PLAYERS, player: anna, minutes: NINE_FIFTEEN, nowMs }));
    assert.ok(state.rooms?.remembersUntilMs);
  };
  const choose = (player: PlayerRecord, placeId: string) => {
    state = readState(chooseMemoryRoom({ state, mission: MISSION, players: PLAYERS, player, placeId, nowMs }));
  };
  remember();
  assert.deepEqual(walkThroughDoor({ state, mission: MISSION, player: bo, placeId: 'C', nowMs }), { refusal: 'houseRemembers' });
  choose(anna, 'B');
  choose(bo, 'C');
  choose(cia, 'D');
  // Den som väljer ett rum står sedan där.
  assert.equal(state.placeByPlayer[cia.id], 'D');
  const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer: cia });
  assert.equal(view.step.rooms?.myRooms[0]?.place.name, 'Biblioteket');
  // Sovrummet står tomt. Anna tar det också, men står kvar i hallen.
  choose(anna, 'E');
  assert.equal(state.placeByPlayer[anna.id], 'B');
  nowMs += 3 * MINUTE_MS;
  state = readState(fadeMemory({ state, mission: MISSION, players: PLAYERS, nowMs }));
  assert.equal(state.status, 'finished');
});

test('golvuret går att vrida innan berättelsen har kommit dit, och då hoppar gruppen bara över rummen som redan är sedda', () => {
  const later: Mission = { ...FULL, steps: [{ id: 'forst', type: 'scene', text: 'Först.' }, STEP, { id: 'slut', type: 'scene', text: 'Slut.' }] };
  const [anna, bo, cia] = PLAYERS;
  let state = readState(startGame({ state: createInitialState(), mission: later, players: PLAYERS, starter: anna, leaderPlays: true, minutes: 60, nowMs: 0 }));
  state = readState(walkThroughDoor({ state, mission: later, player: anna, placeId: 'F', nowMs: 0 }));
  const viewOf = (viewer: PlayerRecord) => buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: later.id, state }, mission: later, players: PLAYERS, viewer });
  assert.deepEqual(viewOf(anna).house?.things.find((thing) => thing.id === 'golvuret')?.instrument, { type: 'clock', dialMinutes: readDialTime('4.40') });
  state = readState(turnClock({ state, mission: later, players: PLAYERS, player: anna, minutes: NINE_FIFTEEN, nowMs: 0 }));
  assert.equal(state.stepIndex, 0);
  // Huset minns, och alla får välja rum fast berättelsen står kvar vid första steget.
  assert.ok(viewOf(bo).step.rooms);
  for (const [player, placeId] of [[anna, 'B'], [bo, 'C'], [cia, 'D'], [anna, 'E']] as const) {
    state = readState(chooseMemoryRoom({ state, mission: later, players: PLAYERS, player, placeId, nowMs: 0 }));
  }
  state = readState(fadeMemory({ state, mission: later, players: PLAYERS, nowMs: 3 * MINUTE_MS }));
  assert.deepEqual(state.solvedSteps, ['rummen-minns']);
  assert.equal(state.stepIndex, 0);
  // Efteråt går visarna att vrida, men huset minns inte mer. Anna står kvar i hallen, sitt första rum.
  state = readState(walkThroughDoor({ state, mission: later, player: anna, placeId: 'F', nowMs: 4 * MINUTE_MS }));
  state = readState(turnClock({ state, mission: later, players: PLAYERS, player: anna, minutes: NINE_FIFTEEN, nowMs: 4 * MINUTE_MS }));
  assert.equal(state.rooms?.remembersUntilMs, null);
  state = readState(advanceStep({ state, mission: later, players: PLAYERS, player: anna }));
  assert.equal(later.steps[state.stepIndex].id, 'slut');
});

test('urklippen slutar när alla har läst och minnet har bleknat, utan någon knapp (Jonas 2026-11-18)', () => {
  const later: Mission = { ...FULL, steps: [{ id: 'urklippen', type: 'scene', text: 'Läs.', endsWithStep: STEP.id }, STEP, { id: 'sedan', type: 'scene', text: 'Sedan.' }, { id: 'slut', type: 'scene', text: 'Slut.' }] };
  const [anna, bo, cia] = PLAYERS;
  let state = readState(startGame({ state: createInitialState(), mission: later, players: PLAYERS, starter: anna, leaderPlays: true, minutes: 60, nowMs: 0 }));
  const viewOf = (viewer: PlayerRecord) => buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: later.id, state }, mission: later, players: PLAYERS, viewer });
  assert.equal(viewOf(bo).step.isDoneByLeaving, true);
  // Alla läser urklippen och går därifrån. Steget väntar ändå på golvuret.
  for (const player of PLAYERS) state = readState(markReady({ state, mission: later, players: PLAYERS, player }));
  assert.equal(state.stepIndex, 0);
  state = readState(walkThroughDoor({ state, mission: later, player: anna, placeId: 'F', nowMs: 0 }));
  state = readState(turnClock({ state, mission: later, players: PLAYERS, player: anna, minutes: NINE_FIFTEEN, nowMs: 0 }));
  assert.equal(state.stepIndex, 0);
  for (const [player, placeId] of [[anna, 'B'], [bo, 'C'], [cia, 'D'], [anna, 'E']] as const) {
    state = readState(chooseMemoryRoom({ state, mission: later, players: PLAYERS, player, placeId, nowMs: 0 }));
  }
  state = readState(fadeMemory({ state, mission: later, players: PLAYERS, nowMs: 3 * MINUTE_MS }));
  assert.equal(later.steps[state.stepIndex].id, 'sedan');
});

test('har gruppen redan sett minnet när urklippen kommer, går de vidare när alla har läst', () => {
  const early: Mission = { ...FULL, steps: [{ id: 'forst', type: 'scene', text: 'Först.' }, { id: 'urklippen', type: 'scene', text: 'Läs.', endsWithStep: STEP.id }, STEP, { id: 'sedan', type: 'scene', text: 'Sedan.' }, { id: 'slut', type: 'scene', text: 'Slut.' }] };
  const [anna, bo, cia] = PLAYERS;
  let state = readState(startGame({ state: createInitialState(), mission: early, players: PLAYERS, starter: anna, leaderPlays: true, minutes: 60, nowMs: 0 }));
  state = readState(walkThroughDoor({ state, mission: early, player: anna, placeId: 'F', nowMs: 0 }));
  state = readState(turnClock({ state, mission: early, players: PLAYERS, player: anna, minutes: NINE_FIFTEEN, nowMs: 0 }));
  for (const [player, placeId] of [[anna, 'B'], [bo, 'C'], [cia, 'D'], [anna, 'E']] as const) {
    state = readState(chooseMemoryRoom({ state, mission: early, players: PLAYERS, player, placeId, nowMs: 0 }));
  }
  state = readState(fadeMemory({ state, mission: early, players: PLAYERS, nowMs: 3 * MINUTE_MS }));
  for (const player of PLAYERS) state = readState(markReady({ state, mission: early, players: PLAYERS, player }));
  assert.equal(early.steps[state.stepIndex].id, 'urklippen');
  const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: early.id, state }, mission: early, players: PLAYERS, viewer: bo });
  assert.equal(view.step.isDoneByLeaving, true);
  for (const player of PLAYERS) state = readState(markReady({ state, mission: early, players: PLAYERS, player }));
  assert.equal(early.steps[state.stepIndex].id, 'sedan');
});
