/**
 * Tar emot en handling från en mobil och svarar. Känner inte till Deno eller
 * hur databasen nås, så att den går att testa med Vitest.
 *
 * Än så länge finns bara ping, som testsidan använder för att mäta
 * fördröjningen och skillnaden mellan klockorna. Spelets handlingar läggs till
 * i nästa steg, se docs/motorn.md.
 */

/** Den del av postgres-bibliotekets sql som logiken använder. */
export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => PromiseLike<readonly Record<string, unknown>[]>;

type ActionResult = { status: number; body: object };

export async function handleAction({ action, sql }: { action: unknown; sql: Sql }): Promise<ActionResult> {
  const type = action && typeof action === 'object' && 'type' in action ? action.type : null;
  if (type === 'ping') {
    // Databasens klocka är spelets klocka, eftersom handlingarna stämplas där.
    const [row] = await sql`select clock_timestamp() as server_time`;
    return { status: 200, body: { serverTime: new Date(row.server_time as string | Date).getTime() } };
  }
  return { status: 400, body: { error: `Okänd handling: ${String(type)}` } };
}
