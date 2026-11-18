import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildGameView, giveHint, startGame } from './game.ts';
import { giveReadingHint, markRead, skipReading } from './reading.ts';
import { chooseFlashbackRoom, fadeFlashback, turnClock, walkThroughDoor } from './taskActions.ts';
import { getMission } from './missions/index.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

const MISSION = getMission('den-femte-gasten')!;
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));
const [ANNA, BO, CIA] = PLAYERS;
const MINUTE_MS = 60_000;
const NINE_FIFTEEN = 555;

function readState(change: { state: GameState } | { refusal: string }): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

function stepId(state: GameState): string {
  return MISSION.steps[state.stepIndex].id;
}

function start(): GameState {
  return readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: ANNA, leaderPlays: true, minutes: 60, nowMs: 0 }));
}

/** Gruppen ställer golvuret, ser alla fyra rummen och låter minnet blekna. */
function seeTheMemory(state: GameState): GameState {
  let next = readState(walkThroughDoor({ state, mission: MISSION, player: ANNA, placeId: 'F', nowMs: 0 }));
  next = readState(turnClock({ state: next, mission: MISSION, players: PLAYERS, player: ANNA, minutes: NINE_FIFTEEN, nowMs: 0 }));
  for (const [player, placeId] of [[ANNA, 'B'], [BO, 'C'], [CIA, 'D'], [ANNA, 'E']] as const) {
    next = readState(chooseFlashbackRoom({ state: next, mission: MISSION, players: PLAYERS, player, placeId, nowMs: 0 }));
  }
  return readState(fadeFlashback({ state: next, mission: MISSION, players: PLAYERS, nowMs: 3 * MINUTE_MS }));
}

function skipUntil(state: GameState, id: string): GameState {
  let next = state;
  while (stepId(next) !== id) next = readState(skipReading({ state: next, mission: MISSION, players: PLAYERS, player: ANNA }));
  return next;
}

test('brädet frågar VEM ÄR JAG först när gruppen har sett minnet och alla har läst urklippen', () => {
  let state = skipUntil(seeTheMemory(start()), 'tidningsurklippen');
  state = readState(markRead({ state, mission: MISSION, players: PLAYERS, player: ANNA, thingId: 'byran' }));
  state = readState(markRead({ state, mission: MISSION, players: PLAYERS, player: BO, thingId: 'byran' }));
  assert.equal(stepId(state), 'tidningsurklippen');
  state = readState(markRead({ state, mission: MISSION, players: PLAYERS, player: CIA, thingId: 'byran' }));
  assert.equal(stepId(state), 'vem-ar-jag');
});

test('alla har läst urklippen men inte sett minnet: berättelsen väntar på golvuret', () => {
  let state = start();
  for (const player of PLAYERS) state = readState(markRead({ state, mission: MISSION, players: PLAYERS, player, thingId: 'byran' }));
  assert.equal(stepId(state), 'inledning');
  state = skipUntil(state, 'tidningsurklippen');
  assert.equal(stepId(state), 'tidningsurklippen');
  state = seeTheMemory(state);
  assert.equal(stepId(state), 'vem-ar-jag');
});

test('har gruppen gjort båda innan berättelsen kommer dit går den förbi urklippen direkt', () => {
  let state = seeTheMemory(start());
  for (const player of PLAYERS) state = readState(markRead({ state, mission: MISSION, players: PLAYERS, player, thingId: 'byran' }));
  state = skipUntil(state, 'vera-svarar');
  state = readState(skipReading({ state, mission: MISSION, players: PLAYERS, player: ANNA }));
  assert.equal(stepId(state), 'vem-ar-jag');
});

test('en annan sak än byrån räknas inte som läst, och Tillbaka igen ändrar inget', () => {
  let state = start();
  assert.equal(readState(markRead({ state, mission: MISSION, players: PLAYERS, player: BO, thingId: 'golvuret' })), state);
  state = readState(markRead({ state, mission: MISSION, players: PLAYERS, player: BO, thingId: 'byran' }));
  assert.equal(readState(markRead({ state, mission: MISSION, players: PLAYERS, player: BO, thingId: 'byran' })), state);
});

test('Hoppa över uppgiften räknar alla som lästa och hoppar över Rummen minns med ett tryck', () => {
  let state = skipUntil(start(), 'tidningsurklippen');
  state = readState(skipReading({ state, mission: MISSION, players: PLAYERS, player: ANNA }));
  assert.equal(stepId(state), 'vem-ar-jag');
  assert.deepEqual(state.foundReaders.tidningsurklippen, ['p0', 'p1', 'p2']);
});

test('vid byrån säger första ledtråden att alla inte har läst, och vid golvuret får gruppen Rummen minns ledtrådar', () => {
  let state = skipUntil(start(), 'tidningsurklippen');
  state = readState(giveReadingHint({ state, mission: MISSION, players: PLAYERS, player: ANNA }));
  state = readState(giveReadingHint({ state, mission: MISSION, players: PLAYERS, player: ANNA }));
  state = readState(giveHint({ state, mission: MISSION, player: ANNA }));
  const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer: BO });
  const reading = MISSION.steps[state.stepIndex];
  const written = reading.type === 'scene' ? reading.readingHints ?? [] : [];
  const clock = MISSION.steps.find((step) => step.id === 'rummen-minns');
  assert.deepEqual(view.step.readingHints, ['Alla har inte läst tidningsurklippen.', written[0]]);
  assert.equal(view.step.readingHintCount, 4);
  assert.deepEqual(view.step.hints, clock?.hints?.slice(0, 1));
  assert.equal(view.step.hintCount, 3);
  for (let given = 1; given < 3; given += 1) state = readState(giveReadingHint({ state, mission: MISSION, players: PLAYERS, player: ANNA }));
  assert.deepEqual(giveReadingHint({ state, mission: MISSION, players: PLAYERS, player: ANNA }), { refusal: 'noMoreHints' });
  assert.deepEqual(giveReadingHint({ state, mission: MISSION, players: PLAYERS, player: BO }), { refusal: 'notLeader' });
});

test('har alla läst ger byrån bara de skrivna ledtrådarna', () => {
  let state = start();
  for (const player of PLAYERS) state = readState(markRead({ state, mission: MISSION, players: PLAYERS, player, thingId: 'byran' }));
  state = skipUntil(state, 'tidningsurklippen');
  state = readState(giveReadingHint({ state, mission: MISSION, players: PLAYERS, player: ANNA }));
  const view = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer: BO });
  const reading = MISSION.steps[state.stepIndex];
  assert.deepEqual(view.step.readingHints, reading.type === 'scene' ? reading.readingHints?.slice(0, 1) : []);
  assert.equal(view.step.readingHintCount, 3);
});
