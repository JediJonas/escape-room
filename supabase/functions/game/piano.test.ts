import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildGameView, startGame } from './game.ts';
import { type Mission, type PianoStep, findMissionErrors } from './mission.ts';
import { getMission } from './missions/index.ts';
import { dealKeys, describePiano, nameNote, pressKey, readPianoState, startPiano } from './piano.ts';
import { playKey } from './taskActions.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

const STEP: PianoStep = {
  id: 'pianot',
  type: 'piano',
  text: 'Spela melodin.',
  callsFromHouse: true,
  keys: ['C4', 'D4', 'E4', 'F4'],
  beatMs: 500,
  hints: ['a', 'b', 'c'],
  solution: { melody: [{ note: 'E4', beats: 1 }, { note: 'C4', beats: 1 }, { note: 'F4', beats: 2 }, { note: 'C4', beats: 1 }] },
};
const FULL = getMission('den-femte-gasten')!;
const MISSION: Mission = {
  ...FULL,
  house: {
    start: 'B',
    rooms: [
      { place: 'B', doors: ['C'], things: [{ id: 'pianot', name: 'Pianot', opensSteps: ['pianot'], isFoundFromStart: true }] },
      { place: 'C', doors: ['B'], things: [] },
    ],
  },
  steps: [STEP, { id: 'efter', type: 'scene', text: 'Efter.' }, { id: 'slut', type: 'scene', text: 'Slut.' }],
};
const PLAYERS: PlayerRecord[] = ['Anna', 'Bo', 'Cia'].map((name, index) => ({ id: `p${index}`, gameId: 'g', userId: `u${index}`, name, isLeader: index === 0, joinedAtMs: index }));
const IDS = PLAYERS.map((player) => player.id);

function readState(change: { state: GameState } | { refusal: string }): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

function start(): GameState {
  return readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: PLAYERS[0], usesPlaceCards: false, leaderPlays: true, minutes: 60, nowMs: 0 }));
}

function viewOf(state: GameState, viewer: PlayerRecord) {
  return buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer });
}

test('tangenterna delas så att alla har minst en och varje tangent finns hos någon', () => {
  const keys = ['C4', 'D4', 'E4', 'F4', 'G4'];
  for (let count = 1; count <= 9; count += 1) {
    const ids = Array.from({ length: count }, (_, index) => `p${index}`);
    const dealt = dealKeys(keys, ids);
    assert.ok(ids.every((id) => dealt[id].length > 0), `${count} spelare`);
    assert.deepEqual(new Set(Object.values(dealt).flat()), new Set(keys));
  }
  assert.deepEqual(dealKeys(keys, ['a', 'b']), { a: ['C4', 'E4', 'G4'], b: ['D4', 'F4'] });
});

test('tonerna heter som på svenska, där B är H', () => {
  assert.equal(nameNote('C4'), 'C');
  assert.equal(nameNote('B4'), 'H');
  assert.equal(nameNote('F#4'), 'Fiss');
});

test('rätt ton för gruppen framåt och en fel ton gör att den börjar om', () => {
  // Anna lyssnar. Bo har C4 och E4, Cia har D4 och F4.
  const piano = startPiano('p0');
  const press = (state: typeof piano, playerId: string, key: string) => {
    const result = pressKey({ piano: state, step: STEP, playerId, participantIds: IDS, key });
    assert.ok('piano' in result, JSON.stringify(result));
    return result.piano;
  };
  const first = press(piano, 'p1', 'E4');
  assert.equal(first.playedCount, 1);
  const second = press(first, 'p1', 'C4');
  assert.equal(second.playedCount, 2);
  const wrong = press(second, 'p2', 'D4');
  assert.deepEqual(wrong, { listenerId: 'p0', playedCount: 0, wrongNotes: 1 });
  assert.deepEqual(pressKey({ piano, step: STEP, playerId: 'p2', participantIds: IDS, key: 'E4' }), { refusal: 'notYourKey' });
  assert.deepEqual(pressKey({ piano, step: STEP, playerId: 'p0', participantIds: IDS, key: 'E4' }), { refusal: 'notYourKey' });
  assert.deepEqual(pressKey({ piano, step: STEP, playerId: 'p1', participantIds: IDS, key: 'A4' }), { refusal: 'unknownKey' });
});

test('bara lyssnaren får melodin, och var och en ser bara sina tangenter', () => {
  const piano = startPiano('p0');
  const listener = describePiano({ piano, step: STEP, viewerId: 'p0', participantIds: IDS, listenerName: 'Anna' });
  assert.deepEqual(listener.melody, STEP.solution.melody);
  assert.deepEqual(listener.myKeys, []);
  const player = describePiano({ piano, step: STEP, viewerId: 'p1', participantIds: IDS, listenerName: 'Anna' });
  assert.equal(player.melody, null);
  assert.deepEqual(player.myKeys, [{ note: 'C4', name: 'C' }, { note: 'E4', name: 'E' }]);
  assert.equal(player.noteCount, 4);
});

test('lyssnaren väljs som en framträdande roll, alla måste stå vid pianot och hela melodin för gruppen vidare', () => {
  const started = start();
  assert.equal(started.piano?.listenerId, 'p0');
  assert.deepEqual(started.prominentHistory, ['p0']);
  const [listener, bo, cia] = PLAYERS;
  assert.equal(viewOf(started, listener).step.piano?.isListener, true);
  assert.equal(viewOf(started, bo).step.piano?.listenerName, 'Anna');
  assert.equal(viewOf(started, bo).house?.things[0].isCalling, true);
  const away = { ...started, placeByPlayer: { ...started.placeByPlayer, [bo.id]: 'C' as const } };
  assert.equal(viewOf(away, bo).house?.callingFrom, 'Något rör sig vid pianot i hallen.');
  assert.deepEqual(playKey({ state: away, mission: MISSION, players: PLAYERS, player: bo, key: 'E4' }), { refusal: 'notAtPlace' });
  let state = started;
  for (const [player, key] of [[bo, 'E4'], [bo, 'C4'], [cia, 'F4'], [bo, 'C4']] as const) state = readState(playKey({ state, mission: MISSION, players: PLAYERS, player, key }));
  assert.equal(state.stepIndex, 1);
  assert.equal(state.piano, null);
});

test('nästa gång lyssnar någon som inte har haft en framträdande roll', () => {
  const started = readState(startGame({ state: { ...createInitialState(), prominentHistory: ['p0'] }, mission: MISSION, players: PLAYERS, starter: PLAYERS[0], usesPlaceCards: false, leaderPlays: true, minutes: 60, nowMs: 0 }));
  assert.equal(started.piano?.listenerId, 'p1');
});

test('uppdragsfilen säger till när pianot är fel', () => {
  const broken = { ...MISSION, steps: [{ ...STEP, keys: ['C4', 'H4'], beatMs: 50, solution: { melody: [{ note: 'D4', beats: 1 }] } }, ...MISSION.steps.slice(1)] };
  const errors = findMissionErrors(broken);
  assert.ok(errors.some((error) => error.includes('tangenter')), errors.join());
  assert.ok(errors.some((error) => error.includes('slag')), errors.join());
  assert.ok(errors.some((error) => error.includes('melodi')), errors.join());
  assert.deepEqual(findMissionErrors(MISSION), []);
});

test('ett sparat piano läses, och ett trasigt blir null', () => {
  assert.deepEqual(readPianoState({ listenerId: 'p0', playedCount: 2, wrongNotes: 1 }), { listenerId: 'p0', playedCount: 2, wrongNotes: 1 });
  assert.equal(readPianoState({ playedCount: -1, wrongNotes: 0 }), null);
});
