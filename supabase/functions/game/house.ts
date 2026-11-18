/**
 * Huset i mobilen: rummen, dörrarna mellan dem och sakerna som gruppen
 * hittar. Spelaren går mellan rummen genom dörrarna, och en sak går bara att
 * hitta när berättelsen har kommit dit. Det som har hittats står i rummets
 * lista för hela gruppen. Se docs/koncept.md, Rundbilder och två lägen.
 *
 * Rena funktioner. Platsen där spelaren är sparas i placeByPlayer, så att
 * uppgifter med en plats fungerar som förut.
 */

import type { Mission, MissionStep, Place } from './mission.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import { isSeanceComplete } from './seance.ts';
import type { GameState } from './state.ts';

/** En sak i ett rum som spelaren kan trycka på. Den öppnar alltid en vy. */
export type HouseThing = {
  id: string;
  name: string;
  /** Texten i vyn, till exempel det som står på tavlan. */
  text?: string;
  /** Stegen som saken öppnar, till exempel båda seanserna vid ouijabrädet. */
  opensSteps?: string[];
  /** Saken går att hitta först när gruppen har kommit till det här steget. */
  fromStep?: string;
  /** Saken står i listan från början, som ouijabrädet. */
  isFoundFromStart?: boolean;
  /**
   * Det som spelarna i de andra rummen får veta när saken kallar på gruppen,
   * till exempel att det hörs något från salongen (Jonas 2026-11-18).
   */
  callingText?: string;
};

export type HouseRoom = { place: PlaceId; doors: PlaceId[]; things: HouseThing[] };

export type House = {
  /** Rummet där alla börjar. */
  start: PlaceId;
  rooms: HouseRoom[];
};

export type HouseRefusal = 'noDoor' | 'unknownPlace';

function findRoom(house: House, place: PlaceId | undefined): HouseRoom | undefined {
  return house.rooms.find((room) => room.place === place);
}

function stepIndexOf(mission: Mission, stepId: string | undefined): number {
  if (stepId === undefined) return 0;
  const index = mission.steps.findIndex((step) => step.id === stepId);
  return index === -1 ? Number.POSITIVE_INFINITY : index;
}

/** Om berättelsen har kommit så långt att saken går att hitta. */
function isFindable(thing: HouseThing, mission: Mission, state: GameState): boolean {
  return state.stepIndex >= stepIndexOf(mission, thing.fromStep);
}

function isFound(thing: HouseThing, state: GameState): boolean {
  return thing.isFoundFromStart === true || state.foundThings.includes(thing.id);
}

/** Alla börjar i samma rum när spelet startar. */
export function placeInHouse(state: GameState, house: House, playerIds: readonly string[]): GameState {
  const placeByPlayer = { ...state.placeByPlayer };
  for (const playerId of playerIds) placeByPlayer[playerId] = house.start;
  return { ...state, placeByPlayer };
}

/** Spelaren går genom en dörr. Det går bara till ett rum intill. */
export function walk({ state, house, playerId, placeId }: {
  state: GameState;
  house: House;
  playerId: string;
  placeId: unknown;
}): { state: GameState } | { refusal: HouseRefusal } {
  if (!isPlaceId(placeId) || !findRoom(house, placeId)) return { refusal: 'unknownPlace' };
  const here = findRoom(house, state.placeByPlayer[playerId]);
  // Den som av någon anledning står utanför huset får gå till vilket rum som helst.
  if (here && !here.doors.includes(placeId)) return { refusal: 'noDoor' };
  return { state: { ...state, placeByPlayer: { ...state.placeByPlayer, [playerId]: placeId } } };
}

/**
 * Spelaren letar i rummet där hon står och hittar det som berättelsen har
 * kommit till. I rundbilden hittar hon i stället en sak i taget, men tills
 * rundbilderna finns är det här reserven.
 */
export function searchRoom({ state, mission, house, playerId }: {
  state: GameState;
  mission: Mission;
  house: House;
  playerId: string;
}): GameState {
  const room = findRoom(house, state.placeByPlayer[playerId]);
  const newlyFound = (room?.things ?? []).filter((thing) => isFindable(thing, mission, state) && !isFound(thing, state)).map((thing) => thing.id);
  return newlyFound.length === 0 ? state : { ...state, foundThings: [...state.foundThings, ...newlyFound] };
}

/** En sak som spelaren ser i rummets lista. */
export type ThingView = {
  id: string;
  name: string;
  text: string | null;
  /** Steget som saken öppnar, om det är det steg gruppen är på nu. */
  opensCurrentStep: boolean;
  /** Steget som saken öppnade tidigare och som går att läsa igen, med namnet i Hittat. */
  opensFound: string | null;
  /** Saken kallar på gruppen, som brädet när det vill fråga något (Jonas 2026-11-17). */
  isCalling: boolean;
};

export type HouseView = {
  room: Place;
  doors: Place[];
  things: ThingView[];
  /** Det som hörs från ett annat rum där något kallar på gruppen, annars null. */
  callingFrom: string | null;
  /** Om det finns något kvar att hitta i rummet. Visas inte, men säger om knappen behövs. */
  canSearch: boolean;
};

/** En seans som kallar på gruppen gör det tills meddelandet är klart, och pianot tills melodin är spelad. */
function isStepCalling(step: MissionStep, state: GameState): boolean {
  if (step.type === 'piano') return step.callsFromHouse === true && state.piano !== null;
  return step.type === 'seance' && step.callsFromHouse === true && state.seance !== null && !isSeanceComplete(state.seance, step.solution.message);
}

