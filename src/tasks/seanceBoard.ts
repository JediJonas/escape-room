/**
 * Brädet i seansen så som mobilen ritar det: när spelarens planchett räknas
 * som på skenet, vilken bokstav som lyser och raden under brädet. Rena
 * funktioner utan DOM och klocka. Var skenet är räknas ut på samma sätt som
 * på servern, se supabase/functions/game/seance.ts.
 */

import { type BoardPoint, type SeanceView, findCellCenter, measureDistanceInCells } from '../../supabase/functions/game/seance.ts';

/**
 * Planchetten räknas som på skenet när den är närmare än en halv ruta, och
 * som av först när den är längre bort än så här. Skillnaden gör att en
 * planchett i kanten inte skickar på och av till servern hela tiden, och att
 * skenet hinner en bit före fingret innan det stannar.
 */
const ON_GLOW_CELLS = 0.5;
const OFF_GLOW_CELLS = 0.8;

/** Skenet räknas som stående på en bokstav så länge det är så här nära rutans mitt. */
const ON_LETTER_CELLS = 0.3;

/** Hur länge ett lyft finger får vara borta innan kontakten bryts, så att ett finger som glider inte förstör allt. */
export const LIFT_GRACE_MS = 500;

/**
 * Om planchetten är på skenet. Den som redan var på får glida lite längre
 * innan hon räknas som av.
 */
export function isPlanchetteOnGlow({ planchette, glow, wasOn }: {
  planchette: BoardPoint | null;
  glow: BoardPoint;
  wasOn: boolean;
}): boolean {
  if (!planchette) return false;
  return measureDistanceInCells(planchette, glow) < (wasOn ? OFF_GLOW_CELLS : ON_GLOW_CELLS);
}

/** Bokstaven som skenet står på, för att lysa upp den hos alla. När skenet glider vidare slocknar den. */
export function findLitCell(seance: SeanceView, glow: BoardPoint): number | null {
  if (seance.takenCell === null) return null;
  return measureDistanceInCells(glow, findCellCenter(seance.takenCell)) < ON_LETTER_CELLS ? seance.takenCell : null;
}

/** Håller planchetten på brädet, även när fingret glider utanför. */
export function clampToBoard(point: BoardPoint): BoardPoint {
  return { x: Math.min(1, Math.max(0, point.x)), y: Math.min(1, Math.max(0, point.y)) };
}

/** Hur länge gruppen ser vem som bröt kontakten. */
const BROKEN_NOTICE_MS = 4000;

/** Fler namn än så här blir för långt för raden, så då står bara antalet. */
const MAX_NAMES_SHOWN = 3;

/** Räknar upp namn som "Bo", "Bo och Cia" eller "Anna, Bo och Cia". */
function listNames(names: readonly string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} och ${names[names.length - 1]}`;
}

/**
 * Raden under brädet. Den säger vem skenet väntar på, eller vem som släppte.
 * Väntar skenet på spelaren själv står det så, i stället för hennes namn.
 */
export function describeSeanceStatus(seance: SeanceView, serverNowMs: number, isPlaying: boolean): string {
  if (seance.isComplete) return 'Skenet har slocknat.';
  if (seance.brokenBy && serverNowMs - seance.brokenBy.atMs < BROKEN_NOTICE_MS) return `Kontakten bröts. ${seance.brokenBy.name} släppte. Det börjar om.`;
  if (isPlaying && !seance.isMeOnGlow) return 'Skenet väntar på dig.';
  const { waitingFor } = seance;
  if (waitingFor.length === 0) return 'Alla följer skenet.';
  if (waitingFor.length > MAX_NAMES_SHOWN) return `Skenet väntar på ${waitingFor.length} av er.`;
  return `Skenet väntar på ${listNames(waitingFor)}.`;
}
