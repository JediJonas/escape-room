import assert from 'node:assert/strict';
import { test } from 'vitest';
import { MAX_SWING_DEGREES, dragPendulum, swingPendulum } from './pendulum.ts';

test('pendeln följer fingret men går inte att dra hur långt som helst', () => {
  assert.equal(dragPendulum(0), 0);
  assert.ok(dragPendulum(40) > 0);
  assert.ok(dragPendulum(-40) < 0);
  assert.equal(dragPendulum(10_000), MAX_SWING_DEGREES);
  assert.equal(dragPendulum(-10_000), -MAX_SWING_DEGREES);
});

test('pendeln gungar över till andra sidan och stannar till slut', () => {
  assert.equal(swingPendulum(20, 0), 20);
  assert.ok(swingPendulum(20, 800) < 0);
  assert.ok(Math.abs(swingPendulum(20, 1600)) < 20);
  assert.equal(swingPendulum(20, 60_000), 0);
});
