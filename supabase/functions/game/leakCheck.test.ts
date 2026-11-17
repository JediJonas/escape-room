/**
 * Läckkontrollen: spelar varje uppdrag med alla gruppstorlekar och letar i
 * varje vy efter det som spelaren inte ska se. Se docs/motorn.md, Vyn och
 * läckkontrollen.
 */

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, choosePlace, giveHint, showSolution, startGame, touchBoard } from './game.ts';
import { MAX_PLAYERS } from './lobby.ts';
import { listParticipants } from './participants.ts';
import { type Mission, listSolutionTexts } from './mission.ts';
import { MISSIONS } from './missions/index.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

function createPlayers(count: number): PlayerRecord[] {
  return Array.from({ length: count }, (_, index) => ({ id: `player-${index}`, gameId: 'g', userId: `user-${index}`, name: `Spelare ${index}`, isLeader: index === 0, joinedAtMs: index }));
}

function readState(change: ReturnType<typeof startGame>): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

/** Varje text i steget som bara vissa ska se: platsens text, alla bitar, ledtrådarna och facit. */
function listSecrets(mission: Mission, stepIndex: number): string[] {
  const step = mission.steps[stepIndex];
  return [
    ...(step.textAtPlace ? [step.textAtPlace] : []),
    ...(step.roles ?? []).flatMap((role) => role.pieces),
    ...(step.hints ?? []),
    ...listSolutionTexts(step),
  ];
}

/** Platsen som spelaren ska till: rollens egen plats, annars stegets. */
function findGoal(mission: Mission, state: GameState, player: PlayerRecord) {
  const step = mission.steps[state.stepIndex];
  const role = step.roles?.find((candidate) => candidate.id === state.roleByPlayer[player.id]?.roleId);
  return role?.goTo ?? step.goTo;
}

function isAtGoal(mission: Mission, state: GameState, player: PlayerRecord): boolean {
  const goal = findGoal(mission, state, player);
  return goal !== undefined && state.placeByPlayer[player.id] === goal;
}

function goToGoals(mission: Mission, state: GameState, players: PlayerRecord[], movers: PlayerRecord[]): GameState {
  let moved = state;
  for (const player of movers) {
    const goal = findGoal(mission, moved, player);
    if (goal) moved = readState(choosePlace({ state: moved, mission, players, player, placeId: goal }));
  }
  return moved;
}

function checkStep(mission: Mission, state: GameState, players: PlayerRecord[]) {
  const game = { id: 'g', joinCode: 'BCDF', missionId: mission.id, state };
  const secrets = listSecrets(mission, state.stepIndex);
  const shown = new Set<string>();
  for (const viewer of players) {
    const view = buildGameView({ game, mission, players, viewer });
    const text = JSON.stringify(view);
    const allowed = new Set([
      ...(view.step.role?.pieces ?? []),
      ...(view.step.textAtPlace ? [view.step.textAtPlace] : []),
      ...view.step.hints,
      // Facit får bara synas hos spelledaren, och bara när hon har bett om det.
      ...(viewer.isLeader && state.isSolutionShown ? listSolutionTexts(mission.steps[state.stepIndex]) : []),
    ]);
    for (const secret of secrets) {
      if (text.includes(secret)) assert.ok(allowed.has(secret), `${mission.id} steg ${state.stepIndex + 1}, ${viewer.name} ser någon annans: ${secret}`);
    }
    // Ingen vy berättar något om de andra spelarna.
    for (const other of players.filter((player) => player.id !== viewer.id)) assert.ok(!text.includes(other.id), `${viewer.name} ser ${other.id}`);
    for (const piece of view.step.role?.pieces ?? []) {
      assert.ok(!shown.has(piece), `${mission.id} steg ${state.stepIndex + 1}: två spelare ser samma bit: ${piece}`);
      shown.add(piece);
    }
  }
  // Alla bitar som behövs finns hos någon.
  for (const role of mission.steps[state.stepIndex].roles ?? []) {
    const roleHolders = players.filter((player) => state.roleByPlayer[player.id]?.roleId === role.id);
    // En roll med egen plats visar bitarna först där, så de räknas när alla är framme.
    if (role.goTo !== undefined && !roleHolders.every((player) => isAtGoal(mission, state, player))) continue;
    const holders = roleHolders.length;
    const reachable = Math.min(role.pieces.length, holders * (role.maxPiecesPerPlayer ?? role.pieces.length));
    // De viktigaste bitarna, de första, ska alltid finnas hos någon.
    assert.ok(role.pieces.slice(0, reachable).every((piece) => shown.has(piece)), `${mission.id} steg ${state.stepIndex + 1}: en bit i ${role.id} har ingen`);
  }
}

/** Alla följer skenet genom hela meddelandet, och vyerna kontrolleras efter varje bokstav. */
function followWholeSeance(mission: Mission, state: GameState, players: PlayerRecord[], participants: PlayerRecord[]): GameState {
  let followed = state;
  while (followed.seance && !buildGameView({ game: { id: 'g', joinCode: 'BCDF', missionId: mission.id, state: followed }, mission, players, viewer: participants[0] }).step.seance?.isComplete) {
    const letterIndex = followed.seance.letterIndex;
    for (const player of participants) followed = readState(touchBoard({ state: followed, mission, players: participants, player, touch: 'onGlow', letterIndex, nowMs: 0 }));
    checkStep(mission, followed, players);
  }
  return followed;
}

for (const mission of MISSIONS) {
  test(`${mission.id}: ingen vy läcker något, med ${mission.minPlayers} till ${MAX_PLAYERS} spelare, med och utan spelledaren`, () => {
    for (const leaderPlays of [true, false]) for (let playerCount = mission.minPlayers; playerCount <= MAX_PLAYERS; playerCount += 1) {
      // Spelledaren som står utanför räknas inte, så det behövs en spelare till.
      const players = createPlayers(leaderPlays ? playerCount : Math.min(playerCount + 1, MAX_PLAYERS));
      const [leader] = players;
      let state = readState(startGame({ state: createInitialState(), mission, players, starter: leader, usesPlaceCards: true, leaderPlays, minutes: 60, nowMs: 0 }));
      const participants = listParticipants(state, players);
      while (state.status === 'running') {
        // Var annan spelare går till rätt plats, så att både de som är där och de som inte är det kontrolleras.
        state = goToGoals(mission, state, participants, participants.filter((_, index) => index % 2 === 0));
        checkStep(mission, state, players);
        // När rollerna har egna platser kontrolleras vyerna igen med alla framme.
        if (mission.steps[state.stepIndex].roles?.some((role) => role.goTo !== undefined)) {
          state = goToGoals(mission, state, participants, participants);
          checkStep(mission, state, players);
        }
        // I en seans kontrolleras vyerna efter varje bokstav, när någon ser den.
        if (mission.steps[state.stepIndex].type === 'seance') state = followWholeSeance(mission, state, players, participants);
        // I en uppgift kontrolleras vyerna igen med alla ledtrådar och facit framme.
        if (mission.steps[state.stepIndex].type !== 'scene') {
          while (state.hintsGiven < (mission.steps[state.stepIndex].hints?.length ?? 0)) state = readState(giveHint({ state, mission, player: leader }));
          state = readState(showSolution({ state, mission, player: leader }));
          checkStep(mission, state, players);
        }
        state = readState(advanceStep({ state, mission, players: participants, player: leader }));
      }
    }
  });
}
