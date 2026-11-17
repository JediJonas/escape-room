/**
 * Spelets enda ljudmotor. Den låses upp när spelaren trycker Klar i en scen
 * som ber om ljud, så att ljud i senare uppgifter kan spelas utan ett nytt
 * tryck. Se docs/koncept.md, Mobilens funktioner.
 */

import { createAudioEngine } from './audioEngine.ts';

export const gameAudio = createAudioEngine();
