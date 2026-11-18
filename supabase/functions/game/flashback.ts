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
import type { Place, FlashbackStep } from './mission.ts';
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
export type FlashbackChoice = { playerId: string; place: PlaceId };

export type FlashbackState = {
  /** Var visarna står, i minuter på urtavlan. */
  dialMinutes: number;
  /** Huset minns till den här tiden, i serverns tid, eller null när det inte minns. */
  remembersUntilMs: number | null;
  /** Vilka som har valt rum i minnet just nu, i den ordning de valde. */
  choices: FlashbackChoice[];
  /** Rummen som någon har stått i under ett minne. */
  seenPlaces: PlaceId[];
};

function readStartMinutes(step: FlashbackStep): number {
  return readDialTime(step.clockStart) ?? 0;
}

export function startFlashback(step: FlashbackStep): FlashbackState {
  return { dialMinutes: readStartMinutes(step), remembersUntilMs: null, choices: [], seenPlaces: [] };
}

export function isRemembering(flashback: FlashbackState, nowMs: number): boolean {
  return flashback.remembersUntilMs !== null && nowMs < flashback.remembersUntilMs;
}

/**
 * För fram tillståndet till nu. Har minnet bleknat räknas rummen som sedda,
 * och visarna går tillbaka till tiden de hade från början (Jonas 2026-11-17).
 */
export function advanceFlashback(flashback: FlashbackState, step: FlashbackStep, nowMs: number): FlashbackState {
  if (flashback.remembersUntilMs === null || isRemembering(flashback, nowMs)) return flashback;
  return { dialMinutes: readStartMinutes(step), remembersUntilMs: null, choices: [], seenPlaces: flashback.seenPlaces };
}

/**
 * Spelledaren trycker Hoppa över uppgiften medan huset minns. Då bleknar minnet
 * direkt, så att gruppen slipper vänta ut tiden, och alla rummen räknas som
 * sedda (Jonas 2026-11-18).
 */
export function endFlashbackNow(step: FlashbackStep): FlashbackState {
  return { dialMinutes: readStartMinutes(step), remembersUntilMs: null, choices: [], seenPlaces: step.rooms.map((room) => room.place) };
}

/** Uppgiften är klar när gruppen har sett alla rummen och minnet har bleknat. */
export function isFlashbackSolved(flashback: FlashbackState, step: FlashbackStep): boolean {
  return flashback.remembersUntilMs === null && step.rooms.every((room) => flashback.seenPlaces.includes(room.place));
}

export type FlashbackRefusal = 'houseRemembers' | 'notRemembering' | 'alreadyChosen' | 'unknownPlace' | 'roomFull';

/** Spelaren vrider visarna. Står de på rätt tid börjar huset minnas. */
export function turnClock({ flashback, step, minutes, nowMs }: {
  flashback: FlashbackState;
  step: FlashbackStep;
  minutes: unknown;
  nowMs: number;
}): { flashback: FlashbackState } | { refusal: FlashbackRefusal } {
  if (isRemembering(flashback, nowMs)) return { refusal: 'houseRemembers' };
  const current = advanceFlashback(flashback, step, nowMs);
  if (typeof minutes !== 'number' || !Number.isFinite(minutes)) return { flashback: current };
  const dialMinutes = snapDial(minutes);
  if (dialMinutes !== readDialTime(step.solution.time)) return { flashback: { ...current, dialMinutes } };
  return { flashback: { ...current, dialMinutes, remembersUntilMs: nowMs + step.flashbackMinutes * MS_PER_MINUTE, choices: [] } };
}

function countByPlace(flashback: FlashbackState, step: FlashbackStep): Map<PlaceId, number> {
  const counts = new Map<PlaceId, number>(step.rooms.map((room) => [room.place, 0]));
  for (const choice of flashback.choices) counts.set(choice.place, (counts.get(choice.place) ?? 0) + 1);
  return counts;
}

/**
 * Rummen som går att välja just nu. Ett rum går bara att välja om inget
 * annat rum har färre spelare i sig, så att rummen fylls jämnt
 * (Jonas 2026-11-17).
 */
