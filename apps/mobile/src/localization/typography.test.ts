import { bindSeparators, bindShortWords, keepSlashJoined, plainText } from './typography';

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

// MVP-22 G30, quality review: the rate-limit waits ("za 5 sekund", "in 5 seconds") could break between the count and its unit.
test('a number keeps a seconds unit on the same line in Polish and English', () => {
  expect(bindShortWords('za 1 sekundę, 2 sekundy, 5 sekund, 1 sekunda', 'pl'))
    .toBe('za 1 sekundę, 2 sekundy, 5 sekund, 1 sekunda');
  expect(bindShortWords('try again in 1 second or 5 seconds', 'en')).toBe('try again in 1 second or 5 seconds');
  // A longer word that starts like the unit keeps its space.
  expect(bindShortWords('5 sekundnik, 2 secondary', 'en')).toBe('5 sekundnik, 2 secondary');
});

test('a number before another word, or a unit inside a longer word, keeps its space', () => {
  expect(bindShortWords('pt 2 paź 18:00', 'pl')).toBe('pt 2 paź 18:00');
  expect(bindShortWords('3 dniach i 5 hours', 'en')).toBe('3 dniach i 5 hours');
  expect(bindShortWords('starter_02 history', 'en')).toBe('starter_02 history');
});

// MVP-22-G24b: at the largest text "15:32 ·" | "Warszawa" left a separator at a line end. The dot now starts the next line with its segment.
test('a middle-dot separator never ends a line, the space after it is a no-break space in every language', () => {
  expect(bindSeparators('Aktywna · termin pt 2 paź 15:32 · Warszawa')).toBe('Aktywna ·\u00a0termin pt 2 paź 15:32 ·\u00a0Warszawa');
  expect(bindSeparators('Running · Fri, Oct 2, 15:32 · Warsaw')).toBe('Running ·\u00a0Fri, Oct 2, 15:32 ·\u00a0Warsaw');
  expect(bindSeparators('A·B and a lone · at the end ·')).toBe('A·B and a lone ·\u00a0at the end ·');
});

test('bound prose applies the separator rule in Polish and English, with single-letter words bound only in Polish', () => {
  expect(bindShortWords('Bieganie · pt 2 paź 06:29 · Warszawa i w domu', 'pl')).toBe('Bieganie ·\u00a0pt 2 paź 06:29 ·\u00a0Warszawa i\u00a0w\u00a0domu');
  expect(bindShortWords('Running · a walk · Warsaw', 'en')).toBe('Running ·\u00a0a walk ·\u00a0Warsaw');
});

test('a spoken label turns drawn bindings back to plain text', () => {
  expect(plainText(keepSlashJoined(bindShortWords('Kowadło z kłódką · 15 XP · Europe/Warsaw', 'pl')))).toBe('Kowadło z kłódką · 15 XP · Europe/Warsaw');
  expect(plainText('plain text')).toBe('plain text');
});
