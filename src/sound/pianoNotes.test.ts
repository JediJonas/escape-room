import { expect, test } from 'vitest';
import { noteFrequency, scheduleMelody } from './pianoNotes.ts';

test('tonernas frekvenser räknas från A4 som 440 Hz', () => {
  expect(noteFrequency('A4')).toBe(440);
  expect(noteFrequency('A5')).toBe(880);
  expect(noteFrequency('C4')).toBeCloseTo(261.63, 2);
  expect(noteFrequency('F#4')).toBeCloseTo(369.99, 2);
  expect(noteFrequency('H4')).toBeNull();
});

test('melodin läggs ut i tid efter hur många slag varje ton varar', () => {
  expect(scheduleMelody([{ note: 'E4', beats: 1 }, { note: 'A4', beats: 2 }, { note: 'C5', beats: 1 }], 500)).toEqual([
    { note: 'E4', startS: 0, lengthS: 0.5 },
    { note: 'A4', startS: 0.5, lengthS: 1 },
    { note: 'C5', startS: 1.5, lengthS: 0.5 },
  ]);
});
