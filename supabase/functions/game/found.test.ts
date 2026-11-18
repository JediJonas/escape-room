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
  let state = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
  assert.deepEqual(viewFor(state, PLAYERS[1]).step.documents, [{ title: 'Artikeln', text: 'Fem gick in.' }]);
  assert.deepEqual(viewFor(state, PLAYERS[1]).found, []);
  for (const player of PLAYERS) state = readState(markReady({ state, mission: MISSION, players: PLAYERS, player }));
  assert.equal(state.stepIndex, 1);
  const [first] = viewFor(state, PLAYERS[0]).found;
  assert.equal(first.title, 'Tidningsurklippen');
  assert.deepEqual(first.documents, [{ title: 'Artikeln', text: 'Fem gick in.' }]);
  // Bitarna lottas, men var och en har sina egna och alla finns hos någon.
  const piecesOf = (player: PlayerRecord) => viewFor(state, player).found[0].pieces;
  const before = PLAYERS.map(piecesOf);
  assert.ok(before.every((pieces) => pieces.length > 0));
  assert.deepEqual(before.flat().sort(), ['ett', 'fyra', 'tre', 'två']);
  // Fynden finns kvar när spelledaren hoppar vidare.
  state = readState(advanceStep({ state, mission: MISSION, players: PLAYERS, player: PLAYERS[0] }));
  assert.deepEqual(PLAYERS.map(piecesOf), before);
});
