import { type ServerPing, summarizeServerPings } from '../sync/serverClock.ts';
import { getSignedInClient } from '../sync/supabaseClient.ts';
import { getButton, getElement } from './dom.ts';
import type { Log, Report } from './report.ts';

/** Tio anrop räcker för en median, utan att testet tar lång tid. */
const PING_COUNT = 10;

/**
 * Mäter hur lång tid ett anrop till spelets serverfunktion tar, och hur
 * mycket mobilens klocka skiljer sig från serverns.
 */
export function setupServerCard({ supabaseConfig, report, log }: {
  supabaseConfig: { url: string; publicKey: string };
  report: Report;
  log: Log;
}) {
  const startButton = getButton('server-start');
  const status = getElement('server-status');

  startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    try {
      status.textContent = 'Loggar in …';
      const client = await getSignedInClient(supabaseConfig);
      const pings: ServerPing[] = [];
      for (let attempt = 1; attempt <= PING_COUNT; attempt += 1) {
        status.textContent = `Mäter, anrop ${attempt} av ${PING_COUNT} …`;
        const sentAt = Date.now();
        const { data, error } = await client.functions.invoke('game', { body: { type: 'ping' } });
        if (error) throw error;
        pings.push({ sentAt, receivedAt: Date.now(), serverTime: data.serverTime });
      }
      const summary = summarizeServerPings(pings);
      if (!summary) return;
      const text = `första anropet ${Math.round(summary.firstMs)} ms, sedan median ${Math.round(summary.medianMs ?? 0)} ms och högst ${Math.round(summary.maxMs ?? 0)} ms. Mobilens klocka skiljer sig ${Math.round(summary.clockOffsetMs)} ms från serverns`;
      status.textContent = `Klart: ${text}.`;
      report.setResult('Server', text);
      log(`server: ${text}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      status.textContent = `Det gick inte att nå servern (${message}).`;
      report.setResult('Server', `misslyckades (${message})`);
      log(`server: fel ${message}`);
    } finally {
      startButton.disabled = false;
    }
  });
}
