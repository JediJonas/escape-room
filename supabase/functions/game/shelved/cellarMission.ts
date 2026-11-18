/**
 * Källaren är tagen ur Den femte gästen tills Vera minns och Ritningen finns,
 * och provet slutar efter pianot (Jonas 2026-11-18). Steget sparas här så att
 * testerna fortsätter att köra källaren och så att det går att lägga tillbaka.
 * Filen läses bara av testerna.
 */

import type { Mission, MissionStep } from '../mission.ts';
import cellarStep from './kallaren.json' with { type: 'json' };

/** Uppdraget med källaren före sluttexten, som Den femte gästen var innan källaren sparades undan. */
export function withCellar(mission: Mission): Mission {
  return {
    ...mission,
    id: `${mission.id}-med-kallaren`,
    steps: [...mission.steps.slice(0, -1), cellarStep as MissionStep, mission.steps.at(-1)!],
  };
}
