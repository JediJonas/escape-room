import { useEffect } from 'react';
import { type MissionTheme, type ThemeFont, listThemeProperties } from '../../supabase/functions/game/theme.ts';

/** Typsnitt som redan är tillagda, så att samma fil bara hämtas en gång. */
const addedFonts = new Set<string>();

/** Lägger till uppdragets typsnitt. Mobilen hämtar filen först när en text använder det. */
function addFonts(fonts: readonly ThemeFont[]) {
  if (typeof FontFace === 'undefined') return;
  for (const font of fonts) {
    if (addedFonts.has(font.file)) continue;
    addedFonts.add(font.file);
    const face = new FontFace(font.family, `url(${import.meta.env.BASE_URL}${font.file}) format('woff2')`, {
      weight: font.weight ?? '400',
      style: font.style ?? 'normal',
      display: 'swap',
    });
    document.fonts.add(face);
  }
}

/**
 * Sätter uppdragets tema på sidan medan skärmen visas, och tar bort det
 * igen efteråt, så att startsidan får motorns neutrala färger
 * (Jonas 2026-11-23). Utan tema används motorns standard.
 */
export function useMissionTheme(theme: MissionTheme | null) {
  const key = JSON.stringify(theme);
  useEffect(() => {
    const parsed = JSON.parse(key) as MissionTheme | null;
    const properties = listThemeProperties(parsed);
    const root = document.documentElement.style;
    for (const [name, value] of properties) root.setProperty(name, value);
    addFonts(parsed?.fonts ?? []);
    return () => {
      for (const [name] of properties) root.removeProperty(name);
    };
  }, [key]);
}
