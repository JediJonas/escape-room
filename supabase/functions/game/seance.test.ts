import assert from 'node:assert/strict';
import { test } from 'vitest';
import { GLOW_PAUSE_MS, type SeanceState, applyBoardTouch, describeSeance, findGlowCell, splitMessage, startSeance } from './seance.ts';
import type { PlayerRecord } from './state.ts';

const MESSAGE = 'JA NEJ';
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));
const IDS = PLAYERS.map((player) => player.id);

function touch(seance: SeanceState, playerId: string, kind: 'onGlow' | 'offGlow' | 'lifted', nowMs = 1000) {
  return applyBoardTouch({ seance, message: MESSAGE, participantIds: IDS, playerId, touch: kind, letterIndex: seance.letterIndex, nowMs });
}

function everyoneOn(seance: SeanceState, nowMs = 1000) {
  return IDS.reduce((current, id) => touch(current, id, 'onGlow', nowMs), seance);
}

function describe(seance: SeanceState, viewerId: string) {
  return describeSeance({ seance, stepId: 'seansen', message: MESSAGE, players: PLAYERS, participantCount: PLAYERS.length, viewerId });
}

test('meddelandet delas i bokstäver, och den första i varje ord märks', () => {
  assert.deepEqual(splitMessage('JA NEJ').map(({ letter, startsWord }) => `${letter}${startsWord ? '!' : ''}`), ['J!', 'A', 'N!', 'E', 'J']);
});

test('bokstaven tas först när allas planchetter är på skenet', () => {
  let seance = startSeance(PLAYERS);
  seance = touch(seance, 'p0', 'onGlow');
  seance = touch(seance, 'p1', 'onGlow');
  assert.equal(seance.letterIndex, 0);
  assert.equal(describe(seance, 'p2').followerCount, 2);
  seance = touch(seance, 'p2', 'onGlow', 5000);
  assert.equal(seance.letterIndex, 1);
  assert.deepEqual(seance.followerIds, []);
  assert.equal(seance.glowMovesAtMs, 5000 + GLOW_PAUSE_MS);
});

test('den som glider av skenet räknas inte, och skenet väntar på henne', () => {
  let seance = touch(touch(startSeance(PLAYERS), 'p0', 'onGlow'), 'p1', 'onGlow');
  seance = touch(seance, 'p0', 'offGlow');
  seance = touch(seance, 'p2', 'onGlow');
  assert.equal(seance.letterIndex, 0);
  assert.equal(touch(seance, 'p0', 'onGlow').letterIndex, 1);
});

test('bokstaven syns bara hos den som ska läsa den, och turen går runt', () => {
  let seance = everyoneOn(startSeance(PLAYERS));
  assert.deepEqual(IDS.map((id) => describe(seance, id).myLetter?.letter ?? null), ['J', null, null]);
  seance = everyoneOn(seance);
  assert.deepEqual(IDS.map((id) => describe(seance, id).myLetter?.letter ?? null), [null, 'A', null]);
  seance = everyoneOn(seance);
  assert.deepEqual(describe(seance, 'p2').myLetter, { letter: 'N', startsWord: true });
  seance = everyoneOn(everyoneOn(seance));
  assert.deepEqual(describe(seance, 'p1').myLetter, { letter: 'J', startsWord: false });
  assert.ok(describe(seance, 'p0').isComplete);
});

test('ingen vy innehåller meddelandet eller någon annans bokstav', () => {
  let seance = startSeance(PLAYERS);
  const seen: string[] = [];
  while (!describe(seance, 'p0').isComplete) {
    seance = everyoneOn(seance);
    const letters = IDS.map((id) => describe(seance, id).myLetter?.letter).filter((letter) => letter !== undefined);
    assert.equal(letters.length, 1);
    seen.push(...letters);
    for (const id of IDS) assert.ok(!JSON.stringify(describe(seance, id)).includes(MESSAGE));
  }
  assert.equal(seen.join(''), 'JANEJ');
});

test('att lyfta fingret får meddelandet att börja om och visar vem som släppte', () => {
  const started = everyoneOn(everyoneOn(startSeance(PLAYERS)));
  const broken = touch(started, 'p1', 'lifted', 7000);
  assert.equal(broken.letterIndex, 0);
  assert.equal(broken.glowMovesAtMs, null);
  assert.deepEqual(describe(broken, 'p0').brokenBy, { name: 'Bo', atMs: 7000 });
  assert.equal(describe(broken, 'p0').myLetter, null);
  assert.equal(describe(broken, 'p0').glowCell, findGlowCell('seansen', 0));
});

test('att lyfta före första bokstaven bryter ingenting', () => {
  const seance = touch(touch(startSeance(PLAYERS), 'p0', 'onGlow'), 'p0', 'lifted');
  assert.equal(seance.brokenBy, null);
  assert.deepEqual(seance.followerIds, []);
});

test('en handling för en äldre bokstav har kommit för sent och ändrar ingenting', () => {
  const seance = touch(everyoneOn(startSeance(PLAYERS)), 'p0', 'onGlow');
  const late = applyBoardTouch({ seance, message: MESSAGE, participantIds: IDS, playerId: 'p1', touch: 'offGlow', letterIndex: 0, nowMs: 2000 });
  assert.equal(late, seance);
});

test('skenet glider från förra bokstaven till nästa och flyttar sig alltid', () => {
  const seance = everyoneOn(startSeance(PLAYERS), 3000);
  const view = describe(seance, 'p1');
  assert.equal(view.previousCell, findGlowCell('seansen', 0));
  assert.equal(view.glowCell, findGlowCell('seansen', 1));
  assert.equal(view.glowMovesAtMs, 3000 + GLOW_PAUSE_MS);
  for (let index = 1; index < 50; index += 1) assert.notEqual(findGlowCell('x', index), findGlowCell('x', index - 1));
});

test('när meddelandet är klart händer inget mer', () => {
  let seance = startSeance(PLAYERS);
  for (let letter = 0; letter < splitMessage(MESSAGE).length; letter += 1) seance = everyoneOn(seance);
  assert.equal(touch(seance, 'p0', 'lifted'), seance);
  assert.equal(describe(seance, 'p0').previousCell, null);
});
