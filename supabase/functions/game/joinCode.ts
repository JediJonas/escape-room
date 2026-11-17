/**
 * Koden som spelarna ansluter med: fyra bokstäver. Den läses upp och skrivs
 * in för hand, så bokstäver som är lätta att blanda ihop är borttagna. Utan
 * vokaler kan koden inte heller bilda ett ord.
 */

/** 20 bokstäver ger 160 000 koder. I, O och vokalerna saknas med avsikt. */
export const JOIN_CODE_LETTERS = 'BCDFGHJKLMNPQRSTVWXZ';
export const JOIN_CODE_LENGTH = 4;

/** `randomIndex` ger ett heltal från 0 till men inte med `count`. */
export function createJoinCode(randomIndex: (count: number) => number): string {
  let code = '';
  for (let position = 0; position < JOIN_CODE_LENGTH; position += 1) {
    code += JOIN_CODE_LETTERS[randomIndex(JOIN_CODE_LETTERS.length)];
  }
  return code;
}

/** Tar bort mellanslag och gör om till versaler, som spelaren kan ha skrivit. */
export function normalizeJoinCode(input: string): string {
  return input.replace(/\s/g, '').toUpperCase();
}

export function isValidJoinCode(code: string): boolean {
  return code.length === JOIN_CODE_LENGTH && [...code].every((letter) => JOIN_CODE_LETTERS.includes(letter));
}
