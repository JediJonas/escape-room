import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { GameStore, GameTransaction } from './gameStore.ts';
import { handleAction } from './handleAction.ts';
import type { GameRecord, LobbyView, PlayerRecord } from './lobby.ts';

const SERVER_TIME = new Date('2026-11-16T20:00:00.123Z');

/** En databas i minnet med samma regler som tabellerna i engine. */
function createMemoryStore() {
  const games: GameRecord[] = [];
  const players: PlayerRecord[] = [];
  const events: object[] = [];
  const sentViews: { playerId: string; view: LobbyView }[] = [];
  let nextId = 1;

  const transaction: GameTransaction = {
    async insertGame({ joinCode, missionId, state }) {
      if (games.some((game) => game.joinCode === joinCode)) return null;
      const game = { id: `game-${nextId++}`, joinCode, missionId, state };
      games.push(game);
      return game;
    },
    lockGameByCode: async (joinCode) => games.find((game) => game.joinCode === joinCode) ?? null,
    lockGameById: async (gameId) => games.find((game) => game.id === gameId) ?? null,
    listPlayers: async (gameId) => players.filter((player) => player.gameId === gameId),
    async insertPlayer({ gameId, userId, name, isLeader }) {
      const player = { id: `player-${nextId}`, gameId, userId, name, isLeader, joinedAtMs: nextId++ };
      players.push(player);
      return player;
    },
    async deletePlayer(playerId) {
      players.splice(players.findIndex((player) => player.id === playerId), 1);
    },
    async logEvent(event) {
      events.push(event);
    },
    async sendView(playerId, view) {
      sentViews.push({ playerId, view: view as LobbyView });
    },
  };
  const store: GameStore = {
    readServerTimeMs: async () => SERVER_TIME.getTime(),
    transaction: (work) => work(transaction),
  };
  return { store, games, players, events, sentViews };
}

function createContext(store: GameStore, userId: string, joinCodes = ['BCDF']) {
  const codes = [...joinCodes];
  return { userId, store, createJoinCode: () => codes.shift() ?? 'ZZZZ' };
}

async function send(store: GameStore, userId: string, action: unknown) {
  return handleAction({ action, context: createContext(store, userId) });
}

function readView(body: object): LobbyView {
  return (body as { view: LobbyView }).view;
}

async function createGameWithPlayers(names: string[]) {
  const memory = createMemoryStore();
  await send(memory.store, 'user-leader', { type: 'createGame', name: 'Ledare' });
  for (const name of names) await send(memory.store, `user-${name}`, { type: 'joinGame', joinCode: 'BCDF', name });
  return memory;
}

test('ping svarar med databasens klocka i millisekunder', async () => {
  const result = await send(createMemoryStore().store, 'user-1', { type: 'ping' });
  assert.deepEqual(result, { status: 200, body: { serverTime: SERVER_TIME.getTime() } });
});

test('en okänd eller felaktig handling ger fel 400', async () => {
  const { store } = createMemoryStore();
  for (const action of [{ type: 'fuska' }, { type: 'toString' }, null, 'ping', { type: 42 }]) {
    assert.deepEqual(await send(store, 'user-1', action), { status: 400, body: { error: 'unknownAction' } }, JSON.stringify(action));
  }
});

test('den som skapar ett spel blir spelledare och får koden', async () => {
  const memory = createMemoryStore();
  const result = await send(memory.store, 'user-1', { type: 'createGame', name: ' Jonna ' });
  assert.equal(result.status, 200);
  const view = readView(result.body);
  assert.equal(view.joinCode, 'BCDF');
  assert.deepEqual(view.me, { playerId: memory.players[0].id, name: 'Jonna', isLeader: true });
  assert.equal(memory.games[0].state.status, 'lobby');
  assert.equal(memory.events.length, 1);
});

