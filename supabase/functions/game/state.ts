/**
 * Spelets tillstånd och raderna i databasen, så som motorn ser dem. Motorn
 * äger formen på tillståndet, så en ny uppgiftstyp kräver ingen ändring i
 * databasen. Se docs/motorn.md.
 */

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
  return { status: 'lobby', usesPlaceCards: true, stepIndex: 0, placeByPlayer: {}, roleByPlayer: {}, prominentHistory: [] };
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
    prominentHistory: Array.isArray(fields.prominentHistory) ? fields.prominentHistory.filter((id): id is string => typeof id === 'string') : [],
    usesPlaceCards: typeof fields.usesPlaceCards === 'boolean' ? fields.usesPlaceCards : initial.usesPlaceCards,
    stepIndex: Number.isInteger(fields.stepIndex) ? fields.stepIndex as number : initial.stepIndex,
    placeByPlayer,
  };
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
