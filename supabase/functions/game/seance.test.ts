import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  BOARD_LETTERS, GLOW_PAUSE_MS, START_CELL, type BoardTouch, type SeanceState,
  advanceSeance, applyBoardTouch, describeSeance, findCellCenter, findGlowPoint, findSegment, hasSeanceChanged, splitMessage, startSeance,
} from './seance.ts';
import type { PlayerRecord } from './state.ts';

const MESSAGE = 'JA NEJ';
const LETTERS = splitMessage(MESSAGE);
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));
const IDS = PLAYERS.map((player) => player.id);

function touch(seance: SeanceState, playerId: string, kind: BoardTouch, nowMs: number) {
  return applyBoardTouch({ seance, message: MESSAGE, participantIds: IDS, playerId, touch: kind, nowMs });
}

function everyoneOn(seance: SeanceState, nowMs: number) {
  return IDS.reduce((current, id) => touch(current, id, 'onGlow', nowMs), seance);
}

function describe(seance: SeanceState, viewerId: string) {
  return describeSeance({ seance, message: MESSAGE, players: PLAYERS, participantIds: IDS, viewerId });
}

/** Tiden då skenet når bokstaven, om alla följer från nowMs. */
function arrival(seance: SeanceState, nowMs: number): number {
  const { durationMs } = findSegment(LETTERS, seance.letterIndex);
  return Math.max(nowMs, seance.pauseUntilMs ?? 0) + (1 - seance.progress) * durationMs;
}

/** Alla följer, och skenet når nästa bokstav. Ger tillståndet och tiden. */
function takeNextLetter(seance: SeanceState, nowMs: number): { seance: SeanceState; nowMs: number } {
  const following = everyoneOn(seance, nowMs);
  const arrivedAt = arrival(following, nowMs);
  return { seance: touch(following, 'p0', 'arrived', arrivedAt), nowMs: arrivedAt };
}

test('meddelandet delas i bokstäver, och den första i varje ord märks', () => {
  assert.deepEqual(LETTERS.map(({ letter, startsWord }) => `${letter}${startsWord ? '!' : ''}`), ['J!', 'A', 'N!', 'E', 'J']);
});

test('brädet har alla bokstäver från A till Ö och en startruta', () => {
  assert.equal(BOARD_LETTERS.length, 29);
  assert.equal(START_CELL, 29);
  assert.deepEqual(findCellCenter(0), { x: 0.1, y: 1 / 12 });
});

test('skenet står still tills alla följer, och glider sedan långsamt mot bokstaven', () => {
  let seance = touch(touch(startSeance(PLAYERS), 'p0', 'onGlow', 1000), 'p1', 'onGlow', 1000);
  seance = advanceSeance({ seance, message: MESSAGE, participantIds: IDS, nowMs: 60_000 });
  assert.equal(seance.progress, 0);
  assert.equal(describe(seance, 'p0').movesFromMs, null);

  seance = touch(seance, 'p2', 'onGlow', 61_000);
  const { durationMs } = findSegment(LETTERS, 0);
  // Från startrutan längst ner till höger till J är det långt, så skenet tar flera sekunder.
  assert.ok(durationMs > 4000, String(durationMs));
  const halfway = advanceSeance({ seance, message: MESSAGE, participantIds: IDS, nowMs: 61_000 + durationMs / 2 });
  assert.ok(Math.abs(halfway.progress - 0.5) < 1e-9);
  assert.equal(halfway.letterIndex, 0);
});

test('halkar någon efter stannar skenet där det är, och fortsätter när hon är med igen', () => {
  let seance = everyoneOn(startSeance(PLAYERS), 0);
  const { durationMs } = findSegment(LETTERS, 0);
  seance = touch(seance, 'p1', 'offGlow', durationMs / 4);
  seance = advanceSeance({ seance, message: MESSAGE, participantIds: IDS, nowMs: durationMs * 10 });
  assert.ok(Math.abs(seance.progress - 0.25) < 1e-9);
  assert.equal(seance.letterIndex, 0);
  seance = touch(seance, 'p1', 'onGlow', 100_000);
  seance = advanceSeance({ seance, message: MESSAGE, participantIds: IDS, nowMs: 100_000 + durationMs * 0.75 });
  assert.equal(seance.letterIndex, 1);
});

test('mobilen räknar fram samma läge för skenet som servern', () => {
  const seance = everyoneOn(startSeance(PLAYERS), 0);
  const { durationMs, from, to } = findSegment(LETTERS, 0);
  const view = describe(seance, 'p0');
  const glow = findGlowPoint(view, durationMs / 2);
  assert.ok(Math.abs(glow.point.x - (from.x + to.x) / 2) < 1e-9 && !glow.hasArrived);
  assert.deepEqual(findGlowPoint(view, durationMs), { point: to, hasArrived: true });
  // Står skenet still syns det där det stannade, hur lång tid som än går.
  const stopped = touch(seance, 'p2', 'offGlow', durationMs / 2);
  assert.ok(Math.abs(findGlowPoint(describe(stopped, 'p0'), 10 * durationMs).point.x - (from.x + to.x) / 2) < 1e-9);
});

