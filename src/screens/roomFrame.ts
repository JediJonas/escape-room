import { type Spot, type SpotFrame, FRAME_MARGIN_DEG, findSpotFrame, frameHalfSizeDeg } from '../../supabase/functions/game/spots.ts';
import type { LookDirection } from '../view/lookDirection.ts';

/** Punkter per sida, så att ramen böjer sig med bilden i det mjuka perspektivet. */
const POINTS_PER_SIDE = 8;

/**
 * Ramens kant som riktningar i rummet, varvet runt. Visaren räknar om dem
 * till punkter på skärmen. Kanten ligger där träffytan slutar
 * (frameHalfSizeDeg), så att det som ramas in är det som går att trycka på.
 */
export function listFrameOutline(spot: Spot): LookDirection[] {
  const frame = findSpotFrame(spot);
  const half = frameHalfSizeDeg(frame, FRAME_MARGIN_DEG);
  const corners = [[-1, 1], [1, 1], [1, -1], [-1, -1]];
  return corners.flatMap(([fromX, fromY], index) => {
    const [toX, toY] = corners[(index + 1) % corners.length];
    return Array.from({ length: POINTS_PER_SIDE }, (_, step) => {
      const share = step / POINTS_PER_SIDE;
      return {
        yawDeg: frame.yawDeg + (fromX + (toX - fromX) * share) * half.yawDeg,
        pitchDeg: frame.pitchDeg + (fromY + (toY - fromY) * share) * half.pitchDeg,
      };
    });
  });
}

export type { SpotFrame };
