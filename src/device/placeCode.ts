import { PLACE_IDS, type PlaceId, isPlaceId } from '../../supabase/functions/game/places.ts';

// Testsidan hämtar listan härifrån, som förut.
export { PLACE_IDS };

const PLACE_CODE_PREFIX = 'plats:';

/**
 * Tolkar texten i en QR-kod. Koden innehåller bara ett id, aldrig innehåll.
 * @returns platsens id, eller null om koden inte är ett platskort
 */
export function parsePlaceCode(text: string | null | undefined): PlaceId | null {
  if (!text || !text.startsWith(PLACE_CODE_PREFIX)) return null;
  const placeId = text.slice(PLACE_CODE_PREFIX.length).trim().toUpperCase();
  return isPlaceId(placeId) ? placeId : null;
}
