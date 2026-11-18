import assert from 'node:assert/strict';
import { test } from 'vitest';
import { readingMs } from './infoBox.ts';

test('en längre text står kvar längre, men aldrig kortare än fem eller längre än femton sekunder', () => {
  assert.equal(readingMs('Kort.'), 5000);
  assert.ok(readingMs('x'.repeat(100)) > readingMs('x'.repeat(80)));
  assert.equal(readingMs('x'.repeat(1000)), 15_000);
});
