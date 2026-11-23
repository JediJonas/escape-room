import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildOutlinePath, listFrameOutline } from './roomFrame.ts';

test('ramen går runt saken med luft på alla sidor', () => {
  const outline = listFrameOutline({ yawDeg: 10, pitchDeg: 0, radiusDeg: 10, frame: { yawDeg: 10, pitchDeg: 0, widthDeg: 20, heightDeg: 10 } });
  const yaws = outline.map((point) => point.yawDeg);
  const pitches = outline.map((point) => point.pitchDeg);
  assert.deepEqual([Math.min(...yaws), Math.max(...yaws)], [-1, 21]);
  assert.deepEqual([Math.min(...pitches), Math.max(...pitches)], [-6, 6]);
});

test('långt ner får ramen mer luft i sidled, så att luften ser lika bred ut', () => {
  const outline = listFrameOutline({ yawDeg: 0, pitchDeg: -60, radiusDeg: 10, frame: { yawDeg: 0, pitchDeg: -60, widthDeg: 20, heightDeg: 10 } });
  assert.ok(Math.abs(Math.max(...outline.map((point) => point.yawDeg)) - 12) < 1e-9);
});

test('en plats utan ram får en fyrkant över radien', () => {
  const outline = listFrameOutline({ yawDeg: 5, pitchDeg: 0, radiusDeg: 12 });
  const yaws = outline.map((point) => point.yawDeg);
  assert.deepEqual([Math.min(...yaws), Math.max(...yaws)], [-8, 18]);
});

test('en plats med kontur ritas efter sakens form i stället för ramen', () => {
  const outline: [number, number][] = [[0, 0], [10, 5], [4, -6]];
  assert.deepEqual(listFrameOutline({ yawDeg: 4, pitchDeg: 0, radiusDeg: 8, outline }), [{ yawDeg: 0, pitchDeg: 0 }, { yawDeg: 10, pitchDeg: 5 }, { yawDeg: 4, pitchDeg: -6 }]);
});

const square = [{ xPx: 0, yPx: 0 }, { xPx: 10, yPx: 0 }, { xPx: 10, yPx: 10 }, { xPx: 0, yPx: 10 }];

test('utan dolda linjer går konturen runt och sluts', () => {
  assert.equal(buildOutlinePath(square), 'M0.0,0.0L10.0,0.0L10.0,10.0L0.0,10.0Z');
});

test('en dold linje lämnar en öppen väg runt resten', () => {
  assert.equal(buildOutlinePath(square, [3]), 'M0.0,0.0L10.0,0.0L10.0,10.0L0.0,10.0');
  assert.equal(buildOutlinePath(square, [1]), 'M10.0,10.0L0.0,10.0L0.0,0.0L10.0,0.0');
});

test('två dolda linjer delar konturen i två bitar', () => {
  assert.equal(buildOutlinePath(square, [0, 2]), 'M10.0,0.0L10.0,10.0M0.0,10.0L0.0,0.0');
});
