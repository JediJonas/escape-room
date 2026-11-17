/**
 * Mobilens väg till spelets serverfunktion och till spelarens privata kanal,
 * se docs/motorn.md. Servern äger spelet, så allt mobilen gör går hit.
 */

import { SUPABASE_PUBLIC_KEY, SUPABASE_URL } from '../config.ts';
import { VIEW_EVENT, getPlayerTopic } from '../../supabase/functions/game/channels.ts';
import type { LobbyView } from '../../supabase/functions/game/lobby.ts';
import { getSignedInClient } from './supabaseClient.ts';

const SUPABASE_CONFIG = { url: SUPABASE_URL, publicKey: SUPABASE_PUBLIC_KEY };

/** Felkoden när servern inte gick att nå alls. */
export const NETWORK_ERROR = 'network';

export type GameResponse = { ok: true; view: LobbyView | null } | { ok: false; error: string };

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
    return { ok: true, view: (data as { view?: LobbyView } | null)?.view ?? null };
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
  onView: (view: LobbyView) => void;
  onListening: () => void;
}): Promise<() => void> {
  const client = await getSignedInClient(SUPABASE_CONFIG);
  const channel = client.channel(getPlayerTopic(playerId), { config: { private: true } });
  channel.on('broadcast', { event: VIEW_EVENT }, (message: { payload: unknown }) => onView(message.payload as LobbyView));
  channel.subscribe((status: string) => {
    if (status === 'SUBSCRIBED') onListening();
  });
  return () => {
    client.removeChannel(channel);
  };
}
