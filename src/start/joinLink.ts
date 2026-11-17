/**
 * Länken i QR-koden. Den leder till startsidan med koden ifylld, så att den
 * som skannar bara behöver skriva sitt namn.
 */

import { normalizeJoinCode } from '../../supabase/functions/game/joinCode.ts';

const JOIN_CODE_PARAMETER = 'kod';

export function buildJoinUrl(pageUrl: string, joinCode: string): string {
  const url = new URL(pageUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set(JOIN_CODE_PARAMETER, joinCode);
  return url.toString();
}

/** Ger koden i adressen, eller en tom text om adressen saknar kod. */
export function readJoinCodeFromUrl(pageUrl: string): string {
  return normalizeJoinCode(new URL(pageUrl).searchParams.get(JOIN_CODE_PARAMETER) ?? '');
}

/** Adressen utan koden, så att en omladdning inte leder tillbaka till formuläret. */
export function removeJoinCodeFromUrl(pageUrl: string): string {
  const url = new URL(pageUrl);
  url.searchParams.delete(JOIN_CODE_PARAMETER);
  return url.toString();
}
