/**
 * Huset i mobilen: rummen, dörrarna mellan dem och sakerna som gruppen
 * hittar. Spelaren går mellan rummen genom dörrarna, och en sak går alltid
 * att hitta och undersöka (Jonas 2026-11-18). Det som har hittats står i rummets
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
import { findReadSteps, hasRead } from './found.ts';
import type { GameState } from './state.ts';
import { type Direction, type Spot, findSpotAt, isSpot } from './spots.ts';

/** En sak i ett rum som spelaren kan trycka på. Den öppnar alltid en vy. */
export type HouseThing = {
  id: string;
  name: string;
  /** Texten i vyn, till exempel det som står på tavlan. */
  text?: string;
  /**
   * En närbild av saken, räknat från webbsidans början. Visas ovanför texten
   * (Jonas 2026-11-20).
   */
  image?: string;
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
  /**
   * Bokens första sida, som Gästbok Ekbacken. Den kommer före de skrivna
   * sidorna (Jonas 2026-11-18).
   */
  cover?: string;
  /**
   * Saken är dörren till ett låst rum, som källardörren. Den som får gå in
   * ser dörren bland dörrarna i stället för bland sakerna (Jonas 2026-11-18).
   */
  doorTo?: PlaceId;
  /** Stegen som saken öppnar, till exempel båda seanserna vid ouijabrädet. */
  opensSteps?: string[];
  /**
   * Saken står i listan från början. I Den femte gästen hittas allt med Leta
   * i rummet, också ouijabrädet, golvuret och pianot (Jonas 2026-11-18).
   */
  isFoundFromStart?: boolean;
  /**
   * Första ledtråden när ingen har hittat saken och gruppen behöver den, som
   * "Det finns ett ouijabräde någonstans i huset." (Jonas 2026-11-18).
   */
  findHint?: string;
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
  /** Var saken sitter i rummets rundbild. Krävs när rummet har en bild. */
  spot?: Spot;
};

