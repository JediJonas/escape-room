/**
 * Brädet i seansen så som mobilen ritar det: när spelarens planchett räknas
 * som på skenet, hur långt skenet ska visas och raden under brädet. Rena
 * funktioner utan DOM och klocka. Var skenet är räknas ut på samma sätt som
 * på servern, se supabase/functions/game/seance.ts.
 */

import { type BoardPoint, type SeanceView, measureDistanceInCells } from '../../supabase/functions/game/seance.ts';

/**
 * Planchetten räknas som på skenet när den är närmare än en halv ruta, och
 * som av först när den är längre bort än så här. Skillnaden gör att en
 * planchett i kanten inte skickar på och av till servern hela tiden, och att
 * skenet hinner en bit före fingret innan det stannar.
 */
const ON_GLOW_CELLS = 0.5;
const OFF_GLOW_CELLS = 0.8;

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

/**
 * Hur mycket fortare än vanligt skenet glider när det ska komma ikapp
 * servern. Den som själv tappade stoppade skenet tidigare än servern, och när
 * skenet sedan rör sig igen ska det glida ikapp i stället för att hoppa
 * (Jonas 2026-11-17).
 */
export const CATCH_UP_SPEED = 3;

/**
 * Hur långt skenet ska visas. Servern får veta först efter en stund att någon
 * har tappat, och då har mobilen redan låtit skenet glida lite för långt.
 * Därför flyttas skenet aldrig bakåt på skärmen, och den som själv har
 * tappat stoppar skenet direkt hos sig (Jonas 2026-11-17). Det som visas kan
 * alltså ligga en bit före servern, och då står skenet still tills servern
 * har kommit ikapp. Ligger det i stället efter servern glider det ikapp,
 * högst maxStep åt gången.
 */
export function holdGlowProgress({ computed, shown, isHeld, maxStep }: {
  /** Det som servern och mobilen räknar fram. */
  computed: number;
  /** Det som visades senast på samma sträcka, eller null på en ny sträcka. */
  shown: number | null;
  /**
   * Om skenet står still: servern har stoppat det, eller spelarens egen
   * planchett har lämnat det. Då står det kvar där det syns, så att det inte
   * hoppar framåt heller när servern stoppade det lite senare än mobilen.
   */
  isHeld: boolean;
  /** Hur långt skenet högst får glida sedan förra bilden, när det ska komma ikapp. */
  maxStep: number;
}): number {
  if (shown === null) return computed;
  if (isHeld || computed <= shown) return shown;
  return Math.min(computed, shown + maxStep);
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
  // När meddelandet är klart släcks skenet, och raden är tom (Jonas 2026-11-17).
  if (seance.isComplete) return '';
  if (seance.brokenBy && serverNowMs - seance.brokenBy.atMs < BROKEN_NOTICE_MS) return `Kontakten bröts. ${seance.brokenBy.name} släppte. Det börjar om.`;
  if (isPlaying && !seance.isMeOnGlow) return 'Skenet väntar på dig.';
  const { waitingFor } = seance;
  if (waitingFor.length === 0) return 'Alla följer skenet.';
  if (waitingFor.length > MAX_NAMES_SHOWN) return `Skenet väntar på ${waitingFor.length} av er.`;
  return `Skenet väntar på ${listNames(waitingFor)}.`;
}
