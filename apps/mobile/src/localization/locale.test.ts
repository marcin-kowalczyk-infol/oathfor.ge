import { resolveLocale } from './locale';

test.each([
  ['pl-PL', 'pl'], ['en-GB', 'en'], ['PL', 'pl'], ['de-DE', 'en'], [null, 'en'],
])('resolves %s to %s', (tag, expected) => {
  expect(resolveLocale(tag)).toBe(expected);
});
