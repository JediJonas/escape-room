/**
 * Uppgiftstypen Instängd med Lotsen, så som Källaren använder den. En
 * spelare stängs in i källaren och ser sig omkring i en mörk rundbild
 * med en ficklampa. De andra har var sin bit av en beskrivning av rummet och
 * lotsar henne. De har också några säkringar som tänder lampan en kort
 * stund. Hon trycker när den dolda dörren är mitt i ficklampan. Något
 * kommer närmare hela tiden, och ett tryck på fel ställe hörs och för det
 * närmare. Hinner det fram släpps hon ut ändå, men gruppen får en följd
 * senare. Se docs/koncept.md, Källaren.
 *
 * Servern tickar inte. Tiden då det når henne bestäms när hon kommer fram,
 * och tillståndet räknas fram till nu vid varje anrop. Rena funktioner utan
 * klocka: serverns tid skickas in.
 */

import type { CellarStep } from './mission.ts';

const MS_PER_MINUTE = 60_000;
const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;

/** Håller en vinkel mellan -180 och 180 grader, så att dörren hittas även över skarven. */
export function wrapDegrees(degrees: number): number {
  return ((((degrees + HALF_TURN_DEG) % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG) - HALF_TURN_DEG;
}

export type CellarState = {
  /** När den instängda kom fram till källaren. Då börjar det komma närmare. */
  arrivedAtMs: number | null;
  /** Hur mycket närmare det har kommit av fel tryck. */
  penaltyMs: number;
  fusesUsed: number;
  /** Lampan lyser till den här tiden, i serverns tid. */
  litUntilMs: number | null;
  /** Hittade hon dörren, eller hann det fram först? */
  outcome: 'found' | 'caught' | null;
};

export function startCellar(): CellarState {
  return { arrivedAtMs: null, penaltyMs: 0, fusesUsed: 0, litUntilMs: null, outcome: null };
}

/** Tiden då det når henne, eller null innan hon har kommit fram. */
export function findCatchMs(cellar: CellarState, step: CellarStep): number | null {
  if (cellar.arrivedAtMs === null) return null;
  return cellar.arrivedAtMs + step.minutes * MS_PER_MINUTE - cellar.penaltyMs;
}

/** För fram tillståndet till nu. Har tiden gått ut hann det fram. */
export function advanceCellar(cellar: CellarState, step: CellarStep, nowMs: number): CellarState {
  const catchMs = findCatchMs(cellar, step);
  if (cellar.outcome !== null || catchMs === null || nowMs < catchMs) return cellar;
  return { ...cellar, outcome: 'caught' };
}

/** Den instängda har kommit fram. Nedräkningen börjar bara en gång. */
export function markArrived(cellar: CellarState, nowMs: number): CellarState {
  return cellar.arrivedAtMs === null ? { ...cellar, arrivedAtMs: nowMs } : cellar;
}

export type CellarMove = { type: 'flipFuse' } | { type: 'openDoor'; yawDeg: number } | { type: 'timeUp' };

export function readCellarMove(move: unknown): CellarMove | null {
  if (!move || typeof move !== 'object') return null;
  const fields = move as Record<string, unknown>;
  if (fields.type === 'flipFuse' || fields.type === 'timeUp') return { type: fields.type };
  if (fields.type === 'openDoor' && typeof fields.yawDeg === 'number' && Number.isFinite(fields.yawDeg)) return { type: 'openDoor', yawDeg: fields.yawDeg };
  return null;
}

export type CellarRefusal = 'notAtPlace' | 'notTrapped' | 'noMoreFuses';

/**
 * En handling i källaren. Säkringarna är de andras, dörren är hennes. Alla
 * mobiler kan säga till när tiden har gått ut, men servern avgör.
 */
export function applyCellarMove({ cellar, step, move, isTrapped, isTrappedHere, nowMs }: {
  cellar: CellarState;
  step: CellarStep;
  move: CellarMove;
  isTrapped: boolean;
  /** Om den instängda är i källaren. Före det händer ingenting i källaren. */
  isTrappedHere: boolean;
  nowMs: number;
}): { cellar: CellarState } | { refusal: CellarRefusal } {
  const advanced = advanceCellar(cellar, step, nowMs);
  if (advanced.outcome !== null || move.type === 'timeUp') return { cellar: advanced };
  if (advanced.arrivedAtMs === null) return { refusal: 'notAtPlace' };
  if (move.type === 'flipFuse') {
    if (isTrapped) return { refusal: 'notTrapped' };
    if (advanced.fusesUsed >= step.fuses) return { refusal: 'noMoreFuses' };
    return { cellar: { ...advanced, fusesUsed: advanced.fusesUsed + 1, litUntilMs: nowMs + step.lightMs } };
  }
  if (!isTrapped) return { refusal: 'notTrapped' };
  if (!isTrappedHere) return { refusal: 'notAtPlace' };
  const isAtDoor = Math.abs(wrapDegrees(move.yawDeg - step.solution.doorYawDeg)) <= step.solution.toleranceDeg;
  if (isAtDoor) return { cellar: { ...advanced, outcome: 'found' } };
  // Ett fel tryck hörs och för det närmare, så att det inte lönar sig att trycka överallt.
  return { cellar: advanceCellar({ ...advanced, penaltyMs: advanced.penaltyMs + step.wrongTapMs }, step, nowMs) };
}

/** Det en spelare ser av källaren. Det dolda rummet syns bara för den instängda, och först när hon har hittat det. */
export type CellarView = {
  isTrapped: boolean;
  trappedName: string;
  /** Vem som går ner, i berättartexten och statusraden: Du går ner i källaren, eller hennes namn för de andra. */
  goDownText: string;
  /** Bilden visas bara för den instängda när hon är i källaren. */
  image: string | null;
  catchMs: number | null;
  /** Hur lång tid det tar från att hon kommer fram tills det når henne, för att rita hur nära det är. */
  totalMs: number;
  fusesLeft: number;
  litUntilMs: number | null;
  outcome: CellarState['outcome'];
  /** Texten efteråt, olika för den instängda och de andra. */
  outcomeText: string | null;
};

/** Byter {name} mot den instängdas namn. */
function fillName(text: string, name: string): string {
  return text.replaceAll('{name}', name);
}

export function describeCellar({ cellar, step, isTrapped, isTrappedHere, trappedName }: {
  cellar: CellarState;
  step: CellarStep;
  isTrapped: boolean;
  isTrappedHere: boolean;
  trappedName: string;
}): CellarView {
  const outcomeTexts = {
    found: isTrapped ? step.foundText : step.othersFoundText,
    caught: step.caughtText,
  };
  return {
    isTrapped,
    trappedName,
    goDownText: fillName(isTrapped ? step.goDownText : step.othersGoDownText, trappedName),
    image: isTrapped && isTrappedHere ? step.image : null,
    catchMs: findCatchMs(cellar, step),
    totalMs: step.minutes * MS_PER_MINUTE,
    fusesLeft: step.fuses - cellar.fusesUsed,
    litUntilMs: cellar.litUntilMs,
    outcome: cellar.outcome,
    outcomeText: cellar.outcome ? fillName(outcomeTexts[cellar.outcome], trappedName) : null,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

/** Läser en sparad källare, eller null om den saknas eller är trasig. */
export function readCellarState(saved: unknown): CellarState | null {
  if (!saved || typeof saved !== 'object') return null;
  const fields = saved as Record<string, unknown>;
  if (!isFiniteNumber(fields.penaltyMs) || !Number.isInteger(fields.fusesUsed)) return null;
  const outcome = fields.outcome === 'found' || fields.outcome === 'caught' ? fields.outcome : null;
  return {
    arrivedAtMs: isFiniteNumber(fields.arrivedAtMs) ? fields.arrivedAtMs : null,
    penaltyMs: fields.penaltyMs,
    fusesUsed: fields.fusesUsed as number,
    litUntilMs: isFiniteNumber(fields.litUntilMs) ? fields.litUntilMs : null,
    outcome,
  };
}

function isFilledText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

/**
 * Kontrollerar källaren i en uppdragsfil. Rollerna kontrolleras som i andra
 * steg. Här krävs att den instängda rollen finns, är en enda och har en plats.
 */
export function findCellarErrors(step: Record<string, unknown>, name: string): string[] {
  const errors: string[] = [];
  const roles = Array.isArray(step.roles) ? step.roles as Record<string, unknown>[] : [];
  const trapped = roles.find((role) => role?.id === step.trappedRoleId);
  if (!trapped || trapped.count !== 1 || trapped.goTo === undefined) errors.push(`${name} ska ha en instängd roll för en spelare, med en plats`);
  if (!isFilledText(step.image)) errors.push(`${name} saknar bild`);
  for (const field of ['minutes', 'lightMs', 'wrongTapMs'] as const) if (!isPositiveNumber(step[field])) errors.push(`${name} saknar ${field}`);
  if (!Number.isInteger(step.fuses) || (step.fuses as number) < 0) errors.push(`${name} ska ha ett antal säkringar`);
  for (const field of ['goDownText', 'othersGoDownText', 'foundText', 'othersFoundText', 'caughtText', 'markWhenCaught'] as const) if (!isFilledText(step[field])) errors.push(`${name} saknar ${field}`);
  const solution = step.solution as Record<string, unknown> | undefined;
  if (!isFiniteNumber(solution?.doorYawDeg) || !isPositiveNumber(solution?.toleranceDeg)) errors.push(`${name} saknar dörrens riktning i facit`);
  if (step.goTo !== undefined || step.textAtPlace !== undefined) errors.push(`${name} skickar spelarna med rollerna, inte med en plats för alla`);
  return errors;
}
