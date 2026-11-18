import assert from 'node:assert/strict';
import { test } from 'vitest';
import { createGameWithPlayers, readGameView, send } from './memoryStore.ts';

test('golvuret och minnet syns hos alla, och en mobil som säger att minnet har bleknat ändrar bara en gång', async () => {
  const memory = await createGameWithPlayers(['Bo', 'Cia']);
  const gameId = memory.games[0].id;
  await send(memory.store, 'user-leader', { type: 'startGame', gameId, missionId: 'den-femte-gasten' });
  let view = readGameView((await send(memory.store, 'user-leader', { type: 'getView', gameId })).body);
  while (view.step.type !== 'flashback') view = readGameView((await send(memory.store, 'user-leader', { type: 'nextStep', gameId })).body);
  assert.equal(view.step.opensFrom, 'Golvuret');
  assert.deepEqual(await send(memory.store, 'user-Bo', { type: 'turnClock', gameId, minutes: 600 }), { status: 409, body: { error: 'notAtPlace' } });
  await send(memory.store, 'user-Bo', { type: 'walk', gameId, placeId: 'F' });

  memory.sentViews.length = 0;
  const turned = readGameView((await send(memory.store, 'user-Bo', { type: 'turnClock', gameId, minutes: 600 })).body);
  assert.equal(turned.step.flashback?.dialMinutes, 600);
  assert.equal(memory.sentViews.length, 3);
  const remembering = readGameView((await send(memory.store, 'user-Bo', { type: 'turnClock', gameId, minutes: 555 })).body);
  assert.ok(remembering.step.flashback?.remembersUntilMs);
  const chosen = readGameView((await send(memory.store, 'user-Cia', { type: 'chooseFlashbackRoom', gameId, placeId: 'D' })).body);
  assert.equal(chosen.step.flashback?.myRooms[0]?.place.name, 'Biblioteket');
  assert.equal(chosen.house?.room.name, 'Biblioteket');
  assert.deepEqual(await send(memory.store, 'user-Cia', { type: 'walk', gameId, placeId: 'B' }), { status: 409, body: { error: 'houseRemembers' } });

  memory.clock.nowMs += 3 * 60_000;
  memory.sentViews.length = 0;
  const faded = readGameView((await send(memory.store, 'user-Cia', { type: 'fadeFlashback', gameId })).body);
  assert.equal(faded.step.flashback?.remembersUntilMs, null);
  assert.equal(faded.step.flashback?.dialMinutes, 280);
  assert.equal(memory.sentViews.length, 3);
  memory.sentViews.length = 0;
  await send(memory.store, 'user-Bo', { type: 'fadeFlashback', gameId });
  assert.equal(memory.sentViews.length, 1);
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

  // Den som ska ner går genom källardörren i hallen. För de andra är den låst (Jonas 2026-11-18).
  const trappedView = views[users.indexOf(trappedUser)];
  const trappedName = trappedView.me.name;
  assert.equal(trappedView.step.cellar?.goDownText, 'Du går ner i källaren.');
  assert.equal(views[users.indexOf(guideUser)].step.cellar?.goDownText, `${trappedName} går ner i källaren.`);
  assert.deepEqual(await send(memory.store, guideUser, { type: 'walk', gameId, placeId: 'A' }), { status: 409, body: { error: 'locked' } });
  const arrived = readGameView((await send(memory.store, trappedUser, { type: 'walk', gameId, placeId: 'A' })).body);
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
