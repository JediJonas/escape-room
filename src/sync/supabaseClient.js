// @ts-check

/**
 * Mobilens anslutning till Supabase, gemensam för hela sidan. Mobilen loggar
 * in anonymt första gången. Inloggningen sparas i webbläsaren, så mobilen är
 * samma användare när sidan laddas om.
 */

/** @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient */

/** @type {Promise<SupabaseClient> | null} */
let signedInClient = null;

/**
 * @param {{ url: string, publicKey: string }} supabaseConfig
 * @returns {Promise<SupabaseClient>}
 */
export function getSignedInClient(supabaseConfig) {
  if (!signedInClient) {
    signedInClient = signIn(supabaseConfig).catch((error) => {
      // Ett misslyckat försök ska inte fastna, så nästa anrop försöker igen.
      signedInClient = null;
      throw error;
    });
  }
  return signedInClient;
}

/** @param {{ url: string, publicKey: string }} supabaseConfig */
async function signIn(supabaseConfig) {
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
