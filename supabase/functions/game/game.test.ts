import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, choosePlace, giveHint, markReady, showSolution, startGame, submitAnswer } from './game.ts';
import { endGame, setPaused } from './leaderControls.ts';
import type { Mission } from './mission.ts';
import { getMission } from './missions/index.ts';
import { type GameRecord, type GameState, type PlayerRecord, createInitialState } from './state.ts';

const MISSION = getMission('prov')!;
const LEADER: PlayerRecord = { id: 'p1', gameId: 'g', userId: 'u1', name: 'Ledare', isLeader: true, joinedAtMs: 1 };
const GUEST: PlayerRecord = { ...LEADER, id: 'p2', userId: 'u2', name: 'Gäst', isLeader: false, joinedAtMs: 2 };
/** Ett litet uppdrag med en plats för alla, med och utan text där. */
const PLACE_MISSION: Mission = {
  ...MISSION,
  steps: [
    { id: 'start', type: 'scene', text: 'Start.' },
    { id: 'koket', type: 'scene', text: 'Gå till köket.', goTo: 'C', textAtPlace: 'En lapp där det står 42.' },
    { id: 'hallen', type: 'scene', text: 'Gå till hallen.', goTo: 'B' },
    { id: 'slut', type: 'scene', text: 'Slut.' },
  ],
};
const KITCHEN_STEP_INDEX = 1;
const HALL_STEP_INDEX = 2;

function readState(change: ReturnType<typeof startGame>): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

test('starten sparar valen och börjar på första steget', () => {
  const state = readState(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER, GUEST], starter: LEADER, leaderPlays: true, minutes: 45, nowMs: 1000 }));
  assert.deepEqual(state, { ...createInitialState(), status: 'running', clock: { durationMs: 45 * 60_000, startedAtMs: 1000, pausedAtMs: null, pausedTotalMs: 0 } });
});

test('en spelare kan inte starta eller gå vidare, och spelet startar inte med för få', () => {
  assert.deepEqual(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER, GUEST], starter: GUEST, leaderPlays: true, minutes: 60, nowMs: 0 }), { refusal: 'notLeader' });
  assert.deepEqual(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER], starter: LEADER, leaderPlays: true, minutes: 60, nowMs: 0 }), { refusal: 'tooFewPlayers' });
  const running: GameState = { ...createInitialState(), status: 'running' };
  assert.deepEqual(advanceStep({ state: running, mission: MISSION, players: [LEADER, GUEST], player: GUEST }), { refusal: 'notLeader' });
});

test('spelet tar slut när gruppen kommer till sluttexten, och står kvar där', () => {
  const lastIndex = MISSION.steps.length - 1;
  assert.equal(MISSION.steps[lastIndex].type, 'scene');
  const state = readState(advanceStep({ state: { ...createInitialState(), status: 'running', stepIndex: lastIndex - 1 }, mission: MISSION, players: [LEADER, GUEST], player: LEADER }));
  assert.deepEqual({ status: state.status, stepIndex: state.stepIndex }, { status: 'finished', stepIndex: lastIndex });
  const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: 'prov', state }, mission: MISSION, players: [LEADER, GUEST], viewer: GUEST });
  assert.deepEqual({ isFinished: view.isFinished, text: view.step.text }, { isFinished: true, text: MISSION.steps[lastIndex].text });
});

test('ett spel som tar slut av sig självt är inte avslutat av spelledaren', () => {
  const lastIndex = MISSION.steps.length - 1;
  const state = readState(advanceStep({ state: { ...createInitialState(), status: 'running', stepIndex: lastIndex - 1 }, mission: MISSION, players: [LEADER, GUEST], player: LEADER }));
  const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: 'prov', state }, mission: MISSION, players: [LEADER, GUEST], viewer: GUEST });
  assert.equal(view.isEndedByLeader, false);
});

test('bara spelledaren kan avsluta spelet, och bara medan det är igång', () => {
  const running: GameState = { ...createInitialState(), status: 'running', stepIndex: 1 };
  assert.deepEqual(endGame({ state: running, player: GUEST }), { refusal: 'notLeader' });
  assert.deepEqual(endGame({ state: createInitialState(), player: LEADER }), { refusal: 'notRunning' });
  const state = readState(endGame({ state: running, player: LEADER }));
  assert.deepEqual({ status: state.status, isEndedByLeader: state.isEndedByLeader, stepIndex: state.stepIndex }, { status: 'finished', isEndedByLeader: true, stepIndex: 1 });
  assert.deepEqual(endGame({ state, player: LEADER }), { refusal: 'notRunning' });
});

