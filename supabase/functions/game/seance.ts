/**
 * Uppgiftstypen Samtidigt, så som Seansen använder den. Alla håller sin
 * planchett på brädet och följer ett sken från bokstav till bokstav. Skenet
 * väntar tills allas planchetter är framme. Bokstaven syns bara hos en
 * spelare, som läser upp den. Lyfter någon fingret börjar meddelandet om
 * (Jonas 2026-11-17).
 *
 * Rena funktioner utan klocka: serverns tid skickas in. Brädet är mörkt och
 * har inga bokstäver, så att den som bara ser skenet inte kan läsa
 * meddelandet själv. Se docs/koncept.md, Seansen.
 */

import type { PlayerRecord } from './state.ts';

/** Brädet är ett rutnät utan bokstäver. Skenet stannar mitt i en ruta. */
export const BOARD_COLUMNS = 5;
export const BOARD_ROWS = 6;
const BOARD_CELLS = BOARD_COLUMNS * BOARD_ROWS;

/** Hur länge skenet står kvar på en tagen bokstav innan det glider vidare, så att den som ser den hinner läsa. */
export const GLOW_PAUSE_MS = 1500;
/** Hur länge skenet glider mellan två rutor. */
export const GLOW_GLIDE_MS = 1200;

/** Bokstäverna som ett meddelande får ha. Mellanslag skiljer orden. */
export const SEANCE_LETTERS = /^[A-ZÅÄÖ]+( [A-ZÅÄÖ]+)*$/;

export type SeanceState = {
  /** Bokstaven som skenet är på väg till eller står på. Lika med antalet bokstäver när meddelandet är klart. */
  letterIndex: number;
  /** De vars planchett är på skenet vid den aktuella bokstaven. */
  followerIds: string[];
  /** Spelarna i den ordning de läser bokstäverna. Bestäms när gruppen kommer till steget. */
  readerIds: string[];
  /** Serverns tid när skenet börjar glida till den aktuella bokstaven. Null vid första bokstaven. */
  glowMovesAtMs: number | null;
  /** Den som senast bröt kontakten, så att gruppen ser vem som släppte. */
  brokenBy: { playerId: string; atMs: number } | null;
};

/** Det spelaren gör med planchetten. Mobilen avgör själv om planchetten är på skenet. */
export type BoardTouch = 'onGlow' | 'offGlow' | 'lifted';

export function readBoardTouch(touch: unknown): BoardTouch | null {
  return touch === 'onGlow' || touch === 'offGlow' || touch === 'lifted' ? touch : null;
}

/** Meddelandets bokstäver utan mellanslag, och vilka som börjar ett nytt ord. */
export function splitMessage(message: string): { letter: string; startsWord: boolean }[] {
  return message.split(' ').flatMap((word) => [...word].map((letter, index) => ({ letter, startsWord: index === 0 })));
}

export function startSeance(players: readonly PlayerRecord[]): SeanceState {
  return { letterIndex: 0, followerIds: [], readerIds: players.map((player) => player.id), glowMovesAtMs: null, brokenBy: null };
}

export function isSeanceComplete(seance: SeanceState, message: string): boolean {
  return seance.letterIndex >= splitMessage(message).length;
}

/** Konstanterna i hashfunktionen FNV-1a för 32 bitar. */
const FNV_OFFSET = 2166136261;
const FNV_PRIME = 16777619;

/** Ett enkelt hashvärde, så att skenets väg blir densamma varje gång vyn byggs. */
function hashText(text: string): number {
  let hash = FNV_OFFSET;
  for (const character of text) hash = Math.imul(hash ^ (character.codePointAt(0) ?? 0), FNV_PRIME);
  return hash >>> 0;
}

/**
 * Rutan där skenet står vid en bokstav. Vägen beror på steget och inte på
 * bokstäverna, så att samma bokstav inte alltid hamnar på samma ruta och
 * gruppen inte kan lära sig brädet. Två bokstäver i rad står aldrig i samma
 * ruta, så att skenet alltid flyttar sig.
 */
export function findGlowCell(stepId: string, letterIndex: number): number {
  const cell = hashText(`${stepId}:${letterIndex}`) % BOARD_CELLS;
  if (letterIndex === 0) return cell;
  return cell === findGlowCell(stepId, letterIndex - 1) ? (cell + 1) % BOARD_CELLS : cell;
}

/** Den som läser bokstaven. Turen går runt bland spelarna. */
export function findReaderId(seance: SeanceState, letterIndex: number): string | null {
  if (seance.readerIds.length === 0) return null;
  return seance.readerIds[letterIndex % seance.readerIds.length];
}

