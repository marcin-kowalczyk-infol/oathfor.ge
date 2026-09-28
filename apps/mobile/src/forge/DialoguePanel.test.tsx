import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import { DialoguePanel, TYPE_MS } from './DialoguePanel';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Locale } from '../localization/locale';

type Props = Parameters<typeof DialoguePanel>[0];
const frame = { left: 16, width: 343, bottom: 20, maxHeight: 300 };
const line = 'Touch the glowing hearth.';
const panel = (props: Partial<Props> = {}, locale: Locale = 'en') => <LocalizationProvider initialLocale={locale}>
  <DialoguePanel frame={frame} speaker="guide" lineId="a" text={line} playerName="Mira" portrait={null} allowed more={false}
    continueLabel="Next" onContinue={jest.fn()} dismissLabel="Close" onDismiss={jest.fn()} {...props} />
</LocalizationProvider>;
const hidden = { includeHiddenElements: true };
const style = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style) as Record<string, number | string>;
const shownText = () => {
  const text = screen.getByTestId('dialogue-text');
  // The typed part is the first child, the rest keeps its place invisibly.
  return (text.props.children as unknown[])[0] as string;
};

beforeEach(() => {
  jest.useFakeTimers();
  Dimensions.set({ window: { width: 375, height: 667, scale: 2, fontScale: 1 }, screen: { width: 375, height: 667, scale: 2, fontScale: 1 } });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('types the line and completes it on the first touch', async () => {
  const onContinue = jest.fn();
  await render(panel({ onContinue, more: true }));
  expect(shownText()).toBe('');
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 5); });
  expect(shownText()).toBe('Touch');
  expect(screen.queryByTestId('dialogue-rune-mark', hidden)).toBeNull();
  await fireEvent.press(screen.getByTestId('dialogue-panel-touch'));
  expect(shownText()).toBe(line);
  expect(onContinue).not.toHaveBeenCalled();
  expect(screen.getByTestId('dialogue-rune-mark', hidden)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('dialogue-panel-touch'));
  expect(onContinue).toHaveBeenCalledTimes(1);
});

test('typing counts graphemes, so Polish letters and joined emoji are never split', async () => {
  await render(panel({ text: 'Z\u0307ar 👨‍👩‍👧 ognia' }));
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 2); });
  expect(shownText()).toBe('Z\u0307a');
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 3); });
  expect(shownText()).toBe('Z\u0307ar 👨‍👩‍👧');
});

// Review finding: motion turns off while the app is in the background. A line shown whole must not go back to partial.
test('a line shown whole while motion was off stays whole when motion returns', async () => {
  const view = await render(panel({ more: true }));
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 5); });
  await view.rerender(panel({ more: true, allowed: false }));
  await view.rerender(panel({ more: true }));
  expect(shownText()).toBe(line);
  expect(screen.getByTestId('dialogue-rune-mark', hidden)).toBeTruthy();
});

// Review finding: a new text under the same id, for example after a language change, stopped typing at the old length.
test('a new text under the same line id types to its end', async () => {
  const view = await render(panel({ text: 'Short.' }));
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 3); });
  await view.rerender(panel({ text: 'A much longer line.' }));
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 40); });
  expect(shownText()).toBe('A much longer line.');
});

