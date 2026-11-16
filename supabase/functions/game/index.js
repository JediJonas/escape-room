// Spelets serverfunktion i Supabase. Den tar emot allt mobilerna gör, se
// docs/motorn.md. Plattformen och withSupabase kontrollerar mobilens
// inloggning innan något körs, och withSupabase sköter CORS.
import { withSupabase } from 'npm:@supabase/server@1';
import postgres from 'npm:postgres@3';
import { handleAction } from './handleAction.js';

// En direkt anslutning till databasen, som återanvänds mellan anropen så
// länge funktionen är vaken. Den behövs för att kunna låsa ett spel under
// en ändring. prepare: false krävs av Supabases anslutningspool.
const sql = postgres(Deno.env.get('SUPABASE_DB_URL'), { prepare: false, max: 1 });

export default {
  fetch: withSupabase({ auth: 'user' }, async (request) => {
    const action = await request.json().catch(() => null);
    const result = await handleAction({ action, sql });
    return Response.json(result.body, { status: result.status });
  }),
};
