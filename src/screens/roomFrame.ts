import { type Spot, FRAME_MARGIN_DEG, findSpotFrame, frameHalfSizeDeg } from '../../supabase/functions/game/spots.ts';
import type { LookDirection } from '../view/lookDirection.ts';

/** Punkter per sida, så att ramen böjer sig med bilden i det mjuka perspektivet. */
const POINTS_PER_SIDE = 8;

/**
 * Det som ritas runt saken, som riktningar i rummet varvet runt. Visaren
 * räknar om dem till punkter på skärmen. Har platsen en kontur följer linjen
 * sakens form (Jonas 2026-11-23). Annars ritas ramen, där träffytan slutar
 * (frameHalfSizeDeg).
 */
export function listFrameOutline(spot: Spot): LookDirection[] {
  if (spot.outline) return spot.outline.map(([yawDeg, pitchDeg]) => ({ yawDeg, pitchDeg }));
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

