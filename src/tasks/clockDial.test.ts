import assert from 'node:assert/strict';
import { test } from 'vitest';
import { angleFromCenter, dragMinuteHand, findHandAngles, formatDialTime } from './clockDial.ts';

test('vinkeln räknas medurs från tolvan', () => {
  assert.equal(angleFromCenter(0, -1), 0);
  assert.equal(angleFromCenter(1, 0), 90);
  assert.equal(angleFromCenter(0, 1), 180);
  assert.equal(angleFromCenter(-1, 0), 270);
});

test('minutvisaren går runt tolvan åt båda hållen', () => {
  assert.equal(dragMinuteHand(280, 354, 6), 282);
  assert.equal(dragMinuteHand(300, 6, 354), 298);
});

test('timvisaren följer minuterna', () => {
  assert.deepEqual(findHandAngles(555), { hour: 277.5, minute: 90 });
  assert.deepEqual(findHandAngles(-60), { hour: 330, minute: 0 });
  assert.equal(formatDialTime(280), '4.40');
  assert.equal(formatDialTime(2), '12.00');
  assert.equal(formatDialTime(557), '9.15');
});
