/**
 * Det som går att läsa igen från saken där det hittades, till exempel
 * Tidningsurklippen i byrån. Listan Hittat är borttagen, men namnet finns
 * kvar i koden (Jonas 2026-11-18). När gruppen lämnar ett steg med
 * `foundTitle` sparas vem som hade vilka bitar, så att var och en senare bara
 * ser sina egna. Se docs/koncept.md, Inget snabbval än.
 *
 * Den som lämnar urklippen med Tillbaka har läst dem, och berättelsen väntar
 * på att alla har läst innan brädet frågar VEM ÄR JAG (Jonas 2026-11-18).
 */

import type { Mission, MissionDocument, MissionStep } from './mission.ts';
import type { RoleAssignment } from './roles.ts';
import type { GameState } from './state.ts';

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

/** Om spelaren har läst det som steget gav att läsa igen. */
export function hasRead(foundReaders: Record<string, string[]>, stepId: string, playerId: string): boolean {
  return (foundReaders[stepId] ?? []).includes(playerId);
}

/** Stegen med något att läsa igen som saken öppnar, som urklippen i byrån. */
export function findReadSteps(mission: Mission, thingId: unknown): string[] {
  const thing = mission.house?.rooms.flatMap((room) => room.things).find((candidate) => candidate.id === thingId);
  return (thing?.opensSteps ?? []).filter((stepId) => {
    const step = mission.steps.find((candidate) => candidate.id === stepId);
    return step?.type === 'scene' && step.foundTitle !== undefined;
  });
}

/** Byråns första ledtråd när någon inte har läst, som "Alla har inte läst tidningsurklippen." (Jonas 2026-11-18). */
function describeUnreadHint(foundTitle: string): string {
  return `Alla har inte läst ${foundTitle.toLocaleLowerCase('sv')}.`;
}

/** Om byråns nästa ledtråd ska säga att alla inte har läst: den kommer först, och bara så länge någon inte har läst. */
export function givesUnreadHint(step: MissionStep, state: GameState, participantIds: readonly string[]): boolean {
  if (step.type !== 'scene' || state.isUnreadHintGiven || state.readingHintsGiven > 0) return false;
  return participantIds.some((playerId) => !hasRead(state.foundReaders, step.id, playerId));
}

/** Ledtrådarna om urklippen som gruppen har fått vid byrån, och hur många det finns. */
export function describeReadingHints(step: MissionStep, state: GameState, participantIds: readonly string[]): { readingHints: string[]; readingHintCount: number } {
  const written = step.type === 'scene' ? step.readingHints ?? [] : [];
  if (step.type !== 'scene' || written.length === 0 || step.foundTitle === undefined) return { readingHints: [], readingHintCount: 0 };
  const unread = state.isUnreadHintGiven ? [describeUnreadHint(step.foundTitle)] : [];
  const extra = state.isUnreadHintGiven || givesUnreadHint(step, state, participantIds) ? 1 : 0;
  return { readingHints: [...unread, ...written.slice(0, state.readingHintsGiven)], readingHintCount: written.length + extra };
}
