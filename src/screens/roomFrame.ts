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
/**
 * Konturen som en SVG-väg genom punkterna på skärmen. Dolda linjer hoppas
 * över, så att något som står framför saken inte får en linje över sig
 * (Jonas 2026-11-23). Utan dolda linjer blir vägen sluten.
 */
export function buildOutlinePath(points: readonly { xPx: number; yPx: number }[], hiddenEdges: readonly number[] = []): string {
  const format = (index: number) => `${points[index].xPx.toFixed(1)},${points[index].yPx.toFixed(1)}`;
  const hidden = new Set(hiddenEdges);
  if (hidden.size === 0) return `M${points.map((_, index) => format(index)).join('L')}Z`;
  // Vägen börjar efter en dold linje, så att varje synlig bit ritas i ett svep.
  const start = (Math.min(...hidden) + 1) % points.length;
  let path = '';
  let isPenDown = false;
  for (let step = 0; step < points.length; step += 1) {
    const edge = (start + step) % points.length;
    if (hidden.has(edge)) {
      isPenDown = false;
      continue;
    }
    if (!isPenDown) path += `M${format(edge)}`;
    path += `L${format((edge + 1) % points.length)}`;
    isPenDown = true;
  }
  return path;
}
