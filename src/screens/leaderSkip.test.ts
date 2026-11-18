import assert from 'node:assert/strict';
import { test } from 'vitest';
import { canLeaderSkip, type LeaderSkipInput } from './leaderSkip.ts';

const ME = { isMe: true, isDone: false };
const DONE = { isMe: false, isDone: true };
const WAITING = { isMe: false, isDone: false };

function input(overrides: Partial<LeaderSkipInput>): LeaderSkipInput {
  return { isLeaderPlaying: true, usesReadyButton: true, isMeDone: false, progress: [ME, DONE, WAITING], ...overrides };
}

test('knappen syns när någon annan inte är klar', () => {
  assert.equal(canLeaderSkip(input({})), true);
});

test('knappen döljs när alla utom spelledaren är klara', () => {
  assert.equal(canLeaderSkip(input({ progress: [ME, DONE, DONE] })), false);
});

test('knappen döljs när spelledaren är ensam och kan trycka Klar', () => {
  assert.equal(canLeaderSkip(input({ progress: [ME] })), false);
});

test('knappen syns när spelledaren redan är klar och väntar på någon', () => {
  assert.equal(canLeaderSkip(input({ isMeDone: true, progress: [{ isMe: true, isDone: true }, DONE, WAITING] })), true);
});

test('knappen syns i en scen där man går till en plats, eftersom den saknar Klar', () => {
  assert.equal(canLeaderSkip(input({ usesReadyButton: false, progress: [ME, DONE, DONE] })), true);
});

test('spelledaren som står utanför ser alltid knappen', () => {
  assert.equal(canLeaderSkip(input({ isLeaderPlaying: false, progress: [DONE, DONE] })), true);
});
