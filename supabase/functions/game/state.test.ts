import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createInitialState, readGameState } from './state.ts';

test('ett spel från före platserna får startvärden för de nya fälten', () => {
  assert.deepEqual(readGameState({ status: 'lobby' }), createInitialState());
});

test('ett sparat tillstånd läses som det är', () => {
  const saved = { status: 'running', usesPlaceCards: false, stepIndex: 2, placeByPlayer: { p1: 'C' }, roleByPlayer: { p1: { roleId: 'siaren', pieceIndexes: [0] } }, prominentHistory: ['p1'], readyPlayerIds: ['p1'], hintsGiven: 2, isSolutionShown: true, clock: { durationMs: 3_600_000, startedAtMs: 5, pausedAtMs: null, pausedTotalMs: 0 } };
  assert.deepEqual(readGameState(saved), saved);
});

test('okända värden i ett sparat tillstånd ersätts', () => {
  assert.deepEqual(readGameState({ status: 'trasig', stepIndex: 'två', placeByPlayer: { p1: 'Q', p2: 'A' }, roleByPlayer: { p1: { roleId: 7 } }, prominentHistory: [3, 'p2'] }), { ...createInitialState(), placeByPlayer: { p2: 'A' }, prominentHistory: ['p2'] });
  assert.deepEqual(readGameState(null), createInitialState());
});
