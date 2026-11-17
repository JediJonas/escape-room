/**
 * Provar serverfunktionens SQL i gameStore.ts mot en riktig Postgres, med
 * schemat från migreringarna. Körs av npm run test:db efter run.sh, som
 * skapar databasen test_engine. I vanliga npm test hoppas provet över.
 */

import assert from 'node:assert/strict';
import postgres from 'postgres';
import { afterAll, describe, test } from 'vitest';
import { type Sql, createGameStore } from '../functions/game/gameStore.ts';
import { handleAction } from '../functions/game/handleAction.ts';
import type { LobbyView } from '../functions/game/lobby.ts';

const DATABASE = process.env.GAME_STORE_DATABASE;
const LEADER = '30000000-0000-0000-0000-000000000001';
const GUEST = '30000000-0000-0000-0000-000000000002';

describe.skipIf(!DATABASE)('gameStore mot Postgres', () => {
  const client = postgres({ database: DATABASE, prepare: false, max: 1, onnotice: () => {} });
  const sql = client as unknown as Sql;
  const store = createGameStore(sql);
  const send = (userId: string, action: object, joinCodes = ['QRST']) =>
    handleAction({ action, context: { userId, store, createJoinCode: () => joinCodes.shift() ?? 'VWXZ' } });

  afterAll(() => client.end());

  test('ett spel skapas, någon går med och båda får sin vy i sin kanal', async () => {
    await sql`insert into auth.users (id) values (${LEADER}), (${GUEST}) on conflict do nothing`;
    const created = await send(LEADER, { type: 'createGame', name: 'Ledare' });
    assert.equal(created.status, 200);
    const { gameId } = (created.body as { view: LobbyView }).view;

    // Tillståndet ska sparas som ett objekt, inte som en sträng med JSON.
    const [game] = await sql`select jsonb_typeof(state) as kind, state->>'status' as status from engine.games where id = ${gameId}`;
    assert.deepEqual({ ...game }, { kind: 'object', status: 'lobby' });

    const joined = await send(GUEST, { type: 'joinGame', joinCode: 'qrst', name: 'Gäst' });
    assert.equal(joined.status, 200);
    const guestView = (joined.body as { view: LobbyView }).view;

    const messages = await sql`
      select topic, event, payload from realtime.messages
      where topic in (select 'player:' || id from engine.players where game_id = ${gameId})`;
    assert.equal(messages.length, 2);
    for (const message of messages) {
      const view = message.payload as LobbyView;
      assert.equal(message.event, 'view');
      assert.equal(message.topic, `player:${view.me.playerId}`);
      assert.deepEqual(view.players.map((player) => player.name), ['Ledare', 'Gäst']);
    }

    const [event] = await sql`select jsonb_typeof(action) as kind from engine.events where game_id = ${gameId} order by id desc limit 1`;
    assert.equal(event.kind, 'object');

    const reloaded = await send(GUEST, { type: 'getView', gameId });
    assert.deepEqual((reloaded.body as { view: LobbyView }).view, guestView);
  });

  test('en kod som redan används byts, och ett id som inte är ett uuid ger inget fel', async () => {
    const created = await send(LEADER, { type: 'createGame', name: 'Igen' }, ['QRST', 'LMNP']);
    assert.equal((created.body as { view: LobbyView }).view.joinCode, 'LMNP');
    assert.deepEqual(await send(GUEST, { type: 'getView', gameId: 'inte-ett-id' }), { status: 404, body: { error: 'notInGame' } });
  });
});
