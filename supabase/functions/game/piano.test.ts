import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, startGame } from './game.ts';
import { type Mission, type PianoStep, findMissionErrors } from './mission.ts';
import { getMission } from './missions/index.ts';
import { dealKeys, describePiano, isPianoSolved, nameNote, pressKey, readPianoState, startPiano } from './piano.ts';
import { playKey } from './taskActions.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

const STEP: PianoStep = {
  id: 'pianot',
  type: 'piano',
  text: 'Spela melodin.',
  callsFromHouse: true,
  keys: ['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5'],
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
  return readState(startGame({ state: createInitialState(), mission: MISSION, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
}

function viewOf(state: GameState, viewer: PlayerRecord) {
  return buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: MISSION.id, state }, mission: MISSION, players: PLAYERS, viewer });
}

test('var och en får fyra intilliggande tangenter, och varje tangent finns hos någon', () => {
  const keys = STEP.keys;
  for (let count = 2; count <= 9; count += 1) {
    const ids = Array.from({ length: count }, (_, index) => `p${index}`);
    const dealt = dealKeys(keys, ids);
    for (const id of ids) {
      const start = keys.indexOf(dealt[id][0]);
      assert.deepEqual(dealt[id], keys.slice(start, start + 4), `${count} spelare`);
    }
    assert.deepEqual(new Set(Object.values(dealt).flat()), new Set(keys));
  }
  assert.deepEqual(dealKeys(keys, ['a', 'b']), { a: ['C4', 'D4', 'E4', 'F4'], b: ['G4', 'A4', 'B4', 'C5'] });
  assert.deepEqual(dealKeys(keys, ['a', 'b', 'c']).b, ['E4', 'F4', 'G4', 'A4']);
  // Ensam med tangenterna får man alla.
  assert.deepEqual(dealKeys(keys, ['a']).a, keys);
});

test('tonerna heter som på svenska, där B är H', () => {
  assert.equal(nameNote('C4'), 'C');
  assert.equal(nameNote('B4'), 'H');
  assert.equal(nameNote('F#4'), 'Fiss');
});

test('gruppen spelar som den vill, och de senaste tonerna avgör', () => {
  // Annas mobil spelar melodin. Bo har C D E F, Cia har G A H C.
  const piano = startPiano('p0');
  const press = (state: typeof piano, playerId: string, key: string) => {
    const result = pressKey({ piano: state, step: STEP, playerId, participantIds: IDS, key });
    assert.ok('piano' in result, JSON.stringify(result));
    return result.piano;
  };
  let played = piano;
  for (const [playerId, key] of [['p2', 'G4'], ['p1', 'E4'], ['p1', 'C4'], ['p1', 'F4']] as const) played = press(played, playerId, key);
  assert.equal(isPianoSolved(played, STEP), false);
  played = press(played, 'p1', 'C4');
  assert.deepEqual(played.recentKeys, ['E4', 'C4', 'F4', 'C4']);
  assert.equal(isPianoSolved(played, STEP), true);
  assert.deepEqual(pressKey({ piano, step: STEP, playerId: 'p2', participantIds: IDS, key: 'E4' }), { refusal: 'notYourKey' });
  assert.deepEqual(pressKey({ piano, step: STEP, playerId: 'p0', participantIds: IDS, key: 'E4' }), { refusal: 'notYourKey' });
  assert.deepEqual(pressKey({ piano, step: STEP, playerId: 'p1', participantIds: IDS, key: 'D#4' }), { refusal: 'unknownKey' });
});

test('bara mobilen som spelar melodin får den, och var och en ser bara sina tangenter', () => {
  const piano = startPiano('p0');
  const listener = describePiano({ piano, step: STEP, viewerId: 'p0', participantIds: IDS, melodyPlayerName: 'Anna' });
  assert.deepEqual(listener.melody, STEP.solution.melody);
  assert.deepEqual(listener.myKeys, []);
  const player = describePiano({ piano, step: STEP, viewerId: 'p1', participantIds: IDS, melodyPlayerName: 'Anna' });
  assert.equal(player.melody, null);
  assert.deepEqual(player.myKeys.map((key) => key.name), ['C', 'D', 'E', 'F']);
});

