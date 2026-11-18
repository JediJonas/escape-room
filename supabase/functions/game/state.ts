/**
 * Spelets tillstånd och raderna i databasen, så som motorn ser dem. Motorn
 * äger formen på tillståndet, så en ny uppgiftstyp kräver ingen ändring i
 * databasen. Se docs/motorn.md.
 */

import { type GameClock, readGameClock } from './clock.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import type { RoleAssignment } from './roles.ts';
import { type CellarState, readCellarState } from './cellar.ts';
import { type FoundState, readFoundState } from './found.ts';
import { type PianoState, readPianoState } from './piano.ts';
import { type FlashbackState, readFlashbackState } from './flashback.ts';
import { type SeanceState, readSeanceState } from './seance.ts';

/** En mobil som kom efter start och väntar på spelledaren. */
export type PendingPlayer = { playerId: string; takesOverPlayerId: string | null };

export type GameState = {
  status: 'lobby' | 'running' | 'finished';
  /** Det steg i uppdraget som gruppen är på. */
  stepIndex: number;
  /** Var varje spelare är, efter spelarens id. */
  placeByPlayer: Record<string, PlaceId>;
  /** Rollerna i det aktuella steget, efter spelarens id. Delas ut när gruppen kommer till steget. */
  roleByPlayer: Record<string, RoleAssignment>;
  /** Vilka som har haft en framträdande roll, äldst först. */
  prominentHistory: string[];
  /** De som har tryckt Klar i det aktuella steget. Töms när gruppen går vidare. */
  readyPlayerIds: string[];
  /** Hur många fel svar gruppen har gett i uppgiften. Töms när gruppen går vidare. */
  wrongAnswers: number;
  /** Hur många av uppgiftens ledtrådar som gruppen har fått. Töms när gruppen går vidare. */
  hintsGiven: number;
  /** Hur många ledtrådar gruppen har fått vid byrån, för urklippen. Töms när gruppen går vidare. */
  readingHintsGiven: number;
  /** Om spelledaren har bett om facit i den aktuella uppgiften. */
  isSolutionShown: boolean;
  /** Om spelledaren spelar med. Annars får hon en ren administrationsvy. */
  leaderPlays: boolean;
  /** Mobiler som kom efter start och väntar på att spelledaren svarar. */
  pendingPlayers: PendingPlayer[];
  /** Nedräkningen. Saknas före start och i spel som startade innan den fanns. */
  clock: GameClock | null;
  /** Seansens läge medan gruppen är i en seans, annars null. */
  seance: SeanceState | null;
  /** Rummen och vilka som är lösta medan gruppen är i Rummen minns, annars null. */
  flashback: FlashbackState | null;
  /** Källarens läge medan gruppen är i källaren, annars null. */
  cellar: CellarState | null;
  /** Pianots läge medan gruppen spelar, annars null. */
  piano: PianoState | null;
  /**
   * Uppgifter som gruppen har klarat innan berättelsen kom dit, till exempel
   * melodin på pianot. Gruppen går förbi dem när den kommer dit (Jonas 2026-11-18).
   */
  solvedSteps: string[];
  /** Följder som senare steg och slut läser, till exempel att gruppen får färre namn. */
  marks: string[];
  /** Det gruppen har hittat och kan läsa igen, med vem som hade vilka bitar. */
  found: FoundState;
  /** Sakerna i huset som gruppen har hittat. De står sedan i rummets lista för alla. */
  foundThings: string[];
  /**
   * Vilka som har läst det som går att läsa igen, efter stegets id. Den som
   * har lämnat urklippen med Tillbaka har läst dem (Jonas 2026-11-18).
   */
  foundReaders: Record<string, string[]>;
};

export type GameRecord = {
  id: string;
  joinCode: string;
  missionId: string;
  state: GameState;
};

export type PlayerRecord = {
  id: string;
  gameId: string;
  userId: string;
  name: string;
  isLeader: boolean;
  joinedAtMs: number;
};

