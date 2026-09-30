import { Dimensions, StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Snapshot } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OathRuleCards } from './OathRuleCards';
import { promiseText } from './SnapshotRules';
import { textSlack } from '../ui/textSlack';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));

function snapshot(): Snapshot {
  const value = JSON.parse(JSON.stringify(catalog));
  value.activity = 'running'; value.activation = { mode: 'now', time: null };
  value.deadline = { local: '2026-10-02T18:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-02T16:00:00Z', receiptCutoff: '2026-10-02T16:15:00Z' };
  for (const locale of ['pl', 'en']) { value.copy[locale].activity = value.copy[locale].activities.running; delete value.copy[locale].activities; }
  return value;
}
const size = (width: number, fontScale: number) => Dimensions.set({ window: { width, height: 874, scale: 3, fontScale }, screen: { width, height: 874, scale: 3, fontScale } });
afterEach(() => size(402, 1));

test('Polish cards show the promise, declaration and card values, full rules folded', async () => {
  size(402, 1);
  const value = snapshot();
  await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={value} /></LocalizationProvider>);
  expect(screen.getByText(value.copy.pl.declaration)).toBeOnTheScreen();
  expect(screen.getByText(promiseText(value, 'pl'))).toBeOnTheScreen();
  expect(screen.getByTestId('rule-card-deadline')).toHaveTextContent(/Termin.*18:00.*pt 2 paź.*Warszawa/);
  expect(screen.getByTestId('rule-card-deadline')).toHaveProp('accessibilityLabel', 'Termin. pt 2 paź 18:00 Warszawa');
  expect(screen.getByTestId('rule-card-cutoff')).toHaveProp('accessibilityLabel', 'Ostatni moment na dowód. 18:15 15 minut po terminie');
  expect(screen.getByTestId('rule-cards')).toHaveStyle({ flexDirection: 'row', flexWrap: 'wrap' });
  expect(screen.getByTestId('rule-card-deadline')).toHaveStyle({ width: '48.5%' });
  expect(screen.queryByText(value.copy.pl.sections.appeal)).toBeNull();
});

// Native check: at text scale 1.4 a wrapping column sized its line to the icon, so each card was about 77 pt wide with no text.
test.each([[340, 1], [402, 1.4]])('at width %i and text scale %d the cards stack in one full-width column', async (width, fontScale) => {
  size(width, fontScale);
  await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={snapshot()} /></LocalizationProvider>);
  expect(screen.getByTestId('rule-cards')).toHaveStyle({ flexDirection: 'column', flexWrap: 'nowrap' });
  expect(screen.getByTestId('rule-card-deadline')).toHaveStyle({ alignSelf: 'stretch' });
  expect(screen.getByTestId('rule-card-deadline')).not.toHaveStyle({ width: '48.5%' });
  expect(screen.getByTestId('rule-card-consequence')).toHaveTextContent(/Nie tracisz zdobytego XP/);
});

test('a highlighted card is marked for the explanation', async () => {
  await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={snapshot()} highlight="cutoff" /></LocalizationProvider>);
  expect(screen.getByTestId('rule-card-cutoff')).toHaveStyle({ borderColor: '#e0a84f' });
  expect(screen.getByTestId('rule-card-deadline')).not.toHaveStyle({ borderColor: '#e0a84f' });
});

// Native check, 2026-09-30: in one column the cards Żaromir names sit far below the grid top, so the screen needs each card's place.
test('each card reports its top inside the grid', async () => {
  const onCardLayout = jest.fn();
  await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={snapshot()} onCardLayout={onCardLayout} /></LocalizationProvider>);
  await fireEvent(screen.getByTestId('rule-card-fixed'), 'layout', { nativeEvent: { layout: { x: 0, y: 1840, width: 370, height: 320 } } });
  expect(onCardLayout).toHaveBeenCalledWith('fixed', 1840);
});

// Native check, 2026-09-30, iPhone 18 Pro at the largest accessibility size in Polish: the uncapped promise broke
// "października" mid-word under the capped title. Every text in the head, the declaration, the cards and the fold is capped.
describe.each([402, 375])('at %s points and the largest text size', width => {
  const flat = (node: { props: { style?: unknown } }) => StyleSheet.flatten(node.props.style as StyleProp<TextStyle>) ?? {};
  test('the promise is capped like the title and never larger than it', async () => {
    size(width, 3.571);
    const value = snapshot();
    await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={value} /></LocalizationProvider>);
    const title = screen.getByRole('header', { name: value.copy.pl.title });
    const promise = screen.getByText(promiseText(value, 'pl'));
    expect(promise).toHaveProp('maxFontSizeMultiplier', 2);
    expect(flat(promise).fontSize! * 2).toBeLessThanOrEqual(flat(title).fontSize! * title.props.maxFontSizeMultiplier);
    expect(flat(promise)).toEqual(expect.objectContaining({ fontSize: 19, lineHeight: 28 }));
  });
  test('the declaration, the card texts and the fold label are capped for their inset width', async () => {
    size(width, 3.571);
    const value = snapshot();
    await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={value} /></LocalizationProvider>);
    expect(screen.getByText(value.copy.pl.declaration)).toHaveProp('maxFontSizeMultiplier', 2.5);
    for (const text of ['Ostatni moment na dowód', '15 minut po terminie', 'Nie tracisz zdobytego XP.', 'Pełne zasady']) {
      expect(screen.getByText(text)).toHaveProp('maxFontSizeMultiplier', 2.5);
    }
    expect(screen.getByText(/XP za zapis aktywności/)).toHaveProp('maxFontSizeMultiplier', 2.5);
  });
  // Native check, 2026-09-30: the declaration and the "Pauza" line drew one line fewer than measured and clipped the last one,
  // because a pixel-exact height came back from Yoga a float step short. The shared Text gives each of them the slack.
  test('every text with a set line height keeps a sub-pixel slack below its last line', async () => {
    size(width, 3.571);
    const value = snapshot();
    await render(<LocalizationProvider initialLocale="pl"><OathRuleCards snapshot={value} /></LocalizationProvider>);
    const texts = [screen.getByText(value.copy.pl.declaration), screen.getByText(promiseText(value, 'pl')), screen.getByText('Pauza wycofuje Przysięgi bez dowodu.'), screen.getByText('18:15')];
    for (const text of texts) {
      expect(flat(text).lineHeight).toEqual(expect.any(Number));
      expect(flat(text).paddingBottom).toBe(textSlack(3).paddingBottom);
    }
  });
});
