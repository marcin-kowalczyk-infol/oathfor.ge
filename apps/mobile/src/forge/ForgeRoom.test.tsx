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
  expect(screen.getByText('The moonlit door leads to the menu. I explain the Forge rules in the Tutorial.')).toBeOnTheScreen();
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

describe('tutorial', () => {
  const tut = en.room.tutorial;
  type Place = 'hearth' | 'seals' | 'chronicle' | 'door';
  const hear = (place: Place, heard = false) => `${tut.hear.replace('{{place}}', en.room[place])}${heard ? `, ${tut.heard}` : ''}`;
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  const next = () => press(tut.next);
  // Plays a whole chapter from the choice bubble and leaves its last line open.
  async function play(place: Place, lines: number, heard = false) {
    await press(hear(place, heard));
    for (let line = 1; line < lines; line++) await next();
  }

  test('starts with the intro and no guide', async () => {
    const onTutorialStart = jest.fn();
    await render(room({ tutorial: 1, showGuide: true, onTutorialStart }));
    expect(screen.getByText(tut.intro)).toBeOnTheScreen();
    expect(screen.queryByText(en.room.guide.hearth)).toBeNull();
    expect(screen.queryByRole('button', { name: en.room.actions.hearth })).toBeNull();
    expect(screen.getByRole('button', { name: hear('door') })).toBeOnTheScreen();
    expect(onTutorialStart).toHaveBeenCalledTimes(1);
  });

  test('a place walks there and pages its chapter with a counter', async () => {
    motion.mockReturnValue(true);
    const finishes: ((result: { finished: boolean }) => void)[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value) => ({
      start: done => { if (done && value instanceof Animated.ValueXY) finishes.push(done); }, stop: jest.fn(), reset: jest.fn(),
    }));
    await render(room({ tutorial: 1 }));
    await press(hear('hearth'));
    expect(walkTimers()).toHaveLength(1);
    expect(screen.queryByText(tut.hearth['1'])).toBeNull();
    await act(async () => finishes[finishes.length - 1]({ finished: true }));
    expect(screen.getByText(tut.hearth['1'])).toBeOnTheScreen();
    expect(screen.getByText('1 / 4')).toBeOnTheScreen();
    await next();
    expect(screen.getByText(tut.hearth['2'])).toBeOnTheScreen();
    expect(screen.getByText('2 / 4')).toBeOnTheScreen();
    await next(); await next();
    expect(screen.getByText(tut.hearth['4'])).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: tut.next })).toBeNull();
    expect(screen.getByRole('button', { name: tut.another })).toBeOnTheScreen();
  });

  test('another place returns to the choice and marks the place as heard', async () => {
    await render(room({ tutorial: 1 }));
    await play('hearth', 4);
    await press(tut.another);
    expect(screen.getByText(tut.again)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: hear('hearth', true) })).toBeOnTheScreen();
    expect(screen.getByTestId('heard-hearth', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('heard-seals', { includeHiddenElements: true })).toBeNull();
  });

  test('the door plays its chapter instead of leaving the room', async () => {
    const onExit = jest.fn();
    await render(room({ tutorial: 1, onExit }));
    await press(hear('door'));
    expect(screen.getByText(tut.door['1'])).toBeOnTheScreen();
    expect(screen.getByText('1 / 4')).toBeOnTheScreen();
    expect(onExit).not.toHaveBeenCalled();
  });

  test('the fourth distinct chapter finishes with the closing bubble, then the room works as usual', async () => {
    const onOpenStation = jest.fn();
    await render(room({ tutorial: 1, onOpenStation }));
    await play('hearth', 4); await press(tut.another);
    await play('seals', 3); await press(tut.another);
    await play('chronicle', 2); await press(tut.another);
    await play('door', 4);
    expect(screen.queryByRole('button', { name: tut.another })).toBeNull();
    await press(tut.finish);
    expect(screen.getByText(tut.end)).toBeOnTheScreen();
    await press(tut.finish);
    expect(screen.queryByText(tut.end)).toBeNull();
    await press(en.room.hearth);
    await press(en.room.actions.hearth);
    expect(onOpenStation).toHaveBeenCalledWith('hearth');
  });

  test('a replayed chapter plays again and does not count twice', async () => {
    await render(room({ tutorial: 1 }));
    await play('hearth', 4); await press(tut.another);
    await play('hearth', 4, true);
    expect(screen.getByText(tut.hearth['4'])).toBeOnTheScreen();
    await press(tut.another);
    await play('seals', 3); await press(tut.another);
    await play('chronicle', 2);
    expect(screen.getByRole('button', { name: tut.another })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: tut.finish })).toBeNull();
  });

  test('closing mid-chapter returns the stations and the door to their usual actions', async () => {
    const onExit = jest.fn();
    await render(room({ tutorial: 1, onExit }));
    await press(hear('seals'));
    await press(tut.close);
    expect(screen.queryByText(tut.seals['1'])).toBeNull();
    await press(en.room.seals);
    expect(screen.getByText(en.room.descriptions.seals)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: en.room.actions.seals })).toBeOnTheScreen();
    await press(en.room.exit);
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('a new tutorial id restarts the tutorial with no heard marks', async () => {
    const onTutorialStart = jest.fn();
    const view = await render(room({ tutorial: 1, onTutorialStart }));
    await play('chronicle', 2); await press(tut.another);
    await press(tut.close);
    await view.rerender(room({ tutorial: 1, onTutorialStart }));
    expect(screen.queryByText(tut.again)).toBeNull();
    await view.rerender(room({ tutorial: 2, onTutorialStart }));
    expect(screen.getByText(tut.intro)).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: hear('chronicle') })).toBeOnTheScreen();
    expect(onTutorialStart).toHaveBeenCalledTimes(2);
  });

  test('reduced motion shows the chapter at once without walking frames', async () => {
    await render(room({ tutorial: 1 }));
    await press(hear('chronicle'));
    expect(screen.getByText(tut.chronicle['1'])).toBeOnTheScreen();
    expect(walkTimers()).toHaveLength(0);
  });

  // The longest lines on a 375 × 667 screen with slightly larger text.
  test.each([['seals', 3], ['chronicle', 2]] as const)('the last %s line fits above the bottom edge and below the places', async (place, lines) => {
    const se = { width: 375, height: 667, scale: 2, fontScale: 1.3 };
    Dimensions.set({ window: se, screen: se });
    await render(room({ tutorial: 1 }));
    await play(place, lines);
    const content = 200;
    await fireEvent(screen.getByTestId('room-bubble-content'), 'contentSizeChange', 343, content);
    const bubble = flat(screen.getByTestId('room-bubble'));
    expect(bubble.top + content + 4 + 44).toBeLessThanOrEqual(se.height - 20);
    const bottoms = (['hearth', 'seals', 'chronicle'] as const).map(station => {
      const style = StyleSheet.flatten(screen.getByRole('button', { name: hear(station) }).props.style) as { top: number; marginTop: number; height: number };
      return style.top + style.marginTop + style.height;
    });
    expect(bubble.top).toBeGreaterThanOrEqual(Math.max(...bottoms));
  });
});

