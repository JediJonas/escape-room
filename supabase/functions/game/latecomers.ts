/**
 * Den som kommer efter start: en ny spelare eller en mobil som tar över en
 * spelare. Båda väntar tills spelledaren svarar. Se participants.ts för
 * reglerna och docs/motorn.md.
 */

import { type Action, type ActionResult, type Context, applyChange, buildOwnView, fail, sendViews, succeed, withOwnPlayer } from './actionKit.ts';
import type { GameTransaction } from './gameStore.ts';
import type { Mission } from './mission.ts';
import { addPending, answerPending, planLateJoin } from './participants.ts';
import type { GameRecord, PlayerRecord } from './state.ts';

/** Lägger till mobilen som väntande och säger till spelledaren. */
export async function joinAfterStart({ transaction, game, mission, players, userId, name }: {
  transaction: GameTransaction;
  game: GameRecord;
  mission: Mission;
  players: PlayerRecord[];
  userId: string;
  name: string;
}): Promise<ActionResult> {
  const plan = planLateJoin({ state: game.state, players, name });
  if ('refusal' in plan) return fail(plan.refusal);
  const player = await transaction.insertPlayer({ gameId: game.id, userId, name, isLeader: false });
  const state = addPending(game.state, { playerId: player.id, takesOverPlayerId: plan.takesOverPlayerId });
  await transaction.updateGameState(game.id, state);
  await transaction.logEvent({ gameId: game.id, playerId: player.id, action: { type: 'joinLate', name, takesOverPlayerId: plan.takesOverPlayerId } });
  const scope = { transaction, game: { ...game, state }, mission, players: [...players, player], player };
  await sendViews(scope, scope.players.filter((candidate) => candidate.isLeader || candidate.id === player.id));
  return succeed({ view: buildOwnView(scope) });
}

/**
 * Spelledaren släpper in eller nekar en mobil som väntar. Vid ett
 * övertagande flyttas den nya mobilens inloggning till spelaren, och raden
 * som mobilen väntade med tas bort. Spelarens roll och plats ligger kvar.
 */
export async function answerPendingAction(action: Action, context: Context, isAdmitted: boolean): Promise<ActionResult> {
  return withOwnPlayer(action, context, async (scope) => {
    const answer = answerPending({ state: scope.game.state, leader: scope.player, playerId: action.playerId });
    if ('refusal' in answer) return fail(answer.refusal);
    const { pending } = answer;
    const waiting = scope.players.find((player) => player.id === pending.playerId);
    if (!waiting) return fail('noSuchPlayer');
    const logged = { type: isAdmitted ? 'admitPlayer' : 'rejectPlayer', name: waiting.name, takesOverPlayerId: pending.takesOverPlayerId };
    const isTakeover = isAdmitted && pending.takesOverPlayerId !== null;
    if (!isAdmitted || isTakeover) {
      // Raden tas bort först, eftersom samma inloggning bara får finnas en gång i ett spel.
      await scope.transaction.deletePlayer(waiting.id);
      if (isTakeover) await scope.transaction.updatePlayerUser(pending.takesOverPlayerId as string, waiting.userId);
    }
    const players = scope.players
      .filter((player) => isAdmitted && !isTakeover ? true : player.id !== waiting.id)
      .map((player) => (isTakeover && player.id === pending.takesOverPlayerId ? { ...player, userId: waiting.userId } : player));
    // Den nekade och den som tog över hämtar själva sin nya vy, eftersom de lyssnar på en kanal som inte finns längre.
    return applyChange({ ...scope, players }, { state: answer.state }, { action: logged });
  });
}