test('platsen sparas per spelare och bara texten för den egna platsen syns', () => {
  const running: GameState = { ...createInitialState(), status: 'running', stepIndex: KITCHEN_STEP_INDEX };
  const state = readState(choosePlace({ state: running, mission: PLACE_MISSION, players: [LEADER, GUEST], player: GUEST, placeId: 'C', nowMs: 0 }));
  assert.deepEqual(state.placeByPlayer, { p2: 'C' });
  const game: GameRecord = { id: 'g', joinCode: 'BCDF', missionId: 'prov', state };
  const guestView = buildGameView({ game, mission: PLACE_MISSION, players: [LEADER, GUEST], viewer: GUEST });
  const leaderView = buildGameView({ game, mission: PLACE_MISSION, players: [LEADER, GUEST], viewer: LEADER });
  assert.equal(guestView.step.textAtPlace, PLACE_MISSION.steps[KITCHEN_STEP_INDEX].textAtPlace);
  assert.equal(leaderView.step.textAtPlace, null);
  assert.equal(leaderView.myPlace, null);
  // Ingen vy berättar var de andra är.
  assert.ok(!JSON.stringify(leaderView).includes('p2'));
});

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
  assert.equal(buildGameView({ game, mission: MISSION, players: PLAYERS, viewer: LEADER }).step.isMeDone, false);
  assert.equal(buildGameView({ game, mission: MISSION, players: PLAYERS, viewer: GUEST }).step.isMeDone, true);
  const second = readState(markReady({ state: first, mission: MISSION, players: PLAYERS, player: LEADER }));
  assert.deepEqual({ stepIndex: second.stepIndex, ready: second.readyPlayerIds }, { stepIndex: 1, ready: [] });
});

test('med text på platsen trycker man Klar först när man är framme', () => {
  assert.deepEqual(markReady({ state: runningAt(KITCHEN_STEP_INDEX), mission: PLACE_MISSION, players: PLAYERS, player: GUEST }), { refusal: 'notAtPlace' });
  let state = runningAt(KITCHEN_STEP_INDEX);
  for (const player of PLAYERS) state = readState(choosePlace({ state, mission: PLACE_MISSION, players: PLAYERS, player, placeId: 'C', nowMs: 0 }));
  // Alla är framme men har inte läst lappen än.
  assert.equal(state.stepIndex, KITCHEN_STEP_INDEX);
  for (const player of PLAYERS) state = readState(markReady({ state, mission: PLACE_MISSION, players: PLAYERS, player }));
  assert.equal(state.stepIndex, KITCHEN_STEP_INDEX + 1);
});

test('en scen som bara skickar alla till en plats går vidare när den sista är framme', () => {
  let state = runningAt(HALL_STEP_INDEX);
  state = readState(choosePlace({ state, mission: PLACE_MISSION, players: PLAYERS, player: LEADER, placeId: 'B', nowMs: 0 }));
  state = readState(choosePlace({ state, mission: PLACE_MISSION, players: PLAYERS, player: GUEST, placeId: 'A', nowMs: 0 }));
  assert.equal(state.stepIndex, HALL_STEP_INDEX);
  const game: GameRecord = { id: 'g', joinCode: 'BCDF', missionId: 'prov', state };
  const view = buildGameView({ game, mission: PLACE_MISSION, players: PLAYERS, viewer: LEADER });
  assert.deepEqual({ usesReadyButton: view.step.usesReadyButton, isMeDone: view.step.isMeDone }, { usesReadyButton: false, isMeDone: true });
  state = readState(choosePlace({ state, mission: PLACE_MISSION, players: PLAYERS, player: GUEST, placeId: 'B', nowMs: 0 }));
  assert.equal(state.stepIndex, HALL_STEP_INDEX + 1);
});

test('bara spelledaren pausar, och vyn visar tiden som är kvar', () => {
  const started = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: LEADER, leaderPlays: true, minutes: 45, nowMs: 0 }));
  assert.deepEqual(setPaused({ state: started, player: GUEST, isPaused: true, nowMs: 60_000 }), { refusal: 'notLeader' });
  const paused = readState(setPaused({ state: started, player: LEADER, isPaused: true, nowMs: 60_000 }));
  const game: GameRecord = { id: 'g', joinCode: 'BCDF', missionId: 'prov', state: paused };
  assert.deepEqual(buildGameView({ game, mission: MISSION, players: PLAYERS, viewer: GUEST }).clock, { isPaused: true, remainingMs: 44 * 60_000 });
  const resumed = readState(setPaused({ state: paused, player: LEADER, isPaused: false, nowMs: 120_000 }));
  assert.deepEqual(buildGameView({ game: { ...game, state: resumed }, mission: MISSION, players: PLAYERS, viewer: GUEST }).clock, { isPaused: false, endsAtMs: 46 * 60_000 });
});

