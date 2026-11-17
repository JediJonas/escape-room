/**
 * Uppgiftstypen Splittrade rum med Delat vittnesmål, så som Rummen minns
 * använder den. Spelarna går till var sitt rum och ser hur det såg ut en
 * gång. Varje rum har bitar, till exempel vad man ser och vad man hör, och
 * den som står i rummet väljer vem som var där. Namnet på den som var i ett
 * rum finns i ett annat rum, så att spelarna måste ropa till varandra. Fel
 * val gör att rummet glömmer en stund, så att det inte lönar sig att gissa.
 * Se docs/koncept.md, Rummen minns.
 *
 * Rena funktioner utan klocka: serverns tid skickas in.
 */

import { MAX_PLAYERS } from './lobby.ts';
import type { Place, RoomsStep } from './mission.ts';
import { type PlaceId, isPlaceId } from './places.ts';

/** Hur länge ett rum glömmer efter ett fel val. */
export const ROOM_FORGETS_MS = 15_000;

/** Ett rum som en spelare ska till, och vilka av rummets bitar hon ser där. */
export type RoomVisit = { place: PlaceId; pieceIndexes: number[] };

export type RoomsState = {
  /** Rummen som varje spelare ska till, efter spelarens id. */
  visitsByPlayer: Record<string, RoomVisit[]>;
  /** Rummen där gruppen har valt rätt. */
  solvedPlaces: PlaceId[];
  /** Ett rum som har fått fel val glömmer till den här tiden, i serverns tid. */
  forgetsUntilMsByPlace: Partial<Record<PlaceId, number>>;
};

/**
 * Delar ut rummen. Är spelarna färre än rummen tar någon flera rum och går
 * mellan dem. Är de fler delar flera på ett rum, och bitarna delas så att
 * ingen får samma skärm: med två i ett rum ser den ena och den andra hör.
 */
export function dealRooms(step: RoomsStep, playerIds: readonly string[]): Record<string, RoomVisit[]> {
  const visitsByPlayer: Record<string, RoomVisit[]> = {};
  if (playerIds.length === 0) return visitsByPlayer;
  const roomCount = step.rooms.length;
  step.rooms.forEach((room, roomIndex) => {
    const holders = playerIds.length <= roomCount
      ? [playerIds[roomIndex % playerIds.length]]
      : playerIds.filter((_, playerIndex) => playerIndex % roomCount === roomIndex);
    holders.forEach((playerId, holderIndex) => {
      const pieceIndexes = room.pieces.map((_, pieceIndex) => pieceIndex).filter((pieceIndex) => pieceIndex % holders.length === holderIndex);
      visitsByPlayer[playerId] = [...(visitsByPlayer[playerId] ?? []), { place: room.place, pieceIndexes }];
    });
  });
  return visitsByPlayer;
}

export function startRooms(step: RoomsStep, playerIds: readonly string[]): RoomsState {
  return { visitsByPlayer: dealRooms(step, playerIds), solvedPlaces: [], forgetsUntilMsByPlace: {} };
}

export function isRoomsSolved(rooms: RoomsState, step: RoomsStep): boolean {
  return step.rooms.every((room) => rooms.solvedPlaces.includes(room.place));
}

/** Spelaren är klar när alla hennes rum har rätt gäst. Den som inte fick något rum är klar direkt. */
export function hasSolvedOwnRooms(rooms: RoomsState, playerId: string): boolean {
  return (rooms.visitsByPlayer[playerId] ?? []).every((visit) => rooms.solvedPlaces.includes(visit.place));
}

export type GuestRefusal = 'notAtPlace' | 'roomForgets';

/**
 * Spelaren väljer vem som stod i rummet där hon är. Bara den som har rummet
 * och står där kan välja. Ett fel val gör att rummet glömmer en stund.
 */
export function chooseGuest({ rooms, step, playerId, placeId, guest, nowMs }: {
  rooms: RoomsState;
  step: RoomsStep;
  playerId: string;
  /** Platsen där spelaren är just nu. */
  placeId: PlaceId | undefined;
  guest: unknown;
  nowMs: number;
}): { rooms: RoomsState } | { refusal: GuestRefusal } {
  const visit = rooms.visitsByPlayer[playerId]?.find((candidate) => candidate.place === placeId);
  if (!visit) return { refusal: 'notAtPlace' };
  if (rooms.solvedPlaces.includes(visit.place)) return { rooms };
  if ((rooms.forgetsUntilMsByPlace[visit.place] ?? 0) > nowMs) return { refusal: 'roomForgets' };
  if (guest === step.solution.guestByPlace[visit.place]) return { rooms: { ...rooms, solvedPlaces: [...rooms.solvedPlaces, visit.place] } };
  return { rooms: { ...rooms, forgetsUntilMsByPlace: { ...rooms.forgetsUntilMsByPlace, [visit.place]: nowMs + ROOM_FORGETS_MS } } };
}

/** Det en spelare ser av uppgiften. Bitarna i ett rum syns bara för den som har rummet och står där. */
export type RoomsView = {
  /** Alla som kan ha stått i ett rum, att välja bland. */
  guests: string[];
  myRooms: { place: Place; isHere: boolean; isSolved: boolean }[];
  /** Spelarens rum där hon står just nu, om hon står i ett av dem. */
  current: {
    place: Place;
    pieces: string[];
    /** Den som stod här, när gruppen har valt rätt. */
    guest: string | null;
    /** Rummet glömmer till den här tiden, i serverns tid, efter ett fel val. */
    forgetsUntilMs: number | null;
  } | null;
  /** Om spelaren har ett rum kvar som hon inte står i. */
  hasRoomElsewhere: boolean;
  solvedCount: number;
  roomCount: number;
};

