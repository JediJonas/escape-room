import { describe, expect, it } from 'vitest';
import { layOutPianoKeys } from './pianoLayout.ts';

describe('layOutPianoKeys', () => {
  it('börjar fönstret vid den första tangenten och flyttar bilden dit', () => {
    const layout = layOutPianoKeys(['E4', 'F4', 'G4', 'A4']);
    expect(layout?.imageLeft).toBe(-355);
    expect(layout?.width).toBe(1025 - 355);
    expect(layout?.whiteKeys.map((key) => key.left)).toEqual([0, 152, 330, 505]);
  });

  it('tar med svarta tangenter i kanten som bara syns till hälften', () => {
    const layout = layOutPianoKeys(['D4', 'E4', 'F4', 'G4']);
    expect(layout?.blackKeys.map((key) => key.note)).toEqual(['C#4', 'D#4', 'F#4', 'G#4']);
  });

  it('fortsätter i nästa oktav efter B', () => {
    const layout = layOutPianoKeys(['A3', 'B3', 'C4', 'D4']);
    expect(layout?.whiteKeys.map((key) => key.left)).toEqual([0, 165, 326, 496]);
    expect(layout?.blackKeys.map((key) => key.note)).toEqual(['G#3', 'A#3', 'C#4', 'D#4']);
  });

  it('ger null för en okänd ton', () => {
    expect(layOutPianoKeys(['H4'])).toBeNull();
    expect(layOutPianoKeys([])).toBeNull();
  });
});