export function listChoosablePlaces(flashback: FlashbackState, step: FlashbackStep): PlaceId[] {
  const counts = countByPlace(flashback, step);
  const fewest = Math.min(...counts.values());
  return step.rooms.map((room) => room.place).filter((place) => counts.get(place) === fewest);
}

function countRoomsOf(flashback: FlashbackState, playerId: string): number {
  return flashback.choices.filter((choice) => choice.playerId === playerId).length;
}

/**
 * Om spelaren får välja ett rum till. Är spelarna färre än rummen tar någon
 * ett tomt rum till, så att gruppen ser alla rum i samma minne
 * (Jonas 2026-11-18). Det går först när alla har ett rum, och bara för den
 * som inte har fler rum än någon annan, så att rummen delas jämnt.
 */
function canTakeAnotherRoom(flashback: FlashbackState, step: FlashbackStep, playerId: string, participantIds: readonly string[]): boolean {
  const mine = countRoomsOf(flashback, playerId);
  if (mine === 0) return false;
  const hasEmptyRoom = [...countByPlace(flashback, step).values()].includes(0);
  const fewest = Math.min(...participantIds.map((id) => countRoomsOf(flashback, id)));
  return hasEmptyRoom && fewest > 0 && mine === fewest;
}

/** Varför spelaren inte kan välja, eller null om hon kan. */
function findChoiceRefusal(flashback: FlashbackState, step: FlashbackStep, playerId: string, participantIds: readonly string[]): FlashbackRefusal | null {
  if (countRoomsOf(flashback, playerId) === 0) return null;
  return canTakeAnotherRoom(flashback, step, playerId, participantIds) ? null : 'alreadyChosen';
}

/**
 * Spelaren väljer sitt rum i minnet. Hon stannar där tills minnet bleknar.
 * Är spelarna färre än rummen kan hon ta ett tomt rum till när alla har valt.
 */
export function chooseFlashbackRoom({ flashback, step, playerId, participantIds, placeId, nowMs }: {
  flashback: FlashbackState;
  step: FlashbackStep;
  playerId: string;
  /** Alla som är med i uppgiften, för att se om alla har ett rum. */
  participantIds: readonly string[];
  placeId: unknown;
  nowMs: number;
}): { flashback: FlashbackState } | { refusal: FlashbackRefusal } {
  if (!isRemembering(flashback, nowMs)) return { refusal: 'notRemembering' };
  const refusal = findChoiceRefusal(flashback, step, playerId, participantIds);
  if (refusal) return { refusal };
  if (!isPlaceId(placeId) || !step.rooms.some((room) => room.place === placeId)) return { refusal: 'unknownPlace' };
  if (flashback.choices.some((choice) => choice.playerId === playerId && choice.place === placeId)) return { refusal: 'alreadyChosen' };
  if (!listChoosablePlaces(flashback, step).includes(placeId)) return { refusal: 'roomFull' };
  const seenPlaces = flashback.seenPlaces.includes(placeId) ? flashback.seenPlaces : [...flashback.seenPlaces, placeId];
  return { flashback: { ...flashback, choices: [...flashback.choices, { playerId, place: placeId }], seenPlaces } };
}

/**
 * Bitarna som spelaren ser i sina rum, i den ordning hon valde dem. Står
 * flera i samma rum delas bitarna mellan dem i den ordning de valde, så att
 * ingen får samma skärm.
 */
function findMyRooms(flashback: FlashbackState, step: FlashbackStep, playerId: string): { place: PlaceId; pieces: string[] }[] {
  return flashback.choices.filter((choice) => choice.playerId === playerId).flatMap((mine) => {
    const room = step.rooms.find((candidate) => candidate.place === mine.place);
    if (!room) return [];
    const holders = flashback.choices.filter((choice) => choice.place === mine.place);
    const holderIndex = holders.indexOf(mine);
    return [{ place: mine.place, pieces: room.pieces.filter((_, pieceIndex) => pieceIndex % holders.length === holderIndex) }];
  });
}

/** Om spelaren kan välja, väntar på att få ta ett rum till, eller har sina rum. */
export type FlashbackChoiceState = 'choose' | 'waitForOthers' | 'takeAnother' | 'done';