export function describeRooms({ rooms, step, places, placeId, viewerId }: {
  rooms: RoomsState;
  step: RoomsStep;
  places: readonly Place[];
  /** Platsen där spelaren är just nu. */
  placeId: PlaceId | undefined;
  viewerId: string;
}): RoomsView {
  const findPlace = (id: PlaceId): Place => places.find((place) => place.id === id) ?? { id, name: id };
  const visits = rooms.visitsByPlayer[viewerId] ?? [];
  const isSolved = (id: PlaceId) => rooms.solvedPlaces.includes(id);
  const here = visits.find((visit) => visit.place === placeId);
  const room = step.rooms.find((candidate) => candidate.place === here?.place);
  return {
    guests: step.guests,
    myRooms: visits.map((visit) => ({ place: findPlace(visit.place), isHere: visit === here, isSolved: isSolved(visit.place) })),
    current: here && room
      ? {
        place: findPlace(here.place),
        pieces: here.pieceIndexes.map((index) => room.pieces[index]).filter((piece) => piece !== undefined),
        guest: isSolved(here.place) ? step.solution.guestByPlace[here.place] ?? null : null,
        forgetsUntilMs: rooms.forgetsUntilMsByPlace[here.place] ?? null,
      }
      : null,
    hasRoomElsewhere: visits.some((visit) => visit !== here && !isSolved(visit.place)),
    solvedCount: rooms.solvedPlaces.length,
    roomCount: step.rooms.length,
  };
}

/** Facit som text, med rummens namn, för spelledaren och läckkontrollen. */
export function describeRoomsSolution(step: RoomsStep, places: readonly Place[]): string {
  return step.rooms.map((room) => `${places.find((place) => place.id === room.place)?.name ?? room.place}: ${step.solution.guestByPlace[room.place] ?? '?'}`).join(', ');
}

function isFilledText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Kontrollerar rummen i en uppdragsfil. Varje rum behöver lika många bitar
 * som det kan få spelare med tio i gruppen, så att ingen får samma skärm.
 */
export function findRoomsErrors(step: Record<string, unknown>, name: string, places: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const guests = step.guests;
  if (!Array.isArray(guests) || guests.length < 2 || !guests.every(isFilledText) || new Set(guests).size !== guests.length) errors.push(`${name} ska ha minst två gäster med olika namn`);
  const rooms = step.rooms;
  if (!Array.isArray(rooms) || rooms.length === 0) return [...errors, `${name} saknar rum`];
  const guestByPlace = (step.solution as { guestByPlace?: Record<string, unknown> } | undefined)?.guestByPlace ?? {};
  const piecesNeeded = Math.ceil(MAX_PLAYERS / rooms.length);
  const roomPlaces = new Set<unknown>();
  for (const room of rooms) {
    const place = room?.place;
    if (!isPlaceId(place) || !(place in places)) errors.push(`${name} har ett rum på en plats som uppdraget saknar: ${String(place)}`);
    if (roomPlaces.has(place)) errors.push(`${name} har två rum på platsen ${String(place)}`);
    roomPlaces.add(place);
    if (!Array.isArray(room?.pieces) || room.pieces.length < piecesNeeded || !room.pieces.every(isFilledText)) errors.push(`rummet ${String(place)} i ${name} ska ha minst ${piecesNeeded} bitar`);
    if (!Array.isArray(guests) || !guests.includes(guestByPlace[String(place)])) errors.push(`rummet ${String(place)} i ${name} saknar en gäst i facit`);
  }
  if (Object.keys(guestByPlace).some((place) => !roomPlaces.has(place))) errors.push(`${name} har facit för ett rum som inte finns`);
  return errors;
}

function isNumberRecord(value: unknown): value is Record<string, number> {
  return !!value && typeof value === 'object' && Object.values(value).every((item) => typeof item === 'number' && Number.isFinite(item));
}

function readVisits(saved: unknown): RoomVisit[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((visit) => {
    const fields = visit as Record<string, unknown> | null;
    if (!fields || !isPlaceId(fields.place) || !Array.isArray(fields.pieceIndexes) || !fields.pieceIndexes.every(Number.isInteger)) return [];
    return [{ place: fields.place, pieceIndexes: fields.pieceIndexes as number[] }];
  });
}

/** Läser sparade rum, eller null om de saknas eller är trasiga. */
export function readRoomsState(saved: unknown): RoomsState | null {
  if (!saved || typeof saved !== 'object') return null;
  const fields = saved as Record<string, unknown>;
  if (!fields.visitsByPlayer || typeof fields.visitsByPlayer !== 'object' || !Array.isArray(fields.solvedPlaces)) return null;
  const visitsByPlayer: Record<string, RoomVisit[]> = {};
  for (const [playerId, visits] of Object.entries(fields.visitsByPlayer)) visitsByPlayer[playerId] = readVisits(visits);
  const forgets = isNumberRecord(fields.forgetsUntilMsByPlace) ? fields.forgetsUntilMsByPlace : {};
  const forgetsUntilMsByPlace: Partial<Record<PlaceId, number>> = {};
  for (const [place, untilMs] of Object.entries(forgets)) if (isPlaceId(place)) forgetsUntilMsByPlace[place] = untilMs;
  return { visitsByPlayer, solvedPlaces: fields.solvedPlaces.filter(isPlaceId), forgetsUntilMsByPlace };
}
