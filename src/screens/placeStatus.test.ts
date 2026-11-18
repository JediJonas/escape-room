import assert from 'node:assert/strict';
import { test } from 'vitest';
import { describePlaceStatus } from './placeStatus.ts';

const KITCHEN = { id: 'C', name: 'Köket' } as const;
const HALL = { id: 'B', name: 'Hallen' } as const;

test('utan plats att gå till visas ingenting', () => {
  assert.equal(describePlaceStatus(null, HALL), '');
});

test('den som inte har angett någon plats får veta vart hon ska', () => {
  assert.equal(describePlaceStatus(KITCHEN, null), 'Gå till köket.');
});

test('den som har valt fel plats får veta var hon är och vart hon ska', () => {
  assert.equal(describePlaceStatus(KITCHEN, HALL), 'Du är i hallen. Gå till köket.');
});

test('den som har kommit fram får veta det', () => {
  assert.equal(describePlaceStatus(KITCHEN, KITCHEN), 'Du är i köket.');
});
