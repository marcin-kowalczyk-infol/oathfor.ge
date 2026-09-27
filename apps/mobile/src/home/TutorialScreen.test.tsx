import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Locale } from '../localization/locale';
import en from '../localization/locales/en/messages.json';
import pl from '../localization/locales/pl/messages.json';
import { bindShortWords } from '../localization/typography';
import { tokens } from '../ui/tokens';
import { TutorialScreen } from './TutorialScreen';

async function setup(locale: Locale = 'pl') {
  const onBack = jest.fn();
  await render(<LocalizationProvider initialLocale={locale}><TutorialScreen onBack={onBack} /></LocalizationProvider>);
  await act(async () => {});
  return onBack;
}

const chapters = (copy: typeof pl | typeof en) => {
  const { titles, hearth, seals, chronicle, door } = copy.room.tutorial;
  const lines = (chapter: Record<string, string>) => Object.values(chapter).map(line => bindShortWords(line, copy === pl ? 'pl' : 'en'));
  return [
    [titles.hearth, ...lines(hearth)],
    [titles.seals, ...lines(seals)],
    [titles.chronicle, ...lines(chronicle)],
    [titles.door, ...lines(door)],
  ];
};

test.each([['pl', pl], ['en', en]] as const)('the %s screen shows the intro and every chapter in order', async (locale, copy) => {
  await setup(locale);
  expect(screen.getByRole('header', { name: copy.tutorial.title })).toBeOnTheScreen();
  expect(screen.getByText(copy.room.tutorial.intro)).toBeOnTheScreen();
  const expected = chapters(copy);
  expect(screen.getAllByRole('header').map(header => header.props.children)).toEqual([copy.tutorial.title, ...expected.map(([title]) => title)]);
  const texts = screen.getAllByText(/./).map(text => text.props.children);
  const order = expected.flat().map(line => texts.indexOf(line));
  expect(order.every(index => index >= 0)).toBe(true);
  expect(order).toEqual([...order].sort((a, b) => a - b));
  expect(expected.flat().length - expected.length).toBe(13);
  if (locale === 'pl') expect(texts).toContain('O\u00A0stanie decyduje Kuźnia, nie zegar w\u00A0telefonie. Gdy minie ostatni termin z\u00A0zasad, Przysięga czeka na rozpatrzenie. To nie jest niewykonanie.');
});

test('back to menu calls onBack once', async () => {
  const onBack = await setup('en');
  await fireEvent.press(screen.getByRole('button', { name: en.forge.returnMenu }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('every text is capped for the largest accessibility size and the content scrolls', async () => {
  await setup('pl');
  const headers = screen.getAllByRole('header');
  expect(headers).toHaveLength(5);
  for (const header of headers) expect(header.props.maxFontSizeMultiplier).toBeLessThanOrEqual(tokens.maxScale.display);
  for (const text of screen.getAllByText(/./)) {
    if (text.props.allowFontScaling === false) continue;
    expect(text.props.maxFontSizeMultiplier).toBeLessThanOrEqual(tokens.maxScale.inset);
  }
  expect(screen.getByTestId('tutorial-scroll').type).toBe('RCTScrollView');
});
