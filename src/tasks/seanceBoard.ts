/**
 * Brädet i seansen så som mobilen ritar det: när spelarens finger räknas
 * som på planchetten, hur långt planchetten ska visas och raden under brädet.
 * Rena funktioner utan DOM och klocka. Var planchetten är räknas ut på samma sätt som
 * på servern, se supabase/functions/game/seance.ts.
 */

import { type BoardPoint, type SeanceView, measureDistanceInCells } from '../../supabase/functions/game/seance.ts';

/**
 * Fingret räknas som på planchetten när det är närmare glasets mitt än en
 * halv ruta, och som av först när det är längre bort än så här. Skillnaden
 * gör att ett finger i kanten inte skickar på och av till servern hela tiden,
 * och att planchetten hinner en bit före fingret innan den stannar.
 */
const ON_GLOW_CELLS = 0.5;
const OFF_GLOW_CELLS = 0.8;

/** Hur länge ett lyft finger får vara borta innan kontakten bryts, så att ett finger som glider inte förstör allt. */
export const LIFT_GRACE_MS = 500;

/**
 * Om fingret är på planchetten. Den som redan var på får glida lite längre
 * innan hon räknas som av. I koden heter planchettens läge glow, efter
 * skenet som fanns före planchetten.
 */
export function isFingerOnGlow({ finger, glow, wasOn }: {
  finger: BoardPoint | null;
  glow: BoardPoint;
  wasOn: boolean;
}): boolean {
  if (!finger) return false;
  return measureDistanceInCells(finger, glow) < (wasOn ? OFF_GLOW_CELLS : ON_GLOW_CELLS);
}

/**
 * Hur mycket fortare än vanligt planchetten glider när den ska komma ikapp
 * servern. Den som själv tappade stoppade planchetten tidigare än servern, och
 * när den sedan rör sig igen ska den glida ikapp i stället för att hoppa
 * (Jonas 2026-11-17).
 */
export const CATCH_UP_SPEED = 3;

/**
 * Hur långt planchetten ska visas. Servern får veta först efter en stund att
 * någon har tappat, och då har mobilen redan låtit planchetten glida lite för
 * långt. Därför flyttas planchetten aldrig bakåt på skärmen, och den som
 * själv har tappat stoppar den direkt hos sig (Jonas 2026-11-17). Det som
 * visas kan alltså ligga en bit före servern, och då står planchetten still tills servern
 * har kommit ikapp. Ligger det i stället efter servern glider det ikapp,
 * högst maxStep åt gången.
 */
export function holdGlowProgress({ computed, shown, isHeld, maxStep }: {
  /** Det som servern och mobilen räknar fram. */
  computed: number;
  /** Det som visades senast på samma sträcka, eller null på en ny sträcka. */
  shown: number | null;
  /**
   * Om planchetten står still: servern har stoppat den, eller spelarens eget
   * finger har lämnat den. Då står den kvar där den syns, så att den inte
   * hoppar framåt heller när servern stoppade det lite senare än mobilen.
   */
  isHeld: boolean;
  /** Hur långt planchetten högst får glida sedan förra bilden, när det ska komma ikapp. */
  maxStep: number;
}): number {
  if (shown === null) return computed;
  if (isHeld || computed <= shown) return shown;
  return Math.min(computed, shown + maxStep);
}

/**
 * Hur länge mobilerna väntar på varandra innan de säger till att planchetten
 * har nått bokstaven. Den som kom först till planchetten säger till direkt, nästa
 * efter en halv sekund och så vidare. Hinner servern svara innan dess
 * behöver de andra inte fråga, så att tio mobiler inte ställer sig i kö
 * samtidigt. Planchetten står ändå kvar på bokstaven i tre sekunder.
 */
export const ARRIVED_STAGGER_MS = 500;

/** Hur ofta mobilen säger till igen, om servern inte höll med, till exempel när klockorna går lite olika. */
export const ARRIVED_RETRY_MS = 1000;

/** Om mobilen ska säga till nu att planchetten har nått bokstaven. */
export function shouldReportArrival({ nowMs, reachedAtMs, sentAtMs, followOrder }: {
  nowMs: number;
  /** När mobilen såg planchetten nå bokstaven. */
  reachedAtMs: number;
  /** När mobilen senast sa till om samma bokstav, eller null. */
  sentAtMs: number | null;
  /** Var i ordningen spelaren kom till planchetten. */
  followOrder: number;
}): boolean {
  if (nowMs - reachedAtMs < followOrder * ARRIVED_STAGGER_MS) return false;
  return sentAtMs === null || nowMs - sentAtMs >= ARRIVED_RETRY_MS;
}

/** Håller fingret på brädet, även när det glider utanför. */
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
 * Raden under brädet. Den säger vem planchetten väntar på, eller vem som
 * släppte. Väntar planchetten på spelaren själv står det så, i stället för hennes namn.
 */
export function describeSeanceStatus(seance: SeanceView, serverNowMs: number, isPlaying: boolean): string {
  // När meddelandet är klart står planchetten still, och raden är tom (Jonas 2026-11-17).
  if (seance.isComplete) return '';
  if (seance.brokenBy && serverNowMs - seance.brokenBy.atMs < BROKEN_NOTICE_MS) return `Kontakten bröts. ${seance.brokenBy.name} släppte. Det börjar om.`;
  if (isPlaying && !seance.isMeOnGlow) return 'Planchetten väntar på dig.';
  const { waitingFor } = seance;
  if (waitingFor.length === 0) return 'Alla följer planchetten.';
  if (waitingFor.length > MAX_NAMES_SHOWN) return `Planchetten väntar på ${waitingFor.length} av er.`;
  return `Planchetten väntar på ${listNames(waitingFor)}.`;
}
