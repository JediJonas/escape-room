import assert from 'node:assert/strict';
import { test } from 'vitest';
import { measureMovement, tiltToPosition } from './tilt.js';

test('plan mobil ger pricken i mitten', () => {
  assert.deepEqual(tiltToPosition({ beta: 0, gamma: 0 }), { x: 0, y: 0 });
});

test('lutning räknas om till andel av största lutningen', () => {
  assert.deepEqual(tiltToPosition({ beta: 15, gamma: -15 }, 30), { x: -0.5, y: 0.5 });
});

test('kraftig lutning stannar vid kanten', () => {
  assert.deepEqual(tiltToPosition({ beta: 170, gamma: -89 }, 30), { x: -1, y: 1 });
});

test('saknade värden räknas som plant', () => {
  assert.deepEqual(tiltToPosition({ beta: null, gamma: null }), { x: 0, y: 0 });
});

test('rörelse mäts som accelerationens styrka', () => {
  assert.equal(measureMovement({ acceleration: { x: 3, y: 4, z: 0 } }), 5);
});

test('utan ren acceleration dras tyngdkraften av', () => {
  const movement = measureMovement({
    acceleration: { x: null, y: null, z: null },
    accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 },
  });
  assert.ok(movement !== null && movement < 0.001);
});

test('mobil utan värden ger null', () => {
  assert.equal(measureMovement({ acceleration: null, accelerationIncludingGravity: null }), null);
});
