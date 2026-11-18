/**
 * Huset i mobilen: rummen, dörrarna mellan dem och sakerna som gruppen
 * hittar. Spelaren går mellan rummen genom dörrarna, och en sak går bara att
 * hitta när berättelsen har kommit dit. Det som har hittats står i rummets
 * lista för hela gruppen. Se docs/koncept.md, Rundbilder, textvyn och rumsvyn.
 *
 * Rena funktioner. Platsen där spelaren är sparas i placeByPlayer, så att
 * uppgifter med en plats fungerar som förut.
 */

import type { Mission, MissionStep, Place } from './mission.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import { SEANCE_LETTERS, isSeanceComplete } from './seance.ts';
import { type PianoKey, listKeyPlayers, listMyKeys } from './piano.ts';
import { readDialTime } from './flashback.ts';
import type { GameState } from './state.ts';

/** En sak i ett rum som spelaren kan trycka på. Den öppnar alltid en vy. */
export type HouseThing = {
  id: string;
  name: string;
  /** Texten i vyn, till exempel det som står på tavlan. */
  text?: string;
  /**
   * Sidor att bläddra i, som gästboken. Spelaren börjar på första sidan
   * (Jonas 2026-11-18). Varje rad på en sida blir ett stycke.
   */
  pages?: string[];
  /**
   * Tomma sidor efter de skrivna, så att en bok som gästboken känns som en
   * liten bok och inte tar slut vid sista namnet (Jonas 2026-11-18).
   */
  blankPages?: number;
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
  /**
   * Det brädet bokstaverar av sig självt när någon går in på det efteråt,
   * om och om igen, från ett visst steg. Det senaste som berättelsen har
   * kommit till gäller (Jonas 2026-11-18).
   */
  echoes?: { fromStep: string; message: string }[];
};

export type HouseRoom = {
  place: PlaceId;
  doors: PlaceId[];
  things: HouseThing[];
  /**
   * Dörren till rummet är låst för alla utom den som steget skickar dit, som
   * den instängda till källaren (Jonas 2026-11-18). Dörren står ändå i listan.
   */
  isLocked?: boolean;
};

export type House = {
  /** Rummet där alla börjar. */
  start: PlaceId;
  rooms: HouseRoom[];
};

export type HouseRefusal = 'noDoor' | 'unknownPlace' | 'locked';

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

/** Spelaren går genom en dörr. Det går bara till ett rum intill, och in i ett låst rum bara om hon ska dit. */
export function walk({ state, house, playerId, placeId, mayEnterLocked = false }: {
  state: GameState;
  house: House;
  playerId: string;
  placeId: unknown;
  mayEnterLocked?: boolean;
}): { state: GameState } | { refusal: HouseRefusal } {
  const target = isPlaceId(placeId) ? findRoom(house, placeId) : undefined;
  if (!isPlaceId(placeId) || !target) return { refusal: 'unknownPlace' };
  const here = findRoom(house, state.placeByPlayer[playerId]);
  // Den som av någon anledning står utanför huset får gå till vilket rum som helst.
  if (here && !here.doors.includes(placeId)) return { refusal: 'noDoor' };
  if (target.isLocked === true && !mayEnterLocked) return { refusal: 'locked' };
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
  pages: string[] | null;
  /** Steget som saken öppnar, om det är det steg gruppen är på nu. */
  opensCurrentStep: boolean;
  /** Steget som saken öppnade tidigare och som går att läsa igen, med stegets `foundTitle`. */
  opensFound: string | null;
  /** Saken kallar på gruppen, som brädet när det vill fråga något (Jonas 2026-11-17). */
  isCalling: boolean;
  /**
   * Golvuret och pianot går att använda hela tiden, också när steget de
   * öppnar inte är det gruppen är på (Jonas 2026-11-18). Annars null.
   */
  instrument: Instrument | null;
  /** Det brädet bokstaverar av sig självt när steget det öppnar inte är det gruppen är på, annars null. */
  echo: string | null;
};

export type Instrument = { type: 'clock'; dialMinutes: number } | { type: 'piano'; keys: PianoKey[] };

