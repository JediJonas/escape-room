import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, choosePlace, startGame } from './game.ts';
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
  const state = readState(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER, GUEST], starter: LEADER, usesPlaceCards: false }));
  assert.deepEqual(state, { ...createInitialState(), status: 'running', usesPlaceCards: false });
});

test('en spelare kan inte starta eller gå vidare, och spelet startar inte med för få', () => {
  assert.deepEqual(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER, GUEST], starter: GUEST, usesPlaceCards: true }), { refusal: 'notLeader' });
  assert.deepEqual(startGame({ state: createInitialState(), mission: MISSION, players: [LEADER], starter: LEADER, usesPlaceCards: true }), { refusal: 'tooFewPlayers' });
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
  const state = readState(choosePlace({ state: running, mission: MISSION, player: GUEST, placeId: 'C' }));
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
