import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildGameView, moveOn, startGame } from './game.ts';
import { type House, findHouseErrors, searchRoom, walk } from './house.ts';
import type { Mission } from './mission.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

const HOUSE: House = {
  start: 'F',
  rooms: [
    { place: 'F', doors: ['B'], things: [{ id: 'bordet', name: 'Ouijabrädet', opensSteps: ['seansen'], isFoundFromStart: true }] },
    { place: 'B', doors: ['F', 'D'], things: [{ id: 'dorren', name: 'Källardörren', text: 'Låst.' }] },
    { place: 'D', doors: ['B'], things: [{ id: 'byran', name: 'Byrån', opensSteps: ['urklippen'], fromStep: 'urklippen' }] },
  ],
};
const MISSION: Mission = {
  format: 1,
  id: 'prov',
  title: 'Prov',
  minPlayers: 3,
  places: { B: 'Hallen', D: 'Biblioteket', F: 'Salongen' },
  house: HOUSE,
  steps: [
    { id: 'seansen', type: 'seance', text: 'Följ skenet.', hints: ['a', 'b', 'c'], solution: { message: 'HJÄLP' } },
    { id: 'urklippen', type: 'scene', text: 'Läs.', foundTitle: 'Tidningsurklippen' },
    { id: 'sedan', type: 'scene', text: 'Sedan.' },
    { id: 'slut', type: 'scene', text: 'Slut.' },
  ],
};
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));

function readState(change: { state: GameState } | { refusal: string }): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

function viewFor(state: GameState, viewer = PLAYERS[1]) {
  return buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer });
}

function start(): GameState {
  return readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
}

test('alla börjar i salongen, och seansbordet står i listan från början och öppnar seansen', () => {
  const view = viewFor(start());
  assert.equal(view.house?.room.name, 'Salongen');
  assert.deepEqual(view.house?.doors.map((door) => door.name), ['Hallen']);
  assert.deepEqual(view.house?.things, [{ id: 'bordet', name: 'Ouijabrädet', text: null, opensCurrentStep: true, opensFound: null, isCalling: false }]);
  assert.equal(view.step.opensFrom, 'Ouijabrädet');
});

test('spelaren går bara genom dörrar till rummen intill', () => {
  let state = start();
  assert.deepEqual(walk({ state, house: HOUSE, playerId: 'p1', placeId: 'D' }), { refusal: 'noDoor' });
  assert.deepEqual(walk({ state, house: HOUSE, playerId: 'p1', placeId: 'Q' }), { refusal: 'unknownPlace' });
  state = readState(walk({ state, house: HOUSE, playerId: 'p1', placeId: 'B' }));
  state = readState(walk({ state, house: HOUSE, playerId: 'p1', placeId: 'D' }));
  assert.equal(viewFor(state).house?.room.name, 'Biblioteket');
  assert.equal(viewFor(state, PLAYERS[2]).house?.room.name, 'Salongen');
});

test('en sak hittas först när berättelsen har kommit dit, och syns sedan för alla', () => {
  let state = start();
  state = readState(walk({ state, house: HOUSE, playerId: 'p1', placeId: 'B' }));
  state = readState(walk({ state, house: HOUSE, playerId: 'p1', placeId: 'D' }));
  assert.equal(viewFor(state).house?.canSearch, false);
  assert.equal(searchRoom({ state, mission: MISSION, house: HOUSE, playerId: 'p1' }), state);

  state = moveOn(state, MISSION, PLAYERS);
  assert.equal(viewFor(state).house?.canSearch, true);
  state = searchRoom({ state, mission: MISSION, house: HOUSE, playerId: 'p1' });
  assert.deepEqual(state.foundThings, ['byran']);
  assert.equal(viewFor(state).house?.things[0].opensCurrentStep, true);
  // Den som står i biblioteket senare ser byrån utan att leta.
  state = readState(walk({ state, house: HOUSE, playerId: 'p2', placeId: 'B' }));
  state = readState(walk({ state, house: HOUSE, playerId: 'p2', placeId: 'D' }));
  assert.equal(viewFor(state, PLAYERS[2]).house?.things[0].name, 'Byrån');

  state = moveOn(state, MISSION, PLAYERS);
  assert.deepEqual(viewFor(state).house?.things[0], { id: 'byran', name: 'Byrån', text: null, opensCurrentStep: false, opensFound: 'Tidningsurklippen', isCalling: false });
});

test('husets dörrar går åt båda hållen och sakerna pekar på steg som finns', () => {
  assert.deepEqual(findHouseErrors(HOUSE, MISSION.places, MISSION.steps.map((step) => step.id)), []);
  const broken = { start: 'F', rooms: [{ place: 'F', doors: ['B'], things: [{ id: 'x', name: 'X', opensSteps: ['saknas'] }] }, { place: 'B', doors: [], things: [{ id: 'x', name: 'Y' }] }] };
  assert.deepEqual(findHouseErrors(broken, MISSION.places, ['seansen']), [
    'dörren från F till B går inte tillbaka',
    'saken x i huset pekar på ett steg som inte finns: saknas',
    'en sak i huset saknar id eller har samma id som en annan',
    'saken x i huset har varken text eller steg att öppna',
  ]);
});
