import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { Role } from './mission.ts';
import { dealRoles } from './roles.ts';
import type { PlayerRecord } from './state.ts';

const PROMINENT: Role = { id: 'siaren', title: 'Siaren', count: 1, isProminent: true, pieces: ['hemlig'] };
const REST: Role = { id: 'gaster', title: 'Gäst', count: 'rest', pieces: ['a', 'b', 'c', 'd', 'e'] };

function createPlayers(count: number): PlayerRecord[] {
  return Array.from({ length: count }, (_, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name: `S${index}`, isLeader: index === 0, joinedAtMs: index }));
}

test('alla får en roll, och den framträdande rollen får precis en', () => {
  const deal = dealRoles({ roles: [REST, PROMINENT], players: createPlayers(4), prominentHistory: [] });
  assert.equal(Object.keys(deal.roleByPlayer).length, 4);
  assert.equal(Object.values(deal.roleByPlayer).filter((assignment) => assignment.roleId === 'siaren').length, 1);
});

test('bitarna delas så att alla finns hos någon och ingen får samma', () => {
  const deal = dealRoles({ roles: [PROMINENT, REST], players: createPlayers(3), prominentHistory: [] });
  const restPieces = Object.values(deal.roleByPlayer).filter((assignment) => assignment.roleId === 'gaster').map((assignment) => assignment.pieceIndexes);
  assert.deepEqual(restPieces, [[0, 2, 4], [1, 3]]);
});

test('den framträdande rollen roterar tills alla har haft den, och börjar sedan om', () => {
  const players = createPlayers(3);
  let history: string[] = [];
  const holders: string[] = [];
  for (let round = 0; round < 4; round += 1) {
    const deal = dealRoles({ roles: [PROMINENT, REST], players, prominentHistory: history });
    holders.push(Object.entries(deal.roleByPlayer).find(([, assignment]) => assignment.roleId === 'siaren')![0]);
    history = deal.prominentHistory;
  }
  assert.deepEqual(holders, ['p0', 'p1', 'p2', 'p0']);
});

test('samma grupp och historik ger samma utdelning, så att en omladdning inte ändrar något', () => {
  const input = { roles: [PROMINENT, REST], players: createPlayers(5), prominentHistory: ['p0'] };
  assert.deepEqual(dealRoles(input), dealRoles(input));
});

test('med en gräns får ingen fler bitar än gränsen, och de viktigaste delas ut först', () => {
  const deal = dealRoles({ roles: [PROMINENT, { ...REST, maxPiecesPerPlayer: 1 }], players: createPlayers(3), prominentHistory: [] });
  const restPieces = Object.values(deal.roleByPlayer).filter((assignment) => assignment.roleId === 'gaster').map((assignment) => assignment.pieceIndexes);
  assert.deepEqual(restPieces, [[0], [1]]);
});
