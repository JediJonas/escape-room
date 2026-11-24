/**
 * En notis i tidningen, som ett av spelarens egna urklipp. Första meningen
 * blir rubrik och resten texten under (Jonas 2026-11-23). En notis med bara
 * en mening har ingen rubrik.
 */
export function splitNotice(text: string): { heading: string | null; body: string } {
  const end = text.indexOf('. ');
  if (end === -1) return { heading: null, body: text };
  return { heading: text.slice(0, end), body: text.slice(end + 2) };
}

const FRAME_EVERY = 2;

/**
 * Om notisen har en svart ram, som en annons i tidningen. Vissa har det men
 * inte alla, och samma text får alltid samma svar (Jonas 2026-11-23).
 */
export function isFramedNotice(text: string): boolean {
  let sum = 0;
  for (const char of text) sum += char.codePointAt(0) ?? 0;
  return sum % FRAME_EVERY === 0;
}

/** En svart symbol i notisen, som i en tidning. */
export type NoticeSymbol = 'rings' | 'cross';

const SYMBOLS: readonly { heading: RegExp; symbol: NoticeSymbol }[] = [
  { heading: /^förlovning/iu, symbol: 'rings' },
  { heading: /^(döds|begravning)/iu, symbol: 'cross' },
];

/**
 * Förlovningsannonsen har två ringar och dödsrunan ett kors, som i en
 * tidning (Jonas 2026-11-24). Rubriken avgör vilken symbol det blir.
 */
export function findNoticeSymbol(heading: string | null): NoticeSymbol | null {
  if (!heading) return null;
  return SYMBOLS.find((entry) => entry.heading.test(heading))?.symbol ?? null;
}
