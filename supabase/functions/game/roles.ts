/**
 * Delar ut rollerna och deras bitar när gruppen kommer till ett steg. Rena
 * funktioner, se docs/motorn.md och docs/koncept.md, Tre till tio spelare.
 */

import type { Role } from './mission.ts';
import type { PlayerRecord } from './state.ts';

/** Vilken roll spelaren har i steget och vilka av rollens bitar hon ser. */
export type RoleAssignment = { roleId: string; pieceIndexes: number[] };

export type RoleDeal = {
  roleByPlayer: Record<string, RoleAssignment>;
  /** Vilka som har haft en framträdande roll, äldst först, så att rollerna roterar. */
  prominentHistory: string[];
};

/**
 * Väljer spelare till en roll. En framträdande roll går först till den som
 * aldrig har haft en, sedan till den som hade en för längst sedan.
 */
function pickPlayers(role: Role, candidates: PlayerRecord[], history: readonly string[]): PlayerRecord[] {
  const count = role.count === 'rest' ? candidates.length : role.count;
  if (!role.isProminent) return candidates.slice(0, count);
  const lastTurn = (player: PlayerRecord) => history.lastIndexOf(player.id);
  // Sorteringen är stabil, så lika fall behåller den ordning de gick med i.
  return [...candidates].sort((first, second) => lastTurn(first) - lastTurn(second)).slice(0, count);
}

/**
 * Bit i går till spelare i modulo antalet, så att ingen får samma som en
 * annan. Utan gräns finns alla bitar hos någon. Med gräns blir de sista över.
 */
function dealPieces(role: Role, playerCount: number, playerIndex: number): number[] {
  const indexes: number[] = [];
  for (let pieceIndex = playerIndex; pieceIndex < role.pieces.length; pieceIndex += playerCount) indexes.push(pieceIndex);
  return indexes.slice(0, role.maxPiecesPerPlayer ?? indexes.length);
}

export function dealRoles({ roles, players, prominentHistory }: {
  roles: readonly Role[];
  /** I den ordning de gick med, så att utdelningen blir densamma varje gång. */
  players: readonly PlayerRecord[];
  prominentHistory: readonly string[];
}): RoleDeal {
  let remaining = [...players];
  const chosen = new Map<Role, PlayerRecord[]>();
  // Framträdande roller väljs först, sedan de med bestämt antal och sist resten.
  const order = [...roles].sort((first, second) => rolePriority(first) - rolePriority(second));
  for (const role of order) {
    const picked = pickPlayers(role, remaining, prominentHistory);
    chosen.set(role, picked);
    remaining = remaining.filter((player) => !picked.includes(player));
  }

  const roleByPlayer: Record<string, RoleAssignment> = {};
  const newProminent: string[] = [];
  for (const [role, rolePlayers] of chosen) {
    rolePlayers.forEach((player, index) => {
      roleByPlayer[player.id] = { roleId: role.id, pieceIndexes: dealPieces(role, rolePlayers.length, index) };
      if (role.isProminent) newProminent.push(player.id);
    });
  }
  return { roleByPlayer, prominentHistory: [...prominentHistory, ...newProminent] };
}

function rolePriority(role: Role): number {
  if (role.isProminent && role.count !== 'rest') return 0;
  return role.count === 'rest' ? 2 : 1;
}
