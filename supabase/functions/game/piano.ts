/**
 * Uppgiftstypen Orkestern, så som Pianot använder den. Melodin spelas högt
 * från en spelares mobil, så att alla hör den. De andra har några av pianots
 * tangenter var, och den som spelar melodin har inga (Jonas 2026-11-18).
 * Gruppen får spela som den vill, och inget säger till om en fel ton.
 * Uppgiften är klar när de senaste tonerna som spelats är melodin
 * (Jonas 2026-11-18). Se docs/koncept.md, Pianot.
 *
 * Rena funktioner. Vilka tangenter en spelare har räknas fram ur ordningen
 * spelarna gick med i, så att bara vems mobil som spelar melodin och de
 * senaste tonerna sparas.
 */

import type { PianoStep } from './mission.ts';

export type PianoState = {
  /** Den vars mobil spelar melodin. Väljs när gruppen kommer till steget. */
  melodyPlayerId: string | null;
  /** De senaste tonerna som gruppen har spelat, högst lika många som melodin har. */
  recentKeys: string[];
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

export function startPiano(melodyPlayerId: string | null): PianoState {
  return { melodyPlayerId, recentKeys: [] };
}

/**
 * Delar tangenterna mellan spelarna utom den som spelar melodin. Alla får minst en
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
  return participantIds.filter((playerId) => playerId !== piano.melodyPlayerId);
}

/** Klart när de senaste tonerna är melodin, i rätt ordning. */
export function isPianoSolved(piano: PianoState, step: PianoStep): boolean {
  const { melody } = step.solution;
  return piano.recentKeys.length === melody.length && melody.every((tone, index) => tone.note === piano.recentKeys[index]);
}

/** En spelare slår an en tangent. Tonen läggs sist bland de senaste. */
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
  return { piano: { ...piano, recentKeys: [...piano.recentKeys, key].slice(-step.solution.melody.length) } };
}

/** En ton i melodin: vilken och hur många slag den varar. */
export type MelodyNote = { note: string; beats: number };

export type PianoView = {
  /** Om melodin spelas från spelarens mobil. Då har hon inga tangenter. */
  hasMelody: boolean;
  melodyPlayerName: string;
  /** Melodin, bara hos den vars mobil spelar den. */
  melody: MelodyNote[] | null;
  beatMs: number;
  /** Spelarens egna tangenter, lägst först. */
  myKeys: PianoKey[];
};

/** En tangent som spelaren har, med tonen och dess namn. */
export type PianoKey = { note: string; name: string };

/** Spelarens tangenter, lägst först. */
export function listMyKeys(keys: readonly string[], keyPlayerIds: readonly string[], viewerId: string): PianoKey[] {
  const mine = dealKeys(keys, keyPlayerIds)[viewerId] ?? [];
  return keys.filter((key) => mine.includes(key)).map((note) => ({ note, name: nameNote(note) }));
}

export function describePiano({ piano, step, viewerId, participantIds, melodyPlayerName }: {
  piano: PianoState;
  step: PianoStep;
  viewerId: string;
  participantIds: readonly string[];
  melodyPlayerName: string;
}): PianoView {
  const hasMelody = piano.melodyPlayerId === viewerId;
  return {
    hasMelody,
    melodyPlayerName,
    melody: hasMelody ? step.solution.melody : null,
    beatMs: step.beatMs,
    myKeys: listMyKeys(step.keys, listKeyPlayers(piano, participantIds), viewerId),
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
  if (!Array.isArray(fields.recentKeys)) return null;
  return {
    melodyPlayerId: typeof fields.melodyPlayerId === 'string' ? fields.melodyPlayerId : null,
    recentKeys: fields.recentKeys.filter(isNote),
  };
}
