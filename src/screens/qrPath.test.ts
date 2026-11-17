import assert from 'node:assert/strict';
import { test } from 'vitest';
import { buildQrPath, getQrViewBoxSize } from './qrPath.ts';

test('varje mörk modul blir en ruta, förskjuten med marginalen', () => {
  const path = buildQrPath(2, (row, column) => row === column);
  assert.equal(path, 'M4 4h1v1h-1zM5 5h1v1h-1z');
});

test('ritytan rymmer koden och marginalen på båda sidor', () => {
  assert.equal(getQrViewBoxSize(21), 29);
});