export function createInitialState(): GameState {
  return { status: 'lobby', stepIndex: 0, placeByPlayer: {}, roleByPlayer: {}, prominentHistory: [], readyPlayerIds: [], wrongAnswers: 0, hintsGiven: 0, readingHintsGiven: 0, isSolutionShown: false, leaderPlays: true, pendingPlayers: [], clock: null, seance: null, flashback: null, cellar: null, piano: null, solvedSteps: [], marks: [], found: {}, foundThings: [], foundReaders: {} };
}

/**
 * Läser ett sparat tillstånd. Spel som skapades innan ett fält fanns får
 * fältets startvärde, så att gamla rader inte ger fel.
 */
export function readGameState(saved: unknown): GameState {
  const initial = createInitialState();
  if (!saved || typeof saved !== 'object') return initial;
  const fields = saved as Partial<Record<keyof GameState, unknown>>;
  const status = fields.status === 'running' || fields.status === 'finished' ? fields.status : 'lobby';
  const placeByPlayer: Record<string, PlaceId> = {};
  if (fields.placeByPlayer && typeof fields.placeByPlayer === 'object') {
    for (const [playerId, placeId] of Object.entries(fields.placeByPlayer)) {
      if (isPlaceId(placeId)) placeByPlayer[playerId] = placeId;
    }
  }
  return {
    status,
    roleByPlayer: readRoleByPlayer(fields.roleByPlayer),
    prominentHistory: readStringList(fields.prominentHistory),
    stepIndex: Number.isInteger(fields.stepIndex) ? fields.stepIndex as number : initial.stepIndex,
    placeByPlayer,
    readyPlayerIds: readStringList(fields.readyPlayerIds),
    wrongAnswers: Number.isInteger(fields.wrongAnswers) && (fields.wrongAnswers as number) >= 0 ? fields.wrongAnswers as number : initial.wrongAnswers,
    hintsGiven: Number.isInteger(fields.hintsGiven) && (fields.hintsGiven as number) >= 0 ? fields.hintsGiven as number : initial.hintsGiven,
    readingHintsGiven: Number.isInteger(fields.readingHintsGiven) && (fields.readingHintsGiven as number) >= 0 ? fields.readingHintsGiven as number : initial.readingHintsGiven,
    isSolutionShown: fields.isSolutionShown === true,
    leaderPlays: fields.leaderPlays !== false,
    pendingPlayers: readPendingPlayers(fields.pendingPlayers),
    clock: readGameClock(fields.clock),
    seance: readSeanceState(fields.seance),
    flashback: readFlashbackState(fields.flashback),
    cellar: readCellarState(fields.cellar),
    piano: readPianoState(fields.piano),
    solvedSteps: readStringList(fields.solvedSteps),
    marks: readStringList(fields.marks),
    found: readFoundState(fields.found, readRoleByPlayer),
    foundThings: readStringList(fields.foundThings),
    foundReaders: readStringListsByKey(fields.foundReaders),
  };
}

function readPendingPlayers(saved: unknown): PendingPlayer[] {
  if (!Array.isArray(saved)) return [];
  return saved.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const { playerId, takesOverPlayerId } = item as Record<string, unknown>;
    if (typeof playerId !== 'string' || (takesOverPlayerId !== null && typeof takesOverPlayerId !== 'string')) return [];
    return [{ playerId, takesOverPlayerId }];
  });
}

function readStringListsByKey(saved: unknown): Record<string, string[]> {
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return {};
  return Object.fromEntries(Object.entries(saved).map(([key, list]) => [key, readStringList(list)]));
}

function readStringList(saved: unknown): string[] {
  return Array.isArray(saved) ? saved.filter((item): item is string => typeof item === 'string') : [];
}

function isRoleAssignment(value: unknown): value is RoleAssignment {
  if (!value || typeof value !== 'object') return false;
  const assignment = value as Record<string, unknown>;
  return typeof assignment.roleId === 'string' && Array.isArray(assignment.pieceIndexes) && assignment.pieceIndexes.every(Number.isInteger);
}

function readRoleByPlayer(saved: unknown): Record<string, RoleAssignment> {
  const roleByPlayer: Record<string, RoleAssignment> = {};
  if (!saved || typeof saved !== 'object') return roleByPlayer;
  for (const [playerId, assignment] of Object.entries(saved)) {
    if (isRoleAssignment(assignment)) roleByPlayer[playerId] = assignment;
  }
  return roleByPlayer;
}
