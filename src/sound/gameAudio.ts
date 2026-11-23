/**
 * Spelets enda ljudmotor. Den låses upp vid varje tryck i spelet, så att ljud
 * i senare uppgifter kan spelas utan ett nytt tryck, också efter en omladdning
 * eller när en uppgift som pianot öppnas innan någon scen har bett om ljud.
 * Se docs/koncept.md, Mobilens funktioner.
 */

import { createAudioEngine } from './audioEngine.ts';

export const gameAudio = createAudioEngine();

/**
 * Händelser som räknas som ett tryck när ljud ska låsas upp. På iPhone räknas
 * inte pointerdown från ett finger, bara när fingret lyfts. Därför lyssnar
 * spelet på dessa och inte på pointerdown.
 */
const UNLOCKING_EVENTS = ['pointerup', 'touchend', 'click', 'keydown'] as const;

let isListening = false;

/** Låser upp ljudmotorn vid varje tryck på sidan. Anropas en gång när spelet visas. */
export function unlockAudioOnEveryTap() {
  if (isListening) return;
  isListening = true;
  const unlock = () => gameAudio.unlock();
  for (const type of UNLOCKING_EVENTS) document.addEventListener(type, unlock, { capture: true, passive: true });
}
