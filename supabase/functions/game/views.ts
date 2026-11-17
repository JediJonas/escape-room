/**
 * Väljer vad en mobil ska se: väntrummet före start och spelet efter. Det
 * här är det enda som skickas till en mobil, se docs/motorn.md.
 */

import { type GameView, buildGameView } from './game.ts';
import { type LobbyView, buildLobbyView } from './lobby.ts';
import type { Mission } from './mission.ts';
import type { GameRecord, PlayerRecord } from './state.ts';

export type PlayerView = LobbyView | GameView;

export function buildPlayerView(input: {
  game: GameRecord;
  mission: Mission;
  players: readonly PlayerRecord[];
  viewer: PlayerRecord;
}): PlayerView {
  return input.game.state.status === 'lobby' ? buildLobbyView(input) : buildGameView(input);
}
