/**
 * Uppgiftstypen Orkestern med Ett öra, så som Pianot använder den. En
 * spelare, lyssnaren, hör melodin i sin mobil och ingen annan hör den. De
 * andra har några av pianots tangenter var. Lyssnaren nynnar och dirigerar,
 * och gruppen spelar melodin ton för ton. En fel ton gör att gruppen får
 * börja om från första tonen. Se docs/koncept.md, Pianot.
 *
 * Rena funktioner. Vilka tangenter en spelare har räknas fram ur ordningen
 * spelarna gick med i, så att bara lyssnaren och antalet rätta toner sparas.
 */

import type { PianoStep } from './mission.ts';

export type PianoState = {
  /** Den som hör melodin. Väljs när gruppen kommer till steget. */
  listenerId: string | null;
  /** Så många toner i följd har gruppen spelat rätt. */
  playedCount: number;
  /** Så många gånger gruppen har spelat fel, så att alla mobiler hör den falska tonen. */
  wrongNotes: number;
};

export type PianoRefusal = 'notYourKey' | 'unknownKey';

/** En ton som "C4" eller "F#4": tonnamn, eventuellt höjt, och oktav. */
const NOTE_PATTERN = /^([A-G])(#?)([2-6])$/;
/** Längsta ton i melodin, i slag. */
const MAX_BEATS = 4;
/** Ett slag får inte vara för kort att höra eller för långt att vänta på. */
const MIN_BEAT_MS = 200;
const MAX_BEAT_MS = 1500;
/** Så här många toner behövs för att det ska vara en melodi och inte en gissning. */
const MIN_MELODY_NOTES = 4;

export function isNote(value: unknown): value is string {
  return typeof value === 'string' && NOTE_PATTERN.test(value);
}

/** Tonens namn på svenska, där B heter H, till exempel "C" eller "Fiss". */
export function nameNote(note: string): string {
  const match = NOTE_PATTERN.exec(note);
  if (!match) return note;
  const letter = match[1] === 'B' ? 'H' : match[1];
  return match[2] === '#' ? `${letter}iss` : letter;
}

export function startPiano(listenerId: string | null): PianoState {
  return { listenerId, playedCount: 0, wrongNotes: 0 };
}

/**
 * Delar tangenterna mellan spelarna utom lyssnaren. Alla får minst en
 * tangent och varje tangent finns hos någon. Är spelarna fler än tangenterna
 * delar några på samma tangent.
 */
export function dealKeys(keys: readonly string[], playerIds: readonly string[]): Record<string, string[]> {
  const keysByPlayer: Record<string, string[]> = {};
  for (const playerId of playerIds) keysByPlayer[playerId] = [];
  if (playerIds.length === 0 || keys.length === 0) return keysByPlayer;
  const slots = Math.max(keys.length, playerIds.length);
  for (let slot = 0; slot < slots; slot += 1) {
    const mine = keysByPlayer[playerIds[slot % playerIds.length]];
    const key = keys[slot % keys.length];
    if (!mine.includes(key)) mine.push(key);
  }
  return keysByPlayer;
}

/** Spelarna som har tangenter, i den ordning de gick med. */
function listKeyPlayers(piano: PianoState, participantIds: readonly string[]): string[] {
  return participantIds.filter((playerId) => playerId !== piano.listenerId);
}

export function isPianoSolved(piano: PianoState, step: PianoStep): boolean {
  return piano.playedCount >= step.solution.melody.length;
}

/**
 * En spelare slår an en tangent. Är det nästa ton i melodin kommer gruppen
 * ett steg närmare, annars får den börja om (se docs/koncept.md, Pianot).
 */
export function pressKey({ piano, step, playerId, participantIds, key }: {
  piano: PianoState;
  step: PianoStep;
  playerId: string;
  /** I den ordning de gick med, så att tangenterna blir desamma varje gång. */
  participantIds: readonly string[];
  key: unknown;
}): { piano: PianoState } | { refusal: PianoRefusal } {
  if (!isNote(key) || !step.keys.includes(key)) return { refusal: 'unknownKey' };
  const mine = dealKeys(step.keys, listKeyPlayers(piano, participantIds))[playerId] ?? [];
  if (!mine.includes(key)) return { refusal: 'notYourKey' };
  if (isPianoSolved(piano, step)) return { piano };
  const isRight = step.solution.melody[piano.playedCount].note === key;
  return { piano: isRight ? { ...piano, playedCount: piano.playedCount + 1 } : { ...piano, playedCount: 0, wrongNotes: piano.wrongNotes + 1 } };
}

/** En ton i melodin: vilken och hur många slag den varar. */
export type MelodyNote = { note: string; beats: number };

export type PianoView = {
  /** Lyssnaren hör melodin och har inga tangenter. */
  isListener: boolean;
  listenerName: string;
  /** Melodin, bara hos lyssnaren. */
  melody: MelodyNote[] | null;
  beatMs: number;
  /** Spelarens egna tangenter, lägst först. */
  myKeys: { note: string; name: string }[];
  playedCount: number;
  noteCount: number;
  wrongNotes: number;
};

export function describePiano({ piano, step, viewerId, participantIds, listenerName }: {
  piano: PianoState;
  step: PianoStep;
  viewerId: string;
  participantIds: readonly string[];
  listenerName: string;
}): PianoView {
  const isListener = piano.listenerId === viewerId;
  const mine = dealKeys(step.keys, listKeyPlayers(piano, participantIds))[viewerId] ?? [];
  return {
    isListener,
    listenerName,
    melody: isListener ? step.solution.melody : null,
    beatMs: step.beatMs,
    myKeys: step.keys.filter((key) => mine.includes(key)).map((note) => ({ note, name: nameNote(note) })),
    playedCount: piano.playedCount,
    noteCount: step.solution.melody.length,
    wrongNotes: piano.wrongNotes,
  };
}

/** Facit, så som spelledaren ser det: tonernas namn i ordning. */
export function describePianoSolution(step: PianoStep): string {
  return `Melodin: ${step.solution.melody.map((tone) => nameNote(tone.note)).join(' ')}`;
}

function isMelodyNote(value: unknown, keys: readonly unknown[]): boolean {
  const tone = value as Partial<MelodyNote> | null;
  return !!tone && typeof tone === 'object' && keys.includes(tone.note) && typeof tone.beats === 'number' && tone.beats > 0 && tone.beats <= MAX_BEATS;
}

/** Kontrollerar pianot i en uppdragsfil. */
export function findPianoErrors(step: Record<string, unknown>, name: string): string[] {
  const errors: string[] = [];
  const { keys, beatMs } = step;
  const hasKeys = Array.isArray(keys) && keys.length >= 2 && keys.every(isNote) && new Set(keys).size === keys.length;
  if (!hasKeys) errors.push(`${name} ska ha minst två olika tangenter, som C4 eller F#4`);
  if (!(typeof beatMs === 'number' && beatMs >= MIN_BEAT_MS && beatMs <= MAX_BEAT_MS)) errors.push(`${name} ska ha ett slag på ${MIN_BEAT_MS} till ${MAX_BEAT_MS} millisekunder`);
  const melody = (step.solution as { melody?: unknown } | undefined)?.melody;
  const isMelody = Array.isArray(melody) && melody.length >= MIN_MELODY_NOTES && melody.every((tone) => isMelodyNote(tone, hasKeys ? keys : []));
  if (!isMelody) errors.push(`${name} ska ha en melodi på minst ${MIN_MELODY_NOTES} toner, alla bland tangenterna och högst ${MAX_BEATS} slag långa`);
  if (step.callsFromHouse !== undefined && typeof step.callsFromHouse !== 'boolean') errors.push(`${name} har callsFromHouse som inte är sant eller falskt`);
  if (step.goTo !== undefined || step.textAtPlace !== undefined || step.roles !== undefined) errors.push(`${name} är ett piano och kan inte ha plats eller roller`);
  return errors;
}

/** Läser ett sparat piano, eller null om det saknas eller är trasigt. */
export function readPianoState(saved: unknown): PianoState | null {
  if (!saved || typeof saved !== 'object') return null;
  const fields = saved as Record<string, unknown>;
  const isCount = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
  if (!isCount(fields.playedCount) || !isCount(fields.wrongNotes)) return null;
  return {
    listenerId: typeof fields.listenerId === 'string' ? fields.listenerId : null,
    playedCount: fields.playedCount as number,
    wrongNotes: fields.wrongNotes as number,
  };
}
