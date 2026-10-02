import pl from './locales/pl/messages.json';
import en from './locales/en/messages.json';
import plTime from './locales/pl/timePicker.json';
import enTime from './locales/en/timePicker.json';
import { ZAROMIR_POOLS } from '../companion/zaromirLine';
import { pathTimeText } from '../oaths/compactStoredTime';

type Group = Record<string, unknown>;
const group = (catalog: Group, ...path: string[]) => path.reduce<Group>((node, key) => (node?.[key] ?? {}) as Group, catalog);
// The caps (docs/product/clarity.md decision 3) are measured with the detail's own formatter at its longest regular output,
// a Sunday ("niedz" in Polish). The offset added in the one repeated autumn hour is left out, decision 3 says "about 70".
const longest = { pl: pathTimeText({ local: '2026-09-27T18:30:00', timezone: 'Europe/Warsaw', offset: '+02:00' }, 'pl'), en: pathTimeText({ local: '2026-09-27T18:30:00', timezone: 'Europe/Warsaw', offset: '+02:00' }, 'en') };
const sample = (text: string, locale: 'pl' | 'en' = 'pl') => text.replace('{{time}}', longest[locale]).replace('{{date}}', longest[locale]);
const words = (text: string) => text.trim().split(/\s+/).length;
const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter(part => part.trim()).length;
const nextKeys = ['scheduled', 'active', 'activeSoon', 'cutoff', 'interrupted', 'assessing', 'needsMore', 'review', 'closed', 'fulfilled', 'missed', 'unresolved', 'withdrawn'];

test('the cap sample is the formatter output', () => {
  expect(longest).toEqual({ pl: 'niedz\u00a027\u00a0wrz\u00a018:30', en: 'Sun,\u00a0Sep\u00a027,\u00a018:30' });
});

test.each(nextKeys.flatMap(key => [['pl', key], ['en', key]] as const))('%s path.next.%s fits 12 words and 70 characters with real times', (locale, key) => {
  const line = group(locale === 'pl' ? pl : en, 'path', 'next')[key];
  expect(typeof line).toBe('string');
  expect(words(sample(line as string, locale))).toBeLessThanOrEqual(12);
  expect(sample(line as string, locale).length).toBeLessThanOrEqual(70);
});

test.each(Object.entries(ZAROMIR_POOLS))('zaromir.%s has %i lines in both languages, each short', (situation, size) => {
  const indexes = Array.from({ length: size }, (_, index) => String(index));
  expect(Object.keys(group(pl, 'zaromir', situation))).toEqual(indexes);
  expect(Object.keys(group(en, 'zaromir', situation))).toEqual(indexes);
  for (const line of Object.values(group(pl, 'zaromir', situation)) as string[]) {
    expect(words(line)).toBeLessThanOrEqual(12);
    expect(sentences(line)).toBeLessThanOrEqual(2);
  }
  for (const line of Object.values(group(en, 'zaromir', situation)) as string[]) expect(sentences(line)).toBeLessThanOrEqual(2);
});

test('in review Żaromir says one sentence', () => {
  expect(sentences(group(pl, 'zaromir', 'review')['0'] as string)).toBe(1);
  expect(sentences(group(en, 'zaromir', 'review')['0'] as string)).toBe(1);
});

// Review finding, 2026-10-01: bare "rozwaga" reads as prudence. The state is always the set phrase "pod rozwagą".
test('Polish names review only with the set phrase "pod rozwagą"', () => {
  const texts: string[] = [];
  const collect = (node: unknown) => { if (typeof node === 'string') texts.push(node); else if (node && typeof node === 'object') Object.values(node).forEach(collect); };
  collect(pl);
  expect(texts.filter(text => /rozwag/i.test(text.replace(/pod rozwagą/gi, '')))).toEqual([]);
});

test('the pending proof lines keep that nothing changes before the server answers', () => {
  expect(group(pl, 'proof').introFull).toMatch(/dopiero/);
  expect(group(pl, 'proof').sending).toMatch(/dopiero/);
  expect(group(en, 'proof').introFull).toMatch(/only/);
  expect(group(en, 'proof').sending).toMatch(/only/);
});

