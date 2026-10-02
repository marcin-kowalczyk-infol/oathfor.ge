import { render, screen } from '@testing-library/react-native';
import { pickLine, ZAROMIR_POOLS } from '../companion/zaromirLine';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import pl from '../localization/locales/pl/messages.json';
import en from '../localization/locales/en/messages.json';
import type { ZaromirSituation } from '../oaths/oathPath';
import { ZaromirLine } from './ZaromirLine';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));

const lineOf = (catalog: { zaromir: object }, situation: ZaromirSituation, seed: string) =>
  (catalog.zaromir as Record<string, Record<string, string>>)[situation][String(pickLine(seed, ZAROMIR_POOLS[situation]))];
const show = (situation: ZaromirSituation | null, seed: string, locale: 'pl' | 'en' = 'pl') =>
  <LocalizationProvider initialLocale={locale}><ZaromirLine situation={situation} seed={seed} /></LocalizationProvider>;

test('nothing is drawn while Żaromir is silent', async () => {
  await render(show(null, 'oath-1:active:2026-10-01'));
  expect(screen.toJSON()).toBeNull();
});

test('the line comes from zaromir.<situation>.<picked index> and names the speaker only for accessibility', async () => {
  const seed = 'oath-1:scheduled:2026-10-01';
  const line = lineOf(pl, 'scheduled', seed);
  await render(show('scheduled', seed));
  expect(screen.getByText(line)).toBeOnTheScreen();
  expect(screen.getByLabelText(`Żaromir: ${line}`)).toBeOnTheScreen();
  expect(screen.queryByText('Żaromir')).toBeNull();
  expect(screen.getByTestId('zaromir-bust', { includeHiddenElements: true })).toHaveProp('accessibilityElementsHidden', true);
});

test('English uses the English speaker name', async () => {
  const seed = 'oath-2:review';
  await render(show('review', seed, 'en'));
  expect(screen.getByLabelText(`Zharomir: ${lineOf(en, 'review', seed)}`)).toBeOnTheScreen();
});

test('the same seed keeps the same text across rerenders', async () => {
  const seed = 'oath-3:active:2026-10-01';
  const view = await render(show('active', seed));
  const line = lineOf(pl, 'active', seed);
  await view.rerender(show('active', seed));
  expect(screen.getByText(line)).toBeOnTheScreen();
});

// MVP-22-B1 (G4): the drawn line binds Polish single-letter words, the spoken label keeps the catalog text.
test('the Polish line keeps "i" with the next word, the label stays plain', async () => {
  const line = lineOf(pl, 'confirmed', 'oath-4:confirmed');
  expect(line).toContain(' i gdzie ');
  await render(show('confirmed', 'oath-4:confirmed'));
  expect(screen.getByText(line.replace(' i gdzie ', ' i\u00a0gdzie '), { normalizer: text => text })).toBeOnTheScreen();
  expect(screen.getByLabelText(`Żaromir: ${line}`)).toBeOnTheScreen();
});
