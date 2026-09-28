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

// Owner decision D6 (2026-09-28): one touch on Żaromir answers at once, so the player's question is gone.
test('the player has no talk line any more', () => {
  expect(Object.keys((catalogs.en as { room: { player: object } }).room.player)).not.toContain('talk');
  expect(Object.keys((catalogs.pl as { room: { player: object } }).room.player)).not.toContain('talk');
});

test('the hint lines match the specification', () => {
  // Owner decision D4 (2026-09-28): one short sentence each, the counts sit in the counters.
  expect(pl.t('room.talk.hint.paused')).toBe('Twoja pauza trwa, a powrót czeka w Ustawieniach.');
  expect(en.t('room.talk.hint.paused')).toBe('Your pause is on, and Settings will bring you back.');
  expect(pl.t('room.talk.hint.none')).toBe('Ogień czeka na Twoją pierwszą Przysięgę.');
  expect(en.t('room.talk.hint.none')).toBe('The fire is waiting for your first Oath.');
  expect(pl.t('room.talk.hint.current')).toBe('Twoje Przysięgi czekają przy pieczęciach.');
  expect(en.t('room.talk.hint.current')).toBe('Your Oaths are waiting at the seals.');
  expect(pl.t('room.talk.hint.unavailable')).toBe('Nie widzę teraz kroniki, zajrzyj za chwilę.');
  expect(en.t('room.talk.hint.unavailable')).toBe('I cannot read the chronicle now, come back in a moment.');
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
