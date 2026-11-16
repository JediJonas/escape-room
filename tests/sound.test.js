import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildFadeOutCurve } from '../web/sound/fade.js';
import { encodeWav, synthesizeChime, synthesizeSilence } from '../web/sound/wav.js';

const readText = (bytes, offset, length) => String.fromCharCode(...bytes.slice(offset, offset + length));

test('wav-filen har rätt huvud och längd', () => {
  const bytes = encodeWav(new Float32Array([0, 1, -1]), 8000);
  const view = new DataView(bytes.buffer);
  assert.equal(readText(bytes, 0, 4), 'RIFF');
  assert.equal(readText(bytes, 8, 4), 'WAVE');
  assert.equal(view.getUint32(24, true), 8000);
  assert.equal(view.getUint32(40, true), 6);
  assert.equal(bytes.length, 44 + 6);
});

test('wav-filen klipper värden utanför -1 till 1', () => {
  const view = new DataView(encodeWav(new Float32Array([2, -2])).buffer);
  assert.equal(view.getInt16(44, true), 32767);
  assert.equal(view.getInt16(46, true), -32767);
});

test('klocktonen är lika lång som sina toner och klingar av', () => {
  const samples = synthesizeChime({ notesHz: [440, 880], noteMs: 500, sampleRateHz: 8000 });
  assert.equal(samples.length, 8000);
  const peakOf = (from, to) => Math.max(...samples.slice(from, to).map(Math.abs));
  assert.ok(peakOf(0, 400) > peakOf(3600, 4000) * 5);
});

test('tystnad är bara nollor', () => {
  const samples = synthesizeSilence(100, 8000);
  assert.equal(samples.length, 800);
  assert.ok(samples.every((sample) => sample === 0));
});

test('uttoningen går från full nivå till noll och sjunker hela vägen', () => {
  const curve = buildFadeOutCurve(0.8, 5);
  assert.ok(Math.abs(curve[0] - 0.8) < 1e-6);
  assert.equal(curve[4], 0);
  for (let i = 1; i < curve.length; i += 1) assert.ok(curve[i] < curve[i - 1]);
});

test('uttoningen följer kurvan volym × kvar³', () => {
  const curve = buildFadeOutCurve(1, 3);
  assert.ok(Math.abs(curve[1] - 0.125) < 1e-6);
});
