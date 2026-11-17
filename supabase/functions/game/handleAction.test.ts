import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { GameStore, GameTransaction } from './gameStore.ts';
import { handleAction } from './handleAction.ts';
import type { GameView } from './game.ts';
import type { LobbyView } from './lobby.ts';
import type { GameRecord, PlayerRecord } from './state.ts';

const SERVER_TIME = new Date('2026-11-16T20:00:00.123Z');

/** En databas i minnet med samma regler som tabellerna i engine. */
function createMemoryStore() {
  const games: GameRecord[] = [];
  const players: PlayerRecord[] = [];
  const events: object[] = [];
  const sentViews: { playerId: string; view: LobbyView | GameView }[] = [];
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
    async updateGameState(gameId, state) {
      const game = games.find((candidate) => candidate.id === gameId);
      if (game) game.state = state;
    },
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
      sentViews.push({ playerId, view: view as LobbyView | GameView });
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
    assert.equal((view as LobbyView).players.length, 2);
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
  assert.ok(memory.sentViews.every(({ view }) => (view as LobbyView).players.length === 2));
});

test('spelledaren kan inte lämna, för då står spelet', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  assert.deepEqual(await send(memory.store, 'user-leader', { type: 'leaveGame', gameId: memory.games[0].id }), { status: 409, body: { error: 'leaderCannotLeave' } });
  assert.equal(memory.players.length, 2);
});

function readGameView(body: object): GameView {
  return (body as { view: GameView }).view;
}

test('bara spelledaren kan starta, och först när det minsta antalet spelare är med', async () => {
  const alone = await createGameWithPlayers([]);
  const aloneGameId = alone.games[0].id;
  assert.deepEqual(await send(alone.store, 'user-leader', { type: 'startGame', gameId: aloneGameId }), { status: 409, body: { error: 'tooFewPlayers' } });

  const memory = await createGameWithPlayers(['Bo']);
  const gameId = memory.games[0].id;
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'startGame', gameId }), { status: 403, body: { error: 'notLeader' } });
  memory.sentViews.length = 0;
  const result = await send(memory.store, 'user-leader', { type: 'startGame', gameId, usesPlaceCards: false });
  assert.equal(result.status, 200);
  const view = readGameView(result.body);
  assert.equal(view.type, 'game');
  assert.equal(view.usesPlaceCards, false);
  assert.equal(view.step.number, 1);
  assert.equal(memory.sentViews.length, 2);
  assert.deepEqual(await send(memory.store, 'user-leader', { type: 'startGame', gameId }), { status: 409, body: { error: 'gameStarted' } });
});

test('platskorten används om spelledaren inte väljer bort dem', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const result = await send(memory.store, 'user-leader', { type: 'startGame', gameId: memory.games[0].id });
  assert.equal(readGameView(result.body).usesPlaceCards, true);
});

test('spelledaren går vidare steg för steg, och efter sista steget är spelet slut', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const gameId = memory.games[0].id;
  await send(memory.store, 'user-leader', { type: 'startGame', gameId });
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'nextStep', gameId }), { status: 403, body: { error: 'notLeader' } });
  let view = readGameView((await send(memory.store, 'user-leader', { type: 'nextStep', gameId })).body);
  assert.equal(view.step.number, 2);
  while (!view.isFinished) view = readGameView((await send(memory.store, 'user-leader', { type: 'nextStep', gameId })).body);
  assert.equal(view.step.number, view.step.count);
  assert.deepEqual(await send(memory.store, 'user-leader', { type: 'nextStep', gameId }), { status: 409, body: { error: 'notRunning' } });
});

