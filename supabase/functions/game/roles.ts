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
function pickPlayers(role: Role, candidates: PlayerRecord[], history: readonly string[], lotSeed: string): PlayerRecord[] {
  const count = role.count === 'rest' ? candidates.length : role.count;
  if (!role.isProminent) return candidates.slice(0, count);
  return sortByLastTurn(candidates, history, lotSeed).slice(0, count);
}

/** FNV-1a:s startvärde och primtal för 32 bitar. */
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
/** Murmur3:s slutblandning, så att små skillnader i texten sprids över alla bitar. */
const MIX_SHIFT_LONG = 16;
const MIX_SHIFT_SHORT = 13;
const MIX_FIRST = 0x85ebca6b;
const MIX_SECOND = 0xc2b2ae35;

/** Ett tal ur en text (FNV-1a och Murmur3:s slutblandning), så att lotten blir densamma varje gång servern räknar. */
export function hashText(text: string): number {
  let hash = FNV_OFFSET;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  hash = Math.imul(hash ^ (hash >>> MIX_SHIFT_LONG), MIX_FIRST);
  hash = Math.imul(hash ^ (hash >>> MIX_SHIFT_SHORT), MIX_SECOND);
  return (hash ^ (hash >>> MIX_SHIFT_LONG)) >>> 0;
}

/**
 * Den som aldrig har haft en framträdande roll först, sedan den som hade en
 * för längst sedan. Lika fall lottas, så att det inte alltid blir den som
 * gick med först (Jonas 2026-11-18). Lotten räknas fram ur `lotSeed` och
 * spelarens id, så att funktionen är ren och ger samma svar varje gång.
 */
export function sortByLastTurn<Player extends { id: string }>(candidates: readonly Player[], history: readonly string[], lotSeed: string): Player[] {
  const lastTurn = (player: Player) => history.lastIndexOf(player.id);
  const lot = (player: Player) => hashText(`${lotSeed}:${player.id}`);
  return [...candidates].sort((first, second) => lastTurn(first) - lastTurn(second) || lot(first) - lot(second));
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

export function dealRoles({ roles, players, prominentHistory, lotSeed }: {
  roles: readonly Role[];
  players: readonly PlayerRecord[];
  prominentHistory: readonly string[];
  /** Det som rollerna och bitarna lottas med, olika för varje spel och steg. */
  lotSeed: string;
}): RoleDeal {
  // Alla roller och bitar lottas, i stället för att gå på ordningen spelarna gick med i (Jonas 2026-11-18).
  const lot = (player: PlayerRecord) => hashText(`${lotSeed}:${player.id}`);
  let remaining = [...players].sort((first, second) => lot(first) - lot(second));
  const chosen = new Map<Role, PlayerRecord[]>();
  // Framträdande roller väljs först, sedan de med bestämt antal och sist resten.
  const order = [...roles].sort((first, second) => rolePriority(first) - rolePriority(second));
  for (const role of order) {
    const picked = pickPlayers(role, remaining, prominentHistory, lotSeed);
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
