// Renderar hemskärmsikonerna i public/icons/ från SVG-filerna med Chromium.
// Kör: node tools/ikoner.mjs. Görs om när favicon.svg eller ikonernas SVG ändras.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright läses med require, så att den förinstallerade globala versionen
// hittas utan att läggas till i package.json.
const { chromium } = createRequire(import.meta.url)('playwright');

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const ICONS = [
  ['favicon.svg', 'icons/icon-192.png', 192],
  ['favicon.svg', 'icons/icon-512.png', 512],
  ['icons/icon-maskable.svg', 'icons/icon-maskable-512.png', 512],
  ['icons/apple-touch-icon.svg', 'icons/apple-touch-icon.png', 180],
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [source, target, size] of ICONS) {
  const svg = fs.readFileSync(path.join(PUBLIC, source), 'utf8');
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.screenshot({ path: path.join(PUBLIC, target), omitBackground: true });
}
await browser.close();
