import { expect, test } from 'vitest';
import { isFramedNotice, splitNotice } from './notice.ts';

test('första meningen blir rubrik, utan punkt', () => {
  expect(splitNotice('Kyrkonytt. Kantor Sven Dahl spelar piano vid söndagens gudstjänst.')).toEqual({ heading: 'Kyrkonytt', body: 'Kantor Sven Dahl spelar piano vid söndagens gudstjänst.' });
  expect(splitNotice('Annons. Seanser och spådomar. Fru Lindqvist tar emot på torsdagar.')).toEqual({ heading: 'Annons', body: 'Seanser och spådomar. Fru Lindqvist tar emot på torsdagar.' });
});

test('en notis med en enda mening har ingen rubrik', () => {
  expect(splitNotice('Pipklubben tackar sin kassör.')).toEqual({ heading: null, body: 'Pipklubben tackar sin kassör.' });
});

test('vissa notiser har ram och andra inte, och samma text får alltid samma svar', () => {
  expect(isFramedNotice('Annons. Seanser och spådomar. Fru Lindqvist tar emot på torsdagar.')).toBe(true);
  expect(isFramedNotice('Kyrkonytt. Kantor Sven Dahl spelar piano vid söndagens gudstjänst.')).toBe(false);
});
