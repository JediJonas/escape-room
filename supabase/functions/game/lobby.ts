/**
 * Väntrummet: att skapa ett spel, gå med i det och vad varje mobil ser innan
 * spelet startar. Rena funktioner utan databas, se docs/motorn.md.
 */

export const MAX_PLAYERS = 10;
export const MAX_NAME_LENGTH = 20;

/** Uppdraget som nya spel får tills spelledaren kan välja (steg 4). */
export const DEFAULT_MISSION_ID = 'den-femte-gasten';

/** Spelets hela tillstånd. Motorn äger formen och fyller på i senare steg. */
export type GameState = {
  status: 'lobby' | 'running';
};

export type GameRecord = {
  id: string;
  joinCode: string;
  missionId: string;
  state: GameState;
};

export type PlayerRecord = {
  id: string;
  gameId: string;
  userId: string;
  name: string;
  isLeader: boolean;
  joinedAtMs: number;
};

/**
 * Det enda en mobil får veta i väntrummet. Andra spelares id skickas inte,
 * eftersom ingen mobil behöver dem.
 */
export type LobbyView = {
  type: 'lobby';
  gameId: string;
  joinCode: string;
  me: { playerId: string; name: string; isLeader: boolean };
  players: { name: string; isLeader: boolean; isMe: boolean }[];
};

export type JoinRefusal = 'invalidName' | 'gameStarted' | 'gameFull' | 'nameTaken';

export function createInitialState(): GameState {
  return { status: 'lobby' };
}

/** Tar bort mellanslag runt namnet och slår ihop flera mellanslag till ett. */
export function cleanPlayerName(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const name = input.trim().replace(/\s+/g, ' ');
  if (name.length === 0 || [...name].length > MAX_NAME_LENGTH) return null;
  return name;
}

/** Två namn räknas som samma om bara stora och små bokstäver skiljer. */
function isSameName(first: string, second: string): boolean {
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

export function buildLobbyView(game: GameRecord, players: readonly PlayerRecord[], viewer: PlayerRecord): LobbyView {
  const playersInJoinOrder = [...players].sort((first, second) => first.joinedAtMs - second.joinedAtMs);
  return {
    type: 'lobby',
    gameId: game.id,
    joinCode: game.joinCode,
    me: { playerId: viewer.id, name: viewer.name, isLeader: viewer.isLeader },
    players: playersInJoinOrder.map((player) => ({
      name: player.name,
      isLeader: player.isLeader,
      isMe: player.id === viewer.id,
    })),
  };
}