// MVP-22-A0 (clarity.md rule 7 applied catalog-wide): every catalog line keeps at most two sentences.
// Each exception names the task that shortens it. A fixed key must leave the list, so the list cannot go stale.
const flat = (node: unknown, prefix = ''): [string, string][] => typeof node === 'string' ? [[prefix, node]]
  : Object.entries((node ?? {}) as Group).flatMap(([key, value]) => flat(value, prefix ? `${prefix}.${key}` : key));
const catalogs = { pl: [...flat(pl), ...flat(plTime, 'timePicker')], en: [...flat(en), ...flat(enTime, 'timePicker')] };
const shared = [
  // Kept long, not debt: folded text stays unchanged (rule 2). The detail folds oathHome.uploadInterrupted behind "Pełny opis",
  // A2 folds notifications.future. No slice A task touches the proof errors.
  'notifications.future', 'oathHome.uploadInterrupted', 'proof.errors.unavailable', 'proof.errors.rateLimited', 'proof.errors.sendFailed',
];
const longLines: Record<'pl' | 'en', string[]> = { pl: shared, en: shared };

test.each(['pl', 'en'] as const)('%s catalog lines keep at most two sentences, apart from the listed exceptions', locale => {
  const over = catalogs[locale].filter(([, text]) => sentences(text) > 2).map(([key]) => key);
  expect(over.sort()).toEqual([...longLines[locale]].sort());
});

// "zobowiązanie" is the legal word for the stored rule sections only. Player lines say Przysięga.
// A5 removed the last exceptions (the seals lines in the room). English follows with "commitment".
test('Polish says "zobowiąz…" and English "commitment" only under oath.sections', () => {
  expect(catalogs.pl.filter(([key, text]) => /zobowiąz/i.test(text) && !key.startsWith('oath.sections.')).map(([key]) => key)).toEqual([]);
  expect(catalogs.en.filter(([key, text]) => /commitment/i.test(text) && !key.startsWith('oath.sections.')).map(([key]) => key)).toEqual([]);
});

// Slice A "what next" lines (clarity.md rule 1 and decision 3): at most 12 Polish words and two sentences. Required error
// sentences are exempt from the word cap only, so they are not listed here (oathHome.pauseError, notifications.error_save, auth.cleanupUnconfirmed).
const at = (catalog: Group, key: string) => key.split('.').reduce<unknown>((node, part) => (node as Group)?.[part], catalog);
const sliceA = [
  // A1.
  'oathHome.pauseIntro', 'oathHome.paused', 'oathHome.pauseChanged', 'oathHome.loadError', 'oath.error.character_changed',
  'settings.language.error', 'settings.notifications.permission_unavailable',
  // A2.
  'onboarding.unconfirmed', 'onboarding.intentionRequired', 'onboarding.error_intention', 'onboarding.notificationsPending', 'onboarding.reviewPending',
  'onboarding.error_save', 'onboarding.error_complete',
  // A3.
  'auth.freshChallenge',
  // A4.
  'character.titlesHint',
  // character.pending and character.rateLimited_* (14 PL words, plan copy) are refusal lines, held by the two-sentence guard.
  // T12c: Żaromir's introduction meets his 12-word cap.
  'onboarding.companionIntroduction',
  // A5. The tutorial chapter lines are rules, not "what next" lines, so only the two-sentence guard holds them.
  'room.descriptions.seals', 'room.tutorial.heardMark',
  // A6.
  'oath.reviewIntro', 'oath.formRequired', 'oath.formRequiredStart',
  // E1r2: a chosen date without its time names the time.
  'oath.formRequiredTime', 'oath.formRequiredStartTime',
];
test.each(sliceA)('%s fits 12 Polish words and two sentences in both languages', key => {
  const [line, english] = [at(pl, key), at(en, key)];
  expect(typeof line).toBe('string'); expect(typeof english).toBe('string');
  expect(words(line as string)).toBeLessThanOrEqual(12);
  expect(sentences(line as string)).toBeLessThanOrEqual(2);
  expect(sentences(english as string)).toBeLessThanOrEqual(2);
});

