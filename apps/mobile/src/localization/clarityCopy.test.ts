import pl from './locales/pl/messages.json';
import en from './locales/en/messages.json';
import { ZAROMIR_POOLS } from '../companion/zaromirLine';

type Group = Record<string, unknown>;
const group = (catalog: Group, ...path: string[]) => path.reduce<Group>((node, key) => (node?.[key] ?? {}) as Group, catalog);
// Realistic values for the caps (docs/product/clarity.md decision 3): a short weekday date with time, and a date.
const sample = (text: string) => text.replace('{{time}}', 'pt 30 wrz, 18:30').replace('{{date}}', '30 wrz 2026');
const words = (text: string) => text.trim().split(/\s+/).length;
const sentences = (text: string) => text.split(/[.!?](?:\s|$)/).filter(part => part.trim()).length;
const nextKeys = ['scheduled', 'active', 'activeSoon', 'cutoff', 'interrupted', 'assessing', 'needsMore', 'review', 'fulfilled', 'missed', 'unresolved', 'withdrawn'];

test.each(nextKeys)('path.next.%s fits 12 Polish words and 70 characters', key => {
  const line = group(pl, 'path', 'next')[key];
  expect(typeof line).toBe('string');
  expect(typeof group(en, 'path', 'next')[key]).toBe('string');
  expect(words(sample(line as string))).toBeLessThanOrEqual(12);
  expect(sample(line as string).length).toBeLessThanOrEqual(70);
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
