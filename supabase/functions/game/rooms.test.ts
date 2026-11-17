import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildGameView, chooseGuest, choosePlace, startGame } from './game.ts';
import type { Mission, RoomsStep } from './mission.ts';
import { getMission } from './missions/index.ts';
import { ROOM_FORGETS_MS, chooseGuest as chooseGuestInRoom, dealRooms, describeRooms, readRoomsState, startRooms } from './rooms.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

const PIECES = ['ser', 'hör', 'klocka'];
const STEP: RoomsStep = {
  id: 'rummen',
  type: 'rooms',
  text: 'Gå till ditt rum.',
  guests: ['Arvid', 'Elsa', 'Margit', 'Sven', 'Vera'],
  rooms: (['B', 'C', 'D', 'E'] as const).map((place) => ({ place, pieces: PIECES.map((piece) => `${place} ${piece}`) })),
  hints: ['a', 'b', 'c'],
  solution: { guestByPlace: { B: 'Elsa', C: 'Sven', D: 'Margit', E: 'Arvid' } },
};
const PLACES = [{ id: 'B', name: 'Hallen' }, { id: 'C', name: 'Köket' }, { id: 'D', name: 'Biblioteket' }, { id: 'E', name: 'Sovrummet' }] as const;

function ids(count: number): string[] {
  return Array.from({ length: count }, (_, index) => `p${index}`);
}

test('med färre spelare än rum tar någon två rum och ser allt i dem', () => {
  assert.deepEqual(dealRooms(STEP, ids(3)), {
    p0: [{ place: 'B', pieceIndexes: [0, 1, 2] }, { place: 'E', pieceIndexes: [0, 1, 2] }],
    p1: [{ place: 'C', pieceIndexes: [0, 1, 2] }],
    p2: [{ place: 'D', pieceIndexes: [0, 1, 2] }],
  });
});

test('med fler spelare än rum delar flera på ett rum, och den ena ser medan den andra hör', () => {
  const visits = dealRooms(STEP, ids(6));
  assert.deepEqual(visits.p0, [{ place: 'B', pieceIndexes: [0, 2] }]);
  assert.deepEqual(visits.p4, [{ place: 'B', pieceIndexes: [1] }]);
  assert.deepEqual(visits.p2, [{ place: 'D', pieceIndexes: [0, 1, 2] }]);
  // Med tio spelare är de tre i två av rummen och får en bit var.
  const ten = dealRooms(STEP, ids(10));
  assert.deepEqual([ten.p0, ten.p4, ten.p8].map((visit) => visit[0].pieceIndexes), [[0], [1], [2]]);
});

test('bitarna syns bara i rummet där spelaren står', () => {
  const rooms = startRooms(STEP, ids(3));
  const away = describeRooms({ rooms, step: STEP, places: PLACES, placeId: 'C', viewerId: 'p0' });
  assert.equal(away.current, null);
  assert.equal(away.hasRoomElsewhere, true);
  assert.deepEqual(away.myRooms.map((room) => room.place.name), ['Hallen', 'Sovrummet']);
  const here = describeRooms({ rooms, step: STEP, places: PLACES, placeId: 'E', viewerId: 'p0' });
  assert.deepEqual(here.current, { place: PLACES[3], pieces: ['E ser', 'E hör', 'E klocka'], guest: null, forgetsUntilMs: null });
});

test('ett fel val gör att rummet glömmer en stund, och ett rätt val löser rummet', () => {
  const rooms = startRooms(STEP, ids(4));
  const choose = (state: typeof rooms, guest: string, nowMs: number, placeId: 'B' | 'C' = 'B') => chooseGuestInRoom({ rooms: state, step: STEP, playerId: 'p0', placeId, guest, nowMs });
  assert.deepEqual(choose(rooms, 'Elsa', 0, 'C'), { refusal: 'notAtPlace' });
  const wrong = choose(rooms, 'Vera', 1000);
  assert.ok('rooms' in wrong);
  assert.deepEqual(wrong.rooms.forgetsUntilMsByPlace, { B: 1000 + ROOM_FORGETS_MS });
  assert.deepEqual(choose(wrong.rooms, 'Elsa', 1000 + ROOM_FORGETS_MS - 1), { refusal: 'roomForgets' });
  const right = choose(wrong.rooms, 'Elsa', 1000 + ROOM_FORGETS_MS);
  assert.ok('rooms' in right);
  assert.deepEqual(right.rooms.solvedPlaces, ['B']);
  assert.equal(describeRooms({ rooms: right.rooms, step: STEP, places: PLACES, placeId: 'B', viewerId: 'p0' }).current?.guest, 'Elsa');
});

test('sparade rum läses, och trasiga ersätts', () => {
  const rooms = startRooms(STEP, ids(5));
  assert.deepEqual(readRoomsState(JSON.parse(JSON.stringify(rooms))), rooms);
  assert.equal(readRoomsState({ visitsByPlayer: {} }), null);
  assert.deepEqual(readRoomsState({ visitsByPlayer: { p0: [{ place: 'Q', pieceIndexes: [0] }] }, solvedPlaces: ['B', 'Q'], forgetsUntilMsByPlace: { B: 'snart' } }), { visitsByPlayer: { p0: [] }, solvedPlaces: ['B'], forgetsUntilMsByPlace: {} });
});

const MISSION: Mission = { ...getMission('den-femte-gasten')!, steps: [STEP, { id: 'slut', type: 'scene', text: 'Slut.' }] };
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia', 'Dan'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));

function readState(change: ReturnType<typeof chooseGuest>): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

test('gruppen går vidare när alla rum har rätt gäst, och spelledaren ser vilka som är klara', () => {
  let state = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: PLAYERS[0], usesPlaceCards: true, leaderPlays: true, minutes: 60, nowMs: 0 }));
  const guests = ['Elsa', 'Sven', 'Margit', 'Arvid'];
  STEP.rooms.forEach((room, index) => {
    const player = PLAYERS[index];
    state = readState(choosePlace({ state, mission: MISSION, players: PLAYERS, player, placeId: room.place }));
    if (index === 0) assert.deepEqual(chooseGuest({ state, mission: MISSION, players: PLAYERS, player: PLAYERS[1], guest: 'Elsa', nowMs: 0 }), { refusal: 'notAtPlace' });
    state = readState(chooseGuest({ state, mission: MISSION, players: PLAYERS, player, guest: guests[index], nowMs: 0 }));
    if (index === 0) {
      const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer: PLAYERS[0] });
      assert.deepEqual(view.progress?.map((row) => row.isDone), [true, false, false, false]);
      assert.equal(view.step.rooms?.solvedCount, 1);
    }
  });
  assert.equal(state.status, 'finished');
  assert.equal(state.rooms, null);
});