// MVP-22-A4b: the owner-defined term wins (glossary.md "Onboarding intention", owner decision 2026-09-24).
// MVP-22-E1.4: the basics line keeps only "nothing is saved yet" and no longer names the intention.
test('onboarding lines name the intention with the owner term, never "cel" or "goal"', () => {
  for (const key of ['intentionRequired', 'error_intention', 'reviewIntention']) {
    expect(group(pl, 'onboarding')[key]).toMatch(/intencj/i);
    expect(group(en, 'onboarding')[key]).toMatch(/intention/i);
  }
  expect(catalogs.pl.filter(([key, text]) => key.startsWith('onboarding.') && /\bcel(u|em)?\b/i.test(text)).map(([key]) => key)).toEqual([]);
  expect(group(pl, 'onboarding').intention).toBe('Chcę regularnie podejmować aktywność');
});

test('the character rate limit keeps every Polish plural form with the name and the count', () => {
  expect(Object.keys(group(pl, 'character')).filter(key => key.startsWith('rateLimited_')).sort()).toEqual(['rateLimited_few', 'rateLimited_many', 'rateLimited_one', 'rateLimited_other']);
  expect(Object.keys(group(en, 'character')).filter(key => key.startsWith('rateLimited_')).sort()).toEqual(['rateLimited_one', 'rateLimited_other']);
  for (const catalog of [pl, en]) for (const [key, text] of Object.entries(group(catalog, 'character'))) {
    if (key.startsWith('rateLimited_')) expect(text).toEqual(expect.stringMatching(/\{\{name\}\}.*\{\{count\}\}/));
  }
});

test('the Polish permission line names notification permission', () => {
  expect(group(group(pl, 'settings'), 'notifications').permission_unavailable).toMatch(/zgody na powiadomienia/);
});

// Owner copy fix, 2026-10-02: Żaromir's cutoff pool must not open like the cutoff card line right above it.
test('no cutoff line of Żaromir opens with the words of the cutoff card line', () => {
  for (const catalog of [pl, en]) {
    const card = (group(catalog, 'path', 'next').cutoff as string).split(/\s+/).slice(0, 3).join(' ');
    for (const line of Object.values(group(catalog, 'zaromir', 'cutoff')) as string[]) expect(line.startsWith(card)).toBe(false);
  }
});

// MVP-22-A7: a menu tile detail is a label, not a sentence. At most five Polish words (local decision, the longest has four).
test.each(['forgeDetail', 'forgePending', 'tutorialDetail', 'settingsDetail'])('menu.%s is a short label in both languages', key => {
  for (const catalog of [pl, en]) {
    const line = group(catalog, 'menu')[key] as string;
    expect(words(line)).toBeLessThanOrEqual(5);
    expect(line).not.toMatch(/[.!?]/);
  }
});

test('the menu shows the pause mark, so the old paused line is gone', () => {
  expect(group(pl, 'menu').paused).toBeUndefined();
  expect(group(en, 'menu').paused).toBeUndefined();
});

// MVP-22-A8c (review of A5 to A8b, main-agent copy decisions).
test('the A8c copy decisions hold in both languages', () => {
  expect(at(pl, 'zaromir.cutoff.1')).toBe('Jeśli trening skończył się w terminie, dowód może jeszcze zdążyć.');
  expect(at(en, 'zaromir.cutoff.1')).toBe('If the workout ended by the deadline, the proof can still make it.');
  // MVP-22-E1.4: the missing line names only what is missing. MVP-22-E1.R: a scheduled start names the start first, then the deadline.
  expect(at(pl, 'oath.formRequiredStart')).toBe('Potrzebny start.');
  expect(at(en, 'oath.formRequiredStart')).toBe('Start needed.');
  // MVP-22-E1r2: a chosen date without its time names the time, not the date row already filled.
  expect(at(pl, 'oath.formRequiredTime')).toBe('Potrzebna godzina.');
  expect(at(en, 'oath.formRequiredTime')).toBe('Time needed.');
  expect(at(pl, 'oath.formRequiredStartTime')).toBe('Potrzebna godzina startu.');
  expect(at(en, 'oath.formRequiredStartTime')).toBe('Start time needed.');
  expect(at(en, 'room.tutorial.seals.1')).toMatch(/awaiting a result/);
  expect(at(en, 'room.tutorial.seals.1')).not.toMatch(/awaiting review/);
  expect(at(en, 'room.tutorial.door.3')).toMatch(/you turn it on in Settings/);
});
