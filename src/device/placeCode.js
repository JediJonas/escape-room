// @ts-check

/** Platskorten på arket. Uppdraget bestämmer vad varje plats är för kvällen. */
export const PLACE_IDS = ['A', 'B', 'C', 'D', 'E', 'F'];

const PLACE_CODE_PREFIX = 'plats:';

/**
 * Tolkar texten i en QR-kod. Koden innehåller bara ett id, aldrig innehåll.
 * @param {string | null | undefined} text
 * @returns {string | null} platsens id, eller null om koden inte är ett platskort
 */
export function parsePlaceCode(text) {
  if (!text || !text.startsWith(PLACE_CODE_PREFIX)) return null;
  const placeId = text.slice(PLACE_CODE_PREFIX.length).trim().toUpperCase();
  return PLACE_IDS.includes(placeId) ? placeId : null;
}
