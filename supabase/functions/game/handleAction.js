// @ts-check

/**
 * Tar emot en handling från en mobil och svarar. Känner inte till Deno eller
 * hur databasen nås, så att den går att testa med Vitest.
 *
 * Än så länge finns bara ping, som testsidan använder för att mäta
 * fördröjningen och skillnaden mellan klockorna. Spelets handlingar läggs till
 * i nästa steg, se docs/motorn.md.
 */

/**
 * @typedef {(strings: TemplateStringsArray, ...values: unknown[]) => Promise<any[]>} Sql
 * @typedef {{ status: number, body: object }} ActionResult
 */

/**
 * @param {{ action: unknown, sql: Sql }} request
 * @returns {Promise<ActionResult>}
 */
export async function handleAction({ action, sql }) {
  const type = action && typeof action === 'object' && 'type' in action ? action.type : null;
  if (type === 'ping') {
    // Databasens klocka är spelets klocka, eftersom handlingarna stämplas där.
    const [row] = await sql`select clock_timestamp() as server_time`;
    return { status: 200, body: { serverTime: new Date(row.server_time).getTime() } };
  }
  return { status: 400, body: { error: `Okänd handling: ${String(type)}` } };
}
