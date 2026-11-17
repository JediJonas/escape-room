import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildJoinUrl, readJoinCodeFromUrl, removeJoinCodeFromUrl } from './joinLink.ts';

const PAGE = 'https://jedijonas.github.io/escape-room/?matt#topp';

test('länken leder till samma sida med koden och inget annat', () => {
  assert.equal(buildJoinUrl(PAGE, 'BCDF'), 'https://jedijonas.github.io/escape-room/?kod=BCDF');
});

test('koden läses ur adressen och tål gemener', () => {
  assert.equal(readJoinCodeFromUrl('https://example.se/escape-room/?kod=bcdf'), 'BCDF');
  assert.equal(readJoinCodeFromUrl(PAGE), '');
});

test('koden tas bort ur adressen men inget annat', () => {
  assert.equal(removeJoinCodeFromUrl('https://example.se/?kod=BCDF&matt'), 'https://example.se/?matt=');
});
