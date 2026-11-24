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

test('fingret räknas som på planchetten var som helst på den, och får glida lite innan det räknas som av', () => {
  const glow = findCellCenter(7);
  // Rutnätet är 675 × 660 bildpixlar. Cirkeln har radien 129 och mitten 75 under glasets mitt.
  const onGlass = glow;
  const nearTip = { x: glow.x, y: glow.y + 190 / 660 };
  const aboveRing = { x: glow.x, y: glow.y - 70 / 660 };
  const beside = { x: glow.x + 130 / 675, y: glow.y + 75 / 660 };
  const further = { x: glow.x + 150 / 675, y: glow.y + 75 / 660 };
  assert.equal(isFingerOnGlow({ finger: onGlass, glow, wasOn: false }), true);
  assert.equal(isFingerOnGlow({ finger: nearTip, glow, wasOn: false }), true);
  assert.equal(isFingerOnGlow({ finger: aboveRing, glow, wasOn: false }), false);
  assert.equal(isFingerOnGlow({ finger: beside, glow, wasOn: false }), false);
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
