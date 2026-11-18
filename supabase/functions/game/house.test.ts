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
    { place: 'D', doors: ['B'], things: [{ id: 'byran', name: 'Byrån', text: 'En gammal byrå.', opensSteps: ['urklippen'] }] },
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
  assert.deepEqual(view.house?.things, [{ id: 'bordet', name: 'Ouijabrädet', text: null, pages: null, opensCurrentStep: true, opensFound: null, isCalling: false, instrument: null, echo: null }]);
  assert.equal(view.step.opensFrom, 'Ouijabrädet');
});

test('ett låst rum går bara att gå in i för den som ska dit', () => {
  const locked: House = { ...HOUSE, rooms: HOUSE.rooms.map((room) => (room.place === 'D' ? { ...room, isLocked: true } : room)) };
  const state = readState(walk({ state: start(), house: locked, playerId: 'p1', placeId: 'B' }));
  assert.deepEqual(walk({ state, house: locked, playerId: 'p1', placeId: 'D' }), { refusal: 'locked' });
  assert.equal(viewFor(readState(walk({ state, house: locked, playerId: 'p1', placeId: 'D', mayEnterLocked: true }))).house?.room.name, 'Biblioteket');
  assert.deepEqual(findHouseErrors({ ...HOUSE, rooms: [{ ...HOUSE.rooms[0], isLocked: 'ja' }, ...HOUSE.rooms.slice(1)] }, MISSION.places, ['seansen', 'urklippen']), ['rummet F har ett lås som inte är sant eller falskt']);
});

test('brädet bokstaverar det senaste ekot som berättelsen har kommit till, men inte i sitt eget steg', () => {
  const echoing: House = { ...HOUSE, rooms: HOUSE.rooms.map((room) => ({ ...room, things: room.things.map((thing) => (thing.id === 'bordet' ? { ...thing, echoes: [{ fromStep: 'urklippen', message: 'VERA' }, { fromStep: 'slut', message: 'EN AV ER' }] } : thing)) })) };
  const mission = { ...MISSION, house: echoing };
  const boardAt = (stepIndex: number) => buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: mission.id, state: { ...start(), stepIndex } }, mission, players: PLAYERS, viewer: PLAYERS[1] }).house?.things[0].echo;
  assert.equal(boardAt(0), null);
  assert.equal(boardAt(1), 'VERA');
  assert.equal(boardAt(3), 'EN AV ER');
  assert.deepEqual(findHouseErrors({ ...echoing, rooms: [{ ...echoing.rooms[0], things: [{ ...echoing.rooms[0].things[0], echoes: [{ fromStep: 'urklippen', message: 'vera!' }] }] }, ...echoing.rooms.slice(1)] }, MISSION.places, ['seansen', 'urklippen']), ['saken bordet i huset har ett eko med andra tecken än bokstäverna på brädet']);
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

test('en sak går att hitta från början, öppnar sitt steg när gruppen är där och syns sedan för alla', () => {
  let state = start();
  state = readState(walk({ state, house: HOUSE, playerId: 'p1', placeId: 'B' }));
  state = readState(walk({ state, house: HOUSE, playerId: 'p1', placeId: 'D' }));
  assert.equal(viewFor(state).house?.canSearch, true);
  state = searchRoom({ state, house: HOUSE, playerId: 'p1' });
  assert.deepEqual(state.foundThings, ['byran']);
  assert.equal(viewFor(state).house?.canSearch, false);
  assert.equal(searchRoom({ state, house: HOUSE, playerId: 'p1' }), state);
  // Före steget visar byrån sin text, och i steget öppnar den urklippen.
  assert.equal(viewFor(state).house?.things[0].text, 'En gammal byrå.');
  assert.equal(viewFor(state).house?.things[0].opensCurrentStep, false);
  state = moveOn(state, MISSION, PLAYERS);
  assert.equal(viewFor(state).house?.things[0].opensCurrentStep, true);
  // Den som står i biblioteket senare ser byrån utan att leta.
  state = readState(walk({ state, house: HOUSE, playerId: 'p2', placeId: 'B' }));
  state = readState(walk({ state, house: HOUSE, playerId: 'p2', placeId: 'D' }));
  assert.equal(viewFor(state, PLAYERS[2]).house?.things[0].name, 'Byrån');

  state = moveOn(state, MISSION, PLAYERS);
  assert.deepEqual(viewFor(state).house?.things[0], { id: 'byran', name: 'Byrån', text: 'En gammal byrå.', pages: null, opensCurrentStep: false, opensFound: 'Tidningsurklippen', isCalling: false, instrument: null, echo: null });
});

test('husets dörrar går åt båda hållen och sakerna pekar på steg som finns', () => {
  assert.deepEqual(findHouseErrors(HOUSE, MISSION.places, MISSION.steps.map((step) => step.id)), []);
  const broken = { start: 'F', rooms: [{ place: 'F', doors: ['B'], things: [{ id: 'x', name: 'X', opensSteps: ['saknas'] }] }, { place: 'B', doors: [], things: [{ id: 'x', name: 'Y' }] }] };
  assert.deepEqual(findHouseErrors(broken, MISSION.places, ['seansen']), [
    'dörren från F till B går inte tillbaka',
    'saken x i huset pekar på ett steg som inte finns: saknas',
    'en sak i huset saknar id eller har samma id som en annan',
    'saken x i huset har varken text, sidor eller steg att öppna',
  ]);
});

test('en bok har sidor med text', () => {
  const book = (pages: unknown) => ({ start: 'F', rooms: [{ place: 'F', doors: [], things: [{ id: 'bok', name: 'Bok', pages }] }] });
  assert.deepEqual(findHouseErrors(book(['Sida ett', 'Sida två']), MISSION.places, []), []);
  assert.deepEqual(findHouseErrors(book([]), MISSION.places, []), ['saken bok i huset har sidor som är tomma eller inte är en lista']);
  assert.deepEqual(findHouseErrors(book(['Sida ett', ' ']), MISSION.places, []), ['saken bok i huset har sidor som är tomma eller inte är en lista']);
});

test('en bok kan ha tomma sidor efter de skrivna', () => {
  const book = (thing: Record<string, unknown>) => ({ start: 'F', rooms: [{ place: 'F', doors: [], things: [{ id: 'bok', name: 'Bok', ...thing }] }] });
  const error = 'saken bok i huset har tomma sidor men inga sidor med text, eller ett antal som inte är ett heltal över noll';
  assert.deepEqual(findHouseErrors(book({ pages: ['Sida ett'], blankPages: 3 }), MISSION.places, []), []);
  assert.deepEqual(findHouseErrors(book({ pages: ['Sida ett'], blankPages: 0 }), MISSION.places, []), [error]);
  assert.deepEqual(findHouseErrors(book({ text: 'Text', blankPages: 2 }), MISSION.places, []), [error]);
});

test('de tomma sidorna kommer efter de skrivna i bokens vy', () => {
  const bookHouse: House = { start: 'F', rooms: [{ place: 'F', doors: [], things: [{ id: 'bok', name: 'Gästboken', pages: ['1962\nVera'], blankPages: 2, isFoundFromStart: true }] }] };
  const mission: Mission = { ...MISSION, house: bookHouse };
  const state = readState(startGame({ state: createInitialState(), mission, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
  const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: mission.id, state }, mission, players: PLAYERS, viewer: PLAYERS[1] });
  assert.deepEqual(view.house?.things[0].pages, ['1962\nVera', '', '']);
});
