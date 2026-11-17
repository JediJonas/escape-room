import assert from 'node:assert/strict';
import { test } from 'vitest';
import { JOIN_CODE_LETTERS, createJoinCode, isValidJoinCode, normalizeJoinCode } from './joinCode.ts';

test('koden har fyra bokstäver ur listan', () => {
  assert.equal(createJoinCode(() => 0), 'BBBB');
  assert.equal(createJoinCode((count) => count - 1), 'ZZZZ');
  const code = createJoinCode((count) => Math.floor(Math.random() * count));
  assert.ok(isValidJoinCode(code), code);
});

test('listan saknar bokstäver som är lätta att blanda ihop och vokaler', () => {
  for (const letter of 'AEIOUYÅÄÖ') assert.ok(!JOIN_CODE_LETTERS.includes(letter), letter);
});

test('en inskriven kod tål gemener och mellanslag', () => {
  assert.equal(normalizeJoinCode(' bc df '), 'BCDF');
});

test('en kod med fel längd eller fel bokstäver godtas inte', () => {
  assert.ok(!isValidJoinCode('BCD'));
  assert.ok(!isValidJoinCode('BCDFG'));
  assert.ok(!isValidJoinCode('BCDA'));
  assert.ok(!isValidJoinCode('bcdf'));
});
