/**
 * En fil från webbsidan som en hel CSS-adress. Safari löser en relativ adress
 * i en CSS-variabel mot stilmallen som använder variabeln, och den ligger i
 * assets/, så bilden hittades inte. En hel adress fungerar överallt.
 */
export function toCssUrl(path: string): string {
  return `url("${new URL(`${import.meta.env.BASE_URL}${path}`, document.baseURI).href}")`;
}
