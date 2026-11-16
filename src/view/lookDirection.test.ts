import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  clampPitchDeg,
  dragToTurn,
  fieldOfViewToHalfHeight,
  MAX_FIELD_OF_VIEW_DEG,
  MAX_PITCH_DEG,
  MIN_FIELD_OF_VIEW_DEG,
  orientationToLook,
  turnLook,
  wrapYawDeg,
  yawToStripOffsetPx,
  zoomFieldOfView,
} from './lookDirection.ts';

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

function assertLookIsClose(actual: { yawDeg: number; pitchDeg: number }, expected: { yawDeg: number; pitchDeg: number }) {
  assert.ok(Math.abs(actual.yawDeg - expected.yawDeg) < 1e-6, `vridning ${actual.yawDeg}, väntade ${expected.yawDeg}`);
  assert.ok(Math.abs(actual.pitchDeg - expected.pitchDeg) < 1e-6, `lutning ${actual.pitchDeg}, väntade ${expected.pitchDeg}`);
}

test('upprätt mobil tittar mot horisonten', () => {
  assertLookIsClose(orientationToLook({ alpha: 0, beta: 90, gamma: 0 }), { yawDeg: 0, pitchDeg: 0 });
});

test('mobil som vrids åt vänster vrider blicken åt vänster', () => {
  assertLookIsClose(orientationToLook({ alpha: 90, beta: 90, gamma: 0 }), { yawDeg: -90, pitchDeg: 0 });
});

test('mobil som vrids åt höger vrider blicken åt höger', () => {
  assertLookIsClose(orientationToLook({ alpha: 330, beta: 90, gamma: 0 }), { yawDeg: 30, pitchDeg: 0 });
});

test('mobil som lutas bakåt tittar uppåt', () => {
  assertLookIsClose(orientationToLook({ alpha: 0, beta: 120, gamma: 0 }), { yawDeg: 0, pitchDeg: 30 });
});

test('mobil som ligger plant tittar rakt ner', () => {
  assert.ok(Math.abs(orientationToLook({ alpha: 40, beta: 0, gamma: 0 }).pitchDeg + 90) < 1e-6);
});

// På en upprätt mobil går både alpha och gamma runt lodlinjen. Webbläsaren
// fördelar vridningen mellan dem, så båda måste räknas in.
test('upprätt mobil räknar in vridning som hamnar i gamma', () => {
  assertLookIsClose(orientationToLook({ alpha: 10, beta: 90, gamma: 20 }), { yawDeg: -30, pitchDeg: 0 });
});

function assertIsClose(actual: number, expected: number) {
  assert.ok(Math.abs(actual - expected) < 1e-6, `${actual}, väntade ${expected}`);
}

test('upprätt mobil är inte lutad i sidled', () => {
  assertIsClose(orientationToLook({ alpha: 0, beta: 90, gamma: 0 }).rollDeg, 0);
  assertIsClose(orientationToLook({ alpha: 70, beta: 120, gamma: 0 }).rollDeg, 0);
});

// Mobilen står på högkant på sin högra långsida: baksidan pekar åt väster
// och överkanten åt norr, som är åt höger för den som tittar västerut.
test('mobil som ligger på sin högra sida är rollad ett kvarts varv medurs', () => {
  const look = orientationToLook({ alpha: 0, beta: 0, gamma: 90 });
  assertIsClose(look.yawDeg, -90);
  assertIsClose(look.pitchDeg, 0);
  assertIsClose(look.rollDeg, 90);
});

test('mobil som ligger på sin vänstra sida är rollad ett kvarts varv moturs', () => {
  assertIsClose(orientationToLook({ alpha: 0, beta: 0, gamma: -90 }).rollDeg, -90);
});

test('mobil som pekar rakt ner räknas som olutad', () => {
  assert.equal(orientationToLook({ alpha: 30, beta: 0, gamma: 0 }).rollDeg, 0);
});

test('hårt perspektiv mäter synfältet med tangens', () => {
  assertIsClose(fieldOfViewToHalfHeight(90, 'straight'), 1);
});

test('mjukt perspektiv drar ut kanterna mindre än det hårda', () => {
  assertIsClose(fieldOfViewToHalfHeight(180, 'soft'), 2);
  assert.ok(fieldOfViewToHalfHeight(100, 'soft') < fieldOfViewToHalfHeight(100, 'straight'));
});
