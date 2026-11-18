import assert from 'node:assert/strict';
import { test } from 'vitest';
import { formatFlashbackLeft } from './flashbackTime.ts';

test('tiden kvar visas som minuter och sekunder, avrundat uppåt', () => {
  assert.equal(formatFlashbackLeft(180_000), '3:00');
  assert.equal(formatFlashbackLeft(65_001), '1:06');
  assert.equal(formatFlashbackLeft(-5), '0:00');
});
