import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, markReady, startGame } from './game.ts';
import type { Mission } from './mission.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

const MISSION: Mission = {
  format: 1,
  id: 'prov',
  title: 'Prov',
  minPlayers: 3,
  places: { A: 'Källaren' },
  steps: [
    {
      id: 'urklippen',
      type: 'scene',
      text: 'Läs urklippen.',
      documents: [{ title: 'Artikeln', text: 'Fem gick in.' }],
      foundTitle: 'Tidningsurklippen',
      roles: [{ id: 'urklipp', title: 'Dina urklipp', count: 'rest', pieces: ['ett', 'två', 'tre', 'fyra'] }],
    },
    { id: 'sedan', type: 'scene', text: 'Sedan.' },
    { id: 'slut', type: 'scene', text: 'Slut.' },
  ],
};
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));

function readState(change: { state: GameState } | { refusal: string }): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

function viewFor(state: GameState, viewer: PlayerRecord) {
  return buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer });
}

test('dokumenten syns för alla, och urklippen ligger kvar i Hittat med bara spelarens egna', () => {
  let state = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: PLAYERS[0], usesPlaceCards: false, leaderPlays: true, minutes: 60, nowMs: 0 }));
  assert.deepEqual(viewFor(state, PLAYERS[1]).step.documents, [{ title: 'Artikeln', text: 'Fem gick in.' }]);
  assert.deepEqual(viewFor(state, PLAYERS[1]).found, []);
  for (const player of PLAYERS) state = readState(markReady({ state, mission: MISSION, players: PLAYERS, player }));
  assert.equal(state.stepIndex, 1);
  assert.deepEqual(viewFor(state, PLAYERS[0]).found, [{ title: 'Tidningsurklippen', documents: [{ title: 'Artikeln', text: 'Fem gick in.' }], pieces: ['ett', 'fyra'] }]);
  assert.deepEqual(viewFor(state, PLAYERS[1]).found[0].pieces, ['två']);
  // Fynden finns kvar när spelledaren hoppar vidare.
  state = readState(advanceStep({ state, mission: MISSION, players: PLAYERS, player: PLAYERS[0] }));
  assert.deepEqual(viewFor(state, PLAYERS[2]).found[0].pieces, ['tre']);
});
