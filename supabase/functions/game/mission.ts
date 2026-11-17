/**
 * Uppdragsfilens form och kontrollen av den. Ett uppdrag är data: motorn
 * tolkar filen, så att ett nytt uppdrag inte kräver ny kod. Se
 * docs/motorn.md. Fälten som bara vissa uppgiftstyper har läggs till när
 * typen byggs.
 */

import { MAX_PLAYERS } from './lobby.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import { findCellarErrors } from './cellar.ts';
import { describeRoomsSolution, findRoomsErrors } from './rooms.ts';
import { SEANCE_LETTERS } from './seance.ts';

export const MISSION_FORMAT = 1;

/**
 * En roll säger vem spelaren är i steget. Antalet är ett tal eller "rest"
 * för alla övriga. Bitarna fördelas över dem som delar rollen, så att ingen
 * får samma skärm som en annan. Se docs/koncept.md, Tre till tio spelare.
 */
export type Role = {
  id: string;
  /** Visas överst hos spelaren, till exempel "Du är siaren". */
  title: string;
  count: number | 'rest';
  /** En framträdande roll går i första hand till någon som inte har haft en. */
  isProminent?: boolean;
  /**
   * Platsen som rollen ska gå till, om den inte är densamma för alla. Då
   * syns bitarna först när spelaren är framme, så att gruppen kan dela på sig
   * i samma steg och var och en bara ser det som finns där den står.
   */
  goTo?: PlaceId;
  /** Viktigast först. Med få spelare och en gräns per spelare blir de sista över. */
  pieces: string[];
  /**
   * Högst så här många bitar per spelare, så att skärmen bara får några rader
   * även när få delar rollen. Utan gräns får rollen alla bitar.
   */
  maxPiecesPerPlayer?: number;
};

/** Ett dokument som alla ser, till exempel en tidningsartikel eller en gästbok. */
export type MissionDocument = { title: string; text: string };

/** Berättelsen mellan uppgifterna. Kan skicka spelarna till en plats. */
export type SceneStep = {
  /* Fälten som bara uppgifter har saknas, så att alla steg kan läsas på samma sätt. */
  hints?: undefined;
  solution?: undefined;
  id: string;
  type: 'scene';
  text: string;
  /** Platsen som spelarna ska gå till i scenen. */
  goTo?: PlaceId;
  /** Det som bara den som har kommit fram till platsen ser. */
  textAtPlace?: string;
  /** Utan roller ser alla samma sak. */
  roles?: Role[];
  /**
   * Tillstånden som mobilen ber om när spelaren trycker Klar, så att ingen
   * systemruta dyker upp mitt i en senare uppgift. Se docs/koncept.md,
   * Mobilens funktioner.
   */
  asksFor?: Permission[];
  /** Det som alla ser i steget, under texten. */
  documents?: MissionDocument[];
  /**
   * Namnet i listan Hittat. Med ett namn sparas stegets dokument och
   * spelarens egna bitar, så att de går att läsa igen senare. Se
   * docs/koncept.md, Rundbilder och Hittat.
   */
  foundTitle?: string;
};

/** Det som en mobil måste be om tillstånd för, eller låsa upp med ett tryck. */
export const PERMISSIONS = ['sound', 'motion'] as const;
export type Permission = (typeof PERMISSIONS)[number];

/** Antal ledtrådar per uppgift, i stigande tydlighet. Se docs/koncept.md. */
export const HINT_COUNT = 3;

/**
 * En uppgift där gruppen skriver in ett svar. Den enklaste uppgiftstypen,
 * byggd för att prova ledtrådar, att hoppa över och facit (steg 4).
 */
export type AnswerStep = {
  id: string;
  type: 'answer';
  /** Frågan, som alla ser. */
  text: string;
  goTo?: undefined;
  textAtPlace?: undefined;
  roles?: Role[];
  hints: string[];
  /** Lämnar aldrig servern, utom till spelledaren som ber om facit. */
  solution: { answers: string[] };
};

/**
 * Seansen: alla följer skenet över brädet, och bokstäverna i meddelandet
 * syns på en mobil i taget. Se seance.ts.
 */