test('när gruppen delar på sig syns bitarna först på platsen, och bara hos den som är där', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const gameId = memory.games[0].id;
  await send(memory.store, 'user-leader', { type: 'startGame', gameId });
  let boStep = readGameView((await send(memory.store, 'user-Bo', { type: 'getView', gameId })).body);
  while (!boStep.step.goTo) {
    await send(memory.store, 'user-leader', { type: 'nextStep', gameId });
    boStep = readGameView((await send(memory.store, 'user-Bo', { type: 'getView', gameId })).body);
  }
  const goTo = boStep.step.goTo;
  assert.ok(goTo);
  assert.deepEqual(boStep.step.role?.pieces, []);
  memory.sentViews.length = 0;

  const result = await send(memory.store, 'user-Bo', { type: 'choosePlace', gameId, placeId: goTo.id, source: 'scan' });
  const boView = readGameView(result.body);
  assert.deepEqual(boView.myPlace, goTo);
  const [piece] = boView.step.role?.pieces ?? [];
  assert.ok(piece);
  // Spelledaren får veta att Bo är framme, men inte vad han ser.
  assert.deepEqual(memory.sentViews.map(({ view }) => view.me.name).sort(), ['Bo', 'Ledare']);
  assert.deepEqual(memory.events.at(-1), { gameId, playerId: boView.me.playerId, action: { type: 'choosePlace', placeId: goTo.id, source: 'scan' } });

  const leaderView = readGameView((await send(memory.store, 'user-leader', { type: 'getView', gameId })).body);
  assert.notDeepEqual(leaderView.step.goTo, goTo);
  assert.ok(!JSON.stringify(leaderView).includes(piece));
});

test('när alla har tryckt Klar får alla nästa steg', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const gameId = memory.games[0].id;
  await send(memory.store, 'user-leader', { type: 'startGame', gameId, minutes: 45 });
  memory.sentViews.length = 0;
  await send(memory.store, 'user-Bo', { type: 'markReady', gameId });
  assert.deepEqual(memory.sentViews.map(({ view }) => view.me.name).sort(), ['Bo', 'Ledare']);
  memory.sentViews.length = 0;
  const view = readGameView((await send(memory.store, 'user-leader', { type: 'markReady', gameId })).body);
  assert.equal(view.step.number, 2);
  assert.equal(memory.sentViews.length, 2);
  assert.deepEqual(memory.events.at(-1), { gameId, playerId: view.me.playerId, action: { type: 'markReady', stepIndex: 0 } });
});

test('spelledaren pausar med databasens klocka', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const gameId = memory.games[0].id;
  const started = readGameView((await send(memory.store, 'user-leader', { type: 'startGame', gameId, minutes: 45 })).body);
  assert.deepEqual(started.clock, { isPaused: false, endsAtMs: SERVER_TIME.getTime() + 45 * 60_000 });
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'setPaused', gameId, isPaused: true }), { status: 403, body: { error: 'notLeader' } });
  const paused = readGameView((await send(memory.store, 'user-leader', { type: 'setPaused', gameId, isPaused: true })).body);
  assert.deepEqual(paused.clock, { isPaused: true, remainingMs: 45 * 60_000 });
});

test('facit går bara till spelledaren, och ett rätt svar ger alla nästa steg', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const gameId = memory.games[0].id;
  await send(memory.store, 'user-leader', { type: 'startGame', gameId });
  let view = readGameView((await send(memory.store, 'user-leader', { type: 'getView', gameId })).body);
  while (view.step.type !== 'answer') view = readGameView((await send(memory.store, 'user-leader', { type: 'nextStep', gameId })).body);
  memory.sentViews.length = 0;
  const shown = readGameView((await send(memory.store, 'user-leader', { type: 'showSolution', gameId })).body);
  assert.equal(shown.step.solution, '42');
  assert.deepEqual(memory.sentViews.map(({ view: sent }) => sent.me.name), ['Ledare']);
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'submitAnswer', gameId, answer: '24' }), { status: 409, body: { error: 'wrongAnswer' } });
  memory.sentViews.length = 0;
  const after = readGameView((await send(memory.store, 'user-Bo', { type: 'submitAnswer', gameId, answer: '42' })).body);
  assert.equal(after.step.number, shown.step.number + 1);
  assert.equal(memory.sentViews.length, 2);
});

test('en plats som uppdraget saknar, eller en plats före start, godtas inte', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  const gameId = memory.games[0].id;
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'choosePlace', gameId, placeId: 'C' }), { status: 409, body: { error: 'notRunning' } });
  await send(memory.store, 'user-leader', { type: 'startGame', gameId });
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'choosePlace', gameId, placeId: 'Q' }), { status: 400, body: { error: 'unknownPlace' } });
});

test('ett spel med ett uppdrag som inte finns längre ger ett fel i stället för att krascha', async () => {
  const memory = await createGameWithPlayers(['Bo']);
  memory.games[0].missionId = 'borttaget';
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'getView', gameId: memory.games[0].id }), { status: 500, body: { error: 'unknownMission' } });
});