/** Golvuret eller pianot, när steget det öppnar inte är det gruppen är på. */
function describeInstrument(opened: readonly MissionStep[], state: GameState, viewerId: string, participantIds: readonly string[]): Instrument | null {
  const flashback = opened.find((step) => step.type === 'flashback');
  if (flashback?.type === 'flashback') return { type: 'clock', dialMinutes: state.flashback?.dialMinutes ?? readDialTime(flashback.clockStart) ?? 0 };
  const piano = opened.find((step) => step.type === 'piano');
  if (piano?.type !== 'piano') return null;
  // Utanför steget spelar ingen melodin, så tangenterna delas mellan alla.
  return { type: 'piano', keys: listMyKeys(piano.keys, listKeyPlayers(state.piano?.melodyPlayerId ?? null, participantIds), viewerId) };
}

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

function describeThing(thing: HouseThing, mission: Mission, state: GameState, viewer?: { id: string; participantIds: readonly string[] }): ThingView {
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
    pages: thing.pages ? [...thing.pages, ...Array.from({ length: thing.blankPages ?? 0 }, () => '')] : null,
    opensCurrentStep: current !== undefined,
    opensFound,
    isCalling: current !== undefined && isStepCalling(current.step, state),
    instrument: current === undefined && viewer ? describeInstrument(opened.map(({ step }) => step), state, viewer.id, viewer.participantIds) : null,
    echo: current === undefined ? (thing.echoes ?? []).filter((echo) => state.stepIndex >= stepIndexOf(mission, echo.fromStep)).at(-1)?.message ?? null : null,
  };
}

export function describeHouse({ state, mission, house, places, viewerId, participantIds }: {
  state: GameState;
  mission: Mission;
  house: House;
  places: readonly Place[];
  viewerId: string;
  /** I den ordning de gick med, så att pianots tangenter delas lika varje gång. */
  participantIds: readonly string[];
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
    things: visible.map((thing) => describeThing(thing, mission, state, { id: viewerId, participantIds })),
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
  const { pages } = thing;
  if (pages !== undefined && !(Array.isArray(pages) && pages.length > 0 && pages.every(isFilledText))) errors.push(`${name} har sidor som är tomma eller inte är en lista`);
  const { blankPages } = thing;
  if (blankPages !== undefined && !(pages !== undefined && Number.isInteger(blankPages) && (blankPages as number) > 0)) errors.push(`${name} har tomma sidor men inga sidor med text, eller ett antal som inte är ett heltal över noll`);
  if (thing.fromStep !== undefined && !stepIds.includes(thing.fromStep)) errors.push(`${name} pekar på ett steg som inte finns: ${String(thing.fromStep)}`);
  const opens = thing.opensSteps;
  if (opens !== undefined && !(Array.isArray(opens) && opens.length > 0)) errors.push(`${name} ska öppna en lista med steg`);
  for (const stepId of Array.isArray(opens) ? opens : []) {
    if (!stepIds.includes(stepId)) errors.push(`${name} pekar på ett steg som inte finns: ${String(stepId)}`);
  }
  if (thing.callingText !== undefined && !(isFilledText(thing.callingText) && opens !== undefined)) errors.push(`${name} har en tom text för när den kallar, eller öppnar inga steg`);
  const { echoes } = thing;
  if (echoes !== undefined && !(Array.isArray(echoes) && echoes.length > 0)) errors.push(`${name} ska ha en lista med ekon`);
  for (const echo of Array.isArray(echoes) ? echoes as Record<string, unknown>[] : []) {
    if (!stepIds.includes(echo?.fromStep)) errors.push(`${name} har ett eko från ett steg som inte finns: ${String(echo?.fromStep)}`);
    if (typeof echo?.message !== 'string' || !SEANCE_LETTERS.test(echo.message)) errors.push(`${name} har ett eko med andra tecken än bokstäverna på brädet`);
  }
  if (thing.text === undefined && pages === undefined && opens === undefined) errors.push(`${name} har varken text, sidor eller steg att öppna`);
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
    if (room?.isLocked !== undefined && typeof room.isLocked !== 'boolean') errors.push(`rummet ${String(place)} har ett lås som inte är sant eller falskt`);
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
