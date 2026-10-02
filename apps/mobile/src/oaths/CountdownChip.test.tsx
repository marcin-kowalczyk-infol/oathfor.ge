import { act, render, screen } from '@testing-library/react-native';
import { AppState, Dimensions, StyleSheet } from 'react-native';
import type { Oath } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { CountdownChip } from './CountdownChip';
import { createServerClock } from './serverClock';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));

const active = (deadline: string) => ({ state: 'active', review: null, snapshot: { activation: { mode: 'now', time: { utc: '2026-09-28T08:00:00Z' } }, deadline: { utc: deadline } } }) as unknown as Oath;
beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-09-28T12:00:30Z')); });
afterEach(() => jest.useRealTimers());
function clockAtDevice() { const clock = createServerClock(); clock.observe(new Date(Date.now()).toISOString()); return clock; }
const chip = () => screen.getByTestId('countdown-chip');

test('ticks on server minutes and reports reaching zero once', async () => {
  const clock = clockAtDevice(); const onElapsed = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T12:03:00Z')} clock={clock} onElapsed={onElapsed} /></LocalizationProvider>);
  expect(screen.getByText('Until the deadline')).toBeOnTheScreen();
  expect(screen.getByText('2 min')).toBeOnTheScreen();
  expect(chip()).toHaveProp('accessibilityLabel', 'Until the deadline 2 minutes');
  await act(async () => { jest.advanceTimersByTime(29000); });
  expect(screen.getByText('2 min')).toBeOnTheScreen();
  await act(async () => { jest.advanceTimersByTime(61000); });
  expect(screen.getByText('1 min')).toBeOnTheScreen();
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(screen.getByText('Time is up')).toBeOnTheScreen();
  expect(onElapsed).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(180000); });
  expect(onElapsed).toHaveBeenCalledTimes(1);
});

test('a target inside a minute ticks at the target itself', async () => {
  jest.setSystemTime(Date.parse('2026-09-28T12:02:00Z'));
  const clock = clockAtDevice(); const onElapsed = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T12:02:50Z')} clock={clock} onElapsed={onElapsed} /></LocalizationProvider>);
  expect(screen.getByText('< 1 min')).toBeOnTheScreen();
  await act(async () => { jest.advanceTimersByTime(50000); });
  expect(screen.getByText('Time is up')).toBeOnTheScreen();
  expect(onElapsed).toHaveBeenCalledTimes(1);
});

test('an Oath already past its target when shown does not ask for a refresh', async () => {
  const clock = clockAtDevice(); const onElapsed = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T11:00:00Z')} clock={clock} onElapsed={onElapsed} /></LocalizationProvider>);
  expect(screen.getByText('Time is up')).toBeOnTheScreen();
  await act(async () => { jest.advanceTimersByTime(120000); });
  expect(onElapsed).not.toHaveBeenCalled();
});

test('without server time or target nothing shows', async () => {
  const clock = createServerClock();
  const view = await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T12:03:00Z')} clock={clock} /></LocalizationProvider>);
  expect(screen.queryByTestId('countdown-chip')).toBeNull();
  await act(async () => { clock.observe('2026-09-28T12:00:30Z'); });
  expect(screen.getByText('2 min')).toBeOnTheScreen();
  await view.rerender(<LocalizationProvider initialLocale="en"><CountdownChip oath={{ ...active('2026-09-28T12:03:00Z'), state: 'fulfilled' }} clock={clock} /></LocalizationProvider>);
  expect(screen.queryByTestId('countdown-chip')).toBeNull();
});

test('returning to the foreground renders from the clock at once', async () => {
  const clock = clockAtDevice();
  const listeners: ((state: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (state: string) => void) => { listeners.push(listener); return { remove: jest.fn() }; }) as never);
  await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T14:00:30Z')} clock={clock} /></LocalizationProvider>);
  expect(screen.getByText('2 h')).toBeOnTheScreen();
  jest.setSystemTime(Date.parse('2026-09-28T13:00:30Z'));
  await act(async () => { listeners.forEach(listener => listener('active')); });
  expect(screen.getByText('1 h')).toBeOnTheScreen();
});

const scheduled = (start: string) => ({ state: 'scheduled', review: null, snapshot: { activation: { mode: 'scheduled', time: { utc: start } }, deadline: { utc: '2026-09-30T12:00:00Z' } } }) as unknown as Oath;
test('Polish reads the start time left in the accusative', async () => {
  const clock = clockAtDevice();
  await render(<LocalizationProvider initialLocale="pl"><CountdownChip oath={scheduled('2026-09-28T13:01:30Z')} clock={clock} /></LocalizationProvider>);
  expect(chip()).toHaveProp('accessibilityLabel', 'Start za 1 godzinę 1 minutę');
});

