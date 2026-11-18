/**
 * Pianots toner i ljudmotorn, så att inget klipp behöver hämtas. En ton är
 * en grundton med svaga övertoner som klingar av, som en sträng som slås an.
 * Utan motor hörs inget, och tangenterna fungerar ändå.
 */

import type { AudioEngine } from './audioEngine.ts';
import { noteFrequency, scheduleMelody } from './pianoNotes.ts';

/** Övertonerna och hur starka de är mot grundtonen. */
const OVERTONES = [{ multiple: 1, gain: 1 }, { multiple: 2, gain: 0.35 }, { multiple: 3, gain: 0.12 }];
/** Starkt, eftersom melodin spelas för hela gruppen ur en mobil. */
const VOLUME = 0.6;
const ATTACK_S = 0.008;
/** En ton klingar av så här länge efter sin längd, som när pedalen är nere en stund. */
const RING_S = 0.6;
const SILENT = 0.0001;
/** Den falska tonen: två toner en halvton isär, lite ostämda. */
const FALSE_NOTES = ['F#3', 'G3'];
const FALSE_DETUNE_CENTS = 18;
const FALSE_LENGTH_S = 0.9;

function playTone(context: AudioContext, { note, startS, lengthS, detuneCents = 0 }: { note: string; startS: number; lengthS: number; detuneCents?: number }) {
  const hz = noteFrequency(note);
  if (hz === null) return;
  const volume = context.createGain();
  const endS = startS + lengthS + RING_S;
  volume.gain.setValueAtTime(SILENT, startS);
  volume.gain.exponentialRampToValueAtTime(VOLUME, startS + ATTACK_S);
  volume.gain.exponentialRampToValueAtTime(SILENT, endS);
  volume.connect(context.destination);
  for (const overtone of OVERTONES) {
    const tone = context.createOscillator();
    const level = context.createGain();
    tone.type = 'sine';
    tone.frequency.setValueAtTime(hz * overtone.multiple, startS);
    tone.detune.setValueAtTime(detuneCents, startS);
    level.gain.setValueAtTime(overtone.gain, startS);
    tone.connect(level).connect(volume);
    tone.start(startS);
    tone.stop(endS);
  }
}

async function withContext(engine: AudioEngine, play: (context: AudioContext) => void): Promise<void> {
  await engine.resume();
  const context = engine.getContext();
  if (context && engine.isRunning()) play(context);
}

/** En tangent slås an. */
export function playNote(engine: AudioEngine, note: string, lengthS: number): Promise<void> {
  return withContext(engine, (context) => playTone(context, { note, startS: context.currentTime, lengthS }));
}

/** Hela melodin, högt för hela gruppen. */
export function playMelody(engine: AudioEngine, melody: readonly { note: string; beats: number }[], beatMs: number): Promise<void> {
  return withContext(engine, (context) => {
    const now = context.currentTime;
    for (const tone of scheduleMelody(melody, beatMs)) playTone(context, { note: tone.note, startS: now + tone.startS, lengthS: tone.lengthS });
  });
}

/** Den falska tonen när någon har spelat fel och gruppen får börja om. */
export function playFalseNote(engine: AudioEngine): Promise<void> {
  return withContext(engine, (context) => {
    FALSE_NOTES.forEach((note, index) => playTone(context, { note, startS: context.currentTime, lengthS: FALSE_LENGTH_S, detuneCents: index === 0 ? FALSE_DETUNE_CENTS : -FALSE_DETUNE_CENTS }));
  });
}
