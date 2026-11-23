import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { DoorView } from '../../supabase/functions/game/house.ts';
import { chooseStartLook, enterRoom } from './roomVisit.ts';

const HALL_DOORS: DoorView[] = [
  { id: 'F', name: 'Salongen', spot: { yawDeg: 22, pitchDeg: -2, radiusDeg: 10, frame: { yawDeg: 20.5, pitchDeg: 0, widthDeg: 20, heightDeg: 50 } } },
  { id: 'D', name: 'Sovrummet', spot: { yawDeg: -112, pitchDeg: -2, radiusDeg: 10 } },
];

const HALL = { doors: HALL_DOORS, wallCornersDeg: [-45, 45, 135, -135] };

test('spelaren tittar mot mitten av väggen mittemot dörren hon kom in genom', () => {
  assert.deepEqual(chooseStartLook(HALL, 'D'), { yawDeg: 90, pitchDeg: 0 });
  assert.deepEqual(chooseStartLook(HALL, 'F'), { yawDeg: -180, pitchDeg: 0 });
});

test('väggen framför är centrerad mellan sina hörn, också när hörnen inte sitter jämnt', () => {
  const door = (id: DoorView['id'], yawDeg: number): DoorView => ({ id, name: id, spot: { yawDeg, pitchDeg: 0, radiusDeg: 10 } });
  const parlour = { doors: [door('B', 152), door('D', -41.5), door('C', 42.5)], wallCornersDeg: [-35, 36, 122, -121] };
  assert.deepEqual(chooseStartLook(parlour, 'C'), { yawDeg: -78, pitchDeg: 0 });
  assert.deepEqual(chooseStartLook(parlour, 'D'), { yawDeg: 79, pitchDeg: 0 });
  assert.deepEqual(chooseStartLook(parlour, 'B'), { yawDeg: 0.5, pitchDeg: 0 });
});

test('ramens mitt avgör vilken vägg dörren sitter på', () => {
  const door: DoorView = { id: 'B', name: 'Hallen', spot: { yawDeg: 47, pitchDeg: 0, radiusDeg: 10, frame: { yawDeg: 42, pitchDeg: 0, widthDeg: 20, heightDeg: 50 } } };
  assert.deepEqual(chooseStartLook({ doors: [door], wallCornersDeg: [-45, 45, 135, -135] }, 'B'), { yawDeg: -180, pitchDeg: 0 });
});

test('vid början och utan dörr i bilden tittar spelaren rakt fram', () => {
  assert.deepEqual(chooseStartLook(HALL, null), { yawDeg: 0, pitchDeg: 0 });
  assert.deepEqual(chooseStartLook(HALL, 'A'), { yawDeg: 0, pitchDeg: 0 });
});

test('ett nytt rum minns varifrån spelaren kom och glömmer blicken', () => {
  const start = enterRoom({ roomId: '', cameFrom: null, look: null }, 'B');
  assert.deepEqual(start, { roomId: 'B', cameFrom: null, look: null });
  const looked = { ...start, look: { yawDeg: 40, pitchDeg: 5 } };
  assert.equal(enterRoom(looked, 'B'), looked);
  assert.deepEqual(enterRoom(looked, 'A'), { roomId: 'A', cameFrom: 'B', look: null });
});
