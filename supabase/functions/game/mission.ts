/**
 * Uppdragsfilens form och kontrollen av den. Ett uppdrag är data: motorn
 * tolkar filen, så att ett nytt uppdrag inte kräver ny kod. Se
 * docs/motorn.md. Fälten som bara vissa uppgiftstyper har läggs till när
 * typen byggs.
 */

import { MAX_PLAYERS } from './lobby.ts';
import { type PlaceId, isPlaceId } from './places.ts';

export const MISSION_FORMAT = 1;

/** Berättelsen mellan uppgifterna. Kan skicka spelarna till en plats. */
export type SceneStep = {
  id: string;
  type: 'scene';
  text: string;
  /** Platsen som spelarna ska gå till i scenen. */
  goTo?: PlaceId;
  /** Det som bara den som har kommit fram till platsen ser. */
  textAtPlace?: string;
};

export type MissionStep = SceneStep;

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

function findStepErrors(step: Record<string, unknown>, places: Record<string, unknown>): string[] {
  const errors: string[] = [];
  if (!isFilledText(step.id)) errors.push('ett steg saknar id');
  const name = `steget ${String(step.id)}`;
  if (step.type !== 'scene') errors.push(`${name} har en okänd typ: ${String(step.type)}`);
  if (!isFilledText(step.text)) errors.push(`${name} saknar text`);
  if (step.goTo !== undefined && !(isPlaceId(step.goTo) && step.goTo in places)) errors.push(`${name} går till en plats som uppdraget saknar: ${String(step.goTo)}`);
  if (step.textAtPlace !== undefined && (!isFilledText(step.textAtPlace) || step.goTo === undefined)) errors.push(`${name} har text på platsen utan plats att gå till`);
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
    errors.push(...findStepErrors(stepFields, places ?? {}));
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
