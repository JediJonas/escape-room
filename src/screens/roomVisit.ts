import { DEFAULT_WALL_CORNERS_DEG, type HouseView } from '../../supabase/functions/game/house.ts';
import { type LookDirection, wrapYawDeg } from '../view/lookDirection.ts';

const FULL_TURN_DEG = 360;

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

/** En vinkel mellan 0 och ett helt varv. */
function wrapPositiveDeg(deg: number): number {
  return ((deg % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;
}

/** Mitten av väggen mellan två hörn, räknat åt höger från det första. */
function findWallCenterDeg(fromDeg: number, toDeg: number): number {
  return wrapYawDeg(fromDeg + wrapPositiveDeg(toDeg - fromDeg) / 2);
}

/**
 * Hållet spelaren tittar åt när hon kommer in i ett rum: mot mitten av
 * väggen mittemot dörren hon kom in genom, mitt emellan väggens hörn i
 * rundbilden, så att väggen med dörren är i ryggen och väggen framför är
 * centrerad (Jonas 2026-11-23). Vid spelets början, eller om dörren inte
 * syns i rundbilden, tittar hon rakt fram. I hallen är ytterdörren rakt bakom.
 */
export function chooseStartLook(house: Pick<HouseView, 'doors' | 'wallCornersDeg'>, cameFrom: string | null): LookDirection {
  const spot = house.doors.find((door) => door.id === cameFrom)?.spot;
  const corners = house.wallCornersDeg ?? DEFAULT_WALL_CORNERS_DEG;
  if (!spot || corners.length === 0) return { yawDeg: 0, pitchDeg: 0 };
  // Vägg nummer i går från hörn i till nästa hörn åt höger. Dörren sitter på den vägg som den ligger inom.
  const doorDeg = spot.frame?.yawDeg ?? spot.yawDeg;
  const at = (index: number) => corners[index % corners.length] ?? 0;
  const doorWall = Math.max(0, corners.findIndex((corner, index) => wrapPositiveDeg(doorDeg - corner) < wrapPositiveDeg(at(index + 1) - corner)));
  const facing = doorWall + corners.length / 2;
  return { yawDeg: findWallCenterDeg(at(facing), at(facing + 1)), pitchDeg: 0 };
}
