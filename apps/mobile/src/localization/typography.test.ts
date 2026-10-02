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

// MVP-22-B2 (G23): the native check broke "za 15" | "XP." on the review card. A number keeps its unit in every language.
test('a number keeps its unit on the same line in every language', () => {
  expect(bindShortWords('Możesz podjąć Zadanie Powrotu za 15 XP.', 'pl')).toBe('Możesz podjąć Zadanie Powrotu za 15 XP.');
  expect(bindShortWords('15 minut po terminie', 'pl')).toBe('15 minut po terminie');
  expect(bindShortWords('Najdłużej 3 dni, 1 dzień albo 2 godziny', 'pl')).toBe('Najdłużej 3 dni, 1 dzień albo 2 godziny');
  expect(bindShortWords('1 d 15 h, 30 min', 'pl')).toBe('1 d 15 h, 30 min');
  expect(bindShortWords('40 XP for a photo, up to 3 days, 15 minutes', 'en')).toBe('40 XP for a photo, up to 3 days, 15 minutes');
});

test('a number before another word, or a unit inside a longer word, keeps its space', () => {
  expect(bindShortWords('pt 2 paź 18:00', 'pl')).toBe('pt 2 paź 18:00');
  expect(bindShortWords('3 dniach i 5 hours', 'en')).toBe('3 dniach i 5 hours');
  expect(bindShortWords('starter_02 history', 'en')).toBe('starter_02 history');
});
