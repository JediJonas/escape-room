import assert from 'node:assert/strict';
import { test } from 'vitest';
import { type CellarMove, type CellarState, applyCellarMove, advanceCellar, describeCellar, findCatchMs, markArrived, readCellarState, startCellar, wrapDegrees } from './cellar.ts';
import type { CellarStep } from './mission.ts';
import { getMission } from './missions/index.ts';

const STEP = getMission('den-femte-gasten')!.steps.find((step): step is CellarStep => step.type === 'cellar')!;
const MINUTE_MS = 60_000;
const ARRIVED = markArrived(startCellar(), 1000);

function apply(cellar: CellarState, move: CellarMove, { isTrapped = true, nowMs = 2000 } = {}) {
  return applyCellarMove({ cellar, step: STEP, move, isTrapped, isTrappedHere: isTrapped, nowMs });
}

function readCellar(result: ReturnType<typeof apply>): CellarState {
  assert.ok('cellar' in result, JSON.stringify(result));
  return result.cellar;
}

test('det börjar komma närmare först när den instängda kommer fram, och bara en gång', () => {
  assert.equal(findCatchMs(startCellar(), STEP), null);
  assert.equal(findCatchMs(ARRIVED, STEP), 1000 + STEP.minutes * MINUTE_MS);
  assert.equal(markArrived(ARRIVED, 5000).arrivedAtMs, 1000);
  assert.deepEqual(apply(startCellar(), { type: 'flipFuse' }, { isTrapped: false }), { refusal: 'notAtPlace' });
});

test('dörren hittas inom marginalen, även över bildens skarv', () => {
  assert.equal(wrapDegrees(190), -170);
  const { doorYawDeg, toleranceDeg } = STEP.solution;
  assert.equal(readCellar(apply(ARRIVED, { type: 'openDoor', yawDeg: doorYawDeg + toleranceDeg })).outcome, 'found');
  assert.equal(readCellar(apply(ARRIVED, { type: 'openDoor', yawDeg: doorYawDeg + 360 })).outcome, 'found');
  assert.deepEqual(apply(ARRIVED, { type: 'openDoor', yawDeg: doorYawDeg }, { isTrapped: false }), { refusal: 'notTrapped' });
});

test('ett fel tryck för det närmare, och när tiden har gått ut hann det fram', () => {
  const wrong = readCellar(apply(ARRIVED, { type: 'openDoor', yawDeg: STEP.solution.doorYawDeg + 90 }));
  assert.equal(wrong.outcome, null);
  assert.equal(findCatchMs(wrong, STEP), 1000 + STEP.minutes * MINUTE_MS - STEP.wrongTapMs);
  const catchMs = findCatchMs(wrong, STEP)!;
  assert.equal(advanceCellar(wrong, STEP, catchMs - 1).outcome, null);
  assert.equal(readCellar(apply(wrong, { type: 'timeUp' }, { nowMs: catchMs })).outcome, 'caught');
  // Efteråt går dörren inte att hitta.
  const caught = readCellar(apply(wrong, { type: 'timeUp' }, { nowMs: catchMs }));
  assert.equal(readCellar(apply(caught, { type: 'openDoor', yawDeg: STEP.solution.doorYawDeg }, { nowMs: catchMs })).outcome, 'caught');
});

test('de andra tänder lampan med säkringarna tills de är slut', () => {
  let cellar = ARRIVED;
  for (let fuse = 0; fuse < STEP.fuses; fuse += 1) cellar = readCellar(apply(cellar, { type: 'flipFuse' }, { isTrapped: false }));
  assert.equal(cellar.litUntilMs, 2000 + STEP.lightMs);
  assert.deepEqual(apply(cellar, { type: 'flipFuse' }, { isTrapped: false }), { refusal: 'noMoreFuses' });
  assert.deepEqual(apply(cellar, { type: 'flipFuse' }), { refusal: 'notTrapped' });
});

test('bara den instängda ser bilden och rummet bakom, med sitt eget namn', () => {
  const found = readCellar(apply(ARRIVED, { type: 'openDoor', yawDeg: STEP.solution.doorYawDeg }));
  const trapped = describeCellar({ cellar: found, step: STEP, isTrapped: true, isTrappedHere: true, trappedName: 'Cia' });
  const other = describeCellar({ cellar: found, step: STEP, isTrapped: false, isTrappedHere: false, trappedName: 'Cia' });
  assert.equal(trapped.image, STEP.image);
  assert.match(trapped.outcomeText ?? '', /nytt namn: Cia/);
  assert.equal(other.image, null);
  assert.match(other.outcomeText ?? '', /^Cia har hittat något/);
});

test('en sparad källare läses, och en trasig blir null', () => {
  const saved = { arrivedAtMs: 1, penaltyMs: 0, fusesUsed: 2, litUntilMs: null, outcome: 'found' };
  assert.deepEqual(readCellarState(saved), saved);
  assert.equal(readCellarState({ arrivedAtMs: 1 }), null);
});
