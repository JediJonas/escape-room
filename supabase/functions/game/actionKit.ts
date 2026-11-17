/**
 * Det som alla handlingar i serverfunktionen delar: felkoderna, svaren och
 * hur ett spel låses och en ändring sparas. Se handleAction.ts.
 */

import type { GameRefusal, StateChange } from './game.ts';
import type { GameStore, GameTransaction } from './gameStore.ts';
import type { JoinRefusal } from './lobby.ts';
import type { Mission } from './mission.ts';
import { getMission } from './missions/index.ts';
import { type LateJoinRefusal, type PendingRefusal, listParticipants } from './participants.ts';
import type { GameRecord, PlayerRecord } from './state.ts';
import { buildPlayerView } from './views.ts';

export type ActionError =
  | JoinRefusal
  | GameRefusal
  | LateJoinRefusal
  | PendingRefusal
  | 'notPlaying'
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
  notAtPlace: HTTP_CONFLICT,
  notPlaying: HTTP_CONFLICT,
  noSuchPlayer: HTTP_NOT_FOUND,
  notATask: HTTP_CONFLICT,
  wrongAnswer: HTTP_CONFLICT,
  noMoreHints: HTTP_CONFLICT,
  unknownMission: HTTP_SERVER_ERROR,
  noFreeJoinCode: HTTP_UNAVAILABLE,
};

export function fail(error: ActionError): ActionResult {
  return { status: STATUS_FOR_ERROR[error], body: { error } };
}

export function succeed(body: object): ActionResult {
  return { status: HTTP_OK, body };
}

export type Context = {
  userId: string;
  store: GameStore;
  /** Ger en ny slumpad kod. Skickas in, så att testerna kan välja koden. */
  createJoinCode: () => string;
};

export type Action = Record<string, unknown> & { type: string };

export function readAction(action: unknown): Action | null {
  if (!action || typeof action !== 'object' || !('type' in action) || typeof action.type !== 'string') return null;
  return action as Action;
}

/** Allt en handling i ett pågående spel behöver: spelet låst, uppdraget och spelarna. */
export type GameScope = {
  transaction: GameTransaction;
  game: GameRecord;
  mission: Mission;
  /** Alla mobiler i spelet, också spelledaren som står utanför och de som väntar. */
  players: PlayerRecord[];
  /** De som är med i uppgifterna. Motorns regler räknar bara dem. */
  participants: PlayerRecord[];
  player: PlayerRecord;
};

/** Skickar varje spelare sin vy. */
export async function sendViews(scope: Omit<GameScope, 'player' | 'participants'>, recipients: readonly PlayerRecord[]): Promise<void> {
  for (const viewer of recipients) {
    await scope.transaction.sendView(viewer.id, buildPlayerView({ ...scope, viewer }));
  }
}

export function buildOwnView(scope: Omit<GameScope, 'participants'>) {
  return buildPlayerView({ ...scope, viewer: scope.player });
}

/** Låser spelet, hittar mobilens spelare i det och kör arbetet. */
export async function withOwnPlayer(action: Action, { userId, store }: Context, work: (scope: GameScope) => Promise<ActionResult>): Promise<ActionResult> {
  return store.transaction(async (transaction) => {
    const game = typeof action.gameId === 'string' ? await transaction.lockGameById(action.gameId) : null;
    if (!game) return fail('notInGame');
    const players = await transaction.listPlayers(game.id);
    const player = players.find((candidate) => candidate.userId === userId);
    if (!player) return fail('notInGame');
    const mission = getMission(game.missionId);
    if (!mission) return fail('unknownMission');
    return work({ transaction, game, mission, players, participants: listParticipants(game.state, players), player });
  });
}

/** Som withOwnPlayer, men bara för den som är med i uppgifterna. */
export async function withParticipant(action: Action, context: Context, work: (scope: GameScope) => Promise<ActionResult>): Promise<ActionResult> {
  return withOwnPlayer(action, context, (scope) => {
    const isParticipant = scope.participants.some((player) => player.id === scope.player.id);
    return isParticipant ? work(scope) : Promise.resolve(fail('notPlaying'));
  });
}

/**
 * Sparar ett nytt tillstånd, loggar handlingen och skickar de nya vyerna.
 * Utan mottagare får alla i spelet sin vy.
 */
export async function applyChange(scope: GameScope, change: StateChange, { action, recipients }: { action: object; recipients?: readonly PlayerRecord[] }): Promise<ActionResult> {
  if ('refusal' in change) return fail(change.refusal);
  const game = { ...scope.game, state: change.state };
  const updated = { ...scope, game, participants: listParticipants(game.state, scope.players) };
  await scope.transaction.updateGameState(game.id, change.state);
  await scope.transaction.logEvent({ gameId: game.id, playerId: scope.player.id, action });
  await sendViews(updated, recipients ?? scope.players);
  return succeed({ view: buildOwnView(updated) });
}
