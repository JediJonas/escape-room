import assert from 'node:assert/strict';
import { test } from 'vitest';
import { canHelpWithTask, describeDone, describeSceneSkip, describeUnread } from './leaderMenu.ts';

test('raden räknar de klara och visar deras namn inom parentes', () => {
  const progress = [{ name: 'Anna', isDone: true }, { name: 'Bo', isDone: false }, { name: 'Cia', isDone: true }];
  assert.equal(describeDone(progress), 'Klara: 2 av 3 (Anna, Cia)');
});

test('raden har ingen parentes när ingen är klar', () => {
  assert.equal(describeDone([{ name: 'Anna', isDone: false }, { name: 'Bo', isDone: false }]), 'Klara: 0 av 2');
});

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

test('i urklippen ser spelledaren vilka som inte har läst (Jonas 2026-11-18)', () => {
  const progress = [{ name: 'Anna', isDone: true }, { name: 'Bo', isDone: false }, { name: 'Cia', isDone: false }];
  assert.equal(describeUnread(progress, 'Tidningsurklippen'), 'Har inte läst tidningsurklippen: Bo, Cia');
  assert.equal(describeUnread([{ name: 'Anna', isDone: true }], 'Tidningsurklippen'), 'Alla har läst tidningsurklippen.');
});

test('i urklippen räknar Alla är klara först alla som lästa, och sedan hoppar knappen över uppgiften', () => {
  assert.equal(describeSceneSkip([{ name: 'Anna', isDone: true }, { name: 'Bo', isDone: false }], 'Tidningsurklippen'), 'Alla är klara');
  assert.equal(describeSceneSkip([{ name: 'Anna', isDone: true }, { name: 'Bo', isDone: true }], 'Tidningsurklippen'), 'Hoppa över uppgiften');
  assert.equal(describeSceneSkip([{ name: 'Anna', isDone: true }], null), 'Alla är klara');
});
