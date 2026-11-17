import assert from 'node:assert/strict';
import { test } from 'vitest';
import { type SeanceView, findCellCenter } from '../../supabase/functions/game/seance.ts';
import { clampToBoard, describeSeanceStatus, findLitCell, isPlanchetteOnGlow } from './seanceBoard.ts';

const VIEW: SeanceView = {
  segment: { from: findCellCenter(29), to: findCellCenter(7), durationMs: 5000 },
  progress: 0,
  anchorMs: 0,
  movesFromMs: null,
  takenCell: null,
  letterIndex: 0,
  letterCount: 5,
  waitingFor: ['Bo', 'Cia'],
  isMeOnGlow: false,
  myLetter: null,
  isComplete: false,
  brokenBy: null,
};

test('planchetten räknas som på skenet nära mitten, och får glida lite innan den räknas som av', () => {
  const glow = findCellCenter(7);
  const nearby = { x: glow.x + 0.4 / 5, y: glow.y };
  const further = { x: glow.x + 0.7 / 5, y: glow.y };
  assert.equal(isPlanchetteOnGlow({ planchette: nearby, glow, wasOn: false }), true);
  assert.equal(isPlanchetteOnGlow({ planchette: further, glow, wasOn: false }), false);
  assert.equal(isPlanchetteOnGlow({ planchette: further, glow, wasOn: true }), true);
  assert.equal(isPlanchetteOnGlow({ planchette: null, glow, wasOn: true }), false);
});

test('bokstaven lyser medan skenet står på den och slocknar när det glider vidare', () => {
  const taken = { ...VIEW, takenCell: 7 };
  assert.equal(findLitCell(taken, findCellCenter(7)), 7);
  assert.equal(findLitCell(taken, findCellCenter(8)), null);
  assert.equal(findLitCell(VIEW, findCellCenter(7)), null);
});

test('planchetten stannar på brädet', () => {
  assert.deepEqual(clampToBoard({ x: -0.2, y: 1.3 }), { x: 0, y: 1 });
});

test('raden under brädet visar vem skenet väntar på, vem som släppte och när det är slut', () => {
  assert.equal(describeSeanceStatus(VIEW, 0, false), 'Skenet väntar på Bo och Cia.');
  assert.equal(describeSeanceStatus({ ...VIEW, waitingFor: ['Bo'] }, 0, false), 'Skenet väntar på Bo.');
  assert.equal(describeSeanceStatus({ ...VIEW, waitingFor: ['Anna', 'Bo', 'Cia'] }, 0, false), 'Skenet väntar på Anna, Bo och Cia.');
  assert.equal(describeSeanceStatus({ ...VIEW, waitingFor: ['A', 'B', 'C', 'D'] }, 0, false), 'Skenet väntar på 4 av er.');
  assert.equal(describeSeanceStatus({ ...VIEW, movesFromMs: 0, waitingFor: [] }, 0, false), 'Alla följer skenet.');
  const broken = { ...VIEW, brokenBy: { name: 'Bo', atMs: 10_000 } };
  assert.equal(describeSeanceStatus(broken, 12_000, false), 'Kontakten bröts. Bo släppte. Det börjar om.');
  assert.equal(describeSeanceStatus(broken, 20_000, false), 'Skenet väntar på Bo och Cia.');
  assert.equal(describeSeanceStatus({ ...VIEW, isComplete: true }, 0, false), 'Skenet har slocknat.');
  assert.equal(describeSeanceStatus(VIEW, 0, true), 'Skenet väntar på dig.');
  assert.equal(describeSeanceStatus({ ...VIEW, isMeOnGlow: true }, 0, true), 'Skenet väntar på Bo och Cia.');
});
