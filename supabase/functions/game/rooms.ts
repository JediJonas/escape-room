/**
 * Uppgiftstypen Splittrade rum, så som Rummen minns använder den. Golvuret i
 * salongen har stannat. Den som vrider visarna till rätt tid får hela huset
 * att minnas, för alla spelare samtidigt. Då väljer var och en ett rum och
 * ser det som det var, med bitar som bara den som står där ser. Rummen fylls
 * jämnt. Efter några minuter bleknar minnet, och visarna går tillbaka till
 * tiden de hade från början. När gruppen har sett alla rummen och minnet har
 * bleknat är uppgiften klar. Se docs/koncept.md, Nu och 1962.
 *
 * Servern tickar inte. Tiden då minnet bleknar sparas när det börjar, och
 * tillståndet räknas fram till nu vid varje anrop. Rena funktioner utan
 * klocka: serverns tid skickas in.
 */

import { MAX_PLAYERS } from './lobby.ts';
import type { Place, RoomsStep } from './mission.ts';
import { type PlaceId, isPlaceId } from './places.ts';

const MS_PER_MINUTE = 60_000;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
/** En urtavla visar tolv timmar. Kvart över nio på kvällen står som kvart över nio på morgonen. */
export const DIAL_HOURS = 12;
export const DIAL_MINUTES = DIAL_HOURS * MINUTES_PER_HOUR;
/** Visarna hakar i var femte minut, så att det går att träffa rätt (Jonas 2026-11-17). */
export const DIAL_STEP_MINUTES = 5;

/** En tid som "21.15" eller "4.40", i minuter på urtavlan, eller null om den inte går att läsa. */
export function readDialTime(time: unknown): number | null {
  const match = typeof time === 'string' ? /^(\d{1,2})\.(\d{2})$/.exec(time) : null;
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours >= HOURS_PER_DAY || minutes >= MINUTES_PER_HOUR || minutes % DIAL_STEP_MINUTES !== 0) return null;
  return (hours * MINUTES_PER_HOUR + minutes) % DIAL_MINUTES;
}

/** Hakar i närmaste femte minut och håller visarna på urtavlan. */
export function snapDial(minutes: number): number {
  const snapped = Math.round(minutes / DIAL_STEP_MINUTES) * DIAL_STEP_MINUTES;
  return ((snapped % DIAL_MINUTES) + DIAL_MINUTES) % DIAL_MINUTES;
}

/** Ett val av rum i minnet. Ordningen avgör hur bitarna delas när flera står i samma rum. */
export type MemoryChoice = { playerId: string; place: PlaceId };

export type RoomsState = {
  /** Var visarna står, i minuter på urtavlan. */
  dialMinutes: number;
  /** Huset minns till den här tiden, i serverns tid, eller null när det inte minns. */
  remembersUntilMs: number | null;
  /** Vilka som har valt rum i minnet just nu, i den ordning de valde. */
  choices: MemoryChoice[];
  /** Rummen som någon har stått i under ett minne. */
  seenPlaces: PlaceId[];
};

function readStartMinutes(step: RoomsStep): number {
  return readDialTime(step.clockStart) ?? 0;
}

export function startRooms(step: RoomsStep): RoomsState {
  return { dialMinutes: readStartMinutes(step), remembersUntilMs: null, choices: [], seenPlaces: [] };
}

export function isRemembering(rooms: RoomsState, nowMs: number): boolean {
  return rooms.remembersUntilMs !== null && nowMs < rooms.remembersUntilMs;
}

/**
 * För fram tillståndet till nu. Har minnet bleknat räknas rummen som sedda,
 * och visarna går tillbaka till tiden de hade från början (Jonas 2026-11-17).
 */
export function advanceRooms(rooms: RoomsState, step: RoomsStep, nowMs: number): RoomsState {
  if (rooms.remembersUntilMs === null || isRemembering(rooms, nowMs)) return rooms;
  return { dialMinutes: readStartMinutes(step), remembersUntilMs: null, choices: [], seenPlaces: rooms.seenPlaces };
}

/** Uppgiften är klar när gruppen har sett alla rummen och minnet har bleknat. */
export function isRoomsSolved(rooms: RoomsState, step: RoomsStep): boolean {
  return rooms.remembersUntilMs === null && step.rooms.every((room) => rooms.seenPlaces.includes(room.place));
}

