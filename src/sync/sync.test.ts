import assert from 'node:assert/strict';
import { test } from 'vitest';
import { PEER_TIMEOUT_MS, applyPeerMessage, createRoom, dropSilentPeers, summarizeRoom } from './holdRoom.ts';
import { summarizeRoundTrips } from './latency.ts';

const peer = (id: string, isHolding: boolean) => ({ id, name: `Mobil ${id}`, isHolding });

test('en ensam mobil räknas inte som att alla håller', () => {
  const room = createRoom();
  applyPeerMessage(room, peer('a', true), 0);
  assert.equal(summarizeRoom(room).isEveryoneHolding, false);
});

test('alla håller först när den sista trycker', () => {
  const room = createRoom();
  applyPeerMessage(room, peer('a', true), 100);
  applyPeerMessage(room, peer('b', false), 110);
  assert.equal(summarizeRoom(room).isEveryoneHolding, false);
  applyPeerMessage(room, peer('b', true), 350);
  const summary = summarizeRoom(room);
  assert.equal(summary.isEveryoneHolding, true);
  assert.equal(summary.pressSpreadMs, 250);
});

test('ett upprepat meddelande flyttar inte tiden för trycket', () => {
  const room = createRoom();
  applyPeerMessage(room, peer('a', true), 100);
  applyPeerMessage(room, peer('b', true), 150);
  applyPeerMessage(room, peer('a', true), 2100);
  assert.equal(summarizeRoom(room).pressSpreadMs, 50);
});

test('den som släpper bryter att alla håller', () => {
  const room = createRoom();
  applyPeerMessage(room, peer('a', true), 0);
  applyPeerMessage(room, peer('b', true), 0);
  applyPeerMessage(room, peer('a', false), 500);
  assert.equal(summarizeRoom(room).isEveryoneHolding, false);
});

test('en tyst mobil tas bort efter tidsgränsen', () => {
  const room = createRoom();
  applyPeerMessage(room, peer('a', true), 0);
  applyPeerMessage(room, peer('b', true), 5000);
  dropSilentPeers(room, PEER_TIMEOUT_MS + 1);
  assert.deepEqual(summarizeRoom(room).peers.map((known) => known.id), ['b']);
});

test('mobilerna visas i namnordning', () => {
  const room = createRoom();
  applyPeerMessage(room, { id: '1', name: 'Örjan', isHolding: false }, 0);
  applyPeerMessage(room, { id: '2', name: 'Anna', isHolding: false }, 0);
  assert.deepEqual(summarizeRoom(room).peers.map((known) => known.name), ['Anna', 'Örjan']);
});

test('tur och retur sammanfattas med median och högsta värde', () => {
  assert.deepEqual(summarizeRoundTrips([80, 200, 60]), { count: 3, medianMs: 80, maxMs: 200 });
  assert.deepEqual(summarizeRoundTrips([10, 30]), { count: 2, medianMs: 20, maxMs: 30 });
  assert.equal(summarizeRoundTrips([]), null);
});
