/**
 * Kanalen och händelsen som en spelares vy skickas i, se docs/motorn.md.
 * Delas av serverfunktionen och mobilen, så att de säger samma sak.
 */

export const VIEW_EVENT = 'view';

export function getPlayerTopic(playerId: string): string {
  return `player:${playerId}`;
}
