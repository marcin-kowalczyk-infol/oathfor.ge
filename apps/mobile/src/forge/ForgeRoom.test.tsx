import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import { ForgeRoom, walkDirection } from './ForgeRoom';
import { useMotionAllowed } from '../ui/useMotion';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Locale } from '../localization/locale';
import en from '../localization/locales/en/messages.json';
import pl from '../localization/locales/pl/messages.json';

jest.mock('../ui/useMotion', () => ({ useMotionAllowed: jest.fn() }));
// The decorative flame owns its own loop and is not part of room navigation.
jest.mock('../ui/HearthFire', () => ({ HearthFire: () => null }));
type Props = Parameters<typeof ForgeRoom>[0];
const room = (props: Partial<Props> = {}, locale: Locale = 'en') =>
  <LocalizationProvider initialLocale={locale}><ForgeRoom onExit={jest.fn()} onOpenStation={jest.fn()} {...props} /></LocalizationProvider>;
const motion = jest.mocked(useMotionAllowed);
let intervals: jest.SpyInstance;
let clear: jest.SpyInstance;
const walkTimers = () => intervals.mock.calls.flatMap((args, index) => args[1] === 140 ? [intervals.mock.results[index].value] : []);

beforeEach(() => {
  jest.useFakeTimers(); motion.mockReturnValue(false);
  jest.spyOn(Animated, 'spring').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
  intervals = jest.spyOn(globalThis, 'setInterval'); clear = jest.spyOn(globalThis, 'clearInterval');
  Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } });
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });

test('reduced motion immediately reveals the selected station and exit is the only external action', async () => {
  const onExit = jest.fn();
  await render(room({ onExit }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
  expect(screen.getByRole('button', { name: en.room.seals, selected: true })).toBeOnTheScreen();
  expect(screen.getByText(en.room.descriptions.seals)).toBeOnTheScreen();
  expect(onExit).not.toHaveBeenCalled();
  expect(walkTimers()).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: en.room.exit }));
  expect(onExit).toHaveBeenCalledTimes(1);
});

test('a late interrupted walk cannot reveal the old station; leaving cancels motion and sprite ticks', async () => {
  motion.mockReturnValue(true);
  const finishes: ((result: { finished: boolean }) => void)[] = [];
  const stops: jest.Mock[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation((value) => {
    const stop = jest.fn();
    if (!(value instanceof Animated.ValueXY)) return { start: jest.fn(), stop, reset: jest.fn() };
    stops.push(stop);
    return { start: done => { if (done) finishes.push(done); }, stop, reset: jest.fn() };
  });
  const view = await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.hearth }));
  const firstArrival = finishes[finishes.length - 1];
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  const latestArrival = finishes[finishes.length - 1];
  await act(async () => firstArrival({ finished: true }));
  expect(screen.queryByText(en.room.descriptions.hearth)).toBeNull();
  expect(screen.queryByText(en.room.descriptions.chronicle)).toBeNull();
  await act(async () => latestArrival({ finished: true }));
  expect(screen.getByText(en.room.descriptions.chronicle)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
  expect(walkTimers()).toHaveLength(3);
  await view.unmount();
  for (const timer of walkTimers()) expect(clear).toHaveBeenCalledWith(timer);
  expect(stops.every(stop => stop.mock.calls.length > 0)).toBe(true);
});

test('turning motion off during a walk finishes at the requested station and clears its timer', async () => {
  motion.mockReturnValue(true);
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
  const view = await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.hearth }));
  motion.mockReturnValue(false);
  await view.rerender(room());
  expect(screen.getByText(en.room.descriptions.hearth)).toBeOnTheScreen();
  for (const timer of walkTimers()) expect(clear).toHaveBeenCalledWith(timer);
});


