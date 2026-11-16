import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  clampPitchDeg,
  dragToTurn,
  MAX_FIELD_OF_VIEW_DEG,
  MAX_PITCH_DEG,
  MIN_FIELD_OF_VIEW_DEG,
  turnLook,
  wrapYawDeg,
  yawToStripOffsetPx,
  zoomFieldOfView,
} from '../web/view/lookDirection.js';

test('vridningen hålls mellan -180 och 180 grader', () => {
  assert.equal(wrapYawDeg(0), 0);
  assert.equal(wrapYawDeg(190), -170);
  assert.equal(wrapYawDeg(-190), 170);
  assert.equal(wrapYawDeg(720 + 45), 45);
  assert.equal(wrapYawDeg(180), -180);
});

test('lutningen stannar strax före rakt upp och rakt ner', () => {
  assert.equal(clampPitchDeg(120), MAX_PITCH_DEG);
  assert.equal(clampPitchDeg(-120), -MAX_PITCH_DEG);
  assert.equal(clampPitchDeg(10), 10);
});

test('en vridning förbi skarven fortsätter på andra sidan', () => {
  assert.deepEqual(turnLook({ yawDeg: 170, pitchDeg: 80 }, { yawDeg: 30, pitchDeg: 30 }), {
    yawDeg: -160,
    pitchDeg: MAX_PITCH_DEG,
  });
});

test('bilden följer fingret: drag åt höger vrider blicken åt vänster', () => {
  const turn = dragToTurn({ xPx: 100, yPx: 0 }, { heightPx: 400, fieldOfViewDeg: 80 });
  assert.equal(turn.yawDeg, -20);
  assert.equal(Math.abs(turn.pitchDeg), 0);
});

test('drag nedåt vrider blicken uppåt', () => {
  assert.equal(dragToTurn({ xPx: 0, yPx: 50 }, { heightPx: 400, fieldOfViewDeg: 80 }).pitchDeg, 10);
});

test('rakt fram hamnar bildens mitt mitt i visaren', () => {
  assert.equal(yawToStripOffsetPx(0, { imageWidthPx: 2000, viewWidthPx: 400 }), -800);
});

test('en kvarts varv åt höger flyttar remsan en kvarts bildbredd åt vänster', () => {
  assert.equal(yawToStripOffsetPx(90, { imageWidthPx: 2000, viewWidthPx: 400 }), -1300);
});

test('fingrar som dras isär till dubbla avståndet halverar synfältet', () => {
  assert.equal(zoomFieldOfView(80, 2), 40);
});

test('zoomen stannar vid det snävaste och det vidaste synfältet', () => {
  assert.equal(zoomFieldOfView(40, 10), MIN_FIELD_OF_VIEW_DEG);
  assert.equal(zoomFieldOfView(100, 0.1), MAX_FIELD_OF_VIEW_DEG);
});