export type SeanceStep = {
  id: string;
  type: 'seance';
  /** Det alla ser ovanför brädet. */
  text: string;
  goTo?: undefined;
  textAtPlace?: undefined;
  roles?: undefined;
  hints: string[];
  /** Meddelandet, med versaler och mellanslag mellan orden. Lämnar aldrig servern i sin helhet. */
  solution: { message: string };
};

/** Ett rum i Rummen minns: platsen och bitarna, viktigast först. */
export type Room = { place: PlaceId; pieces: string[] };

/**
 * Splittrade rum: spelarna går till var sitt rum och väljer vem som stod
 * där. Se rooms.ts.
 */
export type RoomsStep = {
  id: string;
  type: 'rooms';
  /** Det alla ser, före och i rummen. */
  text: string;
  goTo?: undefined;
  textAtPlace?: undefined;
  roles?: undefined;
  /** Alla som kan ha stått i ett rum, i den ordning de visas. */
  guests: string[];
  rooms: Room[];
  hints: string[];
  /** Vem som stod i vilket rum. Lämnar aldrig servern. */
  solution: { guestByPlace: Partial<Record<PlaceId, string>> };
};

/**
 * Källaren: en spelare är instängd i en mörk rundbild och de andra lotsar
 * henne till en dold dörr. Se cellar.ts.
 */
export type CellarStep = {
  id: string;
  type: 'cellar';
  /** Det alla ser. */
  text: string;
  goTo?: undefined;
  textAtPlace?: undefined;
  /** Den instängda rollen har en plats. De andra har bitar av beskrivningen av rummet. */
  roles: Role[];
  trappedRoleId: string;
  /** Rundbilden, med sökväg från webbsidans rot. */
  image: string;
  /** Hur länge det tar innan det når henne, räknat från när hon kommer fram. */
  minutes: number;
  /** Hur många gånger de andra kan tända lampan, och hur länge den lyser. */
  fuses: number;
  lightMs: number;
  /** Hur mycket närmare det kommer av ett tryck på fel ställe. */
  wrongTapMs: number;
  /** Det den instängda ser i rummet bakom. {name} blir hennes namn. */
  foundText: string;
  /** Det de andra ser när hon har hittat dörren. */
  othersFoundText: string;
  /** Det alla ser om det hann fram. */
  caughtText: string;
  /** Markeringen som senare steg och slut läser om det hann fram. */
  markWhenCaught: string;
  hints: string[];
  /** Dörrens riktning i bilden, där 0 är bildens mitt och vinkeln växer åt höger. */
  solution: { doorYawDeg: number; toleranceDeg: number };
};

/** Uppgifter är de steg som gruppen löser, med ledtrådar och facit. */
export type TaskStep = AnswerStep | SeanceStep | RoomsStep | CellarStep;

export type MissionStep = SceneStep | TaskStep;

/** Facit som text, det som spelledaren ser när hon ber om det. */
export function describeSolution(step: TaskStep, places: readonly Place[]): string {
  if (step.type === 'answer') return step.solution.answers[0];
  if (step.type === 'seance') return step.solution.message;
  if (step.type === 'cellar') return `Dörren åt ${step.solution.doorYawDeg} grader i bilden`;
  return describeRoomsSolution(step, places);
}

/** Alla texter i facit. Läckkontrollen letar efter dem i vyerna. */
export function listSolutionTexts(step: MissionStep, places: readonly Place[]): string[] {
  if (step.type === 'answer') return step.solution.answers;
  if (step.type === 'scene') return [];
  return [describeSolution(step, places)];
}

export type Mission = {
  format: typeof MISSION_FORMAT;
  id: string;
  title: string;
  /** Konceptet säger tre, men ett provuppdrag får ange färre (Jonas 2026-11-17). */
  minPlayers: number;
  places: Partial<Record<PlaceId, string>>;
  steps: MissionStep[];
};

function isFilledText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Kontrollerar rollerna i ett steg. Varje roll måste ha minst en bit per
 * spelare den kan få, även med tio spelare, så att två aldrig ser samma sak.
 */
