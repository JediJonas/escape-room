/**
 * Ett svagt knackande, som när brädet kallar på gruppen (Jonas 2026-11-17).
 * Knackningarna görs i ljudmotorn, så att inget klipp behöver hämtas. Utan
 * motor hörs inget, och brädet flimrar ändå i listan.
 */

import type { AudioEngine } from './audioEngine.ts';

/** Tre knackningar, den sista lite efter, som någon som knackar på en dörr. */
const SECOND_KNOCK_S = 0.24;
const THIRD_KNOCK_S = 0.62;
export const KNOCK_TIMES_S = [0, SECOND_KNOCK_S, THIRD_KNOCK_S];
const KNOCK_LENGTH_S = 0.14;
const KNOCK_START_HZ = 150;
const KNOCK_END_HZ = 55;
/** Svagt, så att det hörs i ett tyst rum men inte skrämmer bort någon. */
const KNOCK_VOLUME = 0.35;
const SILENT = 0.0001;
const ATTACK_S = 0.004;

function knockAt(context: AudioContext, startS: number) {
  const tone = context.createOscillator();
  const volume = context.createGain();
  tone.type = 'sine';
  tone.frequency.setValueAtTime(KNOCK_START_HZ, startS);
  tone.frequency.exponentialRampToValueAtTime(KNOCK_END_HZ, startS + KNOCK_LENGTH_S);
  volume.gain.setValueAtTime(SILENT, startS);
  volume.gain.exponentialRampToValueAtTime(KNOCK_VOLUME, startS + ATTACK_S);
  volume.gain.exponentialRampToValueAtTime(SILENT, startS + KNOCK_LENGTH_S);
  tone.connect(volume).connect(context.destination);
  tone.start(startS);
  tone.stop(startS + KNOCK_LENGTH_S);
}

/** Spelar en följd knackningar, om ljudmotorn är upplåst. */
export async function playKnocks(engine: AudioEngine): Promise<void> {
  await engine.resume();
  const context = engine.getContext();
  if (!context || !engine.isRunning()) return;
  for (const offsetS of KNOCK_TIMES_S) knockAt(context, context.currentTime + offsetS);
}
