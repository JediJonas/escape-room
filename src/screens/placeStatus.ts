import type { Place } from '../../supabase/functions/game/mission.ts';

/**
 * Raden som säger var spelaren är och vart hon ska. Efter en skanning av fel
 * kort måste den visa att kortet lästes, annars ser det ut som om ingenting
 * hände.
 */
export function describePlaceStatus(goTo: Place | null, myPlace: Place | null): string {
  if (!goTo) return '';
  const goal = goTo.name.toLowerCase();
  if (myPlace?.id === goTo.id) return `Du är i ${goal}.`;
  if (myPlace) return `Du är i ${myPlace.name.toLowerCase()}. Gå till ${goal}.`;
  return `Gå till ${goal}.`;
}
