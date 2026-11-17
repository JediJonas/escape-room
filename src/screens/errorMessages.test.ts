import assert from 'node:assert/strict';
import { test } from 'vitest';
import { getErrorMessage } from './errorMessages.ts';

test('en känd felkod får sin text', () => {
  assert.match(getErrorMessage('nameTaken'), /heter redan så/);
  assert.match(getErrorMessage('invalidName'), /20 tecken/);
});

test('ett okänt fel eller nätfel säger att servern inte gick att nå', () => {
  assert.match(getErrorMessage('network'), /nå servern/);
  assert.match(getErrorMessage('toString'), /nå servern/);
});
