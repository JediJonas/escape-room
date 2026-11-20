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
