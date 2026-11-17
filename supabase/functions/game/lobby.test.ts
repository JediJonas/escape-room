import assert from 'node:assert/strict';
import { test } from 'vitest';
import { type GameRecord, type PlayerRecord, MAX_PLAYERS, buildLobbyView, cleanPlayerName, createInitialState, findJoinRefusal } from './lobby.ts';

const GAME: GameRecord = { id: 'game-1', joinCode: 'BCDF', missionId: 'prov', state: createInitialState() };

function createPlayer(index: number, overrides: Partial<PlayerRecord> = {}): PlayerRecord {
  return { id: `player-${index}`, gameId: GAME.id, userId: `user-${index}`, name: `Spelare ${index}`, isLeader: index === 0, joinedAtMs: index * 1000, ...overrides };
}

test('namnet tvättas från mellanslag', () => {
  assert.equal(cleanPlayerName('  Anna   Karin '), 'Anna Karin');
});

test('tomma, för långa och andra värden än text godtas inte som namn', () => {
  assert.equal(cleanPlayerName('   '), null);
  assert.equal(cleanPlayerName('x'.repeat(21)), null);
  assert.equal(cleanPlayerName(42), null);
  assert.equal(cleanPlayerName('x'.repeat(20)), 'x'.repeat(20));
  assert.equal(cleanPlayerName('Åsa Öberg-Ärlig'), 'Åsa Öberg-Ärlig');
});

test('en ny spelare får gå med i väntrummet', () => {
  assert.equal(findJoinRefusal({ state: GAME.state, players: [createPlayer(0)], name: 'Bo' }), null);
});

test('ett ogiltigt namn stoppas', () => {
  assert.equal(findJoinRefusal({ state: GAME.state, players: [], name: null }), 'invalidName');
});

test('samma namn med andra versaler är upptaget, men inte ett namn med andra prickar', () => {
  const players = [createPlayer(0, { name: 'Åsa' })];
  assert.equal(findJoinRefusal({ state: GAME.state, players, name: 'åSA' }), 'nameTaken');
  assert.equal(findJoinRefusal({ state: GAME.state, players, name: 'Asa' }), null);
});

test('den elfte spelaren får inte plats', () => {
  const players = Array.from({ length: MAX_PLAYERS }, (_, index) => createPlayer(index));
  assert.equal(findJoinRefusal({ state: GAME.state, players, name: 'Elva' }), 'gameFull');
  assert.equal(findJoinRefusal({ state: GAME.state, players: players.slice(1), name: 'Tia' }), null);
});

test('efter start går det inte att gå med med bara koden', () => {
  assert.equal(findJoinRefusal({ state: { status: 'running' }, players: [], name: 'Sen' }), 'gameStarted');
});

test('väntrummet visar alla i den ordning de gick med och markerar mobilens egen spelare', () => {
  const leader = createPlayer(0, { name: 'Jonna' });
  const late = createPlayer(2, { name: 'Sist' });
  const early = createPlayer(1, { name: 'Först' });
  const view = buildLobbyView(GAME, [leader, late, early], early);
  assert.deepEqual(view, {
    type: 'lobby',
    gameId: 'game-1',
    joinCode: 'BCDF',
    me: { playerId: 'player-1', name: 'Först', isLeader: false },
    players: [
      { name: 'Jonna', isLeader: true, isMe: false },
      { name: 'Först', isLeader: false, isMe: true },
      { name: 'Sist', isLeader: false, isMe: false },
    ],
  });
});

test('väntrummet läcker inte andra spelares id eller inloggningar', () => {
  const players = [createPlayer(0), createPlayer(1), createPlayer(2)];
  const text = JSON.stringify(buildLobbyView(GAME, players, players[1]));
  for (const other of [players[0], players[2]]) {
    assert.ok(!text.includes(other.id), other.id);
    assert.ok(!text.includes(other.userId), other.userId);
  }
  assert.ok(!text.includes(players[1].userId));
});
