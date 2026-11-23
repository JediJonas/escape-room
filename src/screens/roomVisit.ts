import { DEFAULT_WALL_CENTERS_DEG, type HouseView } from '../../supabase/functions/game/house.ts';
import { type LookDirection, wrapYawDeg } from '../view/lookDirection.ts';

/**
 * Rummet som spelaren är i, rummet hon kom från och åt vilket håll hon
 * tittade senast. Det ligger utanför komponenterna, så att det finns kvar när
 * hon öppnar en sak och går tillbaka, och när hon går genom ett rum utan
 * rundbild, som källaren.
 */
export type RoomVisit = { roomId: string; cameFrom: string | null; look: LookDirection | null };

/** Ett nytt besök när spelaren har gått till ett annat rum. Samma rum ändrar ingenting. */
export function enterRoom(visit: RoomVisit, roomId: string): RoomVisit {
  if (visit.roomId === roomId) return visit;
  return { roomId, cameFrom: visit.roomId === '' ? null : visit.roomId, look: null };
}

/**
 * Hållet spelaren tittar åt när hon kommer in i ett rum: mot mitten av
 * väggen mittemot dörren hon kom in genom, så att väggen med dörren är i
 * ryggen och rummet ligger rakt framför henne (Jonas 2026-11-23). Vid spelets början,
 * eller om dörren inte syns i rundbilden, tittar hon rakt fram. I hallen är
 * ytterdörren rakt bakom.
 */
export function chooseStartLook(house: Pick<HouseView, 'doors' | 'wallCentersDeg'>, cameFrom: string | null): LookDirection {
  const spot = house.doors.find((door) => door.id === cameFrom)?.spot;
  const walls = house.wallCentersDeg ?? DEFAULT_WALL_CENTERS_DEG;
  if (!spot || walls.length === 0) return { yawDeg: 0, pitchDeg: 0 };
  // Dörren sitter på väggen vars mitt ligger närmast, och väggen mittemot är två steg bort.
  const doorDeg = spot.frame?.yawDeg ?? spot.yawDeg;
  const distances = walls.map((wall) => Math.abs(wrapYawDeg(wall - doorDeg)));
  const doorWall = distances.indexOf(Math.min(...distances));
  return { yawDeg: wrapYawDeg(walls[(doorWall + walls.length / 2) % walls.length] ?? 0), pitchDeg: 0 };
}
