/**
 * Spelets tillstånd och raderna i databasen, så som motorn ser dem. Motorn
 * äger formen på tillståndet, så en ny uppgiftstyp kräver ingen ändring i
 * databasen. Se docs/motorn.md.
 */

import { type GameClock, readGameClock } from './clock.ts';
import { type PlaceId, isPlaceId } from './places.ts';
import type { RoleAssignment } from './roles.ts';

/** Om spelaren skannade kortet eller valde i listan. Sparas för felsökningens skull. */
export type PlaceSource = 'scan' | 'list';

export type GameState = {
  status: 'lobby' | 'running' | 'finished';
  /** Spelledaren kan välja bort platskorten när spelet startar. Då väljer alla i listan. */
  usesPlaceCards: boolean;
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
  /** Hur många av uppgiftens ledtrådar som gruppen har fått. Töms när gruppen går vidare. */
  hintsGiven: number;
  /** Om spelledaren har bett om facit i den aktuella uppgiften. */
  isSolutionShown: boolean;
  /** Nedräkningen. Saknas före start och i spel som startade innan den fanns. */
  clock: GameClock | null;
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
  return { status: 'lobby', usesPlaceCards: true, stepIndex: 0, placeByPlayer: {}, roleByPlayer: {}, prominentHistory: [], readyPlayerIds: [], hintsGiven: 0, isSolutionShown: false, clock: null };
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
    usesPlaceCards: typeof fields.usesPlaceCards === 'boolean' ? fields.usesPlaceCards : initial.usesPlaceCards,
    stepIndex: Number.isInteger(fields.stepIndex) ? fields.stepIndex as number : initial.stepIndex,
    placeByPlayer,
    readyPlayerIds: readStringList(fields.readyPlayerIds),
    hintsGiven: Number.isInteger(fields.hintsGiven) && (fields.hintsGiven as number) >= 0 ? fields.hintsGiven as number : initial.hintsGiven,
    isSolutionShown: fields.isSolutionShown === true,
    clock: readGameClock(fields.clock),
  };
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
