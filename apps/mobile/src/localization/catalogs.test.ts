import { catalogs } from './createTranslation';
import { validateCatalogs } from './validateCatalogs';

test('both shipped catalogs are complete', () => {
  expect(validateCatalogs(catalogs)).toEqual([]);
});

test('missing messages fail validation despite runtime fallback', () => {
  expect(validateCatalogs({ pl: { retry: 'Ponów' }, en: {} })).toContain('en: missing retry');
});

test('different interpolation arguments fail validation', () => {
  expect(validateCatalogs({ pl: { greeting: 'Witaj, {{name}}' }, en: { greeting: 'Hello, {{person}}' } }))
    .toContain('arguments differ: greeting');
});

test('missing Polish plural categories fail validation', () => {
  expect(validateCatalogs({
    pl: { tries_one: '{{count}} próba', tries_other: '{{count}} próby' },
    en: { tries_one: '{{count}} try', tries_other: '{{count}} tries' },
  })).toEqual(expect.arrayContaining(['pl: missing tries_few', 'pl: missing tries_many']));
});

test('an explicit zero override cannot bypass argument validation', () => {
  const changed = JSON.parse(JSON.stringify(catalogs));
  changed.pl.evidence.correctionsRemaining_zero = 'Brak prób dla {{wrongName}}';
  expect(validateCatalogs(changed)).toContain('arguments differ: evidence.correctionsRemaining');
});
