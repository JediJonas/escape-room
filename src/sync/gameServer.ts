/**
 * Mobilens väg till spelets serverfunktion och till spelarens privata kanal,
 * se docs/motorn.md. Servern äger spelet, så allt mobilen gör går hit.
 */

import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from '../config.ts';
import { SEANCE_EVENT, VIEW_EVENT, getGroupTopic, getPlayerTopic } from '../../supabase/functions/game/channels.ts';
import type { PlayerView, SeanceUpdate } from '../../supabase/functions/game/views.ts';
import { type ServerPing, summarizeServerPings } from './serverClock.ts';
import { getSignedInClient } from './supabaseClient.ts';

const SUPABASE_CONFIG = { url: SUPABASE_URL, publicKey: SUPABASE_PUBLIC_KEY };

/** Felkoden när servern inte gick att nå alls. */
export const NETWORK_ERROR = 'network';

export type GameResponse = { ok: true; view: PlayerView | null } | { ok: false; error: string };

/** Läser felkoden ur ett svar som inte var 200. Supabase lägger svaret i context. */
async function readErrorCode(error: { context?: unknown }): Promise<string> {
  if (!(error.context instanceof Response)) return NETWORK_ERROR;
  const body: unknown = await error.context.json().catch(() => null);
  return body && typeof body === 'object' && 'error' in body && typeof body.error === 'string' ? body.error : NETWORK_ERROR;
}

export async function callGame(action: { type: string } & Record<string, unknown>): Promise<GameResponse> {
  try {
    const client = await getSignedInClient(SUPABASE_CONFIG);
    const { data, error } = await client.functions.invoke('game', { body: action });
    if (error) return { ok: false, error: await readErrorCode(error) };
    return { ok: true, view: (data as { view?: PlayerView } | null)?.view ?? null };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

/**
 * Lyssnar på spelarens privata kanal, där servern skickar en ny vy varje gång
 * något har ändrats. `onListening` anropas när kanalen är öppen, så att
 * mobilen kan hämta det den har missat innan dess.
 */
export async function listenToPlayerView({ playerId, onView, onListening }: {
  playerId: string;
  onView: (view: PlayerView) => void;
  onListening: () => void;
}): Promise<() => void> {
  const client = await getSignedInClient(SUPABASE_CONFIG);
  const channel = client.channel(getPlayerTopic(playerId), { config: { private: true } });
  channel.on('broadcast', { event: VIEW_EVENT }, (message: { payload: unknown }) => onView(message.payload as PlayerView));
  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') onListening();
  });
  return () => {
    client.removeChannel(channel);
  };
}

/**
 * Lyssnar på gruppens kanal, där servern skickar seansens läge en gång till
 * alla i stället för en vy till var och en. Missas ett läge hämtar mobilen
 * vyn som vanligt, se onListening i listenToPlayerView.
 */
export async function listenToGroup({ gameId, onSeance }: {
  gameId: string;
  onSeance: (update: SeanceUpdate) => void;
}): Promise<() => void> {
  const client = await getSignedInClient(SUPABASE_CONFIG);
  const channel = client.channel(getGroupTopic(gameId), { config: { private: true } });
  channel.on('broadcast', { event: SEANCE_EVENT }, (message: { payload: unknown }) => onSeance(message.payload as SeanceUpdate));
  channel.subscribe();
  return () => {
    client.removeChannel(channel);
  };
}

/** Antal anrop när skillnaden mot serverns klocka mäts. Det snabbaste används. */
const CLOCK_PINGS = 3;

/**
 * Mäter hur mycket serverns klocka går före mobilens, för nedräkningen.
 * Ger null om servern inte gick att nå.
 */
export async function measureClockOffsetMs(): Promise<number | null> {
  const pings: ServerPing[] = [];
  try {
    const client = await getSignedInClient(SUPABASE_CONFIG);
    for (let attempt = 0; attempt < CLOCK_PINGS; attempt += 1) {
      const sentAt = Date.now();
      const { data, error } = await client.functions.invoke('game', { body: { type: 'ping' } });
      const receivedAt = Date.now();
      const serverTime = (data as { serverTime?: unknown } | null)?.serverTime;
      if (!error && typeof serverTime === 'number') pings.push({ sentAt, receivedAt, serverTime });
    }
  } catch {
    return null;
  }
  return summarizeServerPings(pings)?.clockOffsetMs ?? null;
}