export type HouseRoom = {
  place: PlaceId;
  doors: PlaceId[];
  things: HouseThing[];
  /**
   * Rundbilden av rummet i dag, räknat från webbsidans början. Ett rum utan
   * bild, som källaren tills den har en, visas som en lista (Jonas 2026-11-20).
   */
  image?: string;
  /** Var dörrarna sitter i rundbilden. En låst dörr som också är en sak sitter på samma ställe som saken. */
  doorSpots?: Partial<Record<PlaceId, Spot>>;
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

export function isFound(thing: HouseThing, state: GameState): boolean {
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
 * Spelaren letar i rummet där hon står och hittar allt som finns där. I
 * rundbilden hittar hon i stället en sak i taget, men tills rundbilderna
 * finns är det här reserven.
 */
export function searchRoom({ state, house, playerId }: {
  state: GameState;
  house: House;
  playerId: string;
}): GameState {
  const room = findRoom(house, state.placeByPlayer[playerId]);
  const newlyFound = (room?.things ?? []).filter((thing) => !isFound(thing, state)).map((thing) => thing.id);
  return newlyFound.length === 0 ? state : { ...state, foundThings: [...state.foundThings, ...newlyFound] };
}

/**
 * Spelaren har tryckt på något i rundbilden som ingen har hittat. Det som
 * sitter där är hittat för hela gruppen (Jonas 2026-11-17). Mobilen vet bara
 * var det sitter, inte vad det är.
 */
export function findThingAt({ state, house, playerId, direction }: {
  state: GameState;
  house: House;
  playerId: string;
  direction: unknown;
}): GameState {
  if (!isDirection(direction)) return state;
  const room = findRoom(house, state.placeByPlayer[playerId]);
  const hidden = (room?.things ?? []).filter((thing) => !isFound(thing, state)).flatMap((thing) => (thing.spot ? [{ thing, spot: thing.spot }] : []));
  const found = findSpotAt(hidden, direction);
  return found ? { ...state, foundThings: [...state.foundThings, found.thing.id] } : state;
}

function isDirection(value: unknown): value is Direction {
  if (!value || typeof value !== 'object') return false;
  const { yawDeg, pitchDeg } = value as Record<string, unknown>;
  return typeof yawDeg === 'number' && Number.isFinite(yawDeg) && typeof pitchDeg === 'number' && Number.isFinite(pitchDeg);
}

/** En sak som spelaren ser i rummet. */
export type ThingView = {
  id: string;
  name: string;
  text: string | null;
  /** Närbilden av saken, eller null. */
  image: string | null;
  pages: string[] | null;
  /** Bokens första sida, eller null. */
  cover: string | null;
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
  /** Spelaren har inte läst det som saken ger, som urklippen. Tillbaka räknas då som läst (Jonas 2026-11-18). */
  marksRead: boolean;
  /**
   * Saken öppnar uppgiften som scenen väntar på, som golvuret medan
   * berättelsen väntar på urklippen. Där kan spelledaren ge ledtråd (Jonas 2026-11-18).
   */
  opensAwaitedTask: boolean;
  /** Var saken sitter i rundbilden, eller null i ett rum utan bild. */
  spot: Spot | null;
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

/** En dörr till ett rum intill, och var den sitter i rundbilden. */
export type DoorView = Place & { spot: Spot | null };

export type HouseView = {
  room: Place;
  /** Rundbilden av rummet, eller null om rummet inte har någon än. */
  image: string | null;
  doors: DoorView[];
  things: ThingView[];
  /** Var det sitter saker som ingen har hittat, utan vad de är. */
  hiddenSpots: Spot[];
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

/** Om scenen väntar på en uppgift som saken öppnar och som gruppen inte har klarat än. */
function isAwaitedBy(step: MissionStep | undefined, state: GameState, thing: HouseThing): boolean {
  if (step?.type !== 'scene' || step.endsWithStep === undefined || state.solvedSteps.includes(step.endsWithStep)) return false;
  return thing.opensSteps?.includes(step.endsWithStep) ?? false;
}

function describeThing(thing: HouseThing, mission: Mission, state: GameState, viewer?: { id: string; participantIds: readonly string[] }): ThingView {
  const opened = (thing.opensSteps ?? []).flatMap((stepId) => {
    const step = mission.steps.find((candidate) => candidate.id === stepId);
    return step ? [{ step, index: stepIndexOf(mission, stepId) }] : [];
  });
  const current = opened.find(({ index }) => index === state.stepIndex);
  const found = opened.filter(({ step, index }) => step.type === 'scene' && step.foundTitle !== undefined && index !== state.stepIndex && state.found[step.id] !== undefined).at(-1);
  const opensFound = found?.step.type === 'scene' ? found.step.foundTitle ?? null : null;
  return {
    id: thing.id,
    name: thing.name,
    text: thing.text ?? null,
    image: thing.image ?? null,
    pages: thing.pages ? [...thing.pages, ...Array.from({ length: thing.blankPages ?? 0 }, () => '')] : null,
    cover: thing.cover ?? null,
    opensCurrentStep: current !== undefined,
    opensFound,
    isCalling: current !== undefined && isStepCalling(current.step, state),
    instrument: current === undefined && viewer ? describeInstrument(opened.map(({ step }) => step), state, viewer.id, viewer.participantIds) : null,
    echo: current === undefined ? (thing.echoes ?? []).filter((echo) => state.stepIndex >= stepIndexOf(mission, echo.fromStep)).at(-1)?.message ?? null : null,
    opensAwaitedTask: isAwaitedBy(mission.steps[state.stepIndex], state, thing),
    marksRead: viewer !== undefined && findReadSteps(mission, thing.id).some((stepId) => !hasRead(state.foundReaders, stepId, viewer.id)),
    spot: thing.spot ?? null,
  };
}

export function describeHouse({ state, mission, house, places, viewerId, participantIds, mayEnter }: {
  state: GameState;
  mission: Mission;
  house: House;
  places: readonly Place[];
  viewerId: string;
  /** I den ordning de gick med, så att pianots tangenter delas lika varje gång. */
  participantIds: readonly string[];
  /** Det låsta rum som spelaren får gå in i, som källaren för den som ska ner dit. */
  mayEnter?: PlaceId;
}): HouseView | null {
  const room = findRoom(house, state.placeByPlayer[viewerId]);
  const findPlace = (id: PlaceId): Place => places.find((place) => place.id === id) ?? { id, name: id };
  if (!room) return null;
  // Ett låst rum syns bland dörrarna bara för den som får gå in. De andra ser dörren bland sakerna
  // när den är hittad, och den som får gå in ser den inte där (Jonas 2026-11-18).
  const isOpenTo = (place: PlaceId) => findRoom(house, place)?.isLocked !== true || place === mayEnter;
  const visible = room.things.filter((thing) => isFound(thing, state) && (thing.doorTo === undefined || thing.doorTo !== mayEnter));
  const callingRoom = house.rooms.find((other) => other !== room && other.things.some((thing) => describeThing(thing, mission, state).isCalling));
  const callingThing = callingRoom?.things.find((thing) => describeThing(thing, mission, state).isCalling);
  const callingPlace = callingRoom ? findPlace(callingRoom.place).name.toLocaleLowerCase('sv') : '';
  // En låst dörr som också är en sak, som källardörren, sitter där saken sitter.
  const findDoorSpot = (place: PlaceId): Spot | null => room.doorSpots?.[place] ?? room.things.find((thing) => thing.doorTo === place)?.spot ?? null;
  return {
    room: findPlace(room.place),
    image: room.image ?? null,
    doors: room.doors.filter(isOpenTo).map((place) => ({ ...findPlace(place), spot: findDoorSpot(place) })),
    things: visible.map((thing) => describeThing(thing, mission, state, { id: viewerId, participantIds })),
    hiddenSpots: room.things.flatMap((thing) => (!isFound(thing, state) && thing.spot ? [thing.spot] : [])),
    callingFrom: callingThing ? callingThing.callingText ?? `Något rör sig vid ${callingThing.name.toLocaleLowerCase('sv')} i ${callingPlace}.` : null,
    canSearch: room.things.some((thing) => !isFound(thing, state)),
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
  if (thing.image !== undefined && !(isFilledText(thing.image) && thing.text !== undefined)) errors.push(`${name} har en tom bild eller en bild utan text`);
  const { pages } = thing;
  if (pages !== undefined && !(Array.isArray(pages) && pages.length > 0 && pages.every(isFilledText))) errors.push(`${name} har sidor som är tomma eller inte är en lista`);
  const { blankPages } = thing;
  if (blankPages !== undefined && !(pages !== undefined && Number.isInteger(blankPages) && (blankPages as number) > 0)) errors.push(`${name} har tomma sidor men inga sidor med text, eller ett antal som inte är ett heltal över noll`);
  // Saker går alltid att hitta och undersöka. Det som inte ska nås för tidigt låses i stället (Jonas 2026-11-18).
  if (thing.fromStep !== undefined) errors.push(`${name} har fromStep, men saker går alltid att hitta. Lås det som inte ska nås för tidigt`);
  const opens = thing.opensSteps;
  if (opens !== undefined && !(Array.isArray(opens) && opens.length > 0)) errors.push(`${name} ska öppna en lista med steg`);
  for (const stepId of Array.isArray(opens) ? opens : []) {
    if (!stepIds.includes(stepId)) errors.push(`${name} pekar på ett steg som inte finns: ${String(stepId)}`);
  }
  if (thing.findHint !== undefined && !(isFilledText(thing.findHint) && opens !== undefined)) errors.push(`${name} har en tom ledtråd för att hitta den, eller öppnar inga steg`);
  if (thing.callingText !== undefined && !(isFilledText(thing.callingText) && opens !== undefined)) errors.push(`${name} har en tom text för när den kallar, eller öppnar inga steg`);
  const { echoes } = thing;
  if (echoes !== undefined && !(Array.isArray(echoes) && echoes.length > 0)) errors.push(`${name} ska ha en lista med ekon`);
  for (const echo of Array.isArray(echoes) ? echoes as Record<string, unknown>[] : []) {
    if (!stepIds.includes(echo?.fromStep)) errors.push(`${name} har ett eko från ett steg som inte finns: ${String(echo?.fromStep)}`);
    if (typeof echo?.message !== 'string' || !SEANCE_LETTERS.test(echo.message)) errors.push(`${name} har ett eko med andra tecken än bokstäverna på brädet`);
  }
  if (thing.cover !== undefined && !(isFilledText(thing.cover) && pages !== undefined)) errors.push(`${name} har en tom första sida eller inga sidor`);
  if (thing.doorTo !== undefined && !isPlaceId(thing.doorTo)) errors.push(`${name} är en dörr till en plats som inte finns`);
  if (thing.text === undefined && pages === undefined && opens === undefined) errors.push(`${name} har varken text, sidor eller steg att öppna`);
  if (thing.spot !== undefined && !isSpot(thing.spot)) errors.push(`${name} har en plats i rundbilden som inte går att läsa`);
  return errors;
}

/** Ett rum med rundbild har en plats i bilden för varje sak och dörr, så att allt går att nå. */
function findImageErrors(room: Record<string, unknown>): string[] {
  const place = String(room.place);
  if (room.image === undefined) return room.doorSpots === undefined ? [] : [`rummet ${place} har dörrar i en rundbild men ingen bild`];
  if (!isFilledText(room.image)) return [`rummet ${place} har en tom bild`];
  const errors: string[] = [];
  const doorSpots = (room.doorSpots ?? {}) as Record<string, unknown>;
  const things = room.things as Record<string, unknown>[];
  for (const [door, spot] of Object.entries(doorSpots)) {
    if (!(room.doors as unknown[]).includes(door)) errors.push(`rummet ${place} har en dörr i rundbilden som inte finns bland dörrarna: ${door}`);
    if (!isSpot(spot)) errors.push(`dörren från ${place} till ${door} har en plats i rundbilden som inte går att läsa`);
  }
  for (const door of room.doors as unknown[]) {
    const hasThingSpot = things.some((thing) => thing?.doorTo === door && thing.spot !== undefined);
    if (doorSpots[String(door)] === undefined && !hasThingSpot) errors.push(`dörren från ${place} till ${String(door)} saknar plats i rundbilden`);
  }
  for (const thing of things) {
    if (thing?.spot === undefined) errors.push(`saken ${String(thing?.id)} i ${place} saknar plats i rundbilden`);
  }
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
    errors.push(...findImageErrors(room));
  }
  return errors;
}