/** Det en spelare ser av uppgiften. Bitarna i ett rum syns bara för den som har valt rummet. */
export type FlashbackView = {
  /** Var visarna står, i minuter på urtavlan. */
  dialMinutes: number;
  /** Huset minns till den här tiden, i serverns tid. Mobilen säger till när den har passerat. */
  remembersUntilMs: number | null;
  /** Raden överst i minnet, efter platsens namn, till exempel "kvart över nio, 1962". */
  flashbackLabel: string;
  /** Alla rum i minnet, och om spelaren kan välja dem just nu. */
  rooms: { place: Place; isChoosable: boolean }[];
  /** Spelarens rum i minnet och det hon ser där, i den ordning hon valde dem. */
  myRooms: { place: Place; pieces: string[] }[];
  /** Om spelaren kan välja ett rum nu, eller ett rum till när de andra har valt. */
  choice: FlashbackChoiceState;
};

function findChoiceState(flashback: FlashbackState, step: FlashbackStep, viewerId: string, participantIds: readonly string[]): FlashbackChoiceState {
  const mine = countRoomsOf(flashback, viewerId);
  if (mine === 0) return 'choose';
  if (canTakeAnotherRoom(flashback, step, viewerId, participantIds)) return 'takeAnother';
  const hasEmptyRoom = [...countByPlace(flashback, step).values()].includes(0);
  const someoneHasNone = participantIds.some((id) => countRoomsOf(flashback, id) === 0);
  return hasEmptyRoom && someoneHasNone ? 'waitForOthers' : 'done';
}

export function describeFlashback({ flashback, step, places, viewerId, participantIds }: {
  flashback: FlashbackState;
  step: FlashbackStep;
  places: readonly Place[];
  viewerId: string;
  participantIds: readonly string[];
}): FlashbackView {
  const findPlace = (id: PlaceId): Place => places.find((place) => place.id === id) ?? { id, name: id };
  const mine = findMyRooms(flashback, step, viewerId);
  const choice = findChoiceState(flashback, step, viewerId, participantIds);
  const canChoose = flashback.remembersUntilMs !== null && (choice === 'choose' || choice === 'takeAnother');
  const choosable = canChoose ? listChoosablePlaces(flashback, step) : [];
  return {
    dialMinutes: flashback.dialMinutes,
    remembersUntilMs: flashback.remembersUntilMs,
    flashbackLabel: step.flashbackLabel,
    rooms: step.rooms.map((room) => ({ place: findPlace(room.place), isChoosable: choosable.includes(room.place) })),
    myRooms: mine.map((room) => ({ place: findPlace(room.place), pieces: room.pieces })),
    choice,
  };
}

/** Facit som text, för spelledaren och läckkontrollen. */
export function describeFlashbackSolution(step: FlashbackStep, places: readonly Place[]): string {
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
export function findFlashbackErrors(step: Record<string, unknown>, name: string, places: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const time = (step.solution as { time?: unknown } | undefined)?.time;
  const target = readDialTime(time);
  const start = readDialTime(step.clockStart);
  if (target === null) errors.push(`${name} saknar en tid i facit, som 21.15, på en femte minut`);
  if (start === null) errors.push(`${name} saknar en starttid på golvuret, som 4.40, på en femte minut`);
  if (target !== null && start === target) errors.push(`${name} har golvuret på rätt tid från början`);
  if (!(typeof step.flashbackMinutes === 'number' && step.flashbackMinutes > 0)) errors.push(`${name} saknar hur många minuter minnet varar`);
  if (!isFilledText(step.flashbackLabel)) errors.push(`${name} saknar raden överst i minnet`);
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

function readChoices(saved: unknown): FlashbackChoice[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((choice) => {
    const fields = choice as Record<string, unknown> | null;
    if (!fields || typeof fields.playerId !== 'string' || !isPlaceId(fields.place)) return [];
    return [{ playerId: fields.playerId, place: fields.place }];
  });
}

/** Läser sparade rum, eller null om de saknas eller är trasiga. Det gamla formatet med gäster blir null. */
export function readFlashbackState(saved: unknown): FlashbackState | null {
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
