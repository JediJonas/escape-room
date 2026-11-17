import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createGameWithPlayers, readGameView, send } from './memoryStore.ts';
import { ROOM_FORGETS_MS } from './rooms.ts';

test('i Rummen minns får bara rummets spelare och spelledaren en ny vy efter ett fel val', async () => {
  const memory = await createGameWithPlayers(['Bo', 'Cia']);
  const gameId = memory.games[0].id;
  await send(memory.store, 'user-leader', { type: 'startGame', gameId, missionId: 'den-femte-gasten' });
  let view = readGameView((await send(memory.store, 'user-leader', { type: 'getView', gameId })).body);
  while (view.step.type !== 'rooms') view = readGameView((await send(memory.store, 'user-leader', { type: 'nextStep', gameId })).body);
  // Med tre spelare har Cia biblioteket ensam.
  const cia = readGameView((await send(memory.store, 'user-Cia', { type: 'choosePlace', gameId, placeId: 'D', source: 'list' })).body);
  assert.equal(cia.step.rooms?.current?.place.name, 'Biblioteket');

  memory.sentViews.length = 0;
  const wrong = readGameView((await send(memory.store, 'user-Cia', { type: 'chooseGuest', gameId, guest: 'Vera' })).body);
  assert.equal(wrong.step.rooms?.current?.forgetsUntilMs, memory.clock.nowMs + ROOM_FORGETS_MS);
  assert.equal(memory.sentViews.length, 2);
  assert.deepEqual(await send(memory.store, 'user-Cia', { type: 'chooseGuest', gameId, guest: 'Margit' }), { status: 409, body: { error: 'roomForgets' } });

  memory.clock.nowMs += ROOM_FORGETS_MS;
  memory.sentViews.length = 0;
  const right = readGameView((await send(memory.store, 'user-Cia', { type: 'chooseGuest', gameId, guest: 'Margit' })).body);
  assert.equal(right.step.rooms?.current?.guest, 'Margit');
  assert.equal(memory.sentViews.length, 3);
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'chooseGuest', gameId, guest: 'Sven' }), { status: 409, body: { error: 'notAtPlace' } });
});

test('i källaren tänder de andra lampan, den instängda hittar dörren och alla trycker Klar', async () => {
  const memory = await createGameWithPlayers(['Bo', 'Cia']);
  const gameId = memory.games[0].id;
  await send(memory.store, 'user-leader', { type: 'startGame', gameId, missionId: 'den-femte-gasten' });
  let view = readGameView((await send(memory.store, 'user-leader', { type: 'getView', gameId })).body);
  while (view.step.type !== 'cellar') view = readGameView((await send(memory.store, 'user-leader', { type: 'nextStep', gameId })).body);
  const users = ['user-leader', 'user-Bo', 'user-Cia'];
  const views = await Promise.all(users.map(async (user) => readGameView((await send(memory.store, user, { type: 'getView', gameId })).body)));
  const trappedUser = users[views.findIndex((candidate) => candidate.step.cellar?.isTrapped)];
  const guideUser = users.find((user) => user !== trappedUser)!;
  assert.deepEqual(await send(memory.store, guideUser, { type: 'moveInCellar', gameId, move: { type: 'flipFuse' } }), { status: 409, body: { error: 'notAtPlace' } });

  const arrived = readGameView((await send(memory.store, trappedUser, { type: 'choosePlace', gameId, placeId: 'A', source: 'list' })).body);
  assert.equal(arrived.step.cellar?.image, 'testsida/rundbilder/kallare-stor.webp');
  assert.equal(arrived.step.cellar?.catchMs, memory.clock.nowMs + 4 * 60_000);
  const lit = readGameView((await send(memory.store, guideUser, { type: 'moveInCellar', gameId, move: { type: 'flipFuse' } })).body);
  assert.equal(lit.step.cellar?.fusesLeft, 2);
  assert.equal(lit.step.cellar?.image, null);

  const found = readGameView((await send(memory.store, trappedUser, { type: 'moveInCellar', gameId, move: { type: 'openDoor', yawDeg: -170 } })).body);
  assert.equal(found.step.cellar?.outcome, 'found');
  assert.equal(found.step.usesReadyButton, true);
  for (const user of users) view = readGameView((await send(memory.store, user, { type: 'markReady', gameId })).body);
  assert.equal(view.step.cellar, null);
  assert.deepEqual(memory.games[0].state.marks, []);
});
