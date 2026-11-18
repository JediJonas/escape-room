/**
 * Tonernas frekvenser för pianot. Rena funktioner, så att de går att testa.
 */

const NOTE_PATTERN = /^([A-G])(#?)(\d)$/;
/** Halvtonerna från C till varje ton i oktaven. */
const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const A4_HZ = 440;
const A4_SEMITONE = 9;
const A4_OCTAVE = 4;
const SEMITONES_PER_OCTAVE = 12;

/** Frekvensen för en ton som "A4" eller "F#4", eller null om den inte går att läsa. */
export function noteFrequency(note: string): number | null {
  const match = NOTE_PATTERN.exec(note);
  if (!match) return null;
  const semitone = SEMITONES[match[1]] + (match[2] === '#' ? 1 : 0);
  const fromA4 = semitone - A4_SEMITONE + (Number(match[3]) - A4_OCTAVE) * SEMITONES_PER_OCTAVE;
  return A4_HZ * 2 ** (fromA4 / SEMITONES_PER_OCTAVE);
}

/** När varje ton i melodin börjar och hur länge den varar, i sekunder. */
export function scheduleMelody(melody: readonly { note: string; beats: number }[], beatMs: number): { note: string; startS: number; lengthS: number }[] {
  const msPerS = 1000;
  let startS = 0;
  return melody.map((tone) => {
    const lengthS = (tone.beats * beatMs) / msPerS;
    const scheduled = { note: tone.note, startS, lengthS };
    startS += lengthS;
    return scheduled;
  });
}
