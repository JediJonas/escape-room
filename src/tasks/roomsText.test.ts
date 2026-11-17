import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { RoomsView } from '../../supabase/functions/game/rooms.ts';
import { countForgetSeconds, describeRoomsGoal } from './roomsText.ts';

const HALL = { id: 'B', name: 'Hallen' } as const;
const BEDROOM = { id: 'E', name: 'Sovrummet' } as const;

function view(fields: Partial<RoomsView>): RoomsView {
  return { guests: [], myRooms: [], current: null, hasRoomElsewhere: false, solvedCount: 0, roomCount: 4, ...fields };
}

test('raden säger vilka rum som är kvar', () => {
  assert.equal(describeRoomsGoal(view({ myRooms: [{ place: HALL, isHere: false, isSolved: false }, { place: BEDROOM, isHere: false, isSolved: false }] })), 'Gå till hallen och sovrummet.');
  const current = { place: HALL, pieces: [], guest: null, forgetsUntilMs: null };
  assert.equal(describeRoomsGoal(view({ current, myRooms: [{ place: HALL, isHere: true, isSolved: false }, { place: BEDROOM, isHere: false, isSolved: false }] })), 'Sedan ska du till sovrummet.');
  assert.equal(describeRoomsGoal(view({ myRooms: [{ place: HALL, isHere: false, isSolved: true }] })), '');
  assert.match(describeRoomsGoal(view({})), /inget eget rum/);
});

test('rummet glömmer i hela sekunder, avrundat uppåt', () => {
  assert.equal(countForgetSeconds(null, 0), 0);
  assert.equal(countForgetSeconds(15_000, 100), 15);
  assert.equal(countForgetSeconds(15_000, 15_000), 0);
});
