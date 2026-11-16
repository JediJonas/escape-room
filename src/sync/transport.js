// @ts-check

/**
 * Kanalen mellan mobilerna i ett testrum. Supabase används när det är
 * inställt i config.js. Annars används en lokal kanal som bara når flikar i
 * samma webbläsare, så att sidan går att prova innan Supabase finns.
 *
 * Båda kanalerna skickar även tillbaka avsändarens egna meddelanden. Så mäts
 * tiden tur och retur.
 */

const BROADCAST_EVENT = 'message';

/**
 * @typedef {{
 *   name: string,
 *   reachesOtherDevices: boolean,
 *   send: (message: object) => void,
 *   close: () => void,
 * }} Transport
 */

/**
 * @param {string} roomCode
 * @param {(message: any) => void} onMessage
 * @returns {Transport}
 */
export function createLocalTransport(roomCode, onMessage) {
  const channel = new BroadcastChannel(`testsida-${roomCode}`);
  channel.onmessage = (event) => onMessage(event.data);
  return {
    name: 'lokal kanal (bara flikar i samma webbläsare)',
    reachesOtherDevices: false,
    send: (message) => {
      channel.postMessage(message);
      // BroadcastChannel skickar inte till avsändaren själv.
      setTimeout(() => onMessage(message), 0);
    },
    close: () => channel.close(),
  };
}

/**
 * @param {string} roomCode
 * @param {(message: any) => void} onMessage
 * @param {{ url: string, publicKey: string }} supabaseConfig
 * @returns {Promise<Transport>}
 */
export async function createSupabaseTransport(roomCode, onMessage, supabaseConfig) {
  // Laddas först här, så att sidan inte hämtar Supabase förrän testet körs.
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseConfig.url, supabaseConfig.publicKey);
  const channel = client.channel(`testsida-${roomCode}`, { config: { broadcast: { self: true } } });
  channel.on('broadcast', { event: BROADCAST_EVENT }, (/** @type {{ payload: any }} */ received) => onMessage(received.payload));
  await new Promise((resolve, reject) => {
    channel.subscribe((/** @type {string} */ status) => {
      if (status === 'SUBSCRIBED') resolve(undefined);
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') reject(new Error(`Supabase svarade ${status}`));
    });
  });
  return {
    name: 'Supabase Realtime',
    reachesOtherDevices: true,
    send: (message) => {
      channel.send({ type: 'broadcast', event: BROADCAST_EVENT, payload: message });
    },
    close: () => {
      client.removeChannel(channel);
    },
  };
}