test('den som spelar melodin väljs som en framträdande roll, alla måste stå vid pianot och hela melodin för gruppen vidare', () => {
  const started = start();
  assert.equal(started.piano?.melodyPlayerId, 'p0');
  assert.deepEqual(started.prominentHistory, ['p0']);
  const [listener, bo, cia] = PLAYERS;
  assert.equal(viewOf(started, listener).step.piano?.hasMelody, true);
  assert.equal(viewOf(started, bo).step.piano?.melodyPlayerName, 'Anna');
  assert.equal(viewOf(started, bo).house?.things[0].isCalling, true);
  const away = { ...started, placeByPlayer: { ...started.placeByPlayer, [bo.id]: 'C' as const } };
  assert.equal(viewOf(away, bo).house?.callingFrom, 'Något rör sig vid pianot i hallen.');
  assert.deepEqual(playKey({ state: away, mission: MISSION, players: PLAYERS, player: bo, key: 'E4' }), { refusal: 'notAtPlace' });
  let state = started;
  for (const [player, key] of [[cia, 'G4'], [bo, 'E4'], [bo, 'C4'], [bo, 'F4'], [bo, 'C4']] as const) state = readState(playKey({ state, mission: MISSION, players: PLAYERS, player, key }));
  assert.equal(state.stepIndex, 1);
  // Pianot står kvar, men efteråt låter tangenterna bara.
  assert.deepEqual(playKey({ state, mission: MISSION, players: PLAYERS, player: bo, key: 'E4' }), { state });
});

test('nästa gång spelar någon melodin som inte har haft en framträdande roll', () => {
  const started = readState(startGame({ state: { ...createInitialState(), prominentHistory: ['p0'] }, mission: MISSION, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
  assert.equal(started.piano?.melodyPlayerId, 'p1');
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
  assert.deepEqual(readPianoState({ melodyPlayerId: 'p0', recentKeys: ['C4', 'X'] }), { melodyPlayerId: 'p0', recentKeys: ['C4'] });
  assert.equal(readPianoState({ recentKeys: 'C4' }), null);
});

/** Ett uppdrag där pianot kommer efter en scen, så att det går att spela innan berättelsen har kommit dit. */
const LATER: Mission = { ...MISSION, steps: [{ id: 'forst', type: 'scene', text: 'Först.' }, ...MISSION.steps] };

function startLater(): GameState {
  return readState(startGame({ state: createInitialState(), mission: LATER, players: PLAYERS, starter: PLAYERS[0], leaderPlays: true, minutes: 60, nowMs: 0 }));
}

test('pianot går att spela innan berättelsen har kommit dit, med tangenterna delade mellan alla', () => {
  const started = startLater();
  const [anna, bo, cia] = PLAYERS;
  const thing = buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: LATER.id, state: started }, mission: LATER, players: PLAYERS, viewer: anna }).house?.things[0];
  assert.equal(thing?.opensCurrentStep, false);
  // Ingen spelar melodin än, så alla har tangenter: Anna C D E F, Bo E F G A och Cia G A H C.
  assert.deepEqual(thing?.instrument?.type === 'piano' && thing.instrument.keys.map((key) => key.name), ['C', 'D', 'E', 'F']);
  // Utanför steget får ingen en ny vy av en ton, så tillståndet ändras bara i det tysta.
  let state = readState(playKey({ state: started, mission: LATER, players: PLAYERS, player: cia, key: 'B4' }));
  assert.equal(state.stepIndex, 0);
  for (const [player, key] of [[bo, 'E4'], [anna, 'C4'], [anna, 'F4'], [anna, 'C4']] as const) state = readState(playKey({ state, mission: LATER, players: PLAYERS, player, key }));
  assert.deepEqual(state.solvedSteps, ['pianot']);
  assert.equal(state.stepIndex, 0);
  // När scenen är klar går gruppen förbi pianot.
  const after = readState(advanceStep({ state, mission: LATER, players: PLAYERS, player: anna }));
  assert.equal(LATER.steps[after.stepIndex].id, 'efter');
  // Efteråt låter tangenterna bara.
  assert.deepEqual(playKey({ state: after, mission: LATER, players: PLAYERS, player: bo, key: 'G4' }), { state: after });
});
