import assert from 'node:assert/strict';
import { test } from 'vitest';
import { parsePlaceCode } from './placeCode.js';

test('ett platskort ger platsens id', () => {
  assert.equal(parsePlaceCode('plats:C'), 'C');
});

test('små bokstäver och blanktecken godtas', () => {
  assert.equal(parsePlaceCode('plats: f '), 'F');
});

test('okänd plats är inget platskort', () => {
  assert.equal(parsePlaceCode('plats:G'), null);
});

test('andra koder är inga platskort', () => {
  assert.equal(parsePlaceCode('https://example.com'), null);
  assert.equal(parsePlaceCode(''), null);
  assert.equal(parsePlaceCode(null), null);
});
