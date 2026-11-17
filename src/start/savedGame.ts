/**
 * Det mobilen minns mellan omladdningar: vilket spel den är med i och vilket
 * namn spelaren skrev senast. Webbläsaren kan neka lagring, till exempel i
 * privat läge, och då fungerar sidan ändå men minns ingenting.
 */

const GAME_ID_KEY = 'escape-room.gameId';
const PLAYER_NAME_KEY = 'escape-room.playerName';

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Utan lagring minns mobilen inte spelet, men spelet fungerar.
  }
}

export const readSavedGameId = () => read(GAME_ID_KEY);
export const saveGameId = (gameId: string | null) => write(GAME_ID_KEY, gameId);
export const readSavedPlayerName = () => read(PLAYER_NAME_KEY);
export const savePlayerName = (name: string) => write(PLAYER_NAME_KEY, name);
