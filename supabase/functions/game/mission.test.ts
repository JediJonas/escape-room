import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'vitest';
import { findMissionErrors, listPlaces } from './mission.ts';
import { MISSIONS, getMission } from './missions/index.ts';

const VALID = {
  format: 1,
  id: 'test',
  title: 'Test',
  minPlayers: 3,
  places: { B: 'Hallen', A: 'Källaren' },
  steps: [{ id: 'ett', type: 'scene', text: 'Hej', goTo: 'A', textAtPlace: 'Mörkt' }],
};

test('alla uppdrag följer formatet', () => {
  assert.ok(MISSIONS.length > 0);
  for (const mission of MISSIONS) assert.deepEqual(findMissionErrors(mission), [], mission.id);
});

test('varje uppdragsfil i mappen är med i listan', () => {
  const files = readdirSync(join(import.meta.dirname, 'missions')).filter((file) => file.endsWith('.json'));
  assert.deepEqual(files.map((file) => file.replace('.json', '')).sort(), MISSIONS.map((mission) => mission.id).sort());
});

test('ett korrekt uppdrag har inga fel', () => {
  assert.deepEqual(findMissionErrors(VALID), []);
});

test('skrivfel i ett uppdrag syns i testerna och inte mitt i ett spel', () => {
  const withStep = (step: object) => ({ ...VALID, steps: [{ ...VALID.steps[0], ...step }] });
  assert.match(findMissionErrors({ ...VALID, format: 2 }).join(), /formatet/);
  assert.match(findMissionErrors({ ...VALID, minPlayers: 0 }).join(), /minPlayers/);
  assert.match(findMissionErrors({ ...VALID, places: { G: 'Garaget' } }).join(), /okänd plats: G/);
  assert.match(findMissionErrors(withStep({ type: 'gåta' })).join(), /okänd typ/);
  assert.match(findMissionErrors(withStep({ goTo: 'C' })).join(), /plats som uppdraget saknar: C/);
  assert.match(findMissionErrors(withStep({ goTo: undefined })).join(), /utan plats/);
  assert.match(findMissionErrors({ ...VALID, steps: [VALID.steps[0], VALID.steps[0]] }).join(), /två gånger/);
  assert.match(findMissionErrors({ ...VALID, steps: [] }).join(), /steg saknas/);
  assert.deepEqual(findMissionErrors(null), ['uppdraget är inte ett objekt']);
});

test('platserna listas i ordningen A till F', () => {
  assert.deepEqual(listPlaces(VALID as never), [{ id: 'A', name: 'Källaren' }, { id: 'B', name: 'Hallen' }]);
});

test('ett okänt uppdrag ger null', () => {
  assert.equal(getMission('finns-inte'), null);
  assert.equal(getMission('prov')?.title, 'Provhuset');
});

/** Alla filer under en mapp, för att leta efter otillåtna importer. */
function listSourceFiles(folder: string): string[] {
  return readdirSync(folder, { withFileTypes: true, recursive: true })
    .filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))
    .map((entry) => join(entry.parentPath, entry.name));
}

/** Moduler som hämtar uppdragen. Webbsidan får bara hämta typer ur dem. */
const MODULES_WITH_MISSIONS = /from '[^']*functions\/game\/(handleAction|views|gameStore|index|missions\/[^']*)(\.ts)?'/;

test('webbsidan hämtar aldrig uppdragen, så att facit inte hamnar i bygget', () => {
  const sourceFolder = join(import.meta.dirname, '../../../src');
  for (const file of listSourceFiles(sourceFolder)) {
    const text = readFileSync(file, 'utf8');
    assert.ok(!/import\([^)]*missions/.test(text), file);
    for (const line of text.split('\n').filter((candidate) => MODULES_WITH_MISSIONS.test(candidate))) {
      assert.match(line, /^import type /, `${file}: ${line}`);
    }
  }
});
