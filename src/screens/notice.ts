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
