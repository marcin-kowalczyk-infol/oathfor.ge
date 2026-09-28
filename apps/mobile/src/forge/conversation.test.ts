import { createTranslation } from '../localization/createTranslation';
import { validateCatalogs } from '../localization/validateCatalogs';
import { catalogs } from '../localization/createTranslation';
import { chapterScript, guideScript, playerLineKey, visitScript } from './conversation';

const pl = createTranslation('pl');
const en = createTranslation('en');
const forms = ['masculine', 'feminine', 'neutral'] as const;

// docs/product/forge-scene.md "Player lines", binding copy.
const lines = {
  hearth: ['Ten ogień aż parzy. Co tu się wykuwa?', 'This fire burns hot. What is forged here?'],
  seals: ['Te pieczęcie świecą. Czyje to obietnice?', 'These seals are glowing. Whose promises are they?'],
  chronicle: ['Kto to wszystko zapisał?', 'Who wrote all of this down?'],
  door: ['Już mam wyjść?', 'Should I leave already?'],
  'tutorial.hearth': ['Pokaż mi, jak to się zaczyna.', 'Show me how it begins.'],
  'tutorial.seals': ['Co znaczą te znaki?', 'What do these marks mean?'],
  talk: ['Jak mi idzie?', 'How am I doing?'],
} as const;
const gendered = {
  'tutorial.chronicle': [['Czy tu zostanie wszystko, co zrobiłem?', 'Czy tu zostanie wszystko, co zrobiłam?', 'Czy tu zostanie wszystko, co uda mi się zrobić?'], 'Will everything I did stay here?'],
  'tutorial.door': [['A jeśli będę musiał przerwać?', 'A jeśli będę musiała przerwać?', 'A jeśli przyjdzie mi przerwać?'], 'And if I have to stop?'],
} as const;

test('every player line resolves by form in both languages', () => {
  for (const [key, [polish, english]] of Object.entries(lines)) for (const form of forms) {
    expect(pl.t(playerLineKey(key as keyof typeof lines, form))).toBe(polish);
    expect(en.t(playerLineKey(key as keyof typeof lines, form))).toBe(english);
  }
  for (const [key, [polish, english]] of Object.entries(gendered)) forms.forEach((form, index) => {
    expect(pl.t(playerLineKey(key as keyof typeof gendered, form))).toBe(polish[index]);
    expect(en.t(playerLineKey(key as keyof typeof gendered, form))).toBe(english);
  });
});

test('the hint lines match the specification', () => {
  expect(pl.t('room.talk.hint.paused')).toBe('Twoja pauza trwa. Kiedy zechcesz wrócić, zajrzyj do Ustawień.');
  expect(en.t('room.talk.hint.paused')).toBe('Your pause is on. When you want to return, look in Settings.');
  expect(pl.t('room.talk.hint.none')).toBe('Ogień czeka. Przy palenisku ukształtujesz pierwszą Przysięgę.');
  expect(en.t('room.talk.hint.none')).toBe('The fire is waiting. At the hearth you can shape your first Oath.');
  expect(pl.t('room.talk.hint.current', { count: 3 })).toBe('Masz bieżące Przysięgi: 3. Zajrzyj do pieczęci.');
  expect(en.t('room.talk.hint.current', { count: 3 })).toBe('You have 3 current Oaths. Take a look at the seals.');
  expect(pl.t('room.talk.hint.unavailable')).toBe('Nie widzę dziś kroniki wyraźnie. Spróbuj za chwilę.');
  expect(en.t('room.talk.hint.unavailable')).toBe('I cannot read the chronicle clearly right now. Try again in a moment.');
  expect(pl.t('room.talk.label')).toBe('Żaromir, twoje postępy');
  expect(en.t('room.talk.label')).toBe('Zharomir, your progress');
});

test('a visit is the player line, then Żaromir\'s description, then the place action', () => {
  expect(visitScript('seals', 'feminine')).toEqual([
    { speaker: 'player', key: 'room.player.seals' },
    { speaker: 'guide', key: 'room.descriptions.seals' },
    { action: 'seals' },
  ]);
});

test('a chapter opens with the player line and counts only Żaromir\'s lines', () => {
  const script = chapterScript('hearth', 'masculine');
  expect(script).toHaveLength(5);
  expect(script[0]).toEqual({ speaker: 'player', key: 'room.player.tutorial.hearth' });
  expect(script.slice(1).map(line => line.key)).toEqual([1, 2, 3, 4].map(line => `room.tutorial.hearth.${line}`));
  expect(script[2]).toEqual({ speaker: 'guide', key: 'room.tutorial.hearth.2', step: { line: 2, lines: 4 } });
});

test('the chronicle and door chapters open with the line for the character\'s form', () => {
  expect(chapterScript('chronicle', 'feminine')[0].key).toBe('room.player.tutorial.chronicle.feminine');
  expect(chapterScript('door', 'neutral')[0].key).toBe('room.player.tutorial.door.neutral');
  expect(pl.t(chapterScript('door', 'neutral')[0].key)).toBe('A jeśli przyjdzie mi przerwać?');
});

test('the first-visit guide is Żaromir alone', () => {
  expect(guideScript('chronicle')).toEqual([{ speaker: 'guide', key: 'room.guide.chronicle' }]);
});

test('the new copy keeps the catalogs valid', () => {
  expect(validateCatalogs(catalogs)).toEqual([]);
});
