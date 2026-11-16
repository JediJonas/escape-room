// @ts-check

/**
 * Sammanfattar hur lång tid meddelanden tar tur och retur till servern.
 * @param {number[]} roundTripsMs
 * @returns {{ count: number, medianMs: number, maxMs: number } | null} null utan mätningar
 */
export function summarizeRoundTrips(roundTripsMs) {
  if (roundTripsMs.length === 0) return null;
  const sorted = [...roundTripsMs].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const medianMs = sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return { count: sorted.length, medianMs, maxMs: sorted[sorted.length - 1] };
}
