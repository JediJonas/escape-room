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
 * grader. Den visar vad som är tänt, och är också träffytan: saken tänds när
 * mitten av bilden är innanför ramen (Jonas 2026-11-23).
 */
export type SpotFrame = { yawDeg: number; pitchDeg: number; widthDeg: number; heightDeg: number };

/**
 * En plats i rundbilden. Radien fanns innan ramen och används för en plats
 * utan ram. Ramen följer saken och kan ha en annan mitt än radien.
 * Konturen är sakens form som punkter med vridning och lutning i grader. Den
 * ritas i stället för ramen, men ramen är fortfarande träffytan, så att det
 * räcker att mitten är i närheten av en smal sak (Jonas 2026-11-23).
 */
export type Spot = { yawDeg: number; pitchDeg: number; radiusDeg: number; frame?: SpotFrame; outline?: [number, number][] };

export type Direction = { yawDeg: number; pitchDeg: number };

const MAX_RADIUS_DEG = 45;
/** En ram får vara högst ett halvt varv bred och gå från rakt ner till rakt upp. */
const MAX_FRAME_SIZE_DEG = 180;
/** En kontur har minst en triangel och högst så här många punkter, så att uppdragsfilen hålls läsbar. */
const MAX_OUTLINE_POINTS = 64;
/** Lite luft mellan saken och ramen, så att ramen inte skär i saken (Jonas 2026-11-23). */
export const FRAME_MARGIN_DEG = 1;
/** Närmare rakt upp eller ner än så här blir en grad i sidled för kort för att räkna med. */
const MIN_COS_PITCH = 0.2;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Vinkeln mellan två riktningar längs en storcirkel. */
export function measureAngleDeg(a: Direction, b: Direction): number {
  const [pitchA, pitchB] = [toRadians(a.pitchDeg), toRadians(b.pitchDeg)];
  const cosine = Math.sin(pitchA) * Math.sin(pitchB) + Math.cos(pitchA) * Math.cos(pitchB) * Math.cos(toRadians(a.yawDeg - b.yawDeg));
  return (Math.acos(Math.max(-1, Math.min(1, cosine))) * 180) / Math.PI;
}

/** Skillnaden i sidled, mellan -180 och 180 grader, räknad över skarven. */
function wrapYawDeg(yawDeg: number): number {
  return ((((yawDeg + 180) % 360) + 360) % 360) - 180;
}

/** Ramen runt saken, eller en fyrkant över radien om platsen inte har någon ram. */
export function findSpotFrame(spot: Spot): SpotFrame {
  return spot.frame ?? { yawDeg: spot.yawDeg, pitchDeg: spot.pitchDeg, widthDeg: spot.radiusDeg * 2, heightDeg: spot.radiusDeg * 2 };
}

/**
 * Halva ramen i grader, med luften inräknad. Luften i sidled räknas om med
 * lutningen, så att den ser lika bred ut som på höjden även när saken ligger
 * långt ner, som en bok på golvet.
 */
export function frameHalfSizeDeg(frame: SpotFrame, marginDeg: number): { yawDeg: number; pitchDeg: number } {
  const cosPitch = Math.max(MIN_COS_PITCH, Math.cos(toRadians(frame.pitchDeg)));
  return { yawDeg: frame.widthDeg / 2 + marginDeg / cosPitch, pitchDeg: frame.heightDeg / 2 + marginDeg };
}

/**
 * Om riktningen ligger innanför ramen, kanten inräknad. Den breda bilden, som
 * är visarens reserv, går bara att vrida i sidled, så där räknas bara
 * vridningen.
 */
export function isDirectionInSpot(spot: Spot, direction: Direction, { isSidewaysOnly = false } = {}): boolean {
  const frame = findSpotFrame(spot);
  const half = frameHalfSizeDeg(frame, FRAME_MARGIN_DEG);
  if (Math.abs(wrapYawDeg(direction.yawDeg - frame.yawDeg)) > half.yawDeg) return false;
  return isSidewaysOnly || Math.abs(direction.pitchDeg - frame.pitchDeg) <= half.pitchDeg;
}

/**
 * Det som ligger närmast riktningen, om riktningen är innanför dess ram.
 * Ligger flera ramar över mitten väljs den vars mitt är närmast.
 */
export function findSpotAt<T extends { spot: Spot }>(items: readonly T[], direction: Direction, { isSidewaysOnly = false } = {}): T | null {
  let nearest: { item: T; angleDeg: number } | null = null;
  for (const item of items) {
    if (!isDirectionInSpot(item.spot, direction, { isSidewaysOnly })) continue;
    const frame = findSpotFrame(item.spot);
    const angleDeg = isSidewaysOnly ? Math.abs(wrapYawDeg(direction.yawDeg - frame.yawDeg)) : measureAngleDeg(frame, direction);
    if (!nearest || angleDeg < nearest.angleDeg) nearest = { item, angleDeg };
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

function isOutline(value: unknown): value is [number, number][] {
  return Array.isArray(value) && value.length >= 3 && value.length <= MAX_OUTLINE_POINTS
    && value.every((point) => Array.isArray(point) && point.length === 2 && isDirection(point[0], point[1]));
}

export function isSpot(value: unknown): value is Spot {
  if (!value || typeof value !== 'object') return false;
  const { yawDeg, pitchDeg, radiusDeg, frame, outline } = value as Record<string, unknown>;
  return isDirection(yawDeg, pitchDeg)
    && typeof radiusDeg === 'number' && radiusDeg > 0 && radiusDeg <= MAX_RADIUS_DEG
    && (frame === undefined || isSpotFrame(frame))
    && (outline === undefined || isOutline(outline));
}
