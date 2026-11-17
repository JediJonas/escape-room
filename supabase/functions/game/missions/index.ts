/**
 * Alla uppdrag. Filerna följer bara med serverfunktionen och läggs aldrig ut
 * på webbsidan, se docs/motorn.md. Ett test kontrollerar varje fil mot
 * findMissionErrors och att webbsidan inte hämtar dem.
 */

import type { Mission } from '../mission.ts';
import denFemteGasten from './den-femte-gasten.json' with { type: 'json' };
import prov from './prov.json' with { type: 'json' };

export const MISSIONS: readonly Mission[] = [denFemteGasten as Mission, prov as Mission];

export function getMission(missionId: string): Mission | null {
  return MISSIONS.find((mission) => mission.id === missionId) ?? null;
}
