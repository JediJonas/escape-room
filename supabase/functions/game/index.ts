// Spelets serverfunktion i Supabase. Den tar emot allt mobilerna gör, se
// docs/motorn.md. Plattformen och withSupabase kontrollerar mobilens
// inloggning innan något körs, och withSupabase sköter CORS.
import { withSupabase } from 'npm:@supabase/server@1';
import postgres from 'npm:postgres@3';
import { handleAction, type Sql } from './handleAction.ts';

// En direkt anslutning till databasen, som återanvänds mellan anropen så
// länge funktionen är vaken. Den behövs för att kunna låsa ett spel under
// en ändring. prepare: false krävs av Supabases anslutningspool.
const databaseUrl = Deno.env.get('SUPABASE_DB_URL');
if (!databaseUrl) throw new Error('SUPABASE_DB_URL saknas');
const client = postgres(databaseUrl, { prepare: false, max: 1 });
// postgres-bibliotekets sql har fler anropssätt än logiken behöver, och
// TypeScript väljer fel av dem. Typen begränsas därför här.
const sql = client as unknown as Sql;

export default {
  fetch: withSupabase({ auth: 'user' }, async (request) => {
    const action = await request.json().catch(() => null);
    const result = await handleAction({ action, sql });
    return Response.json(result.body, { status: result.status });
  }),
};
