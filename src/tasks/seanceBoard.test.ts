import assert from 'node:assert/strict';
import { test } from 'vitest';
import { type SeanceView, findCellCenter } from '../../supabase/functions/game/seance.ts';
import { ARRIVED_RETRY_MS, ARRIVED_STAGGER_MS, clampToBoard, describeSeanceStatus, holdGlowProgress, isFingerOnGlow, shouldReportArrival } from './seanceBoard.ts';

const VIEW: SeanceView = {
  segment: { from: findCellCenter(29), to: findCellCenter(7), durationMs: 5000 },
  progress: 0,
  anchorMs: 0,
  movesFromMs: null,
  letterIndex: 0,
  letterCount: 5,
  waitingFor: ['Bo', 'Cia'],
  followers: [],
  isMeOnGlow: false,
  myFollowOrder: null,
  isComplete: false,
  brokenBy: null,
};

test('fingret räknas som på planchetten nära glasets mitt, och får glida lite innan det räknas som av', () => {
  const glow = findCellCenter(7);
  const nearby = { x: glow.x + 0.4 / 5, y: glow.y };
  const further = { x: glow.x + 0.7 / 5, y: glow.y };
  assert.equal(isFingerOnGlow({ finger: nearby, glow, wasOn: false }), true);
  assert.equal(isFingerOnGlow({ finger: further, glow, wasOn: false }), false);
  assert.equal(isFingerOnGlow({ finger: further, glow, wasOn: true }), true);
  assert.equal(isFingerOnGlow({ finger: null, glow, wasOn: true }), false);
});

test('fingret stannar på brädet', () => {
  assert.deepEqual(clampToBoard({ x: -0.2, y: 1.3 }), { x: 0, y: 1 });
});

test('raden under brädet visar vem planchetten väntar på, vem som släppte och när det är slut', () => {
  assert.equal(describeSeanceStatus(VIEW, 0, false), 'Planchetten väntar på Bo och Cia.');
  assert.equal(describeSeanceStatus({ ...VIEW, waitingFor: ['Bo'] }, 0, false), 'Planchetten väntar på Bo.');
  assert.equal(describeSeanceStatus({ ...VIEW, waitingFor: ['Anna', 'Bo', 'Cia'] }, 0, false), 'Planchetten väntar på Anna, Bo och Cia.');
  assert.equal(describeSeanceStatus({ ...VIEW, waitingFor: ['A', 'B', 'C', 'D'] }, 0, false), 'Planchetten väntar på 4 av er.');
  assert.equal(describeSeanceStatus({ ...VIEW, movesFromMs: 0, waitingFor: [] }, 0, false), 'Alla följer planchetten.');
  const broken = { ...VIEW, brokenBy: { name: 'Bo', atMs: 10_000 } };
  assert.equal(describeSeanceStatus(broken, 12_000, false), 'Kontakten bröts. Bo släppte. Det börjar om.');
  assert.equal(describeSeanceStatus(broken, 20_000, false), 'Planchetten väntar på Bo och Cia.');
  assert.equal(describeSeanceStatus({ ...VIEW, isComplete: true }, 0, false), '');
  assert.equal(describeSeanceStatus(VIEW, 0, true), 'Planchetten väntar på dig.');
  assert.equal(describeSeanceStatus({ ...VIEW, isMeOnGlow: true }, 0, true), 'Planchetten väntar på Bo och Cia.');
});

test('planchetten flyttar sig aldrig bakåt, och hoppar inte när den stannar', () => {
  const maxStep = 0.05;
  assert.equal(holdGlowProgress({ computed: 0.3, shown: null, isHeld: false, maxStep }), 0.3);
  // Servern ligger efter det som syns medan planchetten rör sig: den står kvar tills servern kommer ikapp.
  assert.equal(holdGlowProgress({ computed: 0.4, shown: 0.5, isHeld: false, maxStep }), 0.5);
  assert.equal(holdGlowProgress({ computed: 0.53, shown: 0.5, isHeld: false, maxStep }), 0.53);
  // Ligger planchetten långt efter servern glider den ikapp i stället för att hoppa.
  assert.equal(holdGlowProgress({ computed: 0.8, shown: 0.5, isHeld: false, maxStep }), 0.55);
  // Står planchetten still hoppar den varken bakåt eller framåt.
  assert.equal(holdGlowProgress({ computed: 0.6, shown: 0.5, isHeld: true, maxStep }), 0.5);
  assert.equal(holdGlowProgress({ computed: 0.4, shown: 0.5, isHeld: true, maxStep }), 0.5);
});

test('den som kom först till planchetten säger till direkt att den har nått bokstaven, de andra väntar på sin tur', () => {
  const reachedAtMs = 10_000;
  assert.equal(shouldReportArrival({ nowMs: reachedAtMs, reachedAtMs, sentAtMs: null, followOrder: 0 }), true);
  assert.equal(shouldReportArrival({ nowMs: reachedAtMs + ARRIVED_STAGGER_MS - 1, reachedAtMs, sentAtMs: null, followOrder: 1 }), false);
  assert.equal(shouldReportArrival({ nowMs: reachedAtMs + ARRIVED_STAGGER_MS, reachedAtMs, sentAtMs: null, followOrder: 1 }), true);
  // Höll servern inte med frågar mobilen igen efter en stund, inte i varje bildruta.
  assert.equal(shouldReportArrival({ nowMs: reachedAtMs + 100, reachedAtMs, sentAtMs: reachedAtMs, followOrder: 0 }), false);
  assert.equal(shouldReportArrival({ nowMs: reachedAtMs + ARRIVED_RETRY_MS, reachedAtMs, sentAtMs: reachedAtMs, followOrder: 0 }), true);
});
