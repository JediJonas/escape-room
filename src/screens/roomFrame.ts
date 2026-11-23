import type { Spot, SpotFrame } from '../../supabase/functions/game/spots.ts';
import type { LookDirection } from '../view/lookDirection.ts';

/** Lite luft mellan saken och ramen, så att ramen inte skär i saken (Jonas 2026-11-23). */
export const FRAME_MARGIN_DEG = 1;
/** Punkter per sida, så att ramen böjer sig med bilden i det mjuka perspektivet. */
const POINTS_PER_SIDE = 8;
/** Närmare rakt upp eller ner än så här blir en grad i sidled för kort för att räkna med. */
const MIN_COS_PITCH = 0.2;

/** Ramen runt saken, eller en fyrkant över träffytan om uppdragsfilen inte har någon ram. */
export function findSpotFrame(spot: Spot): SpotFrame {
  return spot.frame ?? { yawDeg: spot.yawDeg, pitchDeg: spot.pitchDeg, widthDeg: spot.radiusDeg * 2, heightDeg: spot.radiusDeg * 2 };
}

/**
 * Ramens kant som riktningar i rummet, varvet runt. Visaren räknar om dem
 * till punkter på skärmen. Luften räknas i grader, så att den blir lika bred
 * i sidled som på höjden även när saken ligger långt ner, som en bok på golvet.
 */
export function listFrameOutline(frame: SpotFrame, marginDeg: number): LookDirection[] {
  const cosPitch = Math.max(MIN_COS_PITCH, Math.cos((frame.pitchDeg * Math.PI) / 180));
  const halfWidthDeg = frame.widthDeg / 2 + marginDeg / cosPitch;
  const halfHeightDeg = frame.heightDeg / 2 + marginDeg;
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  return corners.flatMap(([fromX, fromY], index) => {
    const [toX, toY] = corners[(index + 1) % corners.length];
    return Array.from({ length: POINTS_PER_SIDE }, (_, step) => {
      const share = step / POINTS_PER_SIDE;
      return {
        yawDeg: frame.yawDeg + (fromX + (toX - fromX) * share) * halfWidthDeg,
        pitchDeg: frame.pitchDeg + (fromY + (toY - fromY) * share) * halfHeightDeg,
      };
    });
  });
}
