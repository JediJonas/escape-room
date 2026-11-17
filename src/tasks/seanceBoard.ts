/**
 * Brädet i seansen så som mobilen ritar det: var skenet står vid en viss
 * tid, och när spelarens planchett räknas som på skenet. Rena funktioner
 * utan DOM och klocka. Servern avgör när en bokstav är tagen, se
 * supabase/functions/game/seance.ts.
 */

import { BOARD_COLUMNS, BOARD_ROWS, GLOW_GLIDE_MS, type SeanceView } from '../../supabase/functions/game/seance.ts';

/** En punkt på brädet, från 0 till 1 åt båda håll. */
export type BoardPoint = { x: number; y: number };

/**
 * Planchetten räknas som på skenet när den är närmare än en halv ruta, och
 * som av först när den är längre bort än så här. Skillnaden gör att en
 * planchett i kanten inte skickar på och av till servern hela tiden.
 */
const ON_GLOW_CELLS = 0.5;
const OFF_GLOW_CELLS = 0.8;

/** Hur länge ett lyft finger får vara borta innan kontakten bryts, så att ett finger som glider inte förstör allt. */
export const LIFT_GRACE_MS = 500;

const HALF = 0.5;

export function findCellCenter(cell: number): BoardPoint {
  const column = cell % BOARD_COLUMNS;
  const row = Math.floor(cell / BOARD_COLUMNS);
  return { x: (column + HALF) / BOARD_COLUMNS, y: (row + HALF) / BOARD_ROWS };
}

/** Mjuk start och mjukt stopp, som om något drar i skenet. Samma kurva som easeInOutQuad. */
function easeInOut(progress: number): number {
  const remaining = 1 - progress;
  return progress < HALF ? 2 * progress * progress : 1 - 2 * remaining * remaining;
}

/** Var skenet står vid serverns tid, och om det har kommit fram. */
export function findGlowPoint(seance: SeanceView, serverNowMs: number): { point: BoardPoint; hasArrived: boolean } {
  const target = findCellCenter(seance.glowCell);
  if (seance.previousCell === null || seance.glowMovesAtMs === null) return { point: target, hasArrived: true };
  const progress = (serverNowMs - seance.glowMovesAtMs) / GLOW_GLIDE_MS;
  if (progress >= 1) return { point: target, hasArrived: true };
  const from = findCellCenter(seance.previousCell);
  const eased = easeInOut(Math.max(0, progress));
  return { point: { x: from.x + (target.x - from.x) * eased, y: from.y + (target.y - from.y) * eased }, hasArrived: false };
}

/** Avståndet räknas i rutor, så att det blir lika åt båda håll fast rutorna inte är kvadratiska. */
function measureDistanceInCells(first: BoardPoint, second: BoardPoint): number {
  return Math.hypot((first.x - second.x) * BOARD_COLUMNS, (first.y - second.y) * BOARD_ROWS);
}

/**
 * Om planchetten är på skenet. Den som redan var på får glida lite längre
 * innan hon räknas som av. Skenet måste ha kommit fram, annars räknas inget.
 */
export function isPlanchetteOnGlow({ planchette, glow, hasArrived, wasOn }: {
  planchette: BoardPoint | null;
  glow: BoardPoint;
  hasArrived: boolean;
  wasOn: boolean;
}): boolean {
  if (!planchette || !hasArrived) return false;
  return measureDistanceInCells(planchette, glow) < (wasOn ? OFF_GLOW_CELLS : ON_GLOW_CELLS);
}

/** Håller planchetten på brädet, även när fingret glider utanför. */
export function clampToBoard(point: BoardPoint): BoardPoint {
  return { x: Math.min(1, Math.max(0, point.x)), y: Math.min(1, Math.max(0, point.y)) };
}

/** Hur länge gruppen ser vem som bröt kontakten. */
const BROKEN_NOTICE_MS = 4000;

/** Raden under brädet. Den säger vad gruppen väntar på, eller vem som släppte. */
export function describeSeanceStatus(seance: SeanceView, serverNowMs: number): string {
  if (seance.isComplete) return 'Skenet har slocknat.';
  if (seance.brokenBy && serverNowMs - seance.brokenBy.atMs < BROKEN_NOTICE_MS) return `Kontakten bröts. ${seance.brokenBy.name} släppte. Det börjar om.`;
  return `${seance.followerCount} av ${seance.playerCount} följer skenet.`;
}