test('large text exposes one labelled control per station with a scrollable bubble', async () => {
  Dimensions.set({ window: { width: 320, height: 568, scale: 2, fontScale: 3 }, screen: { width: 320, height: 568, scale: 2, fontScale: 3 } });
  await render(room());
  expect(screen.getAllByRole('button', { name: en.room.chronicle })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  expect(screen.getByText(en.room.descriptions.chronicle)).toBeOnTheScreen();
});

test('restoring motion after arrival does not replay the walk or hide the station description', async () => {
  const view = await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.hearth }));
  expect(screen.getByText(en.room.descriptions.hearth)).toBeOnTheScreen();
  motion.mockReturnValue(true);
  await view.rerender(room());
  expect(screen.getByText(en.room.descriptions.hearth)).toBeOnTheScreen();
  expect(walkTimers()).toHaveLength(0);
});


test('a dismissed bubble stays closed across motion changes and the station can reopen it', async () => {
  const view = await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.dismiss }));
  expect(screen.queryByText(en.room.descriptions.seals)).toBeNull();
  motion.mockReturnValue(true);
  await view.rerender(room());
  expect(screen.queryByText(en.room.descriptions.seals)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
  expect(screen.getByText(en.room.descriptions.seals)).toBeOnTheScreen();
  expect(walkTimers()).toHaveLength(0);
});


test('ambient glow starts only with motion allowed and stops when motion is disabled', async () => {
  const stop = jest.fn();
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
  const view = await render(room());
  expect(loop).not.toHaveBeenCalled();
  motion.mockReturnValue(true);
  await view.rerender(room());
  expect(loop).toHaveBeenCalledTimes(1);
  motion.mockReturnValue(false);
  await view.rerender(room());
  expect(stop).toHaveBeenCalledTimes(1);
});

