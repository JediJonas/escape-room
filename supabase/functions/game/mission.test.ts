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

test('roller som inte räcker till tio spelare eller kräver för många syns i testerna', () => {
  const role = (fields: object) => ({ id: 'r', title: 'Roll', count: 1, pieces: ['a'], ...fields });
  const withRoles = (roles: object[]) => ({ ...VALID, steps: [{ ...VALID.steps[0], roles }] });
  assert.deepEqual(findMissionErrors(withRoles([role({}), role({ id: 'resten', count: 'rest', pieces: Array(9).fill('x') })])), []);
  assert.match(findMissionErrors(withRoles([role({ count: 'rest', pieces: ['a', 'b'] })])).join(), /2 bitar men kan få 10 spelare/);
  assert.match(findMissionErrors(withRoles([role({ count: 4, pieces: ['a', 'b', 'c', 'd'] })])).join(), /kräver 4 spelare men uppdraget tillåter 3/);
  assert.match(findMissionErrors(withRoles([role({ count: 'rest', pieces: Array(10).fill('x') }), role({ id: 'två', count: 'rest', pieces: Array(10).fill('x') })])).join(), /mer än en roll med resten/);
  assert.match(findMissionErrors(withRoles([role({ title: '' })])).join(), /saknar titel/);
  assert.match(findMissionErrors(withRoles([role({ count: 0 })])).join(), /ogiltigt antal/);
  assert.match(findMissionErrors(withRoles([])).join(), /inte är en lista/);
  assert.match(findMissionErrors(withRoles([role({ maxPiecesPerPlayer: 0 })])).join(), /ogiltig gräns/);
  assert.match(findMissionErrors(withRoles([role({ goTo: 'F' })])).join(), /plats som uppdraget saknar: F/);
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

test('en uppgift med svar måste ha tre ledtrådar och ett facit', () => {
  const task = (fields: object) => ({ ...VALID, steps: [{ id: 'kod', type: 'answer', text: 'Vad är koden?', hints: ['a', 'b', 'c'], solution: { answers: ['42'] }, ...fields }] });
  assert.deepEqual(findMissionErrors(task({})), []);
  assert.match(findMissionErrors(task({ hints: ['a', 'b'] })).join(), /ska ha 3 ledtrådar/);
  assert.match(findMissionErrors(task({ solution: { answers: [] } })).join(), /saknar svar i facit/);
  assert.match(findMissionErrors(task({ solution: undefined })).join(), /saknar svar i facit/);
  assert.match(findMissionErrors({ ...VALID, steps: [{ ...VALID.steps[0], hints: ['a', 'b', 'c'] }] }).join(), /är en scen men har ledtrådar/);
});

test('en seans måste ha tre ledtrådar och ett meddelande med versaler', () => {
  const seance = (fields: object) => ({ ...VALID, steps: [{ id: 'seansen', type: 'seance', text: 'Följ skenet.', hints: ['a', 'b', 'c'], solution: { message: 'HJÄLP MIG' }, ...fields }] });
  assert.deepEqual(findMissionErrors(seance({})), []);
  assert.match(findMissionErrors(seance({ hints: [] })).join(), /ska ha 3 ledtrådar/);
  for (const message of ['hjälp', 'HJÄLP  MIG', ' HJÄLP', 'HJÄLP!', '', 42]) {
    assert.match(findMissionErrors(seance({ solution: { message } })).join(), /ska ha ett meddelande/, String(message));
  }
  assert.match(findMissionErrors(seance({ goTo: 'A' })).join(), /kan inte ha plats eller roller/);
});

test('rummen måste ha bitar nog för tio spelare och en gäst i facit', () => {
  const pieces = ['Du ser', 'Du hör', 'Klockan'];
  const rooms = (fields: object) => ({
    ...VALID,
    places: { B: 'Hallen', C: 'Köket' },
    steps: [{ id: 'rummen', type: 'rooms', text: 'Gå till ditt rum.', guests: ['Elsa', 'Sven', 'Vera'], rooms: [{ place: 'B', pieces: [...pieces, 'Golvet', 'Taket'] }, { place: 'C', pieces: [...pieces, 'Spisen', 'Kranen'] }], hints: ['a', 'b', 'c'], solution: { guestByPlace: { B: 'Elsa', C: 'Sven' } }, ...fields }],
  });
  assert.deepEqual(findMissionErrors(rooms({})), []);
  assert.match(findMissionErrors(rooms({ rooms: [{ place: 'B', pieces }, { place: 'C', pieces }] })).join(), /ska ha minst 5 bitar/);
  assert.match(findMissionErrors(rooms({ solution: { guestByPlace: { B: 'Elsa', C: 'Okänd' } } })).join(), /rummet C .* saknar en gäst i facit/);
  assert.match(findMissionErrors(rooms({ solution: { guestByPlace: { B: 'Elsa', C: 'Sven', D: 'Vera' } } })).join(), /facit för ett rum som inte finns/);
  assert.match(findMissionErrors(rooms({ rooms: [{ place: 'F', pieces: [...pieces, 'a', 'b'] }] })).join(), /plats som uppdraget saknar: F/);
  assert.match(findMissionErrors(rooms({ guests: ['Elsa', 'Elsa'] })).join(), /minst två gäster med olika namn/);
  assert.match(findMissionErrors(rooms({ goTo: 'B' })).join(), /kan inte ha plats eller roller/);
});

test('bara en scen kan be om tillstånd, och bara om ljud och rörelse', () => {
  const scene = (fields: object) => ({ ...VALID, steps: [{ ...VALID.steps[0], ...fields }] });
  assert.deepEqual(findMissionErrors(scene({ asksFor: ['sound', 'motion'] })), []);
  assert.match(findMissionErrors(scene({ asksFor: ['camera'] })).join(), /ber om tillstånd som inte finns/);
  assert.match(findMissionErrors(scene({ asksFor: 'motion' })).join(), /ber om tillstånd som inte finns/);
});