test('en kod som redan används byts mot en ny', async () => {
  const memory = createMemoryStore();
  await send(memory.store, 'user-1', { type: 'createGame', name: 'Ett' });
  const result = await handleAction({ action: { type: 'createGame', name: 'Två' }, context: createContext(memory.store, 'user-2', ['BCDF', 'GHJK']) });
  assert.equal(readView(result.body).joinCode, 'GHJK');
});

test('ett spel skapas inte utan namn', async () => {
  const memory = createMemoryStore();
  assert.deepEqual(await send(memory.store, 'user-1', { type: 'createGame', name: '' }), { status: 400, body: { error: 'invalidName' } });
  assert.equal(memory.games.length, 0);
});

test('den som går med syns hos alla, och alla får sin egen vy', async () => {
  const memory = await createGameWithPlayers([]);
  const result = await send(memory.store, 'user-bo', { type: 'joinGame', joinCode: ' bcdf', name: 'Bo' });
  assert.equal(result.status, 200);
  assert.deepEqual(readView(result.body).players.map((player) => [player.name, player.isMe]), [['Ledare', false], ['Bo', true]]);
  assert.equal(memory.sentViews.length, 2);
  for (const { playerId, view } of memory.sentViews) {
    assert.equal(view.me.playerId, playerId);
    assert.equal(view.players.length, 2);
  }
});

test('en mobil som redan är med får sin plats tillbaka i stället för en till', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const result = await send(memory.store, 'user-Bo', { type: 'joinGame', joinCode: 'BCDF', name: 'Nytt namn' });
  assert.equal(readView(result.body).me.name, 'Bo');
  assert.equal(memory.players.length, 2);
});

test('fel kod, upptaget namn och fullt spel ger var sitt fel', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  assert.deepEqual(await send(memory.store, 'user-x', { type: 'joinGame', joinCode: 'ZZZZ', name: 'X' }), { status: 404, body: { error: 'noSuchGame' } });
  assert.deepEqual(await send(memory.store, 'user-x', { type: 'joinGame', joinCode: 'AB', name: 'X' }), { status: 404, body: { error: 'noSuchGame' } });
  assert.deepEqual(await send(memory.store, 'user-x', { type: 'joinGame', joinCode: 'BCDF', name: 'bo' }), { status: 409, body: { error: 'nameTaken' } });
  assert.deepEqual(await send(memory.store, 'user-x', { type: 'joinGame', joinCode: 'BCDF' }), { status: 400, body: { error: 'invalidName' } });

  const full = await createGameWithPlayers(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J']);
  assert.deepEqual(await send(full.store, 'user-x', { type: 'joinGame', joinCode: 'BCDF', name: 'Elva' }), { status: 409, body: { error: 'gameFull' } });
});

test('en omladdad mobil hämtar sin vy, men en främling får ingen', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const gameId = memory.games[0].id;
  const result = await send(memory.store, 'user-Bo', { type: 'getView', gameId });
  assert.equal(readView(result.body).me.name, 'Bo');
  assert.deepEqual(await send(memory.store, 'user-x', { type: 'getView', gameId }), { status: 404, body: { error: 'notInGame' } });
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'getView', gameId: 'game-okänt' }), { status: 404, body: { error: 'notInGame' } });
});

test('en spelare kan lämna väntrummet, och de andra ser det', async () => {
  const memory = await createGameWithPlayers(['Bo', 'Cia']);
  memory.sentViews.length = 0;
  const result = await send(memory.store, 'user-Bo', { type: 'leaveGame', gameId: memory.games[0].id });
  assert.equal(result.status, 200);
  assert.deepEqual(memory.players.map((player) => player.name), ['Ledare', 'Cia']);
  assert.equal(memory.sentViews.length, 2);
  assert.ok(memory.sentViews.every(({ view }) => view.players.length === 2));
});

test('spelledaren kan inte lämna, för då står spelet', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  assert.deepEqual(await send(memory.store, 'user-leader', { type: 'leaveGame', gameId: memory.games[0].id }), { status: 409, body: { error: 'leaderCannotLeave' } });
  assert.equal(memory.players.length, 2);
});