/**
 * För in en spelares planchett. När allas planchetter är på skenet är
 * bokstaven tagen, och skenet glider vidare efter en paus. Att lyfta fingret
 * bryter kontakten och meddelandet börjar om, men bara om det har börjat.
 * En handling för en äldre bokstav än den aktuella har kommit för sent och
 * ändrar ingenting.
 */
export function applyBoardTouch({ seance, message, participantIds, playerId, touch, letterIndex, nowMs }: {
  seance: SeanceState;
  message: string;
  participantIds: readonly string[];
  playerId: string;
  touch: BoardTouch;
  letterIndex: number;
  nowMs: number;
}): SeanceState {
  if (isSeanceComplete(seance, message)) return seance;
  const others = seance.followerIds.filter((id) => id !== playerId);
  if (touch === 'lifted') {
    if (seance.letterIndex === 0) return { ...seance, followerIds: others };
    return { ...seance, letterIndex: 0, followerIds: [], glowMovesAtMs: null, brokenBy: { playerId, atMs: nowMs } };
  }
  if (letterIndex !== seance.letterIndex) return seance;
  if (touch === 'offGlow') return { ...seance, followerIds: others };
  const followerIds = [...others, playerId];
  const isEveryoneOn = participantIds.length > 0 && participantIds.every((id) => followerIds.includes(id));
  if (!isEveryoneOn) return { ...seance, followerIds };
  return { ...seance, letterIndex: seance.letterIndex + 1, followerIds: [], glowMovesAtMs: nowMs + GLOW_PAUSE_MS };
}

/** Det en spelare ser av seansen. Bara den som läser bokstaven får den. */
export type SeanceView = {
  /** Rutan som skenet står på eller glider till. */
  glowCell: number;
  /** Rutan som skenet glider från, eller null om det inte flyttar sig. */
  previousCell: number | null;
  /** Serverns tid när skenet börjar glida. */
  glowMovesAtMs: number | null;
  letterIndex: number;
  letterCount: number;
  followerCount: number;
  playerCount: number;
  isMeOnGlow: boolean;
  /** Den senast tagna bokstaven, bara hos den som ska läsa upp den. */
  myLetter: { letter: string; startsWord: boolean } | null;
  isComplete: boolean;
  /** Namnet på den som bröt kontakten senast, och när. */
  brokenBy: { name: string; atMs: number } | null;
};

export function describeSeance({ seance, stepId, message, players, participantCount, viewerId }: {
  seance: SeanceState;
  stepId: string;
  message: string;
  /** Alla i spelet, för namnet på den som bröt kontakten. */
  players: readonly PlayerRecord[];
  participantCount: number;
  viewerId: string;
}): SeanceView {
  const letters = splitMessage(message);
  const isComplete = isSeanceComplete(seance, message);
  // När meddelandet är klart står skenet kvar på sista bokstaven.
  const shownIndex = Math.min(seance.letterIndex, letters.length - 1);
  const takenIndex = seance.letterIndex - 1;
  const isMyLetter = takenIndex >= 0 && findReaderId(seance, takenIndex) === viewerId;
  const isMoving = seance.glowMovesAtMs !== null && takenIndex >= 0 && !isComplete;
  const breaker = players.find((player) => player.id === seance.brokenBy?.playerId);
  return {
    glowCell: findGlowCell(stepId, shownIndex),
    previousCell: isMoving ? findGlowCell(stepId, takenIndex) : null,
    glowMovesAtMs: isMoving ? seance.glowMovesAtMs : null,
    letterIndex: seance.letterIndex,
    letterCount: letters.length,
    followerCount: seance.followerIds.length,
    playerCount: participantCount,
    isMeOnGlow: seance.followerIds.includes(viewerId),
    myLetter: isMyLetter ? letters[takenIndex] : null,
    isComplete,
    brokenBy: seance.brokenBy && breaker ? { name: breaker.name, atMs: seance.brokenBy.atMs } : null,
  };
}

function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/** Läser en sparad seans, eller null om den saknas eller är trasig. */
export function readSeanceState(saved: unknown): SeanceState | null {
  if (!saved || typeof saved !== 'object') return null;
  const fields = saved as Record<string, unknown>;
  if (!Number.isInteger(fields.letterIndex) || !isStringList(fields.followerIds) || !isStringList(fields.readerIds)) return null;
  const glowMovesAtMs = typeof fields.glowMovesAtMs === 'number' ? fields.glowMovesAtMs : null;
  const broken = fields.brokenBy as Record<string, unknown> | null | undefined;
  const brokenBy = broken && typeof broken.playerId === 'string' && typeof broken.atMs === 'number' ? { playerId: broken.playerId, atMs: broken.atMs } : null;
  return { letterIndex: fields.letterIndex as number, followerIds: fields.followerIds, readerIds: fields.readerIds, glowMovesAtMs, brokenBy };
}
