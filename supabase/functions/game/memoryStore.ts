/**
 * En databas i minnet för testerna av handleAction, med samma regler som
 * tabellerna i engine. Används bara av testerna.
 */

import type { GameStore, GameTransaction } from './gameStore.ts';
import type { GameView } from './game.ts';
import { handleAction } from './handleAction.ts';
import type { LobbyView } from './lobby.ts';
import type { GameRecord, PlayerRecord } from './state.ts';
import type { SeanceUpdate } from './views.ts';

export const SERVER_TIME = new Date('2026-11-16T20:00:00.123Z');

/** En databas i minnet med samma regler som tabellerna i engine. */
export function createMemoryStore() {
  const games: GameRecord[] = [];
  const players: PlayerRecord[] = [];
  const events: object[] = [];
  const sentViews: { playerId: string; view: LobbyView | GameView }[] = [];
  const sentSeances: { gameId: string; update: SeanceUpdate }[] = [];
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
    async updateGameMission(gameId, missionId) {
      const game = games.find((candidate) => candidate.id === gameId);
      if (game) game.missionId = missionId;
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
    async updatePlayerUser(playerId, userId) {
      const player = players.find((candidate) => candidate.id === playerId);
      if (player) player.userId = userId;
    },
    async logEvent(event) {
      events.push(event);
    },
    async sendView(playerId, view) {
      sentViews.push({ playerId, view: view as LobbyView | GameView });
    },
    async sendSeance(gameId, update) {
      sentSeances.push({ gameId, update: update as SeanceUpdate });
    },
  };
  // Testerna kan flytta klockan framåt, till exempel för att planchetten i seansen ska hinna glida.
  const clock = { nowMs: SERVER_TIME.getTime() };
  const store: GameStore = {
    readServerTimeMs: async () => clock.nowMs,
    transaction: (work) => work(transaction),
  };
  return { store, games, players, events, sentViews, sentSeances, clock };
}

export function createContext(store: GameStore, userId: string, joinCodes = ['BCDF']) {
  const codes = [...joinCodes];
  return { userId, store, createJoinCode: () => codes.shift() ?? 'ZZZZ' };
}

export async function send(store: GameStore, userId: string, action: unknown) {
  return handleAction({ action, context: createContext(store, userId) });
}

export function readView(body: object): LobbyView {
  return (body as { view: LobbyView }).view;
}

export async function createGameWithPlayers(names: string[]) {
  const memory = createMemoryStore();
  await send(memory.store, 'user-leader', { type: 'createGame', name: 'Ledare' });
  for (const name of names) await send(memory.store, `user-${name}`, { type: 'joinGame', joinCode: 'BCDF', name });
  return memory;
}


export function readGameView(body: object): GameView {
  return (body as { view: GameView }).view;
}
