/**
 * Platserna A till F. De återanvänds i alla uppdrag, och uppdraget
 * bestämmer vad varje plats är för kvällen. Se docs/koncept.md.
 */

export const PLACE_IDS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

export function isPlaceId(value: unknown): value is PlaceId {
  return typeof value === 'string' && (PLACE_IDS as readonly string[]).includes(value);
}
