import assert from 'node:assert/strict';
import { test } from 'vitest';
import { formatMemoryLeft } from './memoryTime.ts';

test('tiden kvar visas som minuter och sekunder, avrundat uppåt', () => {
  assert.equal(formatMemoryLeft(180_000), '3:00');
  assert.equal(formatMemoryLeft(65_001), '1:06');
  assert.equal(formatMemoryLeft(-5), '0:00');
});
