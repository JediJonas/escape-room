import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createInitialState, readGameState } from './state.ts';

test('ett spel från före platserna får startvärden för de nya fälten', () => {
  assert.deepEqual(readGameState({ status: 'lobby' }), createInitialState());
});

test('ett sparat tillstånd läses som det är', () => {
  const saved = { status: 'running', usesPlaceCards: false, stepIndex: 2, placeByPlayer: { p1: 'C' } };
  assert.deepEqual(readGameState(saved), saved);
});

test('okända värden i ett sparat tillstånd ersätts', () => {
  assert.deepEqual(readGameState({ status: 'trasig', stepIndex: 'två', placeByPlayer: { p1: 'Q', p2: 'A' } }), { ...createInitialState(), placeByPlayer: { p2: 'A' } });
  assert.deepEqual(readGameState(null), createInitialState());
});
