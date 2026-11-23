import type { HouseView } from '../../supabase/functions/game/house.ts';
import type { PlaceId } from '../../supabase/functions/game/places.ts';
import { type Direction, type Spot, findSpotAt, measureAngleDeg } from '../../supabase/functions/game/spots.ts';

/** Något i rundbilden som går att trycka på: en dörr, en sak eller något som ingen har hittat. */
export type RoomTarget =
  | { kind: 'door'; key: string; spot: Spot; label: string; placeId: PlaceId }
  | { kind: 'thing'; key: string; spot: Spot; label: string; thingId: string; isCalling: boolean }
  | { kind: 'hidden'; key: string; spot: Spot; label: string };

/** Det som inte är hittat än tänds med den här texten, eftersom mobilen inte vet vad det är. */
export const HIDDEN_LABEL = 'Undersök';

/** Nyckeln är platsen i bilden, så att en sak behåller den när den blir hittad. */
function spotKey(spot: Spot) {
  return `${spot.yawDeg}:${spot.pitchDeg}`;
}

/**
 * Allt i rummets rundbild som går att trycka på. Spelledaren som står
 * utanför hittar inget, så för henne tänds bara det som redan är hittat.
 */
export function listRoomTargets(house: HouseView, canFind: boolean): RoomTarget[] {
  const doors = house.doors.flatMap((door): RoomTarget[] => (door.spot ? [{ kind: 'door', key: spotKey(door.spot), spot: door.spot, label: `Gå till ${door.name.toLocaleLowerCase('sv')}`, placeId: door.id }] : []));
  const things = house.things.flatMap((thing): RoomTarget[] => (thing.spot ? [{ kind: 'thing', key: spotKey(thing.spot), spot: thing.spot, label: thing.name, thingId: thing.id, isCalling: thing.isCalling }] : []));
  const hidden = canFind ? house.hiddenSpots.map((spot): RoomTarget => ({ kind: 'hidden', key: spotKey(spot), spot, label: HIDDEN_LABEL })) : [];
  return [...doors, ...things, ...hidden];
}

/**
 * Det som ett tryck gäller. Trycket träffar i första hand det som sitter
 * under fingret, och annars det som är tänt mitt i bilden, så att den som
 * vrider mobilen kan trycka var som helst (se docs/koncept.md, Saker i rundbilden).
 */
export function findTappedTarget(targets: readonly RoomTarget[], tapped: Direction, aimed: Direction | null, isSidewaysOnly: boolean): RoomTarget | null {
  return findSpotAt(targets, tapped, { isSidewaysOnly }) ?? (aimed ? findSpotAt(targets, aimed, { isSidewaysOnly }) : null);
}

/** Så långt måste blicken ha rört sig innan något tänds, så att en darrande hand inte räknas. */
export const LOOK_AROUND_DEG = 3;

/**
 * Om spelaren har börjat se sig omkring sedan hon kom in i rummet. Innan dess
 * tänds inget, inte ens det som råkar vara mitt i bilden, som golvuret i
 * salongen (Jonas 2026-11-23).
 */
export function hasLookedAround(start: Direction, look: Direction): boolean {
  return measureAngleDeg(start, look) >= LOOK_AROUND_DEG;
}

/** Saken som en spelare just hittade, om den nu syns på samma plats. */
export function findThingAtSpot(house: HouseView, spot: Spot): string | null {
  return house.things.find((thing) => thing.spot !== null && spotKey(thing.spot) === spotKey(spot))?.id ?? null;
}
