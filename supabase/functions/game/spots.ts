/**
 * Var en sak eller en dörr sitter i rummets rundbild. Vridningen är noll mitt
 * i bilden och växer åt höger, lutningen är noll vid horisonten och växer
 * uppåt, som blicken i visaren (src/view/lookDirection.ts). Se
 * docs/koncept.md, Saker i rundbilden.
 *
 * Rena funktioner, så att servern och mobilen räknar likadant.
 */

/**
 * Ramen runt saken i rundbilden, med mitten som riktning och storleken i
 * grader. Den visar vad som är tänt i stället för siktet som låg mitt i
 * bilden (Jonas 2026-11-23).
 */
export type SpotFrame = { yawDeg: number; pitchDeg: number; widthDeg: number; heightDeg: number };

/**
 * En plats i rundbilden. Radien är träffytan, och den får vara generös.
 * Ramen följer saken och kan därför ha en annan mitt än träffytan.
 */
export type Spot = { yawDeg: number; pitchDeg: number; radiusDeg: number; frame?: SpotFrame };

export type Direction = { yawDeg: number; pitchDeg: number };

const MAX_RADIUS_DEG = 45;
/** En ram får vara högst ett halvt varv bred och gå från rakt ner till rakt upp. */
const MAX_FRAME_SIZE_DEG = 180;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Vinkeln mellan två riktningar längs en storcirkel. */
export function measureAngleDeg(a: Direction, b: Direction): number {
  const [pitchA, pitchB] = [toRadians(a.pitchDeg), toRadians(b.pitchDeg)];
  const cosine = Math.sin(pitchA) * Math.sin(pitchB) + Math.cos(pitchA) * Math.cos(pitchB) * Math.cos(toRadians(a.yawDeg - b.yawDeg));
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

/** Skillnaden i sidled, mellan 0 och 180 grader. */
function measureYawDeg(a: Direction, b: Direction): number {
  const difference = Math.abs(a.yawDeg - b.yawDeg) % 360;
  return difference > 180 ? 360 - difference : difference;
}

/**
 * Det som ligger närmast riktningen, om riktningen är inom dess träffyta.
 * Den breda bilden, som är visarens reserv, går bara att vrida i sidled, så
 * där räknas bara vridningen.
 */
export function findSpotAt<T extends { spot: Spot }>(items: readonly T[], direction: Direction, { isSidewaysOnly = false } = {}): T | null {
  let nearest: { item: T; angleDeg: number } | null = null;
  for (const item of items) {
    const angleDeg = isSidewaysOnly ? measureYawDeg(item.spot, direction) : measureAngleDeg(item.spot, direction);
    if (angleDeg <= item.spot.radiusDeg && (!nearest || angleDeg < nearest.angleDeg)) nearest = { item, angleDeg };
  }
  return nearest?.item ?? null;
}

function isDirection(yawDeg: unknown, pitchDeg: unknown): boolean {
  return typeof yawDeg === 'number' && yawDeg >= -180 && yawDeg <= 180
    && typeof pitchDeg === 'number' && pitchDeg >= -90 && pitchDeg <= 90;
}

function isSpotFrame(value: unknown): value is SpotFrame {
  if (!value || typeof value !== 'object') return false;
  const { yawDeg, pitchDeg, widthDeg, heightDeg } = value as Record<string, unknown>;
  return isDirection(yawDeg, pitchDeg)
    && typeof widthDeg === 'number' && widthDeg > 0 && widthDeg <= MAX_FRAME_SIZE_DEG
    && typeof heightDeg === 'number' && heightDeg > 0 && heightDeg <= MAX_FRAME_SIZE_DEG;
}

export function isSpot(value: unknown): value is Spot {
  if (!value || typeof value !== 'object') return false;
  const { yawDeg, pitchDeg, radiusDeg, frame } = value as Record<string, unknown>;
  return isDirection(yawDeg, pitchDeg)
    && typeof radiusDeg === 'number' && radiusDeg > 0 && radiusDeg <= MAX_RADIUS_DEG
    && (frame === undefined || isSpotFrame(frame));
}