test('a target with seconds shows whole minutes left at every moment', async () => {
  const clock = clockAtDevice();
  await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T12:02:01Z')} clock={clock} /></LocalizationProvider>);
  expect(screen.getByText('1 min')).toBeOnTheScreen();
  await act(async () => { jest.advanceTimersByTime(31000); });
  expect(screen.getByText('1 min')).toBeOnTheScreen();
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(screen.getByText('< 1 min')).toBeOnTheScreen();
});

test('a new target or a clock correction past the target reports zero once each', async () => {
  const clock = clockAtDevice(); const onElapsed = jest.fn();
  const view = await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T12:03:00Z')} clock={clock} onElapsed={onElapsed} /></LocalizationProvider>);
  await act(async () => { clock.observe('2026-09-28T12:05:00Z'); });
  expect(onElapsed).toHaveBeenCalledTimes(1);
  await view.rerender(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T12:06:00Z')} clock={clock} onElapsed={onElapsed} /></LocalizationProvider>);
  await act(async () => { jest.advanceTimersByTime(60000); });
  expect(onElapsed).toHaveBeenCalledTimes(2);
  await view.rerender(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-28T12:08:00Z')} clock={clock} onElapsed={onElapsed} /></LocalizationProvider>);
  await view.unmount();
  await act(async () => { jest.advanceTimersByTime(300000); });
  expect(onElapsed).toHaveBeenCalledTimes(2);
});

test('the large hourglass keeps its own place beside the label', async () => {
  const clock = clockAtDevice();
  await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-29T12:03:00Z')} clock={clock} size="large" /></LocalizationProvider>);
  expect(StyleSheet.flatten(screen.getByTestId('countdown-icon', { includeHiddenElements: true }).props.style)).toMatchObject({ width: 44, height: 44 });
});

test('large text stacks the label over the value so every chip keeps to its text', async () => {
  const phone = (fontScale: number) => ({ width: 390, height: 844, scale: 3, fontScale });
  const direction = async (fontScale: number, size: 'small' | 'large' = 'large') => {
    Dimensions.set({ window: phone(fontScale), screen: phone(fontScale) });
    const view = await render(<LocalizationProvider initialLocale="en"><CountdownChip oath={active('2026-09-29T18:00:30Z')} clock={clockAtDevice()} size={size} /></LocalizationProvider>);
    const style = StyleSheet.flatten(screen.getByTestId('countdown-texts').props.style);
    await view.unmount();
    return style.flexDirection;
  };
  try {
    expect(await direction(1.31)).toBe('column');
    expect(await direction(1.3)).toBe('row');
    expect(await direction(1.31, 'small')).toBe('column');
  } finally { Dimensions.set({ window: phone(1), screen: phone(1) }); }
});

// Owner decision, 2026-10-01: the review countdown names a duration, not a point in time.
const review = (closesAt: string) => ({ state: 'review_pending', review: { enteredAt: '2026-09-25T12:00:00Z', closesAt }, snapshot: { activation: { mode: 'now', time: { utc: '2026-09-20T08:00:00Z' } }, deadline: { utc: '2026-09-25T12:00:00Z' } } }) as unknown as Oath;

test.each([
  ['en', 'Ends in', 'Ends in 2 days 22 hours'],
  ['pl', 'Do końca', 'Do końca 2 dni 22 godziny'],
] as const)('the %s review countdown reads as time left until it ends', async (locale, prefix, spoken) => {
  const clock = clockAtDevice();
  await render(<LocalizationProvider initialLocale={locale}><CountdownChip oath={review('2026-10-01T10:00:30Z')} clock={clock} /></LocalizationProvider>);
  expect(screen.getByText(prefix)).toBeOnTheScreen();
  expect(screen.getByText('2 d 22 h')).toBeOnTheScreen();
  expect(chip()).toHaveProp('accessibilityLabel', spoken);
});

// MVP-22-B2c, review finding: a narrow chip broke "2 d 5 h" or "15 min" between a number and its unit.
test.each([
  ['en', 'small', '2026-10-01T10:00:30Z', '2 d 22 h'],
  ['pl', 'large', '2026-10-01T10:00:30Z', '2 d 22 h'],
  ['en', 'large', '2026-09-28T12:16:00Z', '15 min'],
  ['pl', 'small', '2026-09-28T12:16:00Z', '15 min'],
] as const)('the %s %s chip keeps each number with its unit', async (locale, size, closesAt, value) => {
  await render(<LocalizationProvider initialLocale={locale}><CountdownChip oath={review(closesAt)} clock={clockAtDevice()} size={size} /></LocalizationProvider>);
  expect(screen.getByText(value.replace(/ /g, ' ')).props.children).toBe(value);
});
