/**
 * Läckkontrollen: spelar varje uppdrag med alla gruppstorlekar och letar i
 * varje vy efter det som spelaren inte ska se. Se docs/motorn.md, Vyn och
 * läckkontrollen.
 */

import assert from 'node:assert/strict';
import { test } from 'vitest';
import { advanceStep, buildGameView, choosePlace, startGame } from './game.ts';
import { MAX_PLAYERS } from './lobby.ts';
import type { Mission } from './mission.ts';
import { MISSIONS } from './missions/index.ts';
import { type GameState, type PlayerRecord, createInitialState } from './state.ts';

function createPlayers(count: number): PlayerRecord[] {
  return Array.from({ length: count }, (_, index) => ({ id: `player-${index}`, gameId: 'g', userId: `user-${index}`, name: `Spelare ${index}`, isLeader: index === 0, joinedAtMs: index }));
}

function readState(change: ReturnType<typeof startGame>): GameState {
  assert.ok('state' in change, JSON.stringify(change));
  return change.state;
}

/** Varje text i steget som bara vissa ska se: platsens text och alla bitar. */
function listSecrets(mission: Mission, stepIndex: number): string[] {
  const step = mission.steps[stepIndex];
  return [...(step.textAtPlace ? [step.textAtPlace] : []), ...(step.roles ?? []).flatMap((role) => role.pieces)];
}

function checkStep(mission: Mission, state: GameState, players: PlayerRecord[]) {
  const game = { id: 'g', joinCode: 'BCDF', missionId: mission.id, state };
  const secrets = listSecrets(mission, state.stepIndex);
  const shown = new Set<string>();
  for (const viewer of players) {
    const view = buildGameView({ game, mission, players, viewer });
    const text = JSON.stringify(view);
    const allowed = new Set([...(view.step.role?.pieces ?? []), ...(view.step.textAtPlace ? [view.step.textAtPlace] : [])]);
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
    const holders = Object.values(state.roleByPlayer).filter((assignment) => assignment.roleId === role.id).length;
    const reachable = Math.min(role.pieces.length, holders * (role.maxPiecesPerPlayer ?? role.pieces.length));
    // De viktigaste bitarna, de första, ska alltid finnas hos någon.
    assert.ok(role.pieces.slice(0, reachable).every((piece) => shown.has(piece)), `${mission.id} steg ${state.stepIndex + 1}: en bit i ${role.id} har ingen`);
  }
}

for (const mission of MISSIONS) {
  test(`${mission.id}: ingen vy läcker något, med ${mission.minPlayers} till ${MAX_PLAYERS} spelare`, () => {
    for (let playerCount = mission.minPlayers; playerCount <= MAX_PLAYERS; playerCount += 1) {
      const players = createPlayers(playerCount);
      const [leader] = players;
      let state = readState(startGame({ state: createInitialState(), mission, players, starter: leader, usesPlaceCards: true, minutes: 60, nowMs: 0 }));
      while (state.status === 'running') {
        // Var annan spelare går till rätt plats, så att både de som är där och de som inte är det kontrolleras.
        const goTo = mission.steps[state.stepIndex].goTo;
        if (goTo) {
          for (const player of players.filter((_, index) => index % 2 === 0)) state = readState(choosePlace({ state, mission, players, player, placeId: goTo }));
        }
        checkStep(mission, state, players);
        state = readState(advanceStep({ state, mission, players, player: leader }));
      }
    }
  });
}
