import pl from './locales/pl/messages.json';
import en from './locales/en/messages.json';
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
  expect(longest).toEqual({ pl: 'niedz 27 wrz 18:30', en: 'Sun, Sep 27, 18:30' });
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
  expect(group(pl, 'proof').intro).toMatch(/dopiero/);
  expect(group(pl, 'proof').sending).toMatch(/dopiero/);
  expect(group(en, 'proof').intro).toMatch(/only/);
  expect(group(en, 'proof').sending).toMatch(/only/);
});
