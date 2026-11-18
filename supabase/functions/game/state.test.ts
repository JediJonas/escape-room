import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createInitialState, readGameState } from './state.ts';

test('ett spel från före platserna får startvärden för de nya fälten', () => {
  assert.deepEqual(readGameState({ status: 'lobby' }), createInitialState());
});

test('ett sparat tillstånd läses som det är', () => {
  const saved = { status: 'running', usesPlaceCards: false, stepIndex: 2, placeByPlayer: { p1: 'C' }, roleByPlayer: { p1: { roleId: 'siaren', pieceIndexes: [0] } }, prominentHistory: ['p1'], readyPlayerIds: ['p1'], wrongAnswers: 1, hintsGiven: 2, isSolutionShown: true, leaderPlays: false, pendingPlayers: [{ playerId: 'p2', takesOverPlayerId: null }], clock: { durationMs: 3_600_000, startedAtMs: 5, pausedAtMs: null, pausedTotalMs: 0 }, seance: { letterIndex: 3, followerIds: ['p1'], progress: 0.5, anchorMs: 7, pauseUntilMs: 9, brokenBy: { playerId: 'p2', atMs: 4 } }, rooms: { dialMinutes: 280, remembersUntilMs: 12, choices: [{ playerId: 'p1', place: 'B' }], seenPlaces: ['C'] }, cellar: { arrivedAtMs: 3, penaltyMs: 10_000, fusesUsed: 1, litUntilMs: 8, outcome: 'caught' }, marks: ['fewerNames'], found: { urklipp: { p1: { roleId: 'urklipp', pieceIndexes: [1, 4] } } }, foundThings: ['byran'] };
  assert.deepEqual(readGameState(saved), saved);
});

test('okända värden i ett sparat tillstånd ersätts', () => {
  assert.deepEqual(readGameState({ status: 'trasig', stepIndex: 'två', placeByPlayer: { p1: 'Q', p2: 'A' }, roleByPlayer: { p1: { roleId: 7 } }, prominentHistory: [3, 'p2'] }), { ...createInitialState(), placeByPlayer: { p2: 'A' }, prominentHistory: ['p2'] });
  assert.deepEqual(readGameState(null), createInitialState());
});

test('trasiga fynd hoppas över', () => {
  assert.deepEqual(readGameState({ found: [1, 2] }).found, {});
  assert.deepEqual(readGameState({ found: { urklipp: { p1: { roleId: 3 } } } }).found, { urklipp: {} });
});
