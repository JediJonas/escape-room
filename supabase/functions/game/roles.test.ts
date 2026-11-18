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
  const deal = dealRoles({ roles: [REST, PROMINENT], players: createPlayers(4), prominentHistory: [], lotSeed: 'a' });
  assert.equal(Object.keys(deal.roleByPlayer).length, 4);
  assert.equal(Object.values(deal.roleByPlayer).filter((assignment) => assignment.roleId === 'siaren').length, 1);
});

test('bitarna delas så att alla finns hos någon och ingen får samma', () => {
  const deal = dealRoles({ roles: [PROMINENT, REST], players: createPlayers(3), prominentHistory: [], lotSeed: 'a' });
  const restPieces = Object.values(deal.roleByPlayer).filter((assignment) => assignment.roleId === 'gaster').map((assignment) => assignment.pieceIndexes);
  assert.deepEqual(restPieces, [[0, 2, 4], [1, 3]]);
});

test('den framträdande rollen roterar tills alla har haft den, och börjar sedan om', () => {
  const players = createPlayers(3);
  let history: string[] = [];
  const holders: string[] = [];
  for (let round = 0; round < 4; round += 1) {
    const deal = dealRoles({ roles: [PROMINENT, REST], players, prominentHistory: history, lotSeed: `steg${round}` });
    holders.push(Object.entries(deal.roleByPlayer).find(([, assignment]) => assignment.roleId === 'siaren')![0]);
    history = deal.prominentHistory;
  }
  assert.equal(new Set(holders.slice(0, 3)).size, 3);
  assert.equal(holders[3], holders[0]);
});

test('när ingen har haft en stor roll lottas den, så att det inte alltid blir den som gick med först', () => {
  const firstHolders = new Set(Array.from({ length: 30 }, (_, game) => {
    const deal = dealRoles({ roles: [PROMINENT, REST], players: createPlayers(4), prominentHistory: [], lotSeed: `${game}:seansen` });
    return deal.prominentHistory[0];
  }));
  assert.equal(firstHolders.size, 4);
});

test('samma grupp och historik ger samma utdelning, så att en omladdning inte ändrar något', () => {
  const input = { roles: [PROMINENT, REST], players: createPlayers(5), prominentHistory: ['p0'], lotSeed: 'a' };
  assert.deepEqual(dealRoles(input), dealRoles(input));
});

test('med en gräns får ingen fler bitar än gränsen, och de viktigaste delas ut först', () => {
  const deal = dealRoles({ roles: [PROMINENT, { ...REST, maxPiecesPerPlayer: 1 }], players: createPlayers(3), prominentHistory: [], lotSeed: 'a' });
  const restPieces = Object.values(deal.roleByPlayer).filter((assignment) => assignment.roleId === 'gaster').map((assignment) => assignment.pieceIndexes);
  assert.deepEqual(restPieces, [[0], [1]]);
});
