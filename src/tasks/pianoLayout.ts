/**
 * Var spelarens tangenter ligger i bilden av pianot. Bilden är en oktav, C
 * till B, som läggs bredvid sig själv. Spelaren ser bara sina fyra vita
 * tangenter, och bilden flyttas en vit tangent per steg, så att samma bild
 * räcker för alla (Jonas 2026-11-23). Rena funktioner, räknade i bildens
 * pixlar.
 */

/**
 * Bildens storlek i pixlar. Bilden är beskuren till tangenterna, utan det
 * bruna träet ovanför, så att tangenterna kan fylla skärmens bredd
 * (Jonas 2026-11-24).
 */
export const OCTAVE_IMAGE = { width: 1186, height: 1168 };

/** Skarvarna mellan de vita tangenterna i bilden, från C:s vänsterkant till B:s högerkant. Tangenterna är inte lika breda. */
// Uppmätta i bilden, en siffra per skarv.
// eslint-disable-next-line @typescript-eslint/no-magic-numbers
const WHITE_EDGES = [0, 170, 355, 507, 685, 860, 1025, 1186];

/** De svarta tangenternas mitt i bilden, efter den vita tangent de hör till. */
const BLACK_CENTERS: Record<string, number> = { C: 160, D: 333, F: 670, G: 847, A: 1017 };
const BLACK_WIDTH = 114;


const WHITE_LETTERS = 'CDEFGAB';

/** En tangent i fönstret, med vänsterkant och bredd i bildens pixlar räknat från fönstrets vänsterkant. */
export type KeyPlace = { note: string; left: number; width: number };

export type PianoLayout = {
  /** Fönstrets bredd i bildens pixlar. */
  width: number;
  /** Var oktavbildens vänsterkant hamnar, räknat från fönstrets vänsterkant. */
  imageLeft: number;
  whiteKeys: KeyPlace[];
  blackKeys: KeyPlace[];
};

function parseNote(note: string): { index: number; octave: number } | null {
  const match = /^([A-G])(\d)$/.exec(note);
  return match ? { index: WHITE_LETTERS.indexOf(match[1]), octave: Number(match[2]) } : null;
}

/** Var en vit tangents vänsterkant ligger på ett tänkt piano av bilder bredvid varandra. */
function findWhiteLeft(index: number, octave: number): number {
  return octave * OCTAVE_IMAGE.width + WHITE_EDGES[index];
}

/**
 * Räknar ut fönstret för spelarens intilliggande vita tangenter. Svarta
 * tangenter som syns i fönstret kommer med, också de i kanten som bara syns
 * till hälften, som på ett riktigt piano (Jonas 2026-11-18).
 */
export function layOutPianoKeys(notes: readonly string[]): PianoLayout | null {
  const parsed = notes.map(parseNote);
  if (parsed.length === 0 || parsed.some((note) => note === null)) return null;
  const keys = parsed as { index: number; octave: number }[];
  const first = keys[0];
  const last = keys[keys.length - 1];
  const start = findWhiteLeft(first.index, first.octave);
  const end = findWhiteLeft(last.index + 1, last.octave);
  const whiteKeys = keys.map(({ index, octave }, position) => {
    const left = findWhiteLeft(index, octave) - start;
    return { note: notes[position], left, width: WHITE_EDGES[index + 1] - WHITE_EDGES[index] };
  });
  const blackKeys: KeyPlace[] = [];
  for (let octave = first.octave; octave <= last.octave; octave += 1) {
    for (const [letter, center] of Object.entries(BLACK_CENTERS)) {
      const left = octave * OCTAVE_IMAGE.width + center - BLACK_WIDTH / 2 - start;
      if (left + BLACK_WIDTH > 0 && left < end - start) blackKeys.push({ note: `${letter}#${octave}`, left, width: BLACK_WIDTH });
    }
  }
  return { width: end - start, imageLeft: findWhiteLeft(0, first.octave) - start, whiteKeys, blackKeys };
}