function findRoleErrors(roles: unknown, stepName: string, minPlayers: number, places: Record<string, unknown>): string[] {
  if (!Array.isArray(roles) || roles.length === 0) return [`${stepName} har roller som inte är en lista`];
  const errors: string[] = [];
  const fixedCount = roles.reduce((sum: number, role) => sum + (Number.isInteger(role?.count) ? role.count : 0), 0);
  if (fixedCount > minPlayers) errors.push(`${stepName} kräver ${fixedCount} spelare men uppdraget tillåter ${minPlayers}`);
  if (roles.filter((role) => role?.count === 'rest').length > 1) errors.push(`${stepName} har mer än en roll med resten`);
  const roleIds = new Set<unknown>();
  for (const role of roles) {
    const name = `rollen ${String(role?.id)} i ${stepName}`;
    if (!isFilledText(role?.id) || roleIds.has(role.id)) errors.push(`${stepName} har en roll utan id eller med samma id som en annan`);
    roleIds.add(role?.id);
    if (!isFilledText(role?.title)) errors.push(`${name} saknar titel`);
    if (role?.goTo !== undefined && !(isPlaceId(role.goTo) && role.goTo in places)) errors.push(`${name} går till en plats som uppdraget saknar: ${String(role.goTo)}`);
    const isRest = role?.count === 'rest';
    if (!isRest && !(Number.isInteger(role?.count) && role.count > 0)) errors.push(`${name} har ett ogiltigt antal`);
    if (!Array.isArray(role?.pieces) || !role.pieces.every(isFilledText)) {
      errors.push(`${name} saknar bitar`);
      continue;
    }
    if (role.maxPiecesPerPlayer !== undefined && !(Number.isInteger(role.maxPiecesPerPlayer) && role.maxPiecesPerPlayer > 0)) errors.push(`${name} har en ogiltig gräns för bitar`);
    const mostPlayers = isRest ? MAX_PLAYERS - fixedCount : role.count;
    if (role.pieces.length < mostPlayers) errors.push(`${name} har ${role.pieces.length} bitar men kan få ${mostPlayers} spelare`);
  }
  return errors;
}

function findDocumentErrors(step: Record<string, unknown>, name: string): string[] {
  const errors: string[] = [];
  const { documents, foundTitle } = step;
  if ((documents !== undefined || foundTitle !== undefined) && step.type !== 'scene') errors.push(`${name} har dokument eller Hittat men är ingen scen`);
  const isDocument = (item: unknown) => !!item && typeof item === 'object' && isFilledText((item as MissionDocument).title) && isFilledText((item as MissionDocument).text);
  if (documents !== undefined && !(Array.isArray(documents) && documents.length > 0 && documents.every(isDocument))) errors.push(`${name} har dokument utan rubrik eller text`);
  if (foundTitle !== undefined && !isFilledText(foundTitle)) errors.push(`${name} har ett tomt namn i Hittat`);
  return errors;
}

function findHintErrors(step: Record<string, unknown>, name: string): string[] {
  const hasHints = Array.isArray(step.hints) && step.hints.length === HINT_COUNT && step.hints.every(isFilledText);
  return hasHints ? [] : [`${name} ska ha ${HINT_COUNT} ledtrådar`];
}

function findSeanceErrors(step: Record<string, unknown>, name: string): string[] {
  const errors = findHintErrors(step, name);
  const message = (step.solution as { message?: unknown } | undefined)?.message;
  if (typeof message !== 'string' || !SEANCE_LETTERS.test(message)) errors.push(`${name} ska ha ett meddelande med versaler A till Ö och ett mellanslag mellan orden`);
  if (step.goTo !== undefined || step.textAtPlace !== undefined || step.roles !== undefined) errors.push(`${name} är en seans och kan inte ha plats eller roller`);
  return errors;
}

function findAnswerErrors(step: Record<string, unknown>, name: string): string[] {
  const errors = findHintErrors(step, name);
  const answers = (step.solution as { answers?: unknown } | undefined)?.answers;
  if (!Array.isArray(answers) || answers.length === 0 || !answers.every(isFilledText)) errors.push(`${name} saknar svar i facit`);
  if (step.goTo !== undefined || step.textAtPlace !== undefined) errors.push(`${name} är en uppgift och kan inte skicka till en plats än`);
  return errors;
}

