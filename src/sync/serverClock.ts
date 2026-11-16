import { summarizeRoundTrips } from './latency.ts';

/**
 * Ett anrop till serverfunktionen, med mobilens klocka före och efter och
 * serverns klocka mitt emellan, allt i millisekunder sedan 1970.
 */
export type ServerPing = { sentAt: number; receivedAt: number; serverTime: number };

/**
 * Sammanfattar en serie anrop till servern. Det första anropet redovisas för
 * sig, eftersom serverfunktionen kan behöva starta då. Skillnaden mellan
 * klockorna tas från det snabbaste anropet, där osäkerheten är minst.
 * @param pings i den ordning de gjordes
 * clockOffsetMs är hur mycket serverns klocka går före mobilens. Null utan anrop.
 */
export function summarizeServerPings(pings: ServerPing[]): { firstMs: number; medianMs: number | null; maxMs: number | null; clockOffsetMs: number } | null {
  if (pings.length === 0) return null;
  const roundTripsMs = pings.map((ping) => ping.receivedAt - ping.sentAt);
  const fastest = pings[roundTripsMs.indexOf(Math.min(...roundTripsMs))];
  const midpoint = (fastest.sentAt + fastest.receivedAt) / 2;
  const afterFirst = summarizeRoundTrips(roundTripsMs.slice(1));
  return {
    firstMs: roundTripsMs[0],
    medianMs: afterFirst ? afterFirst.medianMs : null,
    maxMs: afterFirst ? afterFirst.maxMs : null,
    clockOffsetMs: fastest.serverTime - midpoint,
  };
}
