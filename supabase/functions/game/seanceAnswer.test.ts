import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildGameView, startGame, submitAnswer } from './game.ts';
import { type Mission, type SeanceStep, findMissionErrors } from './mission.ts';
import { getMission } from './missions/index.ts';
import { touchBoard } from './taskActions.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

const STEP: SeanceStep = {
  id: 'vem-ar-jag',
  type: 'seance',
  text: 'Följ skenet.',
  callsFromHouse: true,
  question: 'Vem är hon?',
  wrongAnswerMinutes: 2,
  hints: ['a', 'b', 'c'],
  solution: { message: 'VEM', answers: ['Vera', 'Vera Sjö'] },
};
const FULL = getMission('den-femte-gasten')!;
const MISSION: Mission = {
  ...FULL,
  house: { start: 'F', rooms: [{ place: 'F', doors: [], things: [{ id: 'bradet', name: 'Ouijabrädet', opensSteps: ['vem-ar-jag'], isFoundFromStart: true }] }] },
  steps: [STEP, { id: 'slut', type: 'scene', text: 'Slut.' }],
};
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));
const MINUTE_MS = 60_000;

function readState(change: { state: GameState } | { refusal: string }): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

function viewOf(state: GameState) {
  return buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer: PLAYERS[1] });
}

function followWholeMessage(started: GameState): GameState {
  let state = started;
  let nowMs = 0;
  while (!viewOf(state).step.seance?.isComplete) {
    for (const player of PLAYERS) state = readState(touchBoard({ state, mission: MISSION, players: PLAYERS, player, touch: 'onGlow', nowMs }));
    nowMs += MINUTE_MS;
    state = readState(touchBoard({ state, mission: MISSION, players: PLAYERS, player: PLAYERS[0], touch: 'arrived', nowMs }));
  }
  return state;
}

test('brädet kallar från huset tills meddelandet är klart, och sedan står frågan kvar i stället för Klar', () => {
  const started = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
  assert.equal(viewOf(started).house?.things[0].isCalling, true);
  assert.equal(viewOf(started).step.acceptsAnswer, false);
  assert.equal(viewOf(started).step.question, null);
  assert.deepEqual(submitAnswer({ state: started, mission: MISSION, players: PLAYERS, answer: 'Vera' }), { refusal: 'notATask' });
  const complete = followWholeMessage(started);
  const view = viewOf(complete);
  assert.equal(view.house?.things[0].isCalling, false);
  assert.equal(view.step.usesReadyButton, false);
  assert.equal(view.step.acceptsAnswer, true);
  assert.equal(view.step.question, 'Vem är hon?');
  assert.deepEqual(view.step.wrongAnswers, { count: 0, nextMinutes: 2 });
});

test('ett fel namn kostar tid för alla, mer för varje fel, och rätt namn för gruppen vidare', () => {
  const started = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
  const complete = followWholeMessage(started);
  const wrong = readState(submitAnswer({ state: complete, mission: MISSION, players: PLAYERS, answer: 'Margit' }));
  assert.equal(wrong.clock?.durationMs, 58 * MINUTE_MS);
  assert.deepEqual(viewOf(wrong).step.wrongAnswers, { count: 1, nextMinutes: 4 });
  const wrongAgain = readState(submitAnswer({ state: wrong, mission: MISSION, players: PLAYERS, answer: 'Arvid' }));
  assert.equal(wrongAgain.clock?.durationMs, 54 * MINUTE_MS);
  assert.deepEqual(viewOf(wrongAgain).step.wrongAnswers, { count: 2, nextMinutes: 6 });
  assert.deepEqual(submitAnswer({ state: wrong, mission: MISSION, players: PLAYERS, answer: '  ' }), { refusal: 'wrongAnswer' });
  const right = readState(submitAnswer({ state: wrong, mission: MISSION, players: PLAYERS, answer: ' vera  sjö ' }));
  assert.equal(right.status, 'finished');
});

test('en seans med svar behöver både fråga och svar, och kostnaden kräver svar', () => {
  const mission = (step: object) => ({ ...MISSION, steps: [{ ...STEP, ...step }] });
  assert.deepEqual(findMissionErrors(mission({})), []);
  assert.match(findMissionErrors(mission({ question: undefined })).join(), /både en fråga och svar/);
  assert.match(findMissionErrors(mission({ solution: { message: 'VEM', answers: [] } })).join(), /tomma svar/);
  assert.match(findMissionErrors(mission({ question: undefined, wrongAnswerMinutes: 2, solution: { message: 'VEM' } })).join(), /kostnad för fel svar/);
  assert.match(findMissionErrors(mission({ callsFromHouse: 'ja' })).join(), /callsFromHouse/);
});

test('den som står i ett annat rum får veta att brädet kallar, och den som står vid brädet ser det skimra', () => {
  const house = {
    start: 'B' as const,
    rooms: [
      { place: 'F' as const, doors: ['B' as const], things: [{ id: 'bradet', name: 'Ouijabrädet', opensSteps: ['vem-ar-jag'], callingText: 'Från salongen hörs planchetten.', isFoundFromStart: true }] },
      { place: 'B' as const, doors: ['F' as const], things: [] },
    ],
  };
  const mission: Mission = { ...MISSION, house };
  assert.deepEqual(findMissionErrors(mission), []);
  const started = readState(startGame({ state: createInitialState(), mission, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
  const view = (state: GameState) => buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: mission.id, state }, mission, players: PLAYERS, viewer: PLAYERS[1] });
  assert.equal(view(started).house?.callingFrom, 'Från salongen hörs planchetten.');
  const atBoard = { ...started, placeByPlayer: { ...started.placeByPlayer, [PLAYERS[1].id]: 'F' as const } };
  assert.equal(view(atBoard).house?.callingFrom, null);
  assert.equal(view(atBoard).house?.things[0].isCalling, true);
  const withoutText: Mission = { ...mission, house: { ...house, rooms: [{ ...house.rooms[0], things: [{ id: 'bradet', name: 'Ouijabrädet', opensSteps: ['vem-ar-jag'], isFoundFromStart: true }] }, house.rooms[1]] } };
  const generic = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: mission.id, state: started }, mission: withoutText, players: PLAYERS, viewer: PLAYERS[1] });
  assert.equal(generic.house?.callingFrom, 'Något rör sig vid ouijabrädet i salongen.');
});
