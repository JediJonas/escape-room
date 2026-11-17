import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { CellarView } from '../../supabase/functions/game/cellar.ts';
import { describeThreat, hasTimeRunOut, isLampLit, measureThreat } from './cellarText.ts';

const CELLAR: CellarView = { isTrapped: false, trappedName: 'Cia', image: null, catchMs: 10_000, totalMs: 8000, fusesLeft: 3, litUntilMs: 5000, outcome: null, outcomeText: null };

test('hur nära det är räknas från när hon kom fram', () => {
  assert.equal(measureThreat({ ...CELLAR, catchMs: null }, 9000), 0);
  assert.equal(measureThreat(CELLAR, 2000), 0);
  assert.equal(measureThreat(CELLAR, 6000), 0.5);
  assert.equal(measureThreat(CELLAR, 20_000), 1);
  assert.equal(describeThreat(0.5), 'Något rör sig i mörkret.');
  assert.equal(describeThreat(1), 'Det är alldeles intill.');
});

test('lampan lyser till sin tid, och mobilen säger till när tiden har gått ut', () => {
  assert.equal(isLampLit(CELLAR, 4999), true);
  assert.equal(isLampLit(CELLAR, 5000), false);
  assert.equal(hasTimeRunOut(CELLAR, 10_000), true);
  assert.equal(hasTimeRunOut({ ...CELLAR, outcome: 'found' }, 10_000), false);
});
