import assert from 'node:assert/strict';
import { test } from 'vitest';
import { angleFromCenter, dragMinuteHand, findHandAngles, formatDialTime, isGravityFlipped, readWheelAngle, wrapAngleDelta } from './clockDial.ts';

test('vinkeln räknas medurs från tolvan', () => {
  assert.equal(angleFromCenter(0, -1), 0);
  assert.equal(angleFromCenter(1, 0), 90);
  assert.equal(angleFromCenter(0, 1), 180);
  assert.equal(angleFromCenter(-1, 0), 270);
});

test('minutvisaren går runt tolvan åt båda hållen', () => {
  assert.equal(wrapAngleDelta(350), -10);
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

test('mobilen som ratt: medurs ger fler minuter, oavsett åt vilket håll webbläsaren ger tyngdkraften', () => {
  const upright = { x: 0, y: 9.8 };
  assert.equal(isGravityFlipped(upright), false);
  assert.equal(Math.abs(readWheelAngle(upright, false) ?? 1), 0);
  // Medurs vriden mobil: uppåt i skärmen pekar åt vänster.
  const turned = { x: -Math.sin(Math.PI / 6) * 9.8, y: Math.cos(Math.PI / 6) * 9.8 };
  assert.ok(Math.abs((readWheelAngle(turned, false) ?? 0) - 30) < 1e-9);
  const iphone = { x: -turned.x, y: -turned.y };
  assert.equal(isGravityFlipped({ x: 0, y: -9.8 }), true);
  assert.ok(Math.abs((readWheelAngle(iphone, true) ?? 0) - 30) < 1e-9);
  assert.equal(readWheelAngle({ x: 0.5, y: 0.5 }, false), null);
});
