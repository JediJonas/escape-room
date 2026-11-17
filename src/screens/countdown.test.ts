import assert from 'node:assert/strict';
import { test } from 'vitest';
import { formatRemaining } from './countdown.ts';

test('tiden skrivs som minuter och sekunder', () => {
  assert.equal(formatRemaining(60 * 60_000), '60:00');
  assert.equal(formatRemaining(59 * 60_000 + 7_000), '59:07');
  // En påbörjad sekund räknas, så att 0:00 visas först när tiden är slut.
  assert.equal(formatRemaining(400), '0:01');
  assert.equal(formatRemaining(0), '0:00');
  assert.equal(formatRemaining(-5_000), '0:00');
});