export type RoomsRefusal = 'houseRemembers' | 'notRemembering' | 'alreadyChosen' | 'unknownPlace' | 'roomFull';

/** Spelaren vrider visarna. Står de på rätt tid börjar huset minnas. */
export function turnClock({ rooms, step, minutes, nowMs }: {
  rooms: RoomsState;
  step: RoomsStep;
  minutes: unknown;
  nowMs: number;
}): { rooms: RoomsState } | { refusal: RoomsRefusal } {
  if (isRemembering(rooms, nowMs)) return { refusal: 'houseRemembers' };
  const current = advanceRooms(rooms, step, nowMs);
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return { rooms: current };
  const dialMinutes = snapDial(minutes);
  if (dialMinutes !== readDialTime(step.solution.time)) return { rooms: { ...current, dialMinutes } };
  return { rooms: { ...current, dialMinutes, remembersUntilMs: nowMs + step.memoryMinutes * MS_PER_MINUTE, choices: [] } };
}

function countByPlace(rooms: RoomsState, step: RoomsStep): Map<PlaceId, number> {
  const counts = new Map<PlaceId, number>(step.rooms.map((room) => [room.place, 0]));
  for (const choice of rooms.choices) counts.set(choice.place, (counts.get(choice.place) ?? 0) + 1);
  return counts;
}

/**
 * Rummen som går att välja just nu. Ett rum går bara att välja om inget
 * annat rum har färre spelare i sig, så att rummen fylls jämnt
 * (Jonas 2026-11-17).
 */
export function listChoosablePlaces(rooms: RoomsState, step: RoomsStep): PlaceId[] {
  const counts = countByPlace(rooms, step);
  const fewest = Math.min(...counts.values());
  return step.rooms.map((room) => room.place).filter((place) => counts.get(place) === fewest);
}

/** Spelaren väljer sitt rum i minnet. Hon stannar där tills minnet bleknar. */
export function chooseMemoryRoom({ rooms, step, playerId, placeId, nowMs }: {
  rooms: RoomsState;
  step: RoomsStep;
  playerId: string;
  placeId: unknown;
  nowMs: number;
}): { rooms: RoomsState } | { refusal: RoomsRefusal } {
  if (!isRemembering(rooms, nowMs)) return { refusal: 'notRemembering' };
  if (rooms.choices.some((choice) => choice.playerId === playerId)) return { refusal: 'alreadyChosen' };
  if (!isPlaceId(placeId) || !step.rooms.some((room) => room.place === placeId)) return { refusal: 'unknownPlace' };
  if (!listChoosablePlaces(rooms, step).includes(placeId)) return { refusal: 'roomFull' };
  const seenPlaces = rooms.seenPlaces.includes(placeId) ? rooms.seenPlaces : [...rooms.seenPlaces, placeId];
  return { rooms: { ...rooms, choices: [...rooms.choices, { playerId, place: placeId }], seenPlaces } };
}

/**
 * Bitarna som spelaren ser i sitt rum. Står flera i samma rum delas bitarna
 * mellan dem i den ordning de valde, så att ingen får samma skärm.
 */
function findMyPieces(rooms: RoomsState, step: RoomsStep, playerId: string): { place: PlaceId; pieces: string[] } | null {
  const mine = rooms.choices.find((choice) => choice.playerId === playerId);
  const room = step.rooms.find((candidate) => candidate.place === mine?.place);
  if (!mine || !room) return null;
  const holders = rooms.choices.filter((choice) => choice.place === mine.place);
  const holderIndex = holders.indexOf(mine);
  const pieces = room.pieces.filter((_, pieceIndex) => pieceIndex % holders.length === holderIndex);
  return { place: mine.place, pieces };
}

/** Det en spelare ser av uppgiften. Bitarna i ett rum syns bara för den som har valt rummet. */
export type RoomsView = {
  /** Var visarna står, i minuter på urtavlan. */
  dialMinutes: number;
  /** Huset minns till den här tiden, i serverns tid. Mobilen säger till när den har passerat. */
  remembersUntilMs: number | null;
  /** Raden överst i minnet, efter platsens namn, till exempel "kvart över nio, 1962". */
  memoryLabel: string;
  /** Alla rum i minnet, och om spelaren kan välja dem just nu. */
  rooms: { place: Place; isChoosable: boolean }[];
  /** Spelarens rum i minnet och det hon ser där, när hon har valt. */
  myRoom: { place: Place; pieces: string[] } | null;
};