test('the rune continues for VoiceOver and stays in place while the next line types', async () => {
  const onContinue = jest.fn();
  const view = await render(panel({ more: true, onContinue }));
  expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
  expect(screen.queryByTestId('dialogue-rune-mark', hidden)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(shownText()).toBe(line);
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  expect(onContinue).toHaveBeenCalledTimes(1);
  await view.rerender(panel({ more: true, onContinue, lineId: 'b' }));
  expect(screen.getByRole('button', { name: 'Next' })).toBeOnTheScreen();
});

test('a line with its own step control shows no rune over it', async () => {
  await render(panel({ allowed: false, more: true, controls: { step: { count: '1 / 4', label: 'Next', mark: '→', onPress: jest.fn() } } }));
  expect(screen.queryByTestId('dialogue-rune', hidden)).toBeNull();
  expect(screen.getAllByRole('button', { name: 'Next' })).toHaveLength(1);
});

test('a new line starts typing again', async () => {
  const view = await render(panel());
  await act(async () => { jest.advanceTimersByTime(TYPE_MS * 100); });
  expect(shownText()).toBe(line);
  await view.rerender(panel({ lineId: 'b', text: 'Next line.' }));
  expect(shownText()).toBe('');
});

test('the last line shows its controls and no rune', async () => {
  const onPress = jest.fn();
  await render(panel({ allowed: false, controls: { action: { label: 'Shape an Oath', onPress } } }));
  expect(screen.queryByTestId('dialogue-rune', hidden)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Shape an Oath' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});

test.each([['en', 'Zharomir'], ['pl', 'Żaromir']] as const)('in %s Żaromir speaks from the left with his name on the plate', async (locale, name) => {
  await render(panel({}, locale));
  expect(screen.getByTestId('bust-guide', hidden)).toBeTruthy();
  expect(screen.getByTestId('dialogue-plate', hidden)).toHaveTextContent(name);
  expect(style('dialogue-plate').left).toBeDefined();
  expect(style('dialogue-plate').right).toBeUndefined();
  expect(style('bust-guide').left).toBeDefined();
});

test('the player speaks from the right with the character name and portrait', async () => {
  const portrait = 7;
  await render(panel({ speaker: 'player', portrait }));
  expect(screen.getByTestId('dialogue-plate', hidden)).toHaveTextContent('Mira');
  expect(style('dialogue-plate').right).toBeDefined();
  expect(style('bust-player').right).toBeDefined();
  expect(screen.getByTestId('bust-player-image', hidden).props.source).toBe(portrait);
});

test('VoiceOver reads the speaker and the whole line from the first frame, busts are hidden', async () => {
  await render(panel());
  expect(screen.getByTestId('dialogue-text').props.accessibilityLabel).toBe(`Zharomir: ${line}`);
  expect(screen.queryByTestId('bust-guide')).toBeNull();
  expect(screen.getByTestId('bust-guide', hidden)).toBeTruthy();
});

test('the bottom edge is fixed and a taller text grows the panel up to its limit', async () => {
  await render(panel({ text: 'A long line. '.repeat(30) }));
  const box = style('dialogue-panel');
  expect(box.bottom).toBe(20);
  expect(box.maxHeight).toBe(300);
  expect(box.top).toBeUndefined();
});

test('at normal size a text taller than the panel scrolls instead of pushing the bottom edge', async () => {
  await render(panel());
  const scroll = StyleSheet.flatten(screen.getByTestId('dialogue-scroll').props.style) as { flexGrow: number; flexShrink: number };
  expect(scroll).toMatchObject({ flexGrow: 0, flexShrink: 1 });
});

test('large text scrolls inside a fixed height', async () => {
  Dimensions.set({ window: { width: 375, height: 667, scale: 2, fontScale: 1.5 }, screen: { width: 375, height: 667, scale: 2, fontScale: 1.5 } });
  await render(panel());
  expect(style('dialogue-panel').height).toBe(300);
  expect(screen.getByTestId('dialogue-scroll')).toBeTruthy();
});

test('a new speaker slides the old bust out and the new one in', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const view = await render(panel());
  timing.mockClear();
  await view.rerender(panel({ speaker: 'player', lineId: 'b' }));
  const swaps = timing.mock.calls.filter(([, config]) => config.duration === 220).map(([, config]) => config.toValue);
  expect(swaps).toEqual([0, 1]);
});

test('with reduced motion the new bust and the whole line show at once', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const view = await render(panel({ allowed: false }));
  expect(shownText()).toBe(line);
  await view.rerender(panel({ allowed: false, speaker: 'player', lineId: 'b', text: 'How am I doing?' }));
  expect(timing.mock.calls.filter(([, config]) => config.duration === 220)).toHaveLength(0);
  expect(shownText()).toBe('How am I doing?');
  expect(style('bust-player').opacity).toBe(1);
  expect(style('bust-guide').opacity).toBe(0);
});

test('every control is at least 44 points', async () => {
  await render(panel({ allowed: false, controls: {
    action: { label: 'Shape an Oath', onPress: jest.fn() },
    step: { count: '2 / 4', label: 'Another place', text: true, onPress: jest.fn() },
  } }));
  for (const name of ['Shape an Oath', 'Another place', 'Close']) {
    const box = StyleSheet.flatten(screen.getByRole('button', { name }).props.style) as { height?: number; minHeight?: number; width?: number; minWidth?: number };
    expect(Math.max(box.height ?? 0, box.minHeight ?? 0)).toBeGreaterThanOrEqual(44);
  }
  expect(screen.getByText('2 / 4')).toBeOnTheScreen();
});
