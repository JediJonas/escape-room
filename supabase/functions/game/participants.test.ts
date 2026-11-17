import assert from 'node:assert/strict';
import { test } from 'vitest';
import { MAX_PLAYERS } from './lobby.ts';
import { answerPending, isParticipant, listParticipants, planLateJoin } from './participants.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

function createPlayer(index: number): PlayerRecord {
  return { id: `p${index}`, gameId: 'g', userId: `u${index}`, name: `Spelare ${index}`, isLeader: index === 0, joinedAtMs: index };
}

const RUNNING: GameState = { ...createInitialState(), status: 'running' };
const PLAYERS = [createPlayer(0), createPlayer(1), createPlayer(2)];

test('spelledaren som står utanför och de som väntar är inte med i uppgifterna', () => {
  const state: GameState = { ...RUNNING, leaderPlays: false, pendingPlayers: [{ playerId: 'p2', takesOverPlayerId: null }] };
  assert.deepEqual(listParticipants(state, PLAYERS).map((player) => player.id), ['p1']);
  assert.equal(isParticipant(RUNNING, PLAYERS[0]), true);
});

test('en sen mobil blir ny spelare, eller tar över den med samma namn', () => {
  assert.deepEqual(planLateJoin({ state: RUNNING, players: PLAYERS, name: 'Nisse' }), { takesOverPlayerId: null });
  assert.deepEqual(planLateJoin({ state: RUNNING, players: PLAYERS, name: 'spelare 1' }), { takesOverPlayerId: 'p1' });
  assert.deepEqual(planLateJoin({ state: RUNNING, players: PLAYERS, name: 'Spelare 0' }), { refusal: 'nameTaken' });
  assert.deepEqual(planLateJoin({ state: { ...RUNNING, status: 'finished' }, players: PLAYERS, name: 'Nisse' }), { refusal: 'gameStarted' });
  const full = Array.from({ length: MAX_PLAYERS }, (_, index) => createPlayer(index));
  assert.deepEqual(planLateJoin({ state: RUNNING, players: full, name: 'Nisse' }), { refusal: 'gameFull' });
  // Att ta över tar ingen ny plats, så det går även i ett fullt spel.
  assert.deepEqual(planLateJoin({ state: RUNNING, players: full, name: 'Spelare 3' }), { takesOverPlayerId: 'p3' });
});

test('bara spelledaren svarar, och bara på en mobil som väntar', () => {
  const state: GameState = { ...RUNNING, pendingPlayers: [{ playerId: 'p2', takesOverPlayerId: null }] };
  assert.deepEqual(answerPending({ state, leader: PLAYERS[1], playerId: 'p2' }), { refusal: 'notLeader' });
  assert.deepEqual(answerPending({ state, leader: PLAYERS[0], playerId: 'p1' }), { refusal: 'noSuchPlayer' });
  const answer = answerPending({ state, leader: PLAYERS[0], playerId: 'p2' });
  assert.ok('state' in answer);
  assert.deepEqual(answer.state.pendingPlayers, []);
});
