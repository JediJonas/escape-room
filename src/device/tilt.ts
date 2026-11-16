/** Lutning i grader som flyttar pricken ända ut till kanten. */
export const MAX_TILT_DEG = 30;

/** Tyngdaccelerationen, för mobiler som bara ger acceleration med tyngdkraft. */
const GRAVITY_MS2 = 9.81;

function clampToUnit(value: number) {
  return Math.max(-1, Math.min(1, value));
}

/**
 * Gör om mobilens lutning till en plats mellan -1 och 1 i sidled och höjdled.
 */
export function tiltToPosition(orientation: { beta: number | null; gamma: number | null }, maxTiltDeg: number = MAX_TILT_DEG): { x: number; y: number } {
  return {
    x: clampToUnit((orientation.gamma ?? 0) / maxTiltDeg),
    y: clampToUnit((orientation.beta ?? 0) / maxTiltDeg),
  };
}

type Acceleration = { x: number | null; y: number | null; z: number | null };

function hasValues(acceleration: Acceleration | null | undefined) {
  return Boolean(acceleration && acceleration.x !== null && acceleration.y !== null && acceleration.z !== null);
}

function magnitude(acceleration: Acceleration) {
  return Math.hypot(acceleration.x ?? 0, acceleration.y ?? 0, acceleration.z ?? 0);
}

/**
 * Hur mycket mobilen rör sig just nu, i m/s². Noll betyder stilla.
 * Vissa mobiler ger bara acceleration med tyngdkraften inräknad. Då dras
 * tyngdkraften av från styrkan, vilket är grövre men räcker för att skilja
 * stilla från rörelse.
 * @returns null om mobilen inte gav några värden
 */
export function measureMovement(motion: { acceleration?: Acceleration | null; accelerationIncludingGravity?: Acceleration | null }): number | null {
  if (motion.acceleration && hasValues(motion.acceleration)) return magnitude(motion.acceleration);
  if (motion.accelerationIncludingGravity && hasValues(motion.accelerationIncludingGravity)) {
    return Math.abs(magnitude(motion.accelerationIncludingGravity) - GRAVITY_MS2);
  }
  return null;
}
