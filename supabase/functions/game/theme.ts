/**
 * Uppdragets tema: färger, typsnitt, papper, bakgrund och ornament. Motorn
 * äger formen, uppdraget äger stämningen (Jonas 2026-11-23). Ett uppdrag får
 * bara skriva över tokens i listan nedan. Storlekar, avstånd och placering
 * är motorns. Se granskning/designsystem/designforslag.md och
 * src/theme/tokens.css.
 */

/** De CSS-variabler som ett uppdrag får skriva över, utan de två strecken. */
export const THEME_TOKENS = [
  'bg',
  'bg-image',
  'surface',
  'surface-solid',
  'surface-raised',
  'line',
  'line-strong',
  'text',
  'text-muted',
  'accent',
  'accent-soft',
  'on-accent',
  'glow',
  'paper',
  'paper-ink',
  'paper-line',
  'font-display',
  'font-reading',
  'display-case',
  'display-tracking',
  'display-weight',
  'ornament',
] as const;

export type ThemeToken = (typeof THEME_TOKENS)[number];

/** Ett typsnitt som följer med uppdraget. Filen ligger under public/. */
export type ThemeFont = {
  family: string;
  file: string;
  weight?: string;
  style?: 'normal' | 'italic';
};

export type MissionTheme = {
  tokens: Partial<Record<ThemeToken, string>>;
  fonts?: ThemeFont[];
};

function isThemeToken(name: string): name is ThemeToken {
  return (THEME_TOKENS as readonly string[]).includes(name);
}

/** Ett värde får inte kunna avsluta regeln eller börja en ny. */
function isSafeValue(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && !/[;{}<>]/.test(value);
}

/** Bara typsnitt i woff2 under uppdragets egen mapp, utan steg uppåt. */
function isFontFile(file: unknown): boolean {
  return typeof file === 'string' && /^uppdrag\/[a-z0-9-]+\/[a-z0-9/-]+\.woff2$/.test(file) && !file.includes('..');
}

/** Ger en lista över felen i ett tema, tom om temat är rätt. */
export function findThemeErrors(data: unknown): string[] {
  if (!data || typeof data !== 'object') return ['temat är inte ett objekt'];
  const theme = data as Record<string, unknown>;
  const errors: string[] = [];
  const tokens = theme.tokens;
  if (!tokens || typeof tokens !== 'object') errors.push('temat saknar tokens');
  for (const [name, value] of Object.entries(tokens ?? {})) {
    if (!isThemeToken(name)) errors.push(`temat får inte ändra ${name}`);
    else if (!isSafeValue(value)) errors.push(`temats ${name} har ett ogiltigt värde`);
  }
  if (theme.fonts !== undefined) {
    if (!Array.isArray(theme.fonts)) return [...errors, 'temats typsnitt är inte en lista'];
    for (const font of theme.fonts) {
      if (!isSafeValue(font?.family) || /['"]/.test(font.family)) errors.push('ett typsnitt i temat saknar namn');
      if (!isFontFile(font?.file)) errors.push(`typsnittet ${String(font?.family)} ska vara en woff2-fil under uppdrag/`);
      if (font?.weight !== undefined && !/^\d{3}( \d{3})?$/.test(font.weight)) errors.push(`typsnittet ${String(font?.family)} har en ogiltig vikt`);
      if (font?.style !== undefined && font.style !== 'normal' && font.style !== 'italic') errors.push(`typsnittet ${String(font?.family)} har en ogiltig stil`);
    }
  }
  return errors;
}

/** Temats variabler som namn och värde, i listans ordning, så som mobilen sätter dem på sidan. */
export function listThemeProperties(theme: MissionTheme | null): [string, string][] {
  if (!theme) return [];
  return THEME_TOKENS.flatMap((name) => {
    const value = theme.tokens[name];
    return value === undefined ? [] : [[`--${name}`, value] as [string, string]];
  });
}
