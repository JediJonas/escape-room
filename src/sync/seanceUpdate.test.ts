import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { GameView } from '../../supabase/functions/game/game.ts';
import { type SeanceView, findCellCenter } from '../../supabase/functions/game/seance.ts';
import type { SeanceUpdate } from '../../supabase/functions/game/views.ts';
import { applySeanceUpdate, keepNewerSeance } from './seanceUpdate.ts';

const SEANCE: SeanceView = {
  segment: { from: findCellCenter(29), to: findCellCenter(7), durationMs: 5000 },
  progress: 0,
  anchorMs: 1000,
  movesFromMs: null,
  letterIndex: 0,
  letterCount: 8,
  waitingFor: ['Bo'],
  followers: ['Anna'],
  isMeOnGlow: false,
  myFollowOrder: null,
  isComplete: false,
  brokenBy: null,
};

/** En vy med bara det som spelar roll här. Resten av fälten används inte. */
function createView(seance: SeanceView | null, stepNumber = 2): GameView {
  return {
    type: 'game',
    gameId: 'spel',
    me: { playerId: 'p-bo', name: 'Bo', isLeader: false, isPlaying: true },
    step: { number: stepNumber, seance },
  } as unknown as GameView;
}

function createUpdate(changes: Partial<SeanceView>, stepNumber = 2): SeanceUpdate {
  const { isMeOnGlow, myFollowOrder, ...shared } = { ...SEANCE, ...changes };
  assert.deepEqual([isMeOnGlow, myFollowOrder], [false, null]);
  return { gameId: 'spel', stepNumber, seance: shared };
}

function readSeance(view: ReturnType<typeof applySeanceUpdate>): SeanceView | null {
  return view.type === 'game' ? view.step.seance : null;
}

test('ett nytt läge i gruppens kanal ersätter seansen, och mobilen ser själv om den följer', () => {
  const view = applySeanceUpdate(createView(SEANCE), createUpdate({ anchorMs: 2000, followers: ['Anna', 'Bo'], waitingFor: [] }));
  assert.equal(readSeance(view)?.anchorMs, 2000);
  assert.equal(readSeance(view)?.isMeOnGlow, true);
  assert.equal(readSeance(view)?.myFollowOrder, 1);
});

test('ett äldre läge, ett annat steg eller ett annat spel ändrar ingenting', () => {
  const view = createView({ ...SEANCE, anchorMs: 3000 });
  assert.equal(applySeanceUpdate(view, createUpdate({ anchorMs: 2000 })), view);
  assert.equal(applySeanceUpdate(view, createUpdate({ anchorMs: 4000 }, 3)), view);
  assert.equal(applySeanceUpdate(view, { ...createUpdate({ anchorMs: 4000 }), gameId: 'annat' }), view);
  const withoutSeance = createView(null);
  assert.equal(applySeanceUpdate(withoutSeance, createUpdate({ anchorMs: 4000 })), withoutSeance);
});

test('den som står utanför följer aldrig skenet', () => {
  const leader = createView(SEANCE);
  leader.me = { ...leader.me, name: 'Ledare', isPlaying: false };
  const view = applySeanceUpdate(leader, createUpdate({ anchorMs: 2000, followers: ['Ledare'] }));
  assert.equal(readSeance(view)?.isMeOnGlow, false);
});

test('en vy som kommer efter ett nyare läge i gruppens kanal behåller det nyare läget', () => {
  const previous = createView({ ...SEANCE, anchorMs: 3000, letterIndex: 2 });
  const late = createView({ ...SEANCE, anchorMs: 2000, letterIndex: 1 });
  assert.equal(readSeance(keepNewerSeance(previous, late))?.letterIndex, 2);
  const newer = createView({ ...SEANCE, anchorMs: 4000, letterIndex: 3 });
  assert.equal(keepNewerSeance(previous, newer), newer);
  // Ett nytt steg tar aldrig med sig den förra seansen.
  const nextStep = createView({ ...SEANCE, anchorMs: 0 }, 3);
  assert.equal(keepNewerSeance(previous, nextStep), nextStep);
  assert.equal(keepNewerSeance(null, late), late);
});
