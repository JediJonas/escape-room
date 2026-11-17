import assert from 'node:assert/strict';
import { test } from 'vitest';
import { GLOW_GLIDE_MS, type SeanceView } from '../../supabase/functions/game/seance.ts';
import { clampToBoard, describeSeanceStatus, findCellCenter, findGlowPoint, isPlanchetteOnGlow } from './seanceBoard.ts';

const VIEW: SeanceView = {
  glowCell: 7,
  previousCell: null,
  glowMovesAtMs: null,
  letterIndex: 0,
  letterCount: 5,
  followerCount: 1,
  playerCount: 3,
  isMeOnGlow: false,
  myLetter: null,
  isComplete: false,
  brokenBy: null,
};

test('rutornas mitt räknas från övre vänstra hörnet, fem i bredd och sex i höjd', () => {
  assert.deepEqual(findCellCenter(0), { x: 0.1, y: 1 / 12 });
  assert.deepEqual(findCellCenter(7), { x: 0.5, y: 0.25 });
});

test('skenet står kvar, glider och kommer fram', () => {
  const moving = { ...VIEW, previousCell: 0, glowMovesAtMs: 1000 };
  assert.deepEqual(findGlowPoint(moving, 500), { point: findCellCenter(0), hasArrived: false });
  const halfway = findGlowPoint(moving, 1000 + GLOW_GLIDE_MS / 2);
  assert.ok(Math.abs(halfway.point.x - 0.3) < 1e-9 && !halfway.hasArrived);
  assert.deepEqual(findGlowPoint(moving, 1000 + GLOW_GLIDE_MS), { point: findCellCenter(7), hasArrived: true });
  assert.deepEqual(findGlowPoint(VIEW, 0), { point: findCellCenter(7), hasArrived: true });
});

test('planchetten räknas som på skenet nära mitten, och får glida lite innan den räknas som av', () => {
  const glow = findCellCenter(7);
  const nearby = { x: glow.x + 0.4 / 5, y: glow.y };
  const further = { x: glow.x + 0.7 / 5, y: glow.y };
  assert.equal(isPlanchetteOnGlow({ planchette: nearby, glow, hasArrived: true, wasOn: false }), true);
  assert.equal(isPlanchetteOnGlow({ planchette: further, glow, hasArrived: true, wasOn: false }), false);
  assert.equal(isPlanchetteOnGlow({ planchette: further, glow, hasArrived: true, wasOn: true }), true);
  assert.equal(isPlanchetteOnGlow({ planchette: glow, glow, hasArrived: false, wasOn: true }), false);
  assert.equal(isPlanchetteOnGlow({ planchette: null, glow, hasArrived: true, wasOn: true }), false);
});

test('planchetten stannar på brädet', () => {
  assert.deepEqual(clampToBoard({ x: -0.2, y: 1.3 }), { x: 0, y: 1 });
});

test('raden under brädet visar hur många som följer, vem som släppte och när det är slut', () => {
  assert.equal(describeSeanceStatus(VIEW, 0), '1 av 3 följer skenet.');
  const broken = { ...VIEW, brokenBy: { name: 'Bo', atMs: 10_000 } };
  assert.equal(describeSeanceStatus(broken, 12_000), 'Kontakten bröts. Bo släppte. Det börjar om.');
  assert.equal(describeSeanceStatus(broken, 20_000), '1 av 3 följer skenet.');
  assert.equal(describeSeanceStatus({ ...VIEW, isComplete: true }, 0), 'Skenet har slocknat.');
});
