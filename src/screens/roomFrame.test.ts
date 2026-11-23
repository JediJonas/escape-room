import assert from 'node:assert/strict';
import { test } from 'vitest';
import { findSpotFrame, listFrameOutline } from './roomFrame.ts';

test('ramen går runt saken med luft på alla sidor', () => {
  const outline = listFrameOutline({ yawDeg: 10, pitchDeg: 0, widthDeg: 20, heightDeg: 10 }, 1);
  const yaws = outline.map((point) => point.yawDeg);
  const pitches = outline.map((point) => point.pitchDeg);
  assert.deepEqual([Math.min(...yaws), Math.max(...yaws)], [-1, 21]);
  assert.deepEqual([Math.min(...pitches), Math.max(...pitches)], [-6, 6]);
});

test('långt ner får ramen mer luft i sidled, så att luften ser lika bred ut', () => {
  const outline = listFrameOutline({ yawDeg: 0, pitchDeg: -60, widthDeg: 20, heightDeg: 10 }, 1);
  assert.ok(Math.abs(Math.max(...outline.map((point) => point.yawDeg)) - 12) < 1e-9);
});

test('en plats utan ram får en fyrkant över träffytan', () => {
  assert.deepEqual(findSpotFrame({ yawDeg: 5, pitchDeg: -3, radiusDeg: 12 }), { yawDeg: 5, pitchDeg: -3, widthDeg: 24, heightDeg: 24 });
});
