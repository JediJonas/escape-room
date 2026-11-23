/**
 * Väntrummet: att skapa ett spel, gå med i det och vad varje mobil ser innan
 * spelet startar. Rena funktioner utan databas, se docs/motorn.md.
 */

import type { Mission } from './mission.ts';
import type { GameRecord, GameState, PlayerRecord } from './state.ts';
import type { MissionTheme } from './theme.ts';

export const MAX_PLAYERS = 10;
export const MAX_NAME_LENGTH = 20;

/** Uppdraget som nya spel får. Spelledaren kan välja ett annat när hon startar. */
export const DEFAULT_MISSION_ID = 'prov';

/**
 * Det enda en mobil får veta i väntrummet. Andra spelares id skickas inte,
 * eftersom ingen mobil behöver dem.
 */
export type LobbyView = {
  type: 'lobby';
  gameId: string;
  joinCode: string;
  missionId: string;
  missionTitle: string;
  minPlayers: number;
  /** Väntrummet byter till uppdragets tema (Jonas 2026-11-23). */
  theme: MissionTheme | null;
  /** Bara hos spelledaren: uppdragen hon kan välja mellan. */
  missionChoices: MissionChoice[] | null;
  me: { playerId: string; name: string; isLeader: boolean };
  players: { name: string; isLeader: boolean; isMe: boolean }[];
};

/** Ett uppdrag som spelledaren kan välja, som ett kort med bild. */
export type MissionChoice = { id: string; title: string; minPlayers: number; theme: MissionTheme | null; cover: string | null; tagline: string | null };

export type JoinRefusal = 'invalidName' | 'gameStarted' | 'gameFull' | 'nameTaken';

/** Tar bort mellanslag runt namnet och slår ihop flera mellanslag till ett. */
export function cleanPlayerName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || [...name].length > MAX_NAME_LENGTH) return null;
  return name;
}

/** Två namn räknas som samma om bara stora och små bokstäver skiljer. */
export function isSameName(first: string, second: string): boolean {
  return first.localeCompare(second, 'sv', { sensitivity: 'accent' }) === 0;
}

/**
 * Avgör om en ny mobil får gå med. En mobil som redan är med kontrolleras
 * inte här, den får sin plats tillbaka.
 */
export function findJoinRefusal({ state, players, name }: {
  state: GameState;
  players: readonly PlayerRecord[];
  name: string | null;
}): JoinRefusal | null {
  if (name === null) return 'invalidName';
  // Efter start släpper spelledaren in den som kommer sent (steg 4).
  if (state.status !== 'lobby') return 'gameStarted';
  if (players.length >= MAX_PLAYERS) return 'gameFull';
  if (players.some((player) => isSameName(player.name, name))) return 'nameTaken';
  return null;
}

export function sortByJoinOrder(players: readonly PlayerRecord[]): PlayerRecord[] {
  return [...players].sort((first, second) => first.joinedAtMs - second.joinedAtMs);
}

export function describeViewer(viewer: PlayerRecord) {
  return { playerId: viewer.id, name: viewer.name, isLeader: viewer.isLeader };
}

export function buildLobbyView({ game, mission, missions, players, viewer }: {
  game: GameRecord;
  mission: Mission;
  /** Alla uppdrag. Skickas in, så att den här filen inte hämtar dem och mobilen kan använda den. */
  missions: readonly Mission[];
  players: readonly PlayerRecord[];
  viewer: PlayerRecord;
}): LobbyView {
  const playersInJoinOrder = sortByJoinOrder(players);
  return {
    type: 'lobby',
    gameId: game.id,
    joinCode: game.joinCode,
    missionId: mission.id,
    missionTitle: mission.title,
    minPlayers: mission.minPlayers,
    theme: mission.theme ?? null,
    missionChoices: viewer.isLeader ? missions.map(({ id, title, minPlayers, theme, cover, tagline }) => ({ id, title, minPlayers, theme: theme ?? null, cover: cover ?? null, tagline: tagline ?? null })) : null,
    me: describeViewer(viewer),
    players: playersInJoinOrder.map((player) => ({
      name: player.name,
      isLeader: player.isLeader,
      isMe: player.id === viewer.id,
    })),
  };
}
