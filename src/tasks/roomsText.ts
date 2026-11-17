/** Texterna i Rummen minns som räknas fram ur vyn. Rena funktioner, så att de går att testa. */

import type { RoomsView } from '../../supabase/functions/game/rooms.ts';

const MS_PER_SECOND = 1000;

function joinNames(names: readonly string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;
}

/** Raden som säger vart spelaren ska. Klara rum nämns inte, så att det syns vad som är kvar. */
export function describeRoomsGoal(rooms: RoomsView): string {
  const left = rooms.myRooms.filter((room) => !room.isSolved && !room.isHere).map((room) => room.place.name.toLowerCase());
  if (rooms.myRooms.length === 0) return 'Du har inget eget rum. Hjälp de andra att lägga ihop vad de ser.';
  if (left.length === 0) return '';
  return rooms.current ? `Sedan ska du till ${joinNames(left)}.` : `Gå till ${joinNames(left)}.`;
}

/** Hur många hela sekunder som rummet glömmer, eller 0 om man får välja. */
export function countForgetSeconds(forgetsUntilMs: number | null, serverNowMs: number): number {
  if (forgetsUntilMs === null) return 0;
  return Math.max(0, Math.ceil((forgetsUntilMs - serverNowMs) / MS_PER_SECOND));
}
