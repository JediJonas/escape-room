import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { DoorView } from '../../supabase/functions/game/house.ts';
import { chooseStartLook, enterRoom } from './roomVisit.ts';

const HALL_DOORS: DoorView[] = [
  { id: 'F', name: 'Salongen', spot: { yawDeg: 22, pitchDeg: -2, radiusDeg: 10, frame: { yawDeg: 20.5, pitchDeg: 0, widthDeg: 20, heightDeg: 50 } } },
  { id: 'D', name: 'Sovrummet', spot: { yawDeg: -112, pitchDeg: -2, radiusDeg: 10 } },
];

test('spelaren tittar bort från dörren hon kom in genom', () => {
  assert.deepEqual(chooseStartLook(HALL_DOORS, 'D'), { yawDeg: 68, pitchDeg: 0 });
});

test('ramens mitt gäller före radiens', () => {
  assert.deepEqual(chooseStartLook(HALL_DOORS, 'F'), { yawDeg: -159.5, pitchDeg: 0 });
});

test('vid början och utan dörr i bilden tittar spelaren rakt fram', () => {
  assert.deepEqual(chooseStartLook(HALL_DOORS, null), { yawDeg: 0, pitchDeg: 0 });
  assert.deepEqual(chooseStartLook(HALL_DOORS, 'A'), { yawDeg: 0, pitchDeg: 0 });
});

test('ett nytt rum minns varifrån spelaren kom och glömmer blicken', () => {
  const start = enterRoom({ roomId: '', cameFrom: null, look: null }, 'B');
  assert.deepEqual(start, { roomId: 'B', cameFrom: null, look: null });
  const looked = { ...start, look: { yawDeg: 40, pitchDeg: 5 } };
  assert.equal(enterRoom(looked, 'B'), looked);
  assert.deepEqual(enterRoom(looked, 'A'), { roomId: 'A', cameFrom: 'B', look: null });
});