test('pausen stoppar också minnet, skenet och källaren', () => {
  const started = readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: LEADER, leaderPlays: true, minutes: 45, nowMs: 0 }));
  const timed: GameState = {
    ...started,
    flashback: { dialMinutes: 0, remembersUntilMs: 90_000, choices: [], seenPlaces: [] },
    seance: { letterIndex: 1, followerIds: ['p1'], progress: 0.5, anchorMs: 50_000, pauseUntilMs: 55_000, brokenBy: { playerId: 'p2', atMs: 40_000 } },
    cellar: { arrivedAtMs: 30_000, penaltyMs: 0, fusesUsed: 0, litUntilMs: null, outcome: null },
  };
  const paused = readState(setPaused({ state: timed, player: LEADER, isPaused: true, nowMs: 60_000 }));
  const resumed = readState(setPaused({ state: paused, player: LEADER, isPaused: false, nowMs: 80_000 }));
  assert.equal(resumed.flashback?.remembersUntilMs, 110_000);
  assert.deepEqual(resumed.seance, { ...timed.seance, anchorMs: 70_000, pauseUntilMs: 75_000, brokenBy: { playerId: 'p2', atMs: 60_000 } });
  assert.deepEqual(resumed.cellar, { ...timed.cellar, arrivedAtMs: 50_000 });
});

const TASK_STEP_INDEX = MISSION.steps.findIndex((step) => step.type === 'answer');

test('ett rätt svar för gruppen vidare, oavsett stora bokstäver och mellanslag', () => {
  const state = runningAt(TASK_STEP_INDEX);
  assert.deepEqual(submitAnswer({ state, mission: MISSION, players: PLAYERS, answer: '41' }), { refusal: 'wrongAnswer' });
  assert.deepEqual(submitAnswer({ state, mission: MISSION, players: PLAYERS, answer: '' }), { refusal: 'wrongAnswer' });
  assert.deepEqual(submitAnswer({ state, mission: MISSION, players: PLAYERS, answer: 7 }), { refusal: 'wrongAnswer' });
  assert.equal(readState(submitAnswer({ state, mission: MISSION, players: PLAYERS, answer: ' 42 ' })).stepIndex, TASK_STEP_INDEX + 1);
  assert.equal(readState(submitAnswer({ state, mission: MISSION, players: PLAYERS, answer: 'Fyrtiotvå' })).stepIndex, TASK_STEP_INDEX + 1);
  // I en scen finns inget att svara på.
  assert.deepEqual(submitAnswer({ state: runningAt(0), mission: MISSION, players: PLAYERS, answer: '42' }), { refusal: 'notATask' });
});

test('spelledaren ger ledtrådarna en i taget, och alla ser dem', () => {
  let state = runningAt(TASK_STEP_INDEX);
  assert.deepEqual(giveHint({ state, mission: MISSION, player: GUEST }), { refusal: 'notLeader' });
  for (let given = 1; given <= 3; given += 1) {
    state = readState(giveHint({ state, mission: MISSION, player: LEADER }));
    const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: 'prov', state }, mission: MISSION, players: PLAYERS, viewer: GUEST });
    assert.deepEqual({ shown: view.step.hints.length, count: view.step.hintCount }, { shown: given, count: 3 });
  }
  assert.deepEqual(giveHint({ state, mission: MISSION, player: LEADER }), { refusal: 'noMoreHints' });
  // Nästa uppgift börjar utan ledtrådar.
  assert.equal(readState(advanceStep({ state, mission: MISSION, players: PLAYERS, player: LEADER })).hintsGiven, 0);
});

test('facit syns bara hos spelledaren och bara när hon ber om det', () => {
  const state = runningAt(TASK_STEP_INDEX);
  const viewOf = (current: GameState, viewer: PlayerRecord) => buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: 'prov', state: current }, mission: MISSION, players: PLAYERS, viewer });
  assert.equal(viewOf(state, LEADER).step.solution, null);
  assert.deepEqual(showSolution({ state, mission: MISSION, player: GUEST }), { refusal: 'notLeader' });
  const shown = readState(showSolution({ state, mission: MISSION, player: LEADER }));
  assert.equal(viewOf(shown, LEADER).step.solution, '42');
  assert.equal(viewOf(shown, GUEST).step.solution, null);
});
