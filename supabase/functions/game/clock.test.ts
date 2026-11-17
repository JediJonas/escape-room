import assert from 'node:assert/strict';
import { test } from 'vitest';
import { describeClock, findRemainingMs, pauseClock, readGameClock, readGameMinutes, resumeClock, startClock } from './clock.ts';

const MINUTE = 60_000;

test('bara 45, 60 och 75 minuter godtas, annars blir det 60', () => {
  assert.equal(readGameMinutes(45), 45);
  assert.equal(readGameMinutes(75), 75);
  assert.equal(readGameMinutes(30), 60);
  assert.equal(readGameMinutes('45'), 60);
  assert.equal(readGameMinutes(undefined), 60);
});

test('klockan räknar ner från starten', () => {
  const view = describeClock(startClock(60, 1000));
  assert.deepEqual(view, { isPaused: false, endsAtMs: 1000 + 60 * MINUTE });
  assert.equal(findRemainingMs(view, 1000 + 10 * MINUTE), 50 * MINUTE);
});

test('en paus stoppar klockan och flyttar slutet lika långt', () => {
  const started = startClock(45, 0);
  const paused = pauseClock(started, 5 * MINUTE);
  assert.deepEqual(describeClock(paused), { isPaused: true, remainingMs: 40 * MINUTE });
  // Att pausa igen ändrar inte när pausen började.
  assert.deepEqual(pauseClock(paused, 6 * MINUTE), paused);
  const resumed = resumeClock(paused, 8 * MINUTE);
  assert.deepEqual(describeClock(resumed), { isPaused: false, endsAtMs: 48 * MINUTE });
  assert.deepEqual(resumeClock(resumed, 9 * MINUTE), resumed);
});

test('efter sluttiden blir tiden kvar negativ', () => {
  assert.equal(findRemainingMs(describeClock(startClock(45, 0)), 46 * MINUTE), -MINUTE);
});

test('en trasig sparad klocka blir null', () => {
  const clock = startClock(60, 1000);
  assert.deepEqual(readGameClock(JSON.parse(JSON.stringify(clock))), clock);
  assert.equal(readGameClock(null), null);
  assert.equal(readGameClock({ ...clock, startedAtMs: 'igår' }), null);
  assert.equal(readGameClock({ ...clock, pausedAtMs: undefined }), null);
});
