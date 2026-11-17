import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, choosePlace, markReady, setPaused, startGame } from './game.ts';
import { getMission } from './missions/index.ts';
import { type GameRecord, type GameState, type PlayerRecord, createInitialState } from './state.ts';

const MISSION = getMission('prov')!;
const LEADER: PlayerRecord = { id: 'p1', gameId: 'g', userId: 'u1', name: 'Ledare', isLeader: true, joinedAtMs: 1 };
const GUEST: PlayerRecord = { ...LEADER, id: 'p2', userId: 'u2', name: 'Gäst', isLeader: false, joinedAtMs: 2 };
const KITCHEN_STEP_INDEX = MISSION.steps.findIndex((step) => step.goTo === 'C');

function readState(change: ReturnType<typeof startGame>): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

test('starten sparar valet om platskort och börjar på första steget', () => {
  const state = readState(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER, GUEST], starter: LEADER, usesPlaceCards: false, minutes: 45, nowMs: 1000 }));
  assert.deepEqual(state, { ...createInitialState(), status: 'running', usesPlaceCards: false, clock: { durationMs: 45 * 60_000, startedAtMs: 1000, pausedAtMs: null, pausedTotalMs: 0 } });
});

test('en spelare kan inte starta eller gå vidare, och spelet startar inte med för få', () => {
  assert.deepEqual(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER, GUEST], starter: GUEST, usesPlaceCards: true, minutes: 60, nowMs: 0 }), { refusal: 'notLeader' });
  assert.deepEqual(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER], starter: LEADER, usesPlaceCards: true, minutes: 60, nowMs: 0 }), { refusal: 'tooFewPlayers' });
  const running: GameState = { ...createInitialState(), status: 'running' };
  assert.deepEqual(advanceStep({ state: running, mission: MISSION, players: [LEADER, GUEST], player: GUEST }), { refusal: 'notLeader' });
});

test('efter sista steget är spelet slut och står kvar på sista steget', () => {
  const lastIndex = MISSION.steps.length - 1;
  const state = readState(advanceStep({ state: { ...createInitialState(), status: 'running', stepIndex: lastIndex }, mission: MISSION, players: [LEADER, GUEST], player: LEADER }));
  assert.deepEqual({ status: state.status, stepIndex: state.stepIndex }, { status: 'finished', stepIndex: lastIndex });
});

test('platsen sparas per spelare och bara texten för den egna platsen syns', () => {
  const running: GameState = { ...createInitialState(), status: 'running', stepIndex: KITCHEN_STEP_INDEX };
  const state = readState(choosePlace({ state: running, mission: MISSION, players: [LEADER, GUEST], player: GUEST, placeId: 'C' }));
  assert.deepEqual(state.placeByPlayer, { p2: 'C' });
  const game: GameRecord = { id: 'g', joinCode: 'BCDF', missionId: 'prov', state };
  const guestView = buildGameView({ game, mission: MISSION, players: [LEADER, GUEST], viewer: GUEST });
  const leaderView = buildGameView({ game, mission: MISSION, players: [LEADER, GUEST], viewer: LEADER });
  assert.equal(guestView.step.textAtPlace, MISSION.steps[KITCHEN_STEP_INDEX].textAtPlace);
  assert.equal(leaderView.step.textAtPlace, null);
  assert.equal(leaderView.myPlace, null);
  // Ingen vy berättar var de andra är.
  assert.ok(!JSON.stringify(leaderView).includes('p2'));
});

const HALL_STEP_INDEX = MISSION.steps.findIndex((step) => step.goTo === 'B');
const PLAYERS = [LEADER, GUEST];

function runningAt(stepIndex: number): GameState {
  return { ...createInitialState(), status: 'running', stepIndex };
}

