import assert from 'node:assert/strict';
import { test } from 'vitest';
import { SWIPE_PX, swipeTarget } from './swipe.ts';

test('en dragning åt vänster bläddrar framåt och åt höger bakåt, men inte förbi kanterna', () => {
  assert.equal(swipeTarget(0, 3, -SWIPE_PX), 1);
  assert.equal(swipeTarget(1, 3, SWIPE_PX), 0);
  assert.equal(swipeTarget(2, 3, -SWIPE_PX * 2), 2);
  assert.equal(swipeTarget(0, 3, SWIPE_PX * 2), 0);
});

test('en kort dragning bläddrar inte, så att man kan läsa och rulla i lugn och ro', () => {
  assert.equal(swipeTarget(1, 3, SWIPE_PX - 1), 1);
  assert.equal(swipeTarget(1, 3, -(SWIPE_PX - 1)), 1);
});
