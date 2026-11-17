/**
 * Tar emot en handling från en mobil och svarar. Känner inte till Deno eller
 * hur databasen nås, så att den går att testa med Vitest.
 *
 * Felen svarar med en kod, inte en text. Mobilen väljer texten, så att alla
 * texter som visas ligger i webbsidan eller i uppdragsfilen.
 */

import type { GameStore, GameTransaction } from './gameStore.ts';
import { isValidJoinCode, normalizeJoinCode } from './joinCode.ts';
import { DEFAULT_MISSION_ID, type GameRecord, type JoinRefusal, type PlayerRecord, buildLobbyView, cleanPlayerName, createInitialState, findJoinRefusal } from './lobby.ts';

export type ActionError = JoinRefusal | 'unknownAction' | 'noSuchGame' | 'notInGame' | 'leaderCannotLeave' | 'noFreeJoinCode';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_UNAVAILABLE = 503;

export type ActionResult = { status: number; body: object };

/** Antal koder att prova innan servern ger upp. Med 160 000 koder räcker det gott. */
const JOIN_CODE_ATTEMPTS = 20;

const STATUS_FOR_ERROR: Record<ActionError, number> = {
  unknownAction: HTTP_BAD_REQUEST,
  invalidName: HTTP_BAD_REQUEST,
  noSuchGame: HTTP_NOT_FOUND,
  notInGame: HTTP_NOT_FOUND,
  gameStarted: HTTP_CONFLICT,
  gameFull: HTTP_CONFLICT,
  nameTaken: HTTP_CONFLICT,
  leaderCannotLeave: HTTP_CONFLICT,
  noFreeJoinCode: HTTP_UNAVAILABLE,
};

function fail(error: ActionError): ActionResult {
  return { status: STATUS_FOR_ERROR[error], body: { error } };
}

function succeed(body: object): ActionResult {
  return { status: HTTP_OK, body };
}

type Context = {
  userId: string;
  store: GameStore;
  /** Ger en ny slumpad kod. Skickas in, så att testerna kan välja koden. */
  createJoinCode: () => string;
};

type Action = Record<string, unknown> & { type: string };

function readAction(action: unknown): Action | null {
  if (!action || typeof action !== 'object' || !('type' in action) || typeof action.type !== 'string') return null;
  return action as Action;
}

/** Skickar det nya väntrummet till alla som är kvar i spelet. */
async function sendLobbyViews(transaction: GameTransaction, game: GameRecord, players: readonly PlayerRecord[]): Promise<void> {
  for (const player of players) {
    await transaction.sendView(player.id, buildLobbyView(game, players, player));
  }
}

async function createGame(action: Action, { userId, store, createJoinCode }: Context): Promise<ActionResult> {
  const name = cleanPlayerName(action.name);
  if (name === null) return fail('invalidName');
  return store.transaction(async (transaction) => {
    for (let attempt = 0; attempt < JOIN_CODE_ATTEMPTS; attempt += 1) {
      const game = await transaction.insertGame({ joinCode: createJoinCode(), missionId: DEFAULT_MISSION_ID, state: createInitialState() });
      if (!game) continue;
      // Spelledaren spelar med som standard. Valet att stå utanför kommer i steg 4.
      const leader = await transaction.insertPlayer({ gameId: game.id, userId, name, isLeader: true });
      await transaction.logEvent({ gameId: game.id, playerId: leader.id, action: { type: 'createGame', name } });
      return succeed({ view: buildLobbyView(game, [leader], leader) });
    }
    return fail('noFreeJoinCode');
  });
}

async function joinGame(action: Action, { userId, store }: Context): Promise<ActionResult> {
  const joinCode = typeof action.joinCode === 'string' ? normalizeJoinCode(action.joinCode) : '';
  if (!isValidJoinCode(joinCode)) return fail('noSuchGame');
  const name = cleanPlayerName(action.name);
  return store.transaction(async (transaction) => {
    const game = await transaction.lockGameByCode(joinCode);
    if (!game) return fail('noSuchGame');
    const players = await transaction.listPlayers(game.id);
    // En mobil som redan är med, till exempel efter en omladdning, får sin plats tillbaka.
    const returning = players.find((player) => player.userId === userId);
    if (returning) return succeed({ view: buildLobbyView(game, players, returning) });
    const refusal = findJoinRefusal({ state: game.state, players, name });
    if (refusal || name === null) return fail(refusal ?? 'invalidName');
    const player = await transaction.insertPlayer({ gameId: game.id, userId, name, isLeader: false });
    await transaction.logEvent({ gameId: game.id, playerId: player.id, action: { type: 'joinGame', name } });
    const playersNow = [...players, player];
    await sendLobbyViews(transaction, game, playersNow);
    return succeed({ view: buildLobbyView(game, playersNow, player) });
  });
}

/** Låser spelet och hittar mobilens spelare i det. */
async function findOwnPlayer(transaction: GameTransaction, gameId: unknown, userId: string) {
  if (typeof gameId !== 'string') return null;
  const game = await transaction.lockGameById(gameId);
  if (!game) return null;
  const players = await transaction.listPlayers(game.id);
  const player = players.find((candidate) => candidate.userId === userId);
  return player ? { game, players, player } : null;
}

async function getView(action: Action, { userId, store }: Context): Promise<ActionResult> {
  return store.transaction(async (transaction) => {
    const found = await findOwnPlayer(transaction, action.gameId, userId);
    if (!found) return fail('notInGame');
    return succeed({ view: buildLobbyView(found.game, found.players, found.player) });
  });
}

async function leaveGame(action: Action, { userId, store }: Context): Promise<ActionResult> {
  return store.transaction(async (transaction) => {
    const found = await findOwnPlayer(transaction, action.gameId, userId);
    if (!found) return succeed({});
    // Utan spelledare står spelet. Att ta över spelledningen kommer i steg 4.
    if (found.player.isLeader) return fail('leaderCannotLeave');
    if (found.game.state.status !== 'lobby') return fail('gameStarted');
    await transaction.deletePlayer(found.player.id);
    await transaction.logEvent({ gameId: found.game.id, playerId: null, action: { type: 'leaveGame', name: found.player.name } });
    const remaining = found.players.filter((player) => player.id !== found.player.id);
    await sendLobbyViews(transaction, found.game, remaining);
    return succeed({});
  });
}

const HANDLERS: Record<string, (action: Action, context: Context) => Promise<ActionResult>> = {
  createGame,
  joinGame,
  getView,
  leaveGame,
};

export async function handleAction({ action, context }: { action: unknown; context: Context }): Promise<ActionResult> {
  const validAction = readAction(action);
  if (validAction?.type === 'ping') {
    return succeed({ serverTime: await context.store.readServerTimeMs() });
  }
  const handler = validAction && Object.hasOwn(HANDLERS, validAction.type) ? HANDLERS[validAction.type] : null;
  if (!validAction || !handler) return fail('unknownAction');
  return handler(validAction, context);
}