function describeThing(thing: HouseThing, mission: Mission, state: GameState): ThingView {
  const opened = (thing.opensSteps ?? []).flatMap((stepId) => {
    const step = mission.steps.find((candidate) => candidate.id === stepId);
    return step ? [{ step, index: stepIndexOf(mission, stepId) }] : [];
  });
  const current = opened.find(({ index }) => index === state.stepIndex);
  const found = opened.filter(({ step, index }) => step.type === 'scene' && step.foundTitle !== undefined && index < state.stepIndex).at(-1);
  const opensFound = found?.step.type === 'scene' ? found.step.foundTitle ?? null : null;
  return {
    id: thing.id,
    name: thing.name,
    text: thing.text ?? null,
    opensCurrentStep: current !== undefined,
    opensFound,
    isCalling: current !== undefined && isStepCalling(current.step, state),
  };
}

export function describeHouse({ state, mission, house, places, viewerId }: {
  state: GameState;
  mission: Mission;
  house: House;
  places: readonly Place[];
  viewerId: string;
}): HouseView | null {
  const room = findRoom(house, state.placeByPlayer[viewerId]);
  const findPlace = (id: PlaceId): Place => places.find((place) => place.id === id) ?? { id, name: id };
  if (!room) return null;
  const visible = room.things.filter((thing) => isFound(thing, state) && isFindable(thing, mission, state));
  const callingRoom = house.rooms.find((other) => other !== room && other.things.some((thing) => describeThing(thing, mission, state).isCalling));
  const callingThing = callingRoom?.things.find((thing) => describeThing(thing, mission, state).isCalling);
  const callingPlace = callingRoom ? findPlace(callingRoom.place).name.toLocaleLowerCase('sv') : '';
  return {
    room: findPlace(room.place),
    doors: room.doors.map(findPlace),
    things: visible.map((thing) => describeThing(thing, mission, state)),
    callingFrom: callingThing ? callingThing.callingText ?? `Något rör sig vid ${callingThing.name.toLocaleLowerCase('sv')} i ${callingPlace}.` : null,
    canSearch: room.things.some((thing) => isFindable(thing, mission, state) && !isFound(thing, state)),
  };
}

/** Namnet på saken som öppnar steget, om steget öppnas från en sak i huset. */
export function findOpener(house: House | undefined, stepId: string): string | null {
  const things = house?.rooms.flatMap((room) => room.things) ?? [];
  return things.find((thing) => thing.opensSteps?.includes(stepId))?.name ?? null;
}

function isFilledText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function findThingErrors(thing: Record<string, unknown>, stepIds: readonly unknown[], thingIds: Set<unknown>): string[] {
  const name = `saken ${String(thing.id)} i huset`;
  const errors: string[] = [];
  if (!isFilledText(thing.id) || thingIds.has(thing.id)) errors.push('en sak i huset saknar id eller har samma id som en annan');
  thingIds.add(thing.id);
  if (!isFilledText(thing.name)) errors.push(`${name} saknar namn`);
  if (thing.text !== undefined && !isFilledText(thing.text)) errors.push(`${name} har en tom text`);
  if (thing.fromStep !== undefined && !stepIds.includes(thing.fromStep)) errors.push(`${name} pekar på ett steg som inte finns: ${String(thing.fromStep)}`);
  const opens = thing.opensSteps;
  if (opens !== undefined && !(Array.isArray(opens) && opens.length > 0)) errors.push(`${name} ska öppna en lista med steg`);
  for (const stepId of Array.isArray(opens) ? opens : []) {
    if (!stepIds.includes(stepId)) errors.push(`${name} pekar på ett steg som inte finns: ${String(stepId)}`);
  }
  if (thing.callingText !== undefined && !(isFilledText(thing.callingText) && opens !== undefined)) errors.push(`${name} har en tom text för när den kallar, eller öppnar inga steg`);
  if (thing.text === undefined && opens === undefined) errors.push(`${name} har varken text eller steg att öppna`);
  return errors;
}

/** Kontrollerar huset i en uppdragsfil: rummen finns bland platserna, och dörrarna går åt båda hållen. */
export function findHouseErrors(house: unknown, places: Record<string, unknown>, stepIds: readonly unknown[]): string[] {
  if (!house || typeof house !== 'object') return ['huset är inte ett objekt'];
  const { start, rooms } = house as Record<string, unknown>;
  if (!Array.isArray(rooms) || rooms.length === 0) return ['huset saknar rum'];
  const errors: string[] = [];
  const roomPlaces = rooms.map((room) => room?.place);
  if (!roomPlaces.includes(start)) errors.push('huset börjar i ett rum som inte finns');
  const thingIds = new Set<unknown>();
  for (const room of rooms) {
    const place = room?.place;
    if (!isPlaceId(place) || !(place in places)) errors.push(`huset har ett rum på en plats som uppdraget saknar: ${String(place)}`);
    if (!Array.isArray(room?.doors) || !Array.isArray(room?.things)) {
      errors.push(`rummet ${String(place)} saknar dörrar eller saker`);
      continue;
    }
    for (const door of room.doors) {
      const other = rooms.find((candidate) => candidate?.place === door);
      if (!other || !Array.isArray(other.doors) || !other.doors.includes(place)) errors.push(`dörren från ${String(place)} till ${String(door)} går inte tillbaka`);
    }
    for (const thing of room.things) errors.push(...findThingErrors(thing ?? {}, stepIds, thingIds));
  }
  return errors;
}
