/**
 * Det som går att läsa igen från saken där det hittades, till exempel
 * Tidningsurklippen i byrån. Listan Hittat är borttagen, men namnet finns
 * kvar i koden (Jonas 2026-11-18). När gruppen lämnar ett steg med
 * `foundTitle` sparas vem som hade vilka bitar, så att var och en senare bara
 * ser sina egna. Se docs/koncept.md, Inget snabbval än.
 */

import type { Mission, MissionDocument, MissionStep } from './mission.ts';
import type { RoleAssignment } from './roles.ts';

/** Rollerna i de steg som har sparats, efter stegets id och sedan spelarens id. */
export type FoundState = Record<string, Record<string, RoleAssignment>>;

/** Sparar stegets roller när gruppen lämnar det, om steget har `foundTitle`. */
export function keepFound(found: FoundState, step: MissionStep, roleByPlayer: Record<string, RoleAssignment>): FoundState {
  if (step.type !== 'scene' || step.foundTitle === undefined) return found;
  return { ...found, [step.id]: roleByPlayer };
}

/** Det en spelare ser när hon läser igen: dokumenten som alla ser och hennes egna bitar. */
export type FoundItem = { title: string; documents: MissionDocument[]; pieces: string[] };

export function describeFound(mission: Mission, found: FoundState, viewerId: string): FoundItem[] {
  return mission.steps.flatMap((step) => {
    const kept = found[step.id];
    if (step.type !== 'scene' || step.foundTitle === undefined || !kept) return [];
    const assignment = kept[viewerId];
    const role = step.roles?.find((candidate) => candidate.id === assignment?.roleId);
    const pieces = role && assignment ? assignment.pieceIndexes.map((index) => role.pieces[index]).filter((piece) => piece !== undefined) : [];
    return [{ title: step.foundTitle, documents: step.documents ?? [], pieces }];
  });
}

/** Läser sparade fynd. Trasiga delar hoppas över. */
export function readFoundState(saved: unknown, readRoles: (saved: unknown) => Record<string, RoleAssignment>): FoundState {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  const found: FoundState = {};
  for (const [stepId, roles] of Object.entries(saved)) found[stepId] = readRoles(roles);
  return found;
}
