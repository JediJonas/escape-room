/**
 * Uppdragsfilens form och kontrollen av den. Ett uppdrag är data: motorn
 * tolkar filen, så att ett nytt uppdrag inte kräver ny kod. Se
 * docs/motorn.md. Fälten som bara vissa uppgiftstyper har läggs till när
 * typen byggs.
 */

import { MAX_PLAYERS } from './lobby.ts';
import { type PlaceId, isPlaceId } from './places.ts';

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
};

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

export type MissionStep = SceneStep | AnswerStep;

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

function findAnswerErrors(step: Record<string, unknown>, name: string): string[] {
  const errors: string[] = [];
  if (!Array.isArray(step.hints) || step.hints.length !== HINT_COUNT || !step.hints.every(isFilledText)) errors.push(`${name} ska ha ${HINT_COUNT} ledtrådar`);
  const answers = (step.solution as { answers?: unknown } | undefined)?.answers;
  if (!Array.isArray(answers) || answers.length === 0 || !answers.every(isFilledText)) errors.push(`${name} saknar svar i facit`);
  if (step.goTo !== undefined || step.textAtPlace !== undefined) errors.push(`${name} är en uppgift och kan inte skicka till en plats än`);
  return errors;
}

function findStepErrors(step: Record<string, unknown>, places: Record<string, unknown>, minPlayers: number): string[] {
  const errors: string[] = [];
  if (!isFilledText(step.id)) errors.push('ett steg saknar id');
  const name = `steget ${String(step.id)}`;
  if (step.type !== 'scene' && step.type !== 'answer') errors.push(`${name} har en okänd typ: ${String(step.type)}`);
  if (step.type === 'answer') errors.push(...findAnswerErrors(step, name));
  if (step.type === 'scene' && (step.hints !== undefined || step.solution !== undefined)) errors.push(`${name} är en scen men har ledtrådar eller facit`);
  if (!isFilledText(step.text)) errors.push(`${name} saknar text`);
  if (step.goTo !== undefined && !(isPlaceId(step.goTo) && step.goTo in places)) errors.push(`${name} går till en plats som uppdraget saknar: ${String(step.goTo)}`);
  if (step.textAtPlace !== undefined && (!isFilledText(step.textAtPlace) || step.goTo === undefined)) errors.push(`${name} har text på platsen utan plats att gå till`);
  if (step.roles !== undefined) errors.push(...findRoleErrors(step.roles, name, minPlayers, places));
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
