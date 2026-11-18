import assert from 'node:assert/strict';
import { test } from 'vitest';
import { canHelpWithTask } from './leaderMenu.ts';

test('ledtråd och facit syns vid saken som är uppgiften', () => {
  assert.equal(canHelpWithTask({ isTask: true, isAtTask: true, isSolved: false }), true);
});

test('ledtråd och facit syns inte någon annanstans i huset', () => {
  assert.equal(canHelpWithTask({ isTask: true, isAtTask: false, isSolved: false }), false);
});

test('ledtråd och facit syns inte när uppgiften redan är klarad', () => {
  assert.equal(canHelpWithTask({ isTask: true, isAtTask: true, isSolved: true }), false);
});

test('ledtråd och facit syns inte i en scen', () => {
  assert.equal(canHelpWithTask({ isTask: false, isAtTask: true, isSolved: false }), false);
});
