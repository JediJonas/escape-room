/**
 * Mobilens anslutning till Supabase, gemensam för hela sidan. Mobilen loggar
 * in anonymt första gången. Inloggningen sparas i webbläsaren, så mobilen är
 * samma användare när sidan laddas om.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

let signedInClient: Promise<SupabaseClient> | null = null;

export function getSignedInClient(supabaseConfig: { url: string; publicKey: string }): Promise<SupabaseClient> {
  if (!signedInClient) {
    signedInClient = signIn(supabaseConfig).catch((error) => {
      // Ett misslyckat försök ska inte fastna, så nästa anrop försöker igen.
      signedInClient = null;
      throw error;
    });
  }
  return signedInClient;
}

async function signIn(supabaseConfig: { url: string; publicKey: string }) {
  // Laddas först här, så att sidan inte hämtar Supabase förrän den behövs.
  const { createClient } = await import('@supabase/supabase-js');
  const client = createClient(supabaseConfig.url, supabaseConfig.publicKey);
  const { data } = await client.auth.getSession();
  if (!data.session) {
    const { error } = await client.auth.signInAnonymously();
    if (error) throw error;
  }
  // De privata kanalerna kontrollerar inloggningen när mobilen går med.
  await client.realtime.setAuth();
  return client;
}
