/**
 * Kanalerna och händelserna som servern skickar i, se docs/motorn.md.
 * Delas av serverfunktionen och mobilen, så att de säger samma sak.
 */

/** En spelares egen vy, i spelarens kanal. */
export const VIEW_EVENT = 'view';

/** Seansens läge, i gruppens kanal. */
export const SEANCE_EVENT = 'seance';

/** Bara spelaren lyssnar och bara servern skickar. */
export function getPlayerTopic(playerId: string): string {
  return `player:${playerId}`;
}

/**
 * Alla i spelet lyssnar och bara servern skickar. För det som är lika för
 * alla och ändras ofta, så att det skickas en gång i stället för en gång per
 * spelare. Skild från spelets kanal, där mobilerna själva skickar.
 */
export function getGroupTopic(gameId: string): string {
  return `group:${gameId}`;
}
