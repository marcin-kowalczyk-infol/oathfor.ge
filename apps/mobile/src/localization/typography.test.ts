import { bindShortWords, keepSlashJoined } from './typography';

test('Polish single-letter words stay with the next word', () => {
  expect(bindShortWords('nie zegar w telefonie. Gdy minie termin z zasad, i w domu', 'pl'))
    .toBe('nie zegar w telefonie. Gdy minie termin z zasad, i w domu');
  expect(bindShortWords('A potem O tym', 'pl')).toBe('A potem O tym');
});

test('other languages and longer words keep ordinary spaces', () => {
  expect(bindShortWords('I will tell you a rule', 'en')).toBe('I will tell you a rule');
  expect(bindShortWords('od razu we wtorek', 'pl')).toBe('od razu we wtorek');
});

test('opening punctuation, repeated spaces, existing non-breaking spaces and regional Polish are handled', () => {
  expect(bindShortWords('(w domu) „i tak', 'pl-PL')).toBe('(w domu) „i tak');
  expect(bindShortWords('a w domu', 'pl')).toBe('a w domu');
  expect(bindShortWords('w  domu', 'pl')).toBe('w domu');
});

test('a slash between letters is joined to the next word, so a zone such as Europe/Warsaw never breaks after the slash', () => {
  expect(keepSlashJoined('na przykład Europe/Warsaw. Możesz')).toBe('na przykład Europe/\u2060Warsaw. Możesz');
  expect(keepSlashJoined('America/Argentina/Buenos_Aires')).toBe('America/\u2060Argentina/\u2060Buenos_Aires');
  expect(keepSlashJoined('1/2 i dowód / zdjęcie')).toBe('1/2 i dowód / zdjęcie');
});
