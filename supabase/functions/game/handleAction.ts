/**
 * Tar emot en handling från en mobil och svarar. Känner inte till Deno eller
 * hur databasen nås, så att den går att testa med Vitest.
 *
 * Felen svarar med en kod, inte en text. Mobilen väljer texten, så att alla
 * texter som visas ligger i webbsidan eller i uppdragsfilen.
 */

import { type GameRefusal, type StateChange, advanceStep, choosePlace, startGame } from './game.ts';
import type { GameStore, GameTransaction } from './gameStore.ts';
import { isValidJoinCode, normalizeJoinCode } from './joinCode.ts';
import { DEFAULT_MISSION_ID, type JoinRefusal, cleanPlayerName, findJoinRefusal } from './lobby.ts';
import type { Mission } from './mission.ts';
import { getMission } from './missions/index.ts';
import { type GameRecord, type PlayerRecord, createInitialState } from './state.ts';
import { buildPlayerView } from './views.ts';

export type ActionError =
  | JoinRefusal
  | GameRefusal
  | 'unknownAction'
  | 'noSuchGame'
  | 'notInGame'
  | 'unknownMission'
  | 'leaderCannotLeave'
  | 'noFreeJoinCode';

const HTTP_OK = 200;
const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const HTTP_SERVER_ERROR = 500;
const HTTP_UNAVAILABLE = 503;

export type ActionResult = { status: number; body: object };

/** Antal koder att prova innan servern ger upp. Med 160 000 koder räcker det gott. */
const JOIN_CODE_ATTEMPTS = 20;