describe('tutorial after review', () => {
  const tut = en.room.tutorial;
  const hear = (place: 'hearth' | 'seals' | 'chronicle' | 'door', heard = false) => `${tut.hear.replace('{{place}}', en.room[place])}${heard ? `, ${tut.heard}` : ''}`;
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  function captureWalks() {
    motion.mockReturnValue(true);
    const walks: { to: unknown; done: (result: { finished: boolean }) => void }[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
      start: done => { if (done && value instanceof Animated.ValueXY) walks.push({ to: config.toValue, done }); }, stop: jest.fn(), reset: jest.fn(),
    }));
    return walks;
  }

  test('the door chapter walks Żaromir to the door foot point', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await press(hear('door'));
    expect(walks[walks.length - 1].to).toEqual({ x: 0.27, y: 0.58 });
  });

  // Native geometry: a walk back to the start point would hide Żaromir behind the choice bubble.
  test('after a chapter Żaromir stays at the place in his idle pose for the choice', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await press(hear('chronicle'));
    await act(async () => walks[walks.length - 1].done({ finished: true }));
    expect(screen.getByTestId('hero-pose-chronicle', { includeHiddenElements: true })).toBeTruthy();
    await press(tut.next);
    await press(tut.another);
    expect(walks).toHaveLength(1);
    expect(screen.getByText(tut.again)).toBeOnTheScreen();
    expect(screen.getByTestId('hero-idle', { includeHiddenElements: true })).toBeTruthy();
  });

  test('touching the place being told keeps the current line', async () => {
    await render(room({ tutorial: 1 }));
    await press(hear('hearth'));
    await press(tut.next);
    await press(hear('hearth'));
    expect(screen.getByText(tut.hearth['2'])).toBeOnTheScreen();
  });

  test('a guide restart during the tutorial stays hidden', async () => {
    const view = await render(room({ tutorial: 1 }));
    await view.rerender(room({ tutorial: 1, showGuide: 3 }));
    expect(screen.queryByText(en.room.guide.hearth)).toBeNull();
    expect(screen.getByText(tut.intro)).toBeOnTheScreen();
  });

  test('a tutorial restart sends Żaromir back to the start point', async () => {
    const walks = captureWalks();
    const view = await render(room({ tutorial: 1 }));
    await press(hear('seals'));
    await act(async () => walks[walks.length - 1].done({ finished: true }));
    await view.rerender(room({ tutorial: 2 }));
    expect(walks[walks.length - 1].to).toEqual({ x: 0.5, y: 0.82 });
  });
});

test('closing or finishing the tutorial reports its end once', async () => {
  const onTutorialEnd = jest.fn();
  const view = await render(room({ tutorial: 1, onTutorialEnd }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.close }));
  expect(onTutorialEnd).toHaveBeenCalledTimes(1);
  await view.rerender(room({ tutorial: 2, onTutorialEnd }));
  for (const [place, lines] of [['hearth', 4], ['seals', 3], ['chronicle', 2], ['door', 4]] as const) {
    await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.hear.replace('{{place}}', en.room[place]) }));
    for (let line = 1; line < lines; line++) await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.next }));
    await fireEvent.press(screen.getByRole('button', { name: place === 'door' ? en.room.tutorial.finish : en.room.tutorial.another }));
  }
  expect(onTutorialEnd).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.finish }));
  expect(onTutorialEnd).toHaveBeenCalledTimes(2);
});