test('guide advances manually without walking or exiting', async () => {
  const onExit = jest.fn(); const onGuideComplete = jest.fn();
  await render(room({ onExit, showGuide: true, onGuideComplete }));
  expect(screen.getByText('Zharomir')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Next place' }));
  expect(screen.getByText('These glowing seals hold your commitments.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Next place' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next place' }));
  expect(screen.getByText('The moonlit door takes you back. Explore whenever you wish.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Start exploring' }));
  expect(onGuideComplete).toHaveBeenCalledTimes(1);
  expect(onExit).not.toHaveBeenCalled();
  expect(walkTimers()).toHaveLength(0);
});

test('touching a station ends the introduction and arrival keeps its speaker', async () => {
  const onGuideComplete = jest.fn();
  await render(room({ showGuide: true, onGuideComplete }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  expect(onGuideComplete).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Next place' })).toBeNull();
  expect(screen.getByText('Zharomir')).toBeOnTheScreen();
  expect(screen.getByText(en.room.descriptions.chronicle)).toBeOnTheScreen();
});

test('station discovery requires its named action before opening the matching screen', async () => {
  const open = jest.fn();
  await render(room({ onOpenStation: open }));
  for (const [station, label] of [['hearth', 'Shape an Oath'], ['seals', 'View current Oaths'], ['chronicle', 'Read history']] as const) {
    await fireEvent.press(screen.getByRole('button', { name: en.room[station] }));
    expect(open).toHaveBeenCalledTimes(['hearth', 'seals', 'chronicle'].indexOf(station));
    await fireEvent.press(screen.getByRole('button', { name: label }));
    expect(open).toHaveBeenLastCalledWith(station);
  }
});

test('walking picks the sheet that faces the travel direction and never mirrors', () => {
  expect(walkDirection({ x: 0.5, y: 0.82 }, { x: 0.72, y: 0.65 })).toBe('right');
  expect(walkDirection({ x: 0.5, y: 0.82 }, { x: 0.30, y: 0.635 })).toBe('left');
  expect(walkDirection({ x: 0.5, y: 0.82 }, { x: 0.515, y: 0.565 })).toBe('back');
  expect(walkDirection({ x: 0.515, y: 0.565 }, { x: 0.5, y: 0.82 })).toBe('forward');
});

test('arrival shows the station pose, including the static reduced-motion equivalent', async () => {
  await render(room());
  expect(screen.getByTestId('hero-idle', { includeHiddenElements: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  expect(screen.getByTestId('hero-pose-chronicle', { includeHiddenElements: true })).toBeTruthy();
});

test.each([['pl', pl], ['en', en]] as const)('the %s door leaves the room and names every station from the main catalog', async (locale, copy) => {
  const onExit = jest.fn();
  await render(room({ onExit }, locale));
  for (const station of ['hearth', 'seals', 'chronicle'] as const) expect(screen.getByRole('button', { name: copy.room[station] })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: copy.room.exit }));
  expect(onExit).toHaveBeenCalledTimes(1);
});

test('a later guide request starts the guide from the first place', async () => {
  const onGuideComplete = jest.fn();
  const view = await render(room({ showGuide: false, onGuideComplete }));
  expect(screen.queryByRole('button', { name: en.room.guide.next })).toBeNull();
  await view.rerender(room({ showGuide: true, onGuideComplete }));
  expect(screen.getByText(en.room.guide.hearth)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: en.room.guide.skip }));
  expect(onGuideComplete).toHaveBeenCalledTimes(1);
  await view.rerender(room({ showGuide: 2, onGuideComplete }));
  expect(screen.getByText(en.room.guide.hearth)).toBeOnTheScreen();
  await view.rerender(room({ showGuide: 2, onGuideComplete }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.guide.next }));
  expect(screen.getByText(en.room.guide.seals)).toBeOnTheScreen();
});

test('a guide restart in an open room closes the station bubble', async () => {
  const view = await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
  expect(screen.getByText(en.room.descriptions.seals)).toBeOnTheScreen();
  await view.rerender(room({ showGuide: 1 }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.guide.skip }));
  expect(screen.queryByText(en.room.descriptions.seals)).toBeNull();
});

// Native MVP-18 check on iPhone SE 3: the guide text and the station action were clipped at the bottom of the bubble.
const flat = (element: { props: { style?: unknown } }) => StyleSheet.flatten(element.props.style as never) as { top: number; maxHeight: number };
const stationBottoms = () => (['hearth', 'seals', 'chronicle'] as const).map(station => {
  const style = StyleSheet.flatten(screen.getByRole('button', { name: en.room[station] }).props.style) as { top: number; marginTop: number; height: number };
  return style.top + style.marginTop + style.height;
});
const small = { width: 375, height: 603, scale: 2, fontScale: 1 };
test.each([
  ['the guide', { showGuide: true }, null, 146],
  ['a station bubble', {}, 'chronicle', 192],
] as const)('on a small screen %s grows upward to show its whole text above the bottom edge', async (_name, props, station, content) => {
  Dimensions.set({ window: small, screen: small });
  await render(room(props));
  if (station) await fireEvent.press(screen.getByRole('button', { name: en.room[station] }));
  await fireEvent(screen.getByTestId('room-bubble-content'), 'contentSizeChange', 343, content);
  const bubble = flat(screen.getByTestId('room-bubble'));
  const chrome = 4 + (station ? 0 : 44);
  expect(bubble.top + content + chrome).toBeLessThanOrEqual(small.height - 20);
  expect(bubble.maxHeight).toBeGreaterThanOrEqual(content + chrome);
  expect(bubble.top).toBeGreaterThanOrEqual(Math.max(...stationBottoms()));
});

test('a bubble that already fits keeps its place under the character', async () => {
  const tall = { width: 402, height: 810, scale: 3, fontScale: 1 };
  Dimensions.set({ window: tall, screen: tall });
  await render(room({ showGuide: true }));
  await fireEvent(screen.getByTestId('room-bubble-content'), 'contentSizeChange', 370, 120);
  expect(flat(screen.getByTestId('room-bubble')).top).toBeCloseTo(tall.height * 0.7);
});