const STATUS_FOR_ERROR: Record<ActionError, number> = {
  unknownAction: HTTP_BAD_REQUEST,
  invalidName: HTTP_BAD_REQUEST,
  unknownPlace: HTTP_BAD_REQUEST,
  notLeader: HTTP_FORBIDDEN,
  noSuchGame: HTTP_NOT_FOUND,
  notInGame: HTTP_NOT_FOUND,
  gameStarted: HTTP_CONFLICT,
  gameFull: HTTP_CONFLICT,
  nameTaken: HTTP_CONFLICT,
  leaderCannotLeave: HTTP_CONFLICT,
  tooFewPlayers: HTTP_CONFLICT,
  notRunning: HTTP_CONFLICT,
  unknownMission: HTTP_SERVER_ERROR,
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

/** Allt en handling i ett pågående spel behöver: spelet låst, uppdraget och spelarna. */
type GameScope = {
  transaction: GameTransaction;
  game: GameRecord;
  mission: Mission;
  players: PlayerRecord[];
  player: PlayerRecord;
};

/** Skickar varje spelare sin vy. */
async function sendViews(scope: Omit<GameScope, 'player'>, recipients: readonly PlayerRecord[]): Promise<void> {
  for (const viewer of recipients) {
    await scope.transaction.sendView(viewer.id, buildPlayerView({ ...scope, viewer }));
  }
}

function buildOwnView(scope: GameScope) {
  return buildPlayerView({ ...scope, viewer: scope.player });
}

/** Låser spelet, hittar mobilens spelare i det och kör arbetet. */
async function withOwnPlayer(action: Action, { userId, store }: Context, work: (scope: GameScope) => Promise<ActionResult>): Promise<ActionResult> {
  return store.transaction(async (transaction) => {
    const game = typeof action.gameId === 'string' ? await transaction.lockGameById(action.gameId) : null;
    if (!game) return fail('notInGame');
    const players = await transaction.listPlayers(game.id);
    const player = players.find((candidate) => candidate.userId === userId);
    if (!player) return fail('notInGame');
    const mission = getMission(game.missionId);
    if (!mission) return fail('unknownMission');
    return work({ transaction, game, mission, players, player });
  });
}

/**
 * Sparar ett nytt tillstånd, loggar handlingen och skickar de nya vyerna.
 * Utan mottagare får alla i spelet sin vy.
 */
async function applyChange(scope: GameScope, change: StateChange, { action, recipients }: { action: object; recipients?: readonly PlayerRecord[] }): Promise<ActionResult> {
  if ('refusal' in change) return fail(change.refusal);
  const game = { ...scope.game, state: change.state };
  const updated = { ...scope, game };
  await scope.transaction.updateGameState(game.id, change.state);
  await scope.transaction.logEvent({ gameId: game.id, playerId: scope.player.id, action });
  await sendViews(updated, recipients ?? scope.players);
  return succeed({ view: buildOwnView(updated) });
}

async function createGame(action: Action, { userId, store, createJoinCode }: Context): Promise<ActionResult> {
  const name = cleanPlayerName(action.name);
  if (name === null) return fail('invalidName');
  const mission = getMission(DEFAULT_MISSION_ID);
  if (!mission) return fail('unknownMission');
  return store.transaction(async (transaction) => {
    for (let attempt = 0; attempt < JOIN_CODE_ATTEMPTS; attempt += 1) {
      const game = await transaction.insertGame({ joinCode: createJoinCode(), missionId: mission.id, state: createInitialState() });
      if (!game) continue;
      // Spelledaren spelar med som standard. Valet att stå utanför kommer i steg 4.
      const leader = await transaction.insertPlayer({ gameId: game.id, userId, name, isLeader: true });
      await transaction.logEvent({ gameId: game.id, playerId: leader.id, action: { type: 'createGame', name } });
      return succeed({ view: buildPlayerView({ game, mission, players: [leader], viewer: leader }) });
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
    const mission = getMission(game.missionId);
    if (!mission) return fail('unknownMission');
    const players = await transaction.listPlayers(game.id);
    // En mobil som redan är med, till exempel efter en omladdning, får sin plats tillbaka.
    const returning = players.find((player) => player.userId === userId);
    if (returning) return succeed({ view: buildPlayerView({ game, mission, players, viewer: returning }) });
    const refusal = findJoinRefusal({ state: game.state, players, name });
    if (refusal || name === null) return fail(refusal ?? 'invalidName');
    const player = await transaction.insertPlayer({ gameId: game.id, userId, name, isLeader: false });
    await transaction.logEvent({ gameId: game.id, playerId: player.id, action: { type: 'joinGame', name } });
    const scope = { transaction, game, mission, players: [...players, player], player };
    await sendViews(scope, scope.players);
    return succeed({ view: buildOwnView(scope) });
  });
}

async function getView(action: Action, context: Context): Promise<ActionResult> {
  return withOwnPlayer(action, context, async (scope) => succeed({ view: buildOwnView(scope) }));
}

async function leaveGame(action: Action, context: Context): Promise<ActionResult> {
  const result = await withOwnPlayer(action, context, async (scope) => {
    // Utan spelledare står spelet. Att ta över spelledningen kommer i steg 4.
    if (scope.player.isLeader) return fail('leaderCannotLeave');
    if (scope.game.state.status !== 'lobby') return fail('gameStarted');
    await scope.transaction.deletePlayer(scope.player.id);
    await scope.transaction.logEvent({ gameId: scope.game.id, playerId: null, action: { type: 'leaveGame', name: scope.player.name } });
    const remaining = scope.players.filter((player) => player.id !== scope.player.id);
    await sendViews({ ...scope, players: remaining }, remaining);
    return succeed({});
  });
  // Den som redan har lämnat har inget kvar att lämna.
  const isGone = 'error' in result.body && result.body.error === 'notInGame';
  return isGone ? succeed({}) : result;
}

async function startGameAction(action: Action, context: Context): Promise<ActionResult> {
  return withOwnPlayer(action, context, async (scope) => {
    const usesPlaceCards = action.usesPlaceCards !== false;
    const change = startGame({ state: scope.game.state, mission: scope.mission, players: scope.players, starter: scope.player, usesPlaceCards });
    return applyChange(scope, change, { action: { type: 'startGame', usesPlaceCards } });
  });
}

async function nextStep(action: Action, context: Context): Promise<ActionResult> {
  return withOwnPlayer(action, context, async (scope) => {
    const change = advanceStep({ state: scope.game.state, mission: scope.mission, players: scope.players, player: scope.player });
    return applyChange(scope, change, { action: { type: 'nextStep', fromStepIndex: scope.game.state.stepIndex } });
  });
}

async function choosePlaceAction(action: Action, context: Context): Promise<ActionResult> {
  return withOwnPlayer(action, context, async (scope) => {
    const change = choosePlace({ state: scope.game.state, mission: scope.mission, player: scope.player, placeId: action.placeId });
    // Varifrån platsen kom sparas bara i loggen. För motorn är det samma sak.
    const source = action.source === 'scan' ? 'scan' : 'list';
    // Bara spelaren själv ser sin plats, så de andra får ingen ny vy.
    return applyChange(scope, change, { action: { type: 'choosePlace', placeId: action.placeId, source }, recipients: [scope.player] });
  });
}

const HANDLERS: Record<string, (action: Action, context: Context) => Promise<ActionResult>> = {
  createGame,
  joinGame,
  getView,
  leaveGame,
  startGame: startGameAction,
  nextStep,
  choosePlace: choosePlaceAction,
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
