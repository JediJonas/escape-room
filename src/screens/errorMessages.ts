/** Texterna för serverns felkoder. Servern skickar bara koden, se handleAction.ts. */

import type { ActionError } from '../../supabase/functions/game/handleAction.ts';
import { MAX_NAME_LENGTH } from '../../supabase/functions/game/lobby.ts';

const NETWORK_MESSAGE = 'Det gick inte att nå servern. Kontrollera nätet och försök igen.';

const MESSAGES: Record<ActionError, string> = {
  invalidName: `Skriv ett namn på högst ${MAX_NAME_LENGTH} tecken.`,
  noSuchGame: 'Det finns inget spel med den koden. Kontrollera bokstäverna.',
  gameStarted: 'Spelet har redan börjat.',
  gameFull: 'Spelet är fullt. Det får vara högst tio spelare.',
  nameTaken: 'Någon i spelet heter redan så. Välj ett annat namn.',
  notInGame: 'Du är inte med i det spelet längre.',
  leaderCannotLeave: 'Spelledaren kan inte lämna spelet.',
  noFreeJoinCode: 'Det gick inte att skapa ett spel just nu. Försök igen.',
  unknownAction: 'Sidan och servern förstår inte varandra. Ladda om sidan.',
  notLeader: 'Bara spelledaren kan göra det.',
  tooFewPlayers: 'Det är för få spelare för att starta.',
  notRunning: 'Spelet är inte igång.',
  unknownPlace: 'Den platsen finns inte i uppdraget.',
  notAtPlace: 'Gå till platsen först.',
  notPlaying: 'Du är inte med i uppgifterna just nu.',
  noSuchPlayer: 'Den mobilen väntar inte längre.',
  notATask: 'Det finns ingen uppgift att svara på just nu.',
  wrongAnswer: 'Det stämmer inte. Försök igen.',
  notTrapped: 'Det kan bara den andra sidan av källardörren göra.',
  noMoreFuses: 'Säkringarna är slut.',
  roomForgets: 'Rummet minns inte just nu. Vänta en stund.',
  noMoreHints: 'Uppgiften har inga fler ledtrådar.',
  unknownMission: 'Uppdraget finns inte längre. Starta ett nytt spel.',
};

export function getErrorMessage(code: string): string {
  return Object.hasOwn(MESSAGES, code) ? MESSAGES[code as ActionError] : NETWORK_MESSAGE;
}
