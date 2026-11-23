import assert from 'node:assert/strict';
import { test } from 'vitest';
import { findSpotAt, isSpot, measureAngleDeg } from './spots.ts';

test('vinkeln räknas över skarven, där vridningen går från 180 till -180', () => {
  assert.ok(Math.abs(measureAngleDeg({ yawDeg: 175, pitchDeg: 0 }, { yawDeg: -175, pitchDeg: 0 }) - 10) < 1e-9);
  // Nära taket ligger två riktningar nära varandra fast vridningen skiljer mycket.
  assert.ok(measureAngleDeg({ yawDeg: 0, pitchDeg: 80 }, { yawDeg: 90, pitchDeg: 80 }) < 15);
});

test('det närmaste inom träffytan vinner', () => {
  const items = [{ name: 'dörren', spot: { yawDeg: 170, pitchDeg: 0, radiusDeg: 15 } }, { name: 'tavlan', spot: { yawDeg: -170, pitchDeg: 0, radiusDeg: 15 } }];
  assert.equal(findSpotAt(items, { yawDeg: -175, pitchDeg: 0 })?.name, 'tavlan');
  assert.equal(findSpotAt(items, { yawDeg: 0, pitchDeg: 0 }), null);
  assert.equal(findSpotAt(items, { yawDeg: 175, pitchDeg: 40 }), null);
  assert.equal(findSpotAt(items, { yawDeg: 175, pitchDeg: 40 }, { isSidewaysOnly: true })?.name, 'dörren');
});

test('en plats har vridning, lutning och en träffyta som inte är för stor', () => {
  assert.ok(isSpot({ yawDeg: -28, pitchDeg: -12, radiusDeg: 16 }));
  assert.ok(!isSpot({ yawDeg: 200, pitchDeg: 0, radiusDeg: 10 }));
  assert.ok(!isSpot({ yawDeg: 0, pitchDeg: 0, radiusDeg: 90 }));
  assert.ok(!isSpot('pianot'));
});

test('en plats kan ha en ram runt saken, och ramen måste gå att läsa', () => {
  const frame = { yawDeg: -25, pitchDeg: -21, widthDeg: 40, heightDeg: 35 };
  assert.ok(isSpot({ yawDeg: -28, pitchDeg: -12, radiusDeg: 16, frame }));
  assert.ok(!isSpot({ yawDeg: -28, pitchDeg: -12, radiusDeg: 16, frame: { ...frame, widthDeg: 0 } }));
  assert.ok(!isSpot({ yawDeg: -28, pitchDeg: -12, radiusDeg: 16, frame: { ...frame, pitchDeg: 100 } }));
  assert.ok(!isSpot({ yawDeg: -28, pitchDeg: -12, radiusDeg: 16, frame: 'pianot' }));
});

test('saken tänds när mitten är innanför ramen, också vid kanten, men inte utanför', () => {
  const items = [{ name: 'vitrinskåpet', spot: { yawDeg: -150, pitchDeg: -8, radiusDeg: 16, frame: { yawDeg: -150, pitchDeg: -8, widthDeg: 40, heightDeg: 60 } } }];
  // En bred sak tänds i hela ramen, inte bara nära mitten.
  assert.equal(findSpotAt(items, { yawDeg: -169, pitchDeg: 20 })?.name, 'vitrinskåpet');
  // Strax utanför ramen tänds den inte, fast den gamla radien hade räckt.
  assert.equal(findSpotAt(items, { yawDeg: -128, pitchDeg: -8 }), null);
});

test('en bred ram vinner över en smal när mitten ligger i båda', () => {
  const items = [
    { name: 'tavlan', spot: { yawDeg: 0, pitchDeg: 0, radiusDeg: 8, frame: { yawDeg: 0, pitchDeg: 0, widthDeg: 10, heightDeg: 10 } } },
    { name: 'bokhyllan', spot: { yawDeg: 6, pitchDeg: 0, radiusDeg: 30, frame: { yawDeg: 6, pitchDeg: 0, widthDeg: 60, heightDeg: 60 } } },
  ];
  // Mitten ligger närmare tavlans mitt, så tavlan vinner fast bokhyllan är större.
  assert.equal(findSpotAt(items, { yawDeg: 2, pitchDeg: 0 })?.name, 'tavlan');
});

test('en kontur är minst tre punkter med vridning och lutning', () => {
  const spot = { yawDeg: 0, pitchDeg: 0, radiusDeg: 10 };
  assert.ok(isSpot({ ...spot, outline: [[0, 0], [10, 5], [4, -6]] }));
  assert.ok(!isSpot({ ...spot, outline: [[0, 0], [10, 5]] }));
  assert.ok(!isSpot({ ...spot, outline: [[0, 0], [10, 5], [4, -100]] }));
});

test('dolda linjer finns bara på en kontur, och minst en linje syns', () => {
  const spot = { yawDeg: 0, pitchDeg: 0, radiusDeg: 10, outline: [[0, 0], [10, 5], [4, -6]] };
  assert.ok(isSpot({ ...spot, hiddenEdges: [2] }));
  assert.ok(isSpot({ ...spot, hiddenEdges: [0, 1] }));
  assert.ok(!isSpot({ ...spot, hiddenEdges: [0, 1, 2] }));
  assert.ok(!isSpot({ ...spot, hiddenEdges: [3] }));
  assert.ok(!isSpot({ ...spot, hiddenEdges: [1, 1] }));
  assert.ok(!isSpot({ ...spot, hiddenEdges: [0.5] }));
  assert.ok(!isSpot({ yawDeg: 0, pitchDeg: 0, radiusDeg: 10, hiddenEdges: [0] }));
});
