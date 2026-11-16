import assert from 'node:assert/strict';
import { test } from 'vitest';
import { summarizeServerPings } from './serverClock.ts';

test('utan anrop finns ingen sammanfattning', () => {
  assert.equal(summarizeServerPings([]), null);
});

test('det första anropet redovisas för sig och ingår inte i medianen', () => {
  const summary = summarizeServerPings([
    { sentAt: 0, receivedAt: 900, serverTime: 450 },
    { sentAt: 1000, receivedAt: 1100, serverTime: 1050 },
    { sentAt: 2000, receivedAt: 2120, serverTime: 2060 },
    { sentAt: 3000, receivedAt: 3140, serverTime: 3070 },
  ]);
  assert.equal(summary?.firstMs, 900);
  assert.equal(summary?.medianMs, 120);
  assert.equal(summary?.maxMs, 140);
});

test('klockornas skillnad tas från det snabbaste anropet', () => {
  // Serverns klocka går 5 000 ms före. Det långsamma anropet skulle ge fel svar
  // om servern svarade tidigt i stället för mitt i.
  const summary = summarizeServerPings([
    { sentAt: 0, receivedAt: 1000, serverTime: 5100 },
    { sentAt: 2000, receivedAt: 2100, serverTime: 7050 },
  ]);
  assert.equal(summary?.clockOffsetMs, 5000);
});

test('ett enda anrop ger ingen median', () => {
  const summary = summarizeServerPings([{ sentAt: 0, receivedAt: 300, serverTime: 150 }]);
  assert.equal(summary?.firstMs, 300);
  assert.equal(summary?.medianMs, null);
});