test('när skenet når bokstaven syns den uppförstorad bara hos den som ska läsa den, och turen går runt', () => {
  let round = takeNextLetter(startSeance(PLAYERS), 0);
  assert.equal(round.seance.letterIndex, 1);
  assert.deepEqual(IDS.map((id) => describe(round.seance, id).myLetter?.letter ?? null), ['J', null, null]);
  assert.equal(describe(round.seance, 'p1').takenCell, BOARD_LETTERS.indexOf('J'));
  round = takeNextLetter(round.seance, round.nowMs);
  assert.deepEqual(IDS.map((id) => describe(round.seance, id).myLetter?.letter ?? null), [null, 'A', null]);
  round = takeNextLetter(round.seance, round.nowMs);
  assert.deepEqual(describe(round.seance, 'p2').myLetter, { letter: 'N', startsWord: true });
});

test('skenet står kvar på bokstaven en stund innan det glider vidare', () => {
  const { seance, nowMs } = takeNextLetter(startSeance(PLAYERS), 0);
  assert.equal(seance.pauseUntilMs, nowMs + GLOW_PAUSE_MS);
  const view = describe(seance, 'p0');
  assert.deepEqual(findGlowPoint(view, nowMs + GLOW_PAUSE_MS / 2).point, findSegment(LETTERS, 1).from);
  const paused = advanceSeance({ seance, message: MESSAGE, participantIds: IDS, nowMs: nowMs + GLOW_PAUSE_MS / 2 });
  assert.equal(paused.progress, 0);
});

test('ingen vy innehåller hela meddelandet, och varje bokstav förstoras hos exakt en', () => {
  let round = { seance: startSeance(PLAYERS), nowMs: 0 };
  const seen: string[] = [];
  while (!describe(round.seance, 'p0').isComplete) {
    round = takeNextLetter(round.seance, round.nowMs);
    const letters = IDS.map((id) => describe(round.seance, id).myLetter?.letter).filter((letter) => letter !== undefined);
    assert.equal(letters.length, 1);
    seen.push(...letters);
    for (const id of IDS) assert.ok(!JSON.stringify(describe(round.seance, id)).includes(MESSAGE));
  }
  assert.equal(seen.join(''), 'JANEJ');
});

test('att lyfta fingret får meddelandet att börja om från starten och visar vem som släppte', () => {
  const { seance, nowMs } = takeNextLetter(startSeance(PLAYERS), 0);
  const broken = touch(seance, 'p1', 'lifted', nowMs + 7000);
  assert.equal(broken.letterIndex, 0);
  assert.deepEqual(broken.followerIds, []);
  const view = describe(broken, 'p0');
  assert.deepEqual(view.brokenBy, { name: 'Bo', atMs: nowMs + 7000 });
  assert.equal(view.myLetter, null);
  assert.deepEqual(findGlowPoint(view, nowMs + 9000).point, findCellCenter(START_CELL));
});

test('att lyfta innan skenet har rört sig bryter ingenting', () => {
  const seance = touch(touch(startSeance(PLAYERS), 'p0', 'onGlow', 0), 'p0', 'lifted', 0);
  assert.equal(seance.brokenBy, null);
  assert.deepEqual(seance.followerIds, []);
});

test('flera mobiler som säger att skenet har kommit fram ändrar bara något en gång', () => {
  const following = everyoneOn(startSeance(PLAYERS), 0);
  const arrivedAt = arrival(following, 0);
  const first = touch(following, 'p0', 'arrived', arrivedAt);
  const second = touch(first, 'p1', 'arrived', arrivedAt + 50);
  assert.equal(hasSeanceChanged(following, first), true);
  assert.equal(hasSeanceChanged(first, second), false);
});

test('när meddelandet är klart står skenet kvar på sista bokstaven och inget mer händer', () => {
  let round = { seance: startSeance(PLAYERS), nowMs: 0 };
  for (let letter = 0; letter < LETTERS.length; letter += 1) round = takeNextLetter(round.seance, round.nowMs);
  assert.equal(touch(round.seance, 'p0', 'lifted', round.nowMs + 1).brokenBy, null);
  const view = describe(round.seance, 'p0');
  assert.ok(view.isComplete);
  assert.deepEqual(findGlowPoint(view, round.nowMs + 60_000).point, findCellCenter(BOARD_LETTERS.indexOf('J')));
});

test('två lika bokstäver i rad tas utan att skenet behöver flytta sig', () => {
  const letters = splitMessage('ALLA');
  assert.equal(findSegment(letters, 2).durationMs, 0);
  let seance = startSeance(PLAYERS);
  let nowMs = 0;
  for (let letter = 0; letter < letters.length; letter += 1) {
    seance = IDS.reduce((current, id) => applyBoardTouch({ seance: current, message: 'ALLA', participantIds: IDS, playerId: id, touch: 'onGlow', nowMs }), seance);
    nowMs += 60_000;
    seance = applyBoardTouch({ seance, message: 'ALLA', participantIds: IDS, playerId: 'p0', touch: 'arrived', nowMs });
  }
  assert.equal(seance.letterIndex, 4);
});
