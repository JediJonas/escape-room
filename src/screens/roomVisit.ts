import type { DoorView } from '../../supabase/functions/game/house.ts';
import { type LookDirection, wrapYawDeg } from '../view/lookDirection.ts';

/** Ett halvt varv, så att väggen hamnar rakt bakom. */
const HALF_TURN_DEG = 180;
/** Rummen i rundbilderna är kvadratiska, så varje vägg är en fjärdedel av varvet, med mitten på 0, 90, 180 och -90 grader. */
const WALL_DEG = 90;

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
export function chooseStartLook(doors: readonly DoorView[], cameFrom: string | null): LookDirection {
  const spot = doors.find((door) => door.id === cameFrom)?.spot;
  if (!spot) return { yawDeg: 0, pitchDeg: 0 };
  const wallDeg = Math.round((spot.frame?.yawDeg ?? spot.yawDeg) / WALL_DEG) * WALL_DEG;
  return { yawDeg: wrapYawDeg(wallDeg + HALF_TURN_DEG), pitchDeg: 0 };
}
