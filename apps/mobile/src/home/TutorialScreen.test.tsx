import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
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

const size = (fontScale: number) => Dimensions.set({ window: { width: 402, height: 874, scale: 3, fontScale }, screen: { width: 402, height: 874, scale: 3, fontScale } });
afterEach(() => size(1));
const filled = () => screen.queryAllByRole('button').filter(button => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0);

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

// MVP-22-A5: the chapters fold behind their titles (clarity.md rule 1). Each title opens its own lines, unchanged (rule 2).
test.each([['pl', pl], ['en', en]] as const)('the %s screen shows the intro and the folded chapters in order, each opening its lines', async (locale, copy) => {
  size(2);
  await setup(locale);
  expect(screen.getByRole('header', { name: copy.tutorial.title })).toBeOnTheScreen();
  expect(screen.getByText(copy.room.tutorial.intro)).toBeOnTheScreen();
  const expected = chapters(copy);
  expect(expected.flat().length - expected.length).toBe(13);
  const toggles = screen.getAllByRole('button').filter(button => button.props.accessibilityState?.expanded !== undefined);
  expect(toggles.map(toggle => toggle.props.accessibilityLabel)).toEqual(expected.map(([title]) => title));
  for (const [, ...lines] of expected) for (const line of lines) expect(screen.queryByText(line)).toBeNull();
  expect(filled()).toHaveLength(0);
  for (const [title, ...lines] of expected) {
    await fireEvent.press(screen.getByRole('button', { name: title }));
    const texts = screen.getAllByText(/./).map(text => text.props.children);
    const order = lines.map(line => texts.indexOf(line));
    expect(order.every(index => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  }
  if (locale === 'pl') expect(screen.getByText('O stanie decyduje Kuźnia, nie zegar w telefonie. Po ostatnim terminie Przysięga jest pod rozwagą, to nie niewykonanie.')).toBeOnTheScreen();
});

test('back to menu calls onBack once', async () => {
  const onBack = await setup('en');
  await fireEvent.press(screen.getByRole('button', { name: en.forge.returnMenu }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

test('every text is capped for the largest accessibility size and the content scrolls', async () => {
  await setup('pl');
  for (const title of chapters(pl).map(([title]) => title)) await fireEvent.press(screen.getByRole('button', { name: title }));
  const header = screen.getByRole('header', { name: pl.tutorial.title });
  expect(header.props.maxFontSizeMultiplier).toBeLessThanOrEqual(tokens.maxScale.display);
  for (const text of screen.getAllByText(/./)) {
    if (text.props.allowFontScaling === false) continue;
    expect(text.props.maxFontSizeMultiplier).toBeLessThanOrEqual(tokens.maxScale.inset);
  }
  expect(screen.getByTestId('tutorial-scroll').type).toBe('RCTScrollView');
});
