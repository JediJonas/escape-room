/**
 * Ritar en QR-kod som en enda SVG-sökväg, en ruta per mörk modul. Själva
 * kodningen görs av qrcode-generator, som bara laddas där koden visas.
 */

/** QR-standarden kräver fyra modulers ljus marginal runt koden. */
export const QR_QUIET_ZONE_MODULES = 4;

export function buildQrPath(moduleCount: number, isDark: (row: number, column: number) => boolean): string {
  const squares: string[] = [];
  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      if (isDark(row, column)) squares.push(`M${column + QR_QUIET_ZONE_MODULES} ${row + QR_QUIET_ZONE_MODULES}h1v1h-1z`);
    }
  }
  return squares.join('');
}

export function getQrViewBoxSize(moduleCount: number): number {
  return moduleCount + 2 * QR_QUIET_ZONE_MODULES;
}
