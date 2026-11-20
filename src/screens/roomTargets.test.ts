import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { HouseView, ThingView } from '../../supabase/functions/game/house.ts';
import { HIDDEN_LABEL, findTappedTarget, findThingAtSpot, listRoomTargets } from './roomTargets.ts';

const PIANO_SPOT = { yawDeg: -28, pitchDeg: -12, radiusDeg: 16 };
const BOOK_SPOT = { yawDeg: -76, pitchDeg: -19, radiusDeg: 10 };
const DOOR_SPOT = { yawDeg: 22, pitchDeg: -2, radiusDeg: 10 };

function createThing(id: string, name: string, spot: ThingView['spot'], isCalling = false): ThingView {
  return { id, name, text: null, pages: null, cover: null, opensCurrentStep: false, opensFound: null, isCalling, instrument: null, echo: null, marksRead: false, opensAwaitedTask: false, spot };
}

const HOUSE: HouseView = {
  room: { id: 'B', name: 'Hallen' },
  image: 'hallen.webp',
  doors: [{ id: 'F', name: 'Salongen', spot: DOOR_SPOT }],
  things: [createThing('pianot', 'Pianot', PIANO_SPOT, true)],
  hiddenSpots: [BOOK_SPOT],
  callingFrom: null,
  canSearch: true,
};

test('dörrar, hittade saker och det som inte är hittat går att trycka på', () => {
  const targets = listRoomTargets(HOUSE, true);
  assert.deepEqual(targets.map((target) => target.label), ['Gå till salongen', 'Pianot', HIDDEN_LABEL]);
  assert.ok(targets.some((target) => target.kind === 'thing' && target.isCalling));
});

test('spelledaren som står utanför hittar inget', () => {
  assert.ok(listRoomTargets(HOUSE, false).every((target) => target.kind !== 'hidden'));
});

test('trycket gäller det under fingret, annars det som är mitt i bilden', () => {
  const targets = listRoomTargets(HOUSE, true);
  const aimedAtPiano = { yawDeg: -25, pitchDeg: -10 };
  assert.equal(findTappedTarget(targets, { yawDeg: 20, pitchDeg: 0 }, aimedAtPiano, false)?.label, 'Gå till salongen');
  assert.equal(findTappedTarget(targets, { yawDeg: 120, pitchDeg: 0 }, aimedAtPiano, false)?.label, 'Pianot');
  assert.equal(findTappedTarget(targets, { yawDeg: 120, pitchDeg: 0 }, { yawDeg: 90, pitchDeg: 0 }, false), null);
});

test('i den breda bilden räknas bara vridningen', () => {
  const targets = listRoomTargets(HOUSE, true);
  assert.equal(findTappedTarget(targets, { yawDeg: -76, pitchDeg: 40 }, { yawDeg: -76, pitchDeg: 0 }, false), null);
  assert.equal(findTappedTarget(targets, { yawDeg: -76, pitchDeg: 40 }, { yawDeg: -76, pitchDeg: 0 }, true)?.label, HIDDEN_LABEL);
});

test('en sak som just hittades känns igen på platsen', () => {
  const found = { ...HOUSE, things: [...HOUSE.things, createThing('gastboken', 'Gästboken', BOOK_SPOT)], hiddenSpots: [] };
  assert.equal(findThingAtSpot(found, BOOK_SPOT), 'gastboken');
  assert.equal(findThingAtSpot(HOUSE, BOOK_SPOT), null);
});