function findStepErrors(step: Record<string, unknown>, places: Record<string, unknown>, minPlayers: number): string[] {
  const errors: string[] = [];
  if (!isFilledText(step.id)) errors.push('ett steg saknar id');
  const name = `steget ${String(step.id)}`;
  if (step.type === 'cellar') errors.push(...findHintErrors(step, name), ...findCellarErrors(step, name));
  if (!['scene', 'answer', 'seance', 'rooms', 'cellar'].includes(String(step.type))) errors.push(`${name} har en okänd typ: ${String(step.type)}`);
  if (step.type === 'answer') errors.push(...findAnswerErrors(step, name));
  if (step.type === 'seance') errors.push(...findSeanceErrors(step, name));
  if (step.type === 'rooms') errors.push(...findHintErrors(step, name), ...findRoomsErrors(step, name, places));
  if (step.type === 'rooms' && (step.goTo !== undefined || step.textAtPlace !== undefined || step.roles !== undefined)) errors.push(`${name} har egna rum och kan inte ha plats eller roller`);
  if (step.type === 'scene' && (step.hints !== undefined || step.solution !== undefined)) errors.push(`${name} är en scen men har ledtrådar eller facit`);
  if (step.asksFor !== undefined && !(step.type === 'scene' && Array.isArray(step.asksFor) && step.asksFor.every((item) => (PERMISSIONS as readonly unknown[]).includes(item)))) errors.push(`${name} ber om tillstånd som inte finns, eller är ingen scen`);
  if (!isFilledText(step.text)) errors.push(`${name} saknar text`);
  errors.push(...findDocumentErrors(step, name));
  if (step.goTo !== undefined && !(isPlaceId(step.goTo) && step.goTo in places)) errors.push(`${name} går till en plats som uppdraget saknar: ${String(step.goTo)}`);
  if (step.textAtPlace !== undefined && (!isFilledText(step.textAtPlace) || step.goTo === undefined)) errors.push(`${name} har text på platsen utan plats att gå till`);
  if (step.roles !== undefined && step.type !== 'seance' && step.type !== 'rooms') errors.push(...findRoleErrors(step.roles, name, minPlayers, places));
  return errors;
}

/** Ger en lista över felen i en uppdragsfil, tom om filen är rätt. */
export function findMissionErrors(data: unknown): string[] {
  if (!data || typeof data !== 'object') return ['uppdraget är inte ett objekt'];
  const mission = data as Record<string, unknown>;
  const errors: string[] = [];
  if (mission.format !== MISSION_FORMAT) errors.push(`formatet ska vara ${MISSION_FORMAT}`);
  if (!isFilledText(mission.id)) errors.push('id saknas');
  if (!isFilledText(mission.title)) errors.push('titel saknas');
  const minPlayers = mission.minPlayers;
  if (!Number.isInteger(minPlayers) || (minPlayers as number) < 1 || (minPlayers as number) > MAX_PLAYERS) errors.push(`minPlayers ska vara ett heltal från 1 till ${MAX_PLAYERS}`);
  const places = mission.places && typeof mission.places === 'object' ? mission.places as Record<string, unknown> : null;
  if (!places) errors.push('platser saknas');
  for (const [placeId, placeName] of Object.entries(places ?? {})) {
    if (!isPlaceId(placeId)) errors.push(`okänd plats: ${placeId}`);
    if (!isFilledText(placeName)) errors.push(`platsen ${placeId} saknar namn`);
  }
  if (!Array.isArray(mission.steps) || mission.steps.length === 0) return [...errors, 'steg saknas'];
  const stepIds = new Set<unknown>();
  for (const step of mission.steps) {
    if (!step || typeof step !== 'object') {
      errors.push('ett steg är inte ett objekt');
      continue;
    }
    const stepFields = step as Record<string, unknown>;
    if (stepIds.has(stepFields.id)) errors.push(`steget ${String(stepFields.id)} finns två gånger`);
    stepIds.add(stepFields.id);
    errors.push(...findStepErrors(stepFields, places ?? {}, Number.isInteger(minPlayers) ? minPlayers as number : 0));
  }
  return errors;
}

export type Place = { id: PlaceId; name: string };

/** Uppdragets platser i ordningen A till F. */
export function listPlaces(mission: Mission): Place[] {
  return Object.entries(mission.places)
    .filter((entry): entry is [PlaceId, string] => isPlaceId(entry[0]) && typeof entry[1] === 'string')
    .map(([id, name]) => ({ id, name }))
    .sort((first, second) => first.id.localeCompare(second.id));
}