test('scenen går vidare först när alla har tryckt Klar', () => {
  const first = readState(markReady({ state: runningAt(0), mission: MISSION, players: PLAYERS, player: GUEST }));
  assert.deepEqual({ stepIndex: first.stepIndex, ready: first.readyPlayerIds }, { stepIndex: 0, ready: ['p2'] });
  // Att trycka två gånger räknas en gång.
  assert.deepEqual(readState(markReady({ state: first, mission: MISSION, players: PLAYERS, player: GUEST })), first);
  const game: GameRecord = { id: 'g', joinCode: 'BCDF', missionId: 'prov', state: first };
  const leaderView = buildGameView({ game, mission: MISSION, players: PLAYERS, viewer: LEADER });
  assert.deepEqual(leaderView.progress, [{ name: 'Ledare', isMe: true, isDone: false }, { name: 'Gäst', isMe: false, isDone: true }]);
  assert.equal(buildGameView({ game, mission: MISSION, players: PLAYERS, viewer: GUEST }).progress, null);
  const second = readState(markReady({ state: first, mission: MISSION, players: PLAYERS, player: LEADER }));
  assert.deepEqual({ stepIndex: second.stepIndex, ready: second.readyPlayerIds }, { stepIndex: 1, ready: [] });
});

test('med text på platsen trycker man Klar först när man är framme', () => {
  assert.deepEqual(markReady({ state: runningAt(KITCHEN_STEP_INDEX), mission: MISSION, players: PLAYERS, player: GUEST }), { refusal: 'notAtPlace' });
  let state = runningAt(KITCHEN_STEP_INDEX);
  for (const player of PLAYERS) state = readState(choosePlace({ state, mission: MISSION, players: PLAYERS, player, placeId: 'C' }));
  // Alla är framme men har inte läst lappen än.
  assert.equal(state.stepIndex, KITCHEN_STEP_INDEX);
  for (const player of PLAYERS) state = readState(markReady({ state, mission: MISSION, players: PLAYERS, player }));
  assert.equal(state.stepIndex, KITCHEN_STEP_INDEX + 1);
});

test('en scen som bara skickar alla till en plats går vidare när den sista är framme', () => {
  let state = runningAt(HALL_STEP_INDEX);
  state = readState(choosePlace({ state, mission: MISSION, players: PLAYERS, player: LEADER, placeId: 'B' }));
  state = readState(choosePlace({ state, mission: MISSION, players: PLAYERS, player: GUEST, placeId: 'A' }));
  assert.equal(state.stepIndex, HALL_STEP_INDEX);
  const game: GameRecord = { id: 'g', joinCode: 'BCDF', missionId: 'prov', state };
  const view = buildGameView({ game, mission: MISSION, players: PLAYERS, viewer: LEADER });
  assert.deepEqual({ usesReadyButton: view.step.usesReadyButton, isMeDone: view.step.isMeDone }, { usesReadyButton: false, isMeDone: true });
  state = readState(choosePlace({ state, mission: MISSION, players: PLAYERS, player: GUEST, placeId: 'B' }));
  assert.equal(state.stepIndex, HALL_STEP_INDEX + 1);
});

test('bara spelledaren pausar, och vyn visar tiden som är kvar', () => {
  const started = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: LEADER, usesPlaceCards: true, minutes: 45, nowMs: 0 }));
  assert.deepEqual(setPaused({ state: started, player: GUEST, isPaused: true, nowMs: 60_000 }), { refusal: 'notLeader' });
  const paused = readState(setPaused({ state: started, player: LEADER, isPaused: true, nowMs: 60_000 }));
  const game: GameRecord = { id: 'g', joinCode: 'BCDF', missionId: 'prov', state: paused };
  assert.deepEqual(buildGameView({ game, mission: MISSION, players: PLAYERS, viewer: GUEST }).clock, { isPaused: true, remainingMs: 44 * 60_000 });
  const resumed = readState(setPaused({ state: paused, player: LEADER, isPaused: false, nowMs: 120_000 }));
  assert.deepEqual(buildGameView({ game: { ...game, state: resumed }, mission: MISSION, players: PLAYERS, viewer: GUEST }).clock, { isPaused: false, endsAtMs: 46 * 60_000 });
});
