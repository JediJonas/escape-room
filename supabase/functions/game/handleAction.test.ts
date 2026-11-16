import assert from 'node:assert/strict';
import { test } from 'vitest';
import { handleAction } from './handleAction.ts';

const SERVER_TIME = new Date('2026-11-16T20:00:00.123Z');
const fakeSql = async () => [{ server_time: SERVER_TIME }];

test('ping svarar med databasens klocka i millisekunder', async () => {
  const result = await handleAction({ action: { type: 'ping' }, sql: fakeSql });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { serverTime: SERVER_TIME.getTime() });
});

test('en okänd handling ger fel 400', async () => {
  const result = await handleAction({ action: { type: 'fuska' }, sql: fakeSql });
  assert.equal(result.status, 400);
});

test('en handling utan typ ger fel 400', async () => {
  assert.equal((await handleAction({ action: null, sql: fakeSql })).status, 400);
  assert.equal((await handleAction({ action: 'ping', sql: fakeSql })).status, 400);
});
