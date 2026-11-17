/**
 * Vilka som spelar just nu. Spelledaren kan stå utanför, och den som kommer
 * efter start väntar tills spelledaren släpper in den, eller tar över en
 * spelare vars mobil har försvunnit. Rena funktioner, se docs/motorn.md.
 */

import { MAX_PLAYERS, isSameName } from './lobby.ts';
import type { GameState, PendingPlayer, PlayerRecord } from './state.ts';

export type LateJoinRefusal = 'gameStarted' | 'gameFull' | 'nameTaken';

export type PendingRefusal = 'notLeader' | 'notRunning' | 'noSuchPlayer';

export function isPending(state: GameState, playerId: string): boolean {
  return state.pendingPlayers.some((pending) => pending.playerId === playerId);
}

/** Om spelaren är med i uppgifterna. Spelledaren som står utanför och de som väntar är det inte. */
export function isParticipant(state: GameState, player: PlayerRecord): boolean {
  if (isPending(state, player.id)) return false;
  return !player.isLeader || state.leaderPlays;
}

export function listParticipants(state: GameState, players: readonly PlayerRecord[]): PlayerRecord[] {
  return players.filter((player) => isParticipant(state, player));
}

/**
 * Avgör vad som händer när en ny mobil kommer efter start. Har den samma namn
 * som en spelare ber den om att ta över spelaren, annars om att få vara med.
 */
export function planLateJoin({ state, players, name }: {
  state: GameState;
  players: readonly PlayerRecord[];
  name: string;
}): { refusal: LateJoinRefusal } | { takesOverPlayerId: string | null } {
  if (state.status !== 'running') return { refusal: 'gameStarted' };
  const sameName = players.find((player) => isSameName(player.name, name));
  if (sameName) {
    // Spelledaren släpper in, så hennes plats kan inte tas över på det här sättet.
    const isTaken = sameName.isLeader || isPending(state, sameName.id) || state.pendingPlayers.some((pending) => pending.takesOverPlayerId === sameName.id);
    return isTaken ? { refusal: 'nameTaken' } : { takesOverPlayerId: sameName.id };
  }
  if (players.length >= MAX_PLAYERS) return { refusal: 'gameFull' };
  return { takesOverPlayerId: null };
}

export function addPending(state: GameState, pending: PendingPlayer): GameState {
  return { ...state, pendingPlayers: [...state.pendingPlayers, pending] };
}

/**
 * Spelledaren svarar på en mobil som väntar. Den som släpps in spelar från
 * och med nu. Vid ett övertagande ger servern spelarens plats till den nya
 * mobilen, se handleAction.
 */
export function answerPending({ state, leader, playerId }: {
  state: GameState;
  leader: PlayerRecord;
  playerId: unknown;
}): { refusal: PendingRefusal } | { state: GameState; pending: PendingPlayer } {
  if (!leader.isLeader) return { refusal: 'notLeader' };
  if (state.status !== 'running') return { refusal: 'notRunning' };
  const pending = state.pendingPlayers.find((candidate) => candidate.playerId === playerId);
  if (!pending) return { refusal: 'noSuchPlayer' };
  return { state: { ...state, pendingPlayers: state.pendingPlayers.filter((candidate) => candidate !== pending) }, pending };
}

/** Det enda en mobil som väntar får veta. */
export type WaitingView = {
  type: 'waiting';
  gameId: string;
  missionTitle: string;
  me: { playerId: string; name: string; isLeader: boolean };
  /** Namnet på spelaren som mobilen vill ta över, eller null om den vill vara med som ny. */
  takesOver: string | null;
};

/** Det spelledaren ser om dem som väntar, så att hon kan svara. */
export function describePending(state: GameState, players: readonly PlayerRecord[]) {
  return state.pendingPlayers.flatMap((pending) => {
    const player = players.find((candidate) => candidate.id === pending.playerId);
    if (!player) return [];
    const target = players.find((candidate) => candidate.id === pending.takesOverPlayerId);
    return [{ playerId: player.id, name: player.name, takesOver: target?.name ?? null }];
  });
}
