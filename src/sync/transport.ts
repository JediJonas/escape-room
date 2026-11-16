/**
 * Kanalen mellan mobilerna i ett testrum. Supabase används när det är
 * inställt i config.js. Annars används en lokal kanal som bara når flikar i
 * samma webbläsare, så att sidan går att prova innan Supabase finns.
 *
 * Båda kanalerna skickar även tillbaka avsändarens egna meddelanden. Så mäts
 * tiden tur och retur.
 */

import { getSignedInClient } from './supabaseClient.ts';

const BROADCAST_EVENT = 'message';

export type Transport = {
  name: string;
  reachesOtherDevices: boolean;
  send: (message: object) => void;
  close: () => void;
};

export function createLocalTransport(roomCode: string, onMessage: (message: unknown) => void): Transport {
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

export async function createSupabaseTransport(roomCode: string, onMessage: (message: unknown) => void, supabaseConfig: { url: string; publicKey: string }): Promise<Transport> {
  const client = await getSignedInClient(supabaseConfig);
  // En privat kanal: Supabase släpper bara in inloggade mobiler, enligt
  // reglerna i supabase/migrations.
  const channel = client.channel(`testsida:${roomCode}`, { config: { private: true, broadcast: { self: true } } });
  channel.on('broadcast', { event: BROADCAST_EVENT }, (received: { payload: unknown }) => onMessage(received.payload));
  await new Promise((resolve, reject) => {
    channel.subscribe((status: string) => {
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
