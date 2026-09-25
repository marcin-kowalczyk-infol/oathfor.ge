import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, Dimensions } from 'react-native';
import { ForgeScene } from './ForgeScene';
import { useMotionAllowed } from '../src/ui/useMotion';
import en from './locales/en.json';

jest.mock('../src/ui/useMotion', () => ({ useMotionAllowed: jest.fn() }));
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
  await render(<ForgeScene locale="en" onExit={onExit} />);
  await fireEvent.press(screen.getByRole('button', { name: en.scene.seals }));
  expect(screen.getByRole('button', { name: en.scene.seals, selected: true })).toBeOnTheScreen();
  expect(screen.getByText(en.scene.descriptions.seals)).toBeOnTheScreen();
  expect(onExit).not.toHaveBeenCalled();
  expect(walkTimers()).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: en.scene.exit }));
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
  const view = await render(<ForgeScene locale="en" onExit={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: en.scene.hearth }));
  const firstArrival = finishes[finishes.length - 1];
  await fireEvent.press(screen.getByRole('button', { name: en.scene.chronicle }));
  const latestArrival = finishes[finishes.length - 1];
  await act(async () => firstArrival({ finished: true }));
  expect(screen.queryByText(en.scene.descriptions.hearth)).toBeNull();
  expect(screen.queryByText(en.scene.descriptions.chronicle)).toBeNull();
  await act(async () => latestArrival({ finished: true }));
  expect(screen.getByText(en.scene.descriptions.chronicle)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: en.scene.seals }));
  expect(walkTimers()).toHaveLength(3);
  await view.unmount();
  for (const timer of walkTimers()) expect(clear).toHaveBeenCalledWith(timer);
  expect(stops.every(stop => stop.mock.calls.length > 0)).toBe(true);
});

test('turning motion off during a walk finishes at the requested station and clears its timer', async () => {
  motion.mockReturnValue(true);
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
  const view = await render(<ForgeScene locale="en" onExit={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: en.scene.hearth }));
  motion.mockReturnValue(false);
  await view.rerender(<ForgeScene locale="en" onExit={jest.fn()} />);
  expect(screen.getByText(en.scene.descriptions.hearth)).toBeOnTheScreen();
  for (const timer of walkTimers()) expect(clear).toHaveBeenCalledWith(timer);
});


test('large text exposes one labelled control per station with a scrollable bubble', async () => {
  Dimensions.set({ window: { width: 320, height: 568, scale: 2, fontScale: 3 }, screen: { width: 320, height: 568, scale: 2, fontScale: 3 } });
  await render(<ForgeScene locale="en" onExit={jest.fn()} />);
  expect(screen.getAllByRole('button', { name: en.scene.chronicle })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: en.scene.chronicle }));
  expect(screen.getByText(en.scene.descriptions.chronicle)).toBeOnTheScreen();
});

test('restoring motion after arrival does not replay the walk or hide the station description', async () => {
  const view = await render(<ForgeScene locale="en" onExit={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: en.scene.hearth }));
  expect(screen.getByText(en.scene.descriptions.hearth)).toBeOnTheScreen();
  motion.mockReturnValue(true);
  await view.rerender(<ForgeScene locale="en" onExit={jest.fn()} />);
  expect(screen.getByText(en.scene.descriptions.hearth)).toBeOnTheScreen();
  expect(walkTimers()).toHaveLength(0);
});


test('a dismissed bubble stays closed across motion changes and the station can reopen it', async () => {
  const view = await render(<ForgeScene locale="en" onExit={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: en.scene.seals }));
  await fireEvent.press(screen.getByRole('button', { name: en.scene.dismiss }));
  expect(screen.queryByText(en.scene.descriptions.seals)).toBeNull();
  motion.mockReturnValue(true);
  await view.rerender(<ForgeScene locale="en" onExit={jest.fn()} />);
  expect(screen.queryByText(en.scene.descriptions.seals)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: en.scene.seals }));
  expect(screen.getByText(en.scene.descriptions.seals)).toBeOnTheScreen();
  expect(walkTimers()).toHaveLength(0);
});


test('ambient glow starts only with motion allowed and stops when motion is disabled', async () => {
  const stop = jest.fn();
  const loop = jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
  const view = await render(<ForgeScene locale="en" onExit={jest.fn()} />);
  expect(loop).not.toHaveBeenCalled();
  motion.mockReturnValue(true);
  await view.rerender(<ForgeScene locale="en" onExit={jest.fn()} />);
  expect(loop).toHaveBeenCalledTimes(1);
  motion.mockReturnValue(false);
  await view.rerender(<ForgeScene locale="en" onExit={jest.fn()} />);
  expect(stop).toHaveBeenCalledTimes(1);
});

test('guide advances manually without walking or exiting', async () => {
  const onExit = jest.fn(); const onIntroComplete = jest.fn();
  await render(<ForgeScene locale="en" onExit={onExit} showIntro onIntroComplete={onIntroComplete} />);
  expect(screen.getByText('Zharomir')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Next place' }));
  expect(screen.getByText('These glowing seals hold your commitments.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Next place' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next place' }));
  expect(screen.getByText('The moonlit door takes you back. Explore whenever you wish.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Start exploring' }));
  expect(onIntroComplete).toHaveBeenCalledTimes(1);
  expect(onExit).not.toHaveBeenCalled();
  expect(walkTimers()).toHaveLength(0);
});

test('touching a station ends the introduction and arrival keeps its speaker', async () => {
  const onIntroComplete = jest.fn();
  await render(<ForgeScene locale="en" onExit={jest.fn()} showIntro onIntroComplete={onIntroComplete} />);
  await fireEvent.press(screen.getByRole('button', { name: en.scene.chronicle }));
  expect(onIntroComplete).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Next place' })).toBeNull();
  expect(screen.getByText('Zharomir')).toBeOnTheScreen();
  expect(screen.getByText(en.scene.descriptions.chronicle)).toBeOnTheScreen();
});