export function describeRooms({ rooms, step, places, viewerId }: {
  rooms: RoomsState;
  step: RoomsStep;
  places: readonly Place[];
  viewerId: string;
}): RoomsView {
  const findPlace = (id: PlaceId): Place => places.find((place) => place.id === id) ?? { id, name: id };
  const mine = findMyPieces(rooms, step, viewerId);
  const choosable = rooms.remembersUntilMs !== null && !mine ? listChoosablePlaces(rooms, step) : [];
  return {
    dialMinutes: rooms.dialMinutes,
    remembersUntilMs: rooms.remembersUntilMs,
    memoryLabel: step.memoryLabel,
    rooms: step.rooms.map((room) => ({ place: findPlace(room.place), isChoosable: choosable.includes(room.place) })),
    myRoom: mine ? { place: findPlace(mine.place), pieces: mine.pieces } : null,
  };
}

/** Facit som text, för spelledaren och läckkontrollen. */
export function describeRoomsSolution(step: RoomsStep, places: readonly Place[]): string {
  const names = step.rooms.map((room) => places.find((place) => place.id === room.place)?.name ?? room.place);
  return `Vrid golvuret till ${step.solution.time}, och se ${names.join(', ')} i minnet`;
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
  const time = (step.solution as { time?: unknown } | undefined)?.time;
  const target = readDialTime(time);
  const start = readDialTime(step.clockStart);
  if (target === null) errors.push(`${name} saknar en tid i facit, som 21.15, på en femte minut`);
  if (start === null) errors.push(`${name} saknar en starttid på golvuret, som 4.40, på en femte minut`);
  if (target !== null && start === target) errors.push(`${name} har golvuret på rätt tid från början`);
  if (!(typeof step.memoryMinutes === 'number' && step.memoryMinutes > 0)) errors.push(`${name} saknar hur många minuter minnet varar`);
  if (!isFilledText(step.memoryLabel)) errors.push(`${name} saknar raden överst i minnet`);
  const rooms = step.rooms;
  if (!Array.isArray(rooms) || rooms.length === 0) return [...errors, `${name} saknar rum`];
  const piecesNeeded = Math.ceil(MAX_PLAYERS / rooms.length);
  const roomPlaces = new Set<unknown>();
  for (const room of rooms) {
    const place = room?.place;
    if (!isPlaceId(place) || !(place in places)) errors.push(`${name} har ett rum på en plats som uppdraget saknar: ${String(place)}`);
    if (roomPlaces.has(place)) errors.push(`${name} har två rum på platsen ${String(place)}`);
    roomPlaces.add(place);
    if (!Array.isArray(room?.pieces) || room.pieces.length < piecesNeeded || !room.pieces.every(isFilledText)) errors.push(`rummet ${String(place)} i ${name} ska ha minst ${piecesNeeded} bitar`);
  }
  return errors;
}

function readChoices(saved: unknown): MemoryChoice[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((choice) => {
    const fields = choice as Record<string, unknown> | null;
    if (!fields || typeof fields.playerId !== 'string' || !isPlaceId(fields.place)) return [];
    return [{ playerId: fields.playerId, place: fields.place }];
  });
}

/** Läser sparade rum, eller null om de saknas eller är trasiga. Det gamla formatet med gäster blir null. */
export function readRoomsState(saved: unknown): RoomsState | null {
  if (!saved || typeof saved !== 'object') return null;
  const fields = saved as Record<string, unknown>;
  if (!Number.isInteger(fields.dialMinutes) || !Array.isArray(fields.seenPlaces)) return null;
  const until = fields.remembersUntilMs;
  return {
    dialMinutes: snapDial(fields.dialMinutes as number),
    remembersUntilMs: typeof until === 'number' && Number.isFinite(until) ? until : null,
    choices: readChoices(fields.choices),
    seenPlaces: fields.seenPlaces.filter(isPlaceId),
  };
}
