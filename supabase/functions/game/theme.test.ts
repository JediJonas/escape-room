import assert from 'node:assert/strict';
import { test } from 'vitest';
import { findThemeErrors, listThemeProperties } from './theme.ts';

const FONT = { family: 'EB Garamond', file: 'uppdrag/den-femte-gasten/typsnitt/eb-garamond.woff2', weight: '400 600' };

test('ett tema med färger och typsnitt har inga fel', () => {
  assert.deepEqual(findThemeErrors({ tokens: { accent: '#e8b86c', 'font-reading': "'EB Garamond', serif" }, fonts: [FONT] }), []);
});

test('uppdraget får inte ändra storlekar, avstånd eller placering', () => {
  assert.match(findThemeErrors({ tokens: { tap: '2rem' } }).join(), /får inte ändra tap/);
  assert.match(findThemeErrors({ tokens: { 'stage-max-width': '10rem' } }).join(), /får inte ändra/);
});

test('ett värde kan inte avsluta regeln och börja en ny', () => {
  assert.match(findThemeErrors({ tokens: { accent: 'red; } body { display: none' } }).join(), /ogiltigt värde/);
  assert.match(findThemeErrors({ tokens: { accent: '' } }).join(), /ogiltigt värde/);
});

test('typsnitten ligger som woff2 i uppdragets mapp', () => {
  assert.match(findThemeErrors({ tokens: {}, fonts: [{ ...FONT, file: 'https://example.com/a.woff2' }] }).join(), /woff2-fil/);
  assert.match(findThemeErrors({ tokens: {}, fonts: [{ ...FONT, file: 'uppdrag/x/../../a.woff2' }] }).join(), /woff2-fil/);
  assert.match(findThemeErrors({ tokens: {}, fonts: [{ ...FONT, style: 'oblique' }] }).join(), /stil/);
});

test('temat blir CSS-variabler i listans ordning', () => {
  assert.deepEqual(listThemeProperties({ tokens: { text: '#fff', bg: '#000' } }), [['--bg', '#000'], ['--text', '#fff']]);
  assert.deepEqual(listThemeProperties(null), []);
});
