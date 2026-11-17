/**
 * Väljer vad en mobil ska se: väntrummet före start och spelet efter. Det
 * här är det enda som skickas till en mobil, se docs/motorn.md.
 */

import { type GameView, buildGameView } from './game.ts';
import { type LobbyView, buildLobbyView } from './lobby.ts';
import type { Mission } from './mission.ts';
import { MISSIONS } from './missions/index.ts';
import { type WaitingView, isPending } from './participants.ts';
import type { GameRecord, PlayerRecord } from './state.ts';

export type PlayerView = LobbyView | GameView | WaitingView;

/** En mobil som kom efter start får bara veta att den väntar, och på vad. */
function buildWaitingView({ game, mission, players, viewer }: { game: GameRecord; mission: Mission; players: readonly PlayerRecord[]; viewer: PlayerRecord }): WaitingView {
  const pending = game.state.pendingPlayers.find((candidate) => candidate.playerId === viewer.id);
  const target = players.find((player) => player.id === pending?.takesOverPlayerId);
  return {
    type: 'waiting',
    gameId: game.id,
    missionTitle: mission.title,
    me: { playerId: viewer.id, name: viewer.name, isLeader: viewer.isLeader },
    takesOver: target?.name ?? null,
  };
}

export function buildPlayerView(input: {
  game: GameRecord;
  mission: Mission;
  players: readonly PlayerRecord[];
  viewer: PlayerRecord;
}): PlayerView {
  if (input.game.state.status === 'lobby') return buildLobbyView({ ...input, missions: MISSIONS });
  if (isPending(input.game.state, input.viewer.id)) return buildWaitingView(input);
  return buildGameView(input);
}
