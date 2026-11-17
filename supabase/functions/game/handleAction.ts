/**
 * Tar emot en handling från en mobil och svarar. Känner inte till Deno eller
 * hur databasen nås, så att den går att testa med Vitest.
 *
 * Felen svarar med en kod, inte en text. Mobilen väljer texten, så att alla
 * texter som visas ligger i webbsidan eller i uppdragsfilen.
 */

import { type Action, type ActionResult, type Context, type GameScope, applyChange, buildOwnView, fail, readAction, sendViews, succeed, withOwnPlayer, withParticipant } from './actionKit.ts';
import { readGameMinutes } from './clock.ts';
import { type StateChange, advanceStep, choosePlace, giveHint, markReady, setPaused, showSolution, startGame, submitAnswer } from './game.ts';
import { isValidJoinCode, normalizeJoinCode } from './joinCode.ts';
import { DEFAULT_MISSION_ID, cleanPlayerName, findJoinRefusal } from './lobby.ts';
import { getMission } from './missions/index.ts';
import { type PlayerRecord, createInitialState } from './state.ts';
import { answerPendingAction, joinAfterStart } from './latecomers.ts';
import { buildPlayerView } from './views.ts';

export type { ActionError } from './actionKit.ts';

/** Antal koder att prova innan servern ger upp. Med 160 000 koder räcker det gott. */
const JOIN_CODE_ATTEMPTS = 20;

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
    if (name === null) return fail('invalidName');
    if (game.state.status !== 'lobby') return joinAfterStart({ transaction, game, mission, players, userId, name });
    const refusal = findJoinRefusal({ state: game.state, players, name });
    if (refusal) return fail(refusal);
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
  const nowMs = await context.store.readServerTimeMs();
  return withOwnPlayer(action, context, async (scope) => {
    const usesPlaceCards = action.usesPlaceCards !== false;
    const minutes = readGameMinutes(action.minutes);
    const leaderPlays = action.leaderPlays !== false;
    const change = startGame({ state: scope.game.state, mission: scope.mission, players: scope.players, starter: scope.player, usesPlaceCards, leaderPlays, minutes, nowMs });
    return applyChange(scope, change, { action: { type: 'startGame', usesPlaceCards, leaderPlays, minutes } });
  });
}

async function markReadyAction(action: Action, context: Context): Promise<ActionResult> {
  return withParticipant(action, context, async (scope) => {
    const change = markReady({ state: scope.game.state, mission: scope.mission, players: scope.participants, player: scope.player });
    return applyChange(scope, change, { action: { type: 'markReady', stepIndex: scope.game.state.stepIndex }, recipients: findRecipients(scope, change) });
  });
}

async function setPausedAction(action: Action, context: Context): Promise<ActionResult> {
  const nowMs = await context.store.readServerTimeMs();
  return withOwnPlayer(action, context, async (scope) => {
    const isPaused = action.isPaused === true;
    const change = setPaused({ state: scope.game.state, player: scope.player, isPaused, nowMs });
    return applyChange(scope, change, { action: { type: 'setPaused', isPaused } });
  });
}

async function nextStep(action: Action, context: Context): Promise<ActionResult> {
  return withOwnPlayer(action, context, async (scope) => {
    const change = advanceStep({ state: scope.game.state, mission: scope.mission, players: scope.participants, player: scope.player });
    return applyChange(scope, change, { action: { type: 'nextStep', fromStepIndex: scope.game.state.stepIndex } });
  });
}

/**
 * Den som är klar eller har kommit fram syns bara hos sig själv och hos
 * spelledaren. Går gruppen vidare får alla sin nya vy.
 */
function findRecipients(scope: GameScope, change: StateChange): readonly PlayerRecord[] {
  if ('refusal' in change) return [];
  const before = scope.game.state;
  if (change.state.stepIndex !== before.stepIndex || change.state.status !== before.status) return scope.players;
  return scope.players.filter((player) => player.id === scope.player.id || player.isLeader);
}

async function choosePlaceAction(action: Action, context: Context): Promise<ActionResult> {
  return withParticipant(action, context, async (scope) => {
    const change = choosePlace({ state: scope.game.state, mission: scope.mission, players: scope.participants, player: scope.player, placeId: action.placeId });
    // Varifrån platsen kom sparas bara i loggen. För motorn är det samma sak.
    const source = action.source === 'scan' ? 'scan' : 'list';
    return applyChange(scope, change, { action: { type: 'choosePlace', placeId: action.placeId, source }, recipients: findRecipients(scope, change) });
  });
}

async function submitAnswerAction(action: Action, context: Context): Promise<ActionResult> {
  return withParticipant(action, context, async (scope) => {
    const change = submitAnswer({ state: scope.game.state, mission: scope.mission, players: scope.participants, answer: action.answer });
    return applyChange(scope, change, { action: { type: 'submitAnswer', answer: action.answer, stepIndex: scope.game.state.stepIndex } });
  });
}

async function giveHintAction(action: Action, context: Context): Promise<ActionResult> {
  return withOwnPlayer(action, context, async (scope) => {
    const change = giveHint({ state: scope.game.state, mission: scope.mission, player: scope.player });
    return applyChange(scope, change, { action: { type: 'giveHint', stepIndex: scope.game.state.stepIndex } });
  });
}

async function showSolutionAction(action: Action, context: Context): Promise<ActionResult> {
  return withOwnPlayer(action, context, async (scope) => {
    const change = showSolution({ state: scope.game.state, mission: scope.mission, player: scope.player });
    // Facit syns bara hos spelledaren, så ingen annan får en ny vy.
    return applyChange(scope, change, { action: { type: 'showSolution', stepIndex: scope.game.state.stepIndex }, recipients: [scope.player] });
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
  markReady: markReadyAction,
  setPaused: setPausedAction,
  submitAnswer: submitAnswerAction,
  giveHint: giveHintAction,
  showSolution: showSolutionAction,
  admitPlayer: (action, context) => answerPendingAction(action, context, true),
  rejectPlayer: (action, context) => answerPendingAction(action, context, false),
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
