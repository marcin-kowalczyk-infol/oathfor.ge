import { PluralRulesShim, ensurePluralRules, pluralCategory } from './plural';

test.each([0, 1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 102, 112, 1.5])('Polish %p matches CLDR', count => {
  expect(pluralCategory('pl', count)).toBe(new Intl.PluralRules('pl').select(count));
});

test.each([0, 1, 2, 1.5])('English %p matches CLDR', count => {
  expect(pluralCategory('en', count)).toBe(new Intl.PluralRules('en').select(count));
});

test.each(['pl', 'en'] as const)('the shim selects like Node for every %s integer from -200 to 1000 and for fractions', locale => {
  const shim = new PluralRulesShim(locale);
  const node = new Intl.PluralRules(locale);
  const counts = [...Array.from({ length: 1201 }, (_, index) => index - 200), 0.5, 1.5, 2.5, 22.1];
  expect(counts.filter(count => shim.select(count) !== node.select(count))).toEqual([]);
  expect(shim.resolvedOptions()).toEqual({ locale, pluralCategories: node.resolvedOptions().pluralCategories });
});

test('the shim treats region tags by language and answers "other" for ordinals', () => {
  expect(new PluralRulesShim('pl-PL').select(5)).toBe('many');
  expect(new PluralRulesShim('en', { type: 'ordinal' }).select(2)).toBe('other');
  expect(new PluralRulesShim('en', { type: 'ordinal' }).resolvedOptions().pluralCategories).toEqual(['other']);
});

test('a native Intl.PluralRules is never replaced', () => {
  const native = Intl.PluralRules;
  ensurePluralRules();
  expect(Intl.PluralRules).toBe(native);
});
