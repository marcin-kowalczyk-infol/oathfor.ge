import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Animated, Dimensions, Easing, StyleSheet } from 'react-native';
import { ForgeRoom } from './ForgeRoom';
import { cover, FIGURE_FOOT, FIGURE_HEIGHT, FIGURE_WIDTH, aside, places, playerStart, tutor, walkDirection, walkDuration } from './sceneLayout';
import { presetArt } from '../characters/presetArt';
import { responseDuration } from './StationEffect';
import { ACT_BEFORE_TURN_MS, TURN_FRAME_MS, WALK_FRAME_MS } from './HeroSprite';
import { useMotionAllowed } from '../ui/useMotion';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Locale } from '../localization/locale';
import en from '../localization/locales/en/messages.json';
import pl from '../localization/locales/pl/messages.json';

jest.mock('../ui/useMotion', () => ({ useMotionAllowed: jest.fn() }));
// The decorative flame owns its own loop and is not part of room navigation.
jest.mock('../ui/HearthFire', () => ({ HearthFire: () => null }));
// Looping decorations (hotspot wisps) own their loops. The room glow test counts only the room's own loop.
jest.mock('./Sprite', () => ({ ...jest.requireActual('./Sprite'), SpriteLoop: () => null }));
type Props = Parameters<typeof ForgeRoom>[0];
const character = { name: 'Mira', presetId: 'starter_02', build: 'thin', form: 'feminine' } as const;
const known = { today: { total: 0, paused: false }, history: { total: 0 }, loading: false };
const room = (props: Partial<Props> = {}, locale: Locale = 'en') =>
  <LocalizationProvider initialLocale={locale}><ForgeRoom character={character} progress={known} onTalk={jest.fn()} onExit={jest.fn()} onOpenStation={jest.fn()} {...props} /></LocalizationProvider>;
const motion = jest.mocked(useMotionAllowed);
let intervals: jest.SpyInstance;
let clear: jest.SpyInstance;
const hidden = { includeHiddenElements: true };
/** Where a figure's feet stand, as fractions of the room artwork, read from its drawn transform. */
function footOf(testID: string) {
  const style = StyleSheet.flatten(screen.getByTestId(testID, hidden).props.style) as { transform: [{ translateX: number }, { translateY: number }] };
  const scene = cover(Dimensions.get('window'));
  return { x: (style.transform[0].translateX + FIGURE_WIDTH / 2) / scene.width, y: (style.transform[1].translateY + FIGURE_HEIGHT * FIGURE_FOOT) / scene.height };
}
const expectAt = (testID: string, spot: { x: number; y: number }) => {
  const foot = footOf(testID);
  expect(foot.x).toBeCloseTo(spot.x, 3);
  expect(foot.y).toBeCloseTo(spot.y, 3);
};
/** testIDs in drawing order, first drawn first. */
function drawOrder(ids: string[]) {
  const order: string[] = [];
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(visit); return; }
    const element = node as { props?: { testID?: string }; children?: unknown };
    if (element.props?.testID && ids.includes(element.props.testID)) order.push(element.props.testID);
    visit(element.children);
  };
  visit(screen.toJSON());
  return order;
}
/** Leaving through the door: the visit, Żaromir's line, then the action, which opens the menu within 700 ms. */
async function leave(copy = en) {
  await fireEvent.press(screen.getByRole('button', { name: copy.room.door }));
  await fireEvent.press(screen.getByRole('button', { name: copy.room.tutorial.next }));
  await fireEvent.press(screen.getByRole('button', { name: copy.room.exit }));
  await act(async () => { jest.advanceTimersByTime(700); });
}
/** A place action opens its screen after the camera flight, within 700 ms. */
async function pressAction(name: string) {
  await fireEvent.press(screen.getByRole('button', { name }));
  await act(async () => { jest.advanceTimersByTime(700); });
}
const walkTimers = () => intervals.mock.calls.flatMap((args, index) => args[1] === WALK_FRAME_MS ? [intervals.mock.results[index].value] : []);

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
  expect(screen.getByText(en.room.player.seals)).toBeOnTheScreen();
  expect(onExit).not.toHaveBeenCalled();
  expect(walkTimers()).toHaveLength(0);
  await leave();
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
  expect(screen.queryByText(en.room.player.hearth)).toBeNull();
  expect(screen.queryByText(en.room.player.chronicle)).toBeNull();
  await act(async () => latestArrival({ finished: true }));
  expect(screen.getByText(en.room.player.chronicle)).toBeOnTheScreen();
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
  expect(screen.getByText(en.room.player.hearth)).toBeOnTheScreen();
  for (const timer of walkTimers()) expect(clear).toHaveBeenCalledWith(timer);
});


test('large text exposes one labelled control per station with a scrollable bubble', async () => {
  Dimensions.set({ window: { width: 320, height: 568, scale: 2, fontScale: 3 }, screen: { width: 320, height: 568, scale: 2, fontScale: 3 } });
  await render(room());
  expect(screen.getAllByRole('button', { name: en.room.chronicle })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  expect(screen.getByText(en.room.player.chronicle)).toBeOnTheScreen();
});

test('restoring motion after arrival does not replay the walk or hide the station description', async () => {
  const view = await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.hearth }));
  expect(screen.getByText(en.room.player.hearth)).toBeOnTheScreen();
  motion.mockReturnValue(true);
  await view.rerender(room());
  expect(screen.getByText(en.room.player.hearth)).toBeOnTheScreen();
  expect(walkTimers()).toHaveLength(0);
});


test('a dismissed bubble stays closed across motion changes and the station can reopen it', async () => {
  const view = await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.dismiss }));
  expect(screen.queryByText(en.room.player.seals)).toBeNull();
  motion.mockReturnValue(true);
  await view.rerender(room());
  expect(screen.queryByText(en.room.player.seals)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
  expect(screen.getByText(en.room.player.seals)).toBeOnTheScreen();
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

test('touching a station ends the introduction and the player opens the visit', async () => {
  const onGuideComplete = jest.fn();
  await render(room({ showGuide: true, onGuideComplete }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  expect(onGuideComplete).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Next place' })).toBeNull();
  expect(screen.getByText('Mira')).toBeOnTheScreen();
  expect(screen.getByText(en.room.player.chronicle)).toBeOnTheScreen();
});

test('station discovery requires its named action before opening the matching screen', async () => {
  const open = jest.fn();
  await render(room({ onOpenStation: open }));
  for (const [station, label] of [['hearth', 'Shape an Oath'], ['seals', 'View current Oaths'], ['chronicle', 'Read history']] as const) {
    await fireEvent.press(screen.getByRole('button', { name: en.room[station] }));
    expect(open).toHaveBeenCalledTimes(['hearth', 'seals', 'chronicle'].indexOf(station));
    await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.next }));
    await pressAction(label);
    expect(open).toHaveBeenLastCalledWith(station);
  }
});

test('touching the station the player stands at replays its response', async () => {
  motion.mockReturnValue(true);
  const finishes: ((result: { finished: boolean }) => void)[] = [];
  const responses: number[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
    start: done => {
      if (value instanceof Animated.ValueXY) { if (done) finishes.push(done); return; }
      // The camera's entrance also runs 1100 ms, eased. Place responses run linearly.
      if (config.duration === responseDuration('chronicle') && config.easing === Easing.linear) responses.push(1);
    }, stop: jest.fn(), reset: jest.fn(),
  }));
  await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  await act(async () => finishes[finishes.length - 1]({ finished: true }));
  expect(responses).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  expect(responses).toHaveLength(2);
});

// Review finding: a new target mid-walk started from the old destination, not from where the figure was.
test('a new target mid-walk starts from where the player is', async () => {
  motion.mockReturnValue(true);
  const durations: number[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
    start: () => { if (value instanceof Animated.ValueXY) durations.push(config.duration!); }, stop: jest.fn(), reset: jest.fn(),
  }));
  await render(room());
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  await act(async () => { jest.advanceTimersByTime(walkDuration(playerStart, places.chronicle.player) / 2); });
  await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
  // The walk curve is symmetric, so halfway in time is halfway along the way.
  const halfway = { x: (playerStart.x + places.chronicle.player.x) / 2, y: (playerStart.y + places.chronicle.player.y) / 2 };
  expect(durations[1]).toBe(walkDuration(halfway, places.seals.player));
});

test('a walk shows the sheet for its direction', async () => {
  motion.mockReturnValue(true);
  jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
  await render(room({ tutorial: 1 }));
  // From aside, the tutorial place in front of the hearth is down and to the left.
  expect(screen.getByTestId('hero-walk-front-left', { includeHiddenElements: true })).toBeTruthy();
});

test('Żaromir keeps breathing aside while the player handles a place', async () => {
  await render(room());
  expect(screen.getByTestId('hero-idle', { includeHiddenElements: true })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
  expect(screen.getByTestId('hero-idle', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByTestId('hero-pose-chronicle', { includeHiddenElements: true })).toBeNull();
});

test.each([['pl', pl], ['en', en]] as const)('the %s door leaves the room and names every station from the main catalog', async (locale, copy) => {
  const onExit = jest.fn();
  await render(room({ onExit }, locale));
  for (const station of ['hearth', 'seals', 'chronicle'] as const) expect(screen.getByRole('button', { name: copy.room[station] })).toBeOnTheScreen();
  await leave(copy);
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
  expect(screen.getByText(en.room.player.seals)).toBeOnTheScreen();
  await view.rerender(room({ showGuide: 1 }));
  await fireEvent.press(screen.getByRole('button', { name: en.room.guide.skip }));
  expect(screen.queryByText(en.room.player.seals)).toBeNull();
});

// Native MVP-18 check on iPhone SE 3: the guide text and the station action were clipped at the bottom of the bubble.
const stationBottoms = () => (['hearth', 'seals', 'chronicle'] as const).map(station => {
  const style = StyleSheet.flatten(screen.getByRole('button', { name: en.room[station] }).props.style) as { top: number; marginTop: number; height: number };
  return style.top + style.marginTop + style.height;
});
const small = { width: 375, height: 603, scale: 2, fontScale: 1 };
test.each([
  ['the guide', { showGuide: true }, null],
  ['a station visit', {}, 'chronicle'],
] as const)('on a small screen %s keeps the panel bottom and stays below the places', async (_name, props, station) => {
  Dimensions.set({ window: small, screen: small });
  await render(room(props));
  if (station) await fireEvent.press(screen.getByRole('button', { name: en.room[station] }));
  const panel = StyleSheet.flatten(screen.getByTestId('dialogue-panel').props.style) as { bottom: number; maxHeight: number };
  expect(panel.bottom).toBe(20);
  expect(small.height - panel.bottom - panel.maxHeight).toBeGreaterThanOrEqual(Math.max(...stationBottoms()));
});

describe('tutorial', () => {
  const tut = en.room.tutorial;
  type Place = 'hearth' | 'seals' | 'chronicle' | 'door';
  const hear = (place: Place, heard = false) => `${tut.hear.replace('{{place}}', en.room[place])}${heard ? `, ${tut.heard}` : ''}`;
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  const next = () => press(tut.next);
  // Plays a whole chapter from the choice bubble and leaves its last line open.
  async function play(place: Place, lines: number, heard = false) {
    await open(place, heard);
    for (let line = 1; line < lines; line++) await next();
  }
  // A chapter opens with the player's line, the next touch brings Żaromir's first line.
  async function open(place: Place, heard = false) {
    await press(hear(place, heard));
    await next();
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
    // The first walk brings Żaromir to his tutorial place, then he and the player walk to the hearth.
    expect(walkTimers()).toHaveLength(3);
    expect(screen.queryByText(en.room.player.tutorial.hearth)).toBeNull();
    for (const finish of finishes) await act(async () => finish({ finished: true }));
    expect(screen.getByText(en.room.player.tutorial.hearth)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('dialogue-panel-touch'));
    await next();
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
    await open('door');
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
    await next();
    await pressAction(en.room.actions.hearth);
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
    await open('seals');
    await press(tut.close);
    expect(screen.queryByText(tut.seals['1'])).toBeNull();
    await press(en.room.seals);
    expect(screen.getByText(en.room.player.seals)).toBeOnTheScreen();
    await next();
    expect(screen.getByRole('button', { name: en.room.actions.seals })).toBeOnTheScreen();
    await leave();
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
    await open('chronicle');
    expect(screen.getByText(tut.chronicle['1'])).toBeOnTheScreen();
    expect(walkTimers()).toHaveLength(0);
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

  test('the door chapter walks Żaromir to his spot in front of the seals', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await press(hear('door'));
    // The player takes the threshold. A point on the seal pedestals, (0.31, 0.56), stood him on the seals.
    expect(walks.map(walk => walk.to)).toContainEqual(places.door.guide);
  });

  // Native geometry: a walk back to the start point would hide Żaromir behind the choice bubble.
  test('after a chapter Żaromir stays at the place in his idle pose for the choice', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await press(hear('chronicle'));
    for (const walk of walks) await act(async () => walk.done({ finished: true }));
    expect(screen.getByTestId('hero-pose-chronicle', { includeHiddenElements: true })).toBeTruthy();
    // With motion the first touch completes the typed opening line, the second continues.
    await press(tut.next); await press(tut.next);
    await press(tut.next);
    await press(tut.another);
    expect(walks.map(walk => walk.to)).toEqual([tutor, places.chronicle.guide, places.chronicle.player]);
    expect(screen.getByText(tut.again)).toBeOnTheScreen();
    expect(screen.getByTestId('hero-idle', { includeHiddenElements: true })).toBeTruthy();
  });

  test('at a told place Żaromir works facing it, turns around and then talks to the player', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await press(hear('seals'));
    for (const walk of walks) await act(async () => walk.done({ finished: true }));
    expect(screen.getByTestId('hero-pose-seals', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(ACT_BEFORE_TURN_MS); });
    expect(screen.getByTestId('hero-turn', { includeHiddenElements: true })).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(TURN_FRAME_MS * 4); });
    expect(screen.getByTestId('hero-talk', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText(en.room.player.tutorial.seals)).toBeOnTheScreen();
  });

  test('while the player chooses a place Żaromir talks and points at the places', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await act(async () => walks[walks.length - 1].done({ finished: true }));
    expect(screen.getByTestId('hero-talk', { includeHiddenElements: true })).toBeTruthy();
  });

  test('the door chapter plays the moonlight response at the door', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await press(hear('door'));
    // The place responds when Żaromir reaches it and starts working there, not while he is still walking.
    expect(screen.queryByTestId('fx-door', { includeHiddenElements: true })).toBeNull();
    for (const walk of walks) await act(async () => walk.done({ finished: true }));
    expect(screen.getByTestId('fx-door', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('hero-pose-door', { includeHiddenElements: true })).toBeTruthy();
  });

  test('touching the place being told keeps the current line', async () => {
    await render(room({ tutorial: 1 }));
    await press(hear('hearth'));
    await press(tut.next);
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

  test('a tutorial restart sends Żaromir back to his tutorial place', async () => {
    const walks = captureWalks();
    const view = await render(room({ tutorial: 1 }));
    await press(hear('seals'));
    await act(async () => walks[walks.length - 1].done({ finished: true }));
    await view.rerender(room({ tutorial: 2 }));
    expect(walks[walks.length - 1].to).toEqual({ x: 0.5, y: 0.66 });
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
    for (let line = 0; line < lines; line++) await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.next }));
    await fireEvent.press(screen.getByRole('button', { name: place === 'door' ? en.room.tutorial.finish : en.room.tutorial.another }));
  }
  expect(onTutorialEnd).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.finish }));
  expect(onTutorialEnd).toHaveBeenCalledTimes(2);
});

describe('tutorial after the native check', () => {
  const tut = en.room.tutorial;
  const hear = (place: 'hearth' | 'seals' | 'chronicle' | 'door') => tut.hear.replace('{{place}}', en.room[place]);

  // iPhone 18 Pro: at the start point Żaromir stood behind the intro bubble.
  test('the tutorial start walks Żaromir to his place in front of the hearth', async () => {
    motion.mockReturnValue(true);
    const targets: unknown[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
      start: () => { if (value instanceof Animated.ValueXY) targets.push(config.toValue); }, stop: jest.fn(), reset: jest.fn(),
    }));
    await render(room({ tutorial: 1 }));
    expect(targets).toEqual([{ x: 0.5, y: 0.66 }]);
  });

  test('Polish tutorial lines keep single-letter words with the next word', async () => {
    await render(room({ tutorial: 1 }, 'pl'));
    await fireEvent.press(screen.getByRole('button', { name: pl.room.tutorial.hear.replace('{{place}}', pl.room.seals) }));
    for (let line = 0; line < 3; line++) await fireEvent.press(screen.getByRole('button', { name: pl.room.tutorial.next }));
    // The default text matcher folds the non-breaking space, so the rendered string is checked directly.
    expect(screen.getByText(/nie zegar w.telefonie/).props.children[0]).toContain('nie zegar w\u00A0telefonie');
  });

  // iPhone 18 Pro: a line that grew the bubble upward moved the next button between lines.
  test('paging a chapter keeps the panel bottom and its button in place', async () => {
    await render(room({ tutorial: 1 }));
    await fireEvent.press(screen.getByRole('button', { name: hear('seals') }));
    const bottom = () => (StyleSheet.flatten(screen.getByTestId('dialogue-panel').props.style) as { bottom: number }).bottom;
    expect(bottom()).toBe(20);
    for (let line = 0; line < 3; line++) {
      await fireEvent.press(screen.getByRole('button', { name: tut.next }));
      expect(bottom()).toBe(20);
    }
  });
});

describe('player', () => {
  function captureWalks() {
    motion.mockReturnValue(true);
    const walks: { to: unknown; done: (result: { finished: boolean }) => void }[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
      start: done => { if (value instanceof Animated.ValueXY) walks.push({ to: config.toValue, done: done ?? (() => undefined) }); }, stop: jest.fn(), reset: jest.fn(),
    }));
    return walks;
  }

  test('draws the character at the start point and Żaromir aside', async () => {
    await render(room());
    // The pilot starter_02 thin has sprites, other presets draw their still menu figure.
    expect(screen.getByTestId('player-idle', hidden)).toBeTruthy();
    expectAt('room-player', playerStart);
    expectAt('room-guide', aside);
    expect(screen.getByTestId('hero-idle', hidden)).toBeTruthy();
  });

  test('another preset draws its still menu figure until its sprites exist', async () => {
    await render(room({ character: { ...character, presetId: 'starter_04' } }));
    expect(screen.getByTestId('player-dummy', hidden).props.source).toBe(presetArt('starter_04', 'thin')!.figure);
  });

  test('the pilot walks to the chronicle facing its direction and handles the book on arrival', async () => {
    motion.mockReturnValue(true);
    const walks: ((result: { finished: boolean }) => void)[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value) => ({
      start: done => { if (done && value instanceof Animated.ValueXY) walks.push(done); }, stop: jest.fn(), reset: jest.fn(),
    }));
    await render(room());
    await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
    expect(screen.getByTestId(`player-walk-${walkDirection(playerStart, places.chronicle.player)}`, hidden)).toBeTruthy();
    await act(async () => walks[0]({ finished: true }));
    expect(screen.getByTestId('player-pose-chronicle', hidden)).toBeTruthy();
  });

  test('a touched place walks the player there while Żaromir stays aside', async () => {
    const walks = captureWalks();
    await render(room());
    await fireEvent.press(screen.getByRole('button', { name: en.room.seals }));
    expect(walks.map(walk => walk.to)).toEqual([places.seals.player]);
    expect(screen.queryByText(en.room.player.seals)).toBeNull();
    await act(async () => walks[0].done({ finished: true }));
    expect(screen.getByText(en.room.player.seals)).toBeOnTheScreen();
    expect(screen.getByTestId('fx-seal-star', hidden)).toBeTruthy();
    expect(screen.getByTestId('hero-idle', hidden)).toBeTruthy();
    expectAt('room-guide', aside);
  });

  test('with reduced motion the player stands at the place at once', async () => {
    await render(room());
    await fireEvent.press(screen.getByRole('button', { name: en.room.chronicle }));
    expectAt('room-player', places.chronicle.player);
    expect(walkTimers()).toHaveLength(0);
  });

  test('the figure lower on screen is drawn in front', async () => {
    await render(room());
    expect(drawOrder(['room-guide', 'room-player'])).toEqual(['room-guide', 'room-player']);
  });

  // Review finding: after the tutorial Żaromir stayed at his last tutorial spot, where the player could stand on him.
  test('closing the tutorial sends Żaromir back aside', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.hear.replace('{{place}}', en.room.seals) }));
    for (const walk of walks.slice()) await act(async () => walk.done({ finished: true }));
    await fireEvent.press(screen.getByRole('button', { name: en.room.tutorial.close }));
    expect(walks[walks.length - 1].to).toEqual(aside);
  });

  test('a character whose preset has no art gets a silhouette and the room still works', async () => {
    await render(room({ character: { ...character, presetId: 'starter_99' } }));
    expect(screen.getByTestId('player-silhouette', hidden)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: en.room.hearth }));
    expect(screen.getByText(en.room.player.hearth)).toBeOnTheScreen();
  });
});

describe('tutorial with the player', () => {
  const tut = en.room.tutorial;
  const hear = (place: 'hearth' | 'seals' | 'chronicle' | 'door') => tut.hear.replace('{{place}}', en.room[place]);
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  function captureWalks() {
    motion.mockReturnValue(true);
    const walks: { value: unknown; to: unknown; done: (result: { finished: boolean }) => void }[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
      start: done => { if (value instanceof Animated.ValueXY) walks.push({ value, to: config.toValue, done: done ?? (() => undefined) }); }, stop: jest.fn(), reset: jest.fn(),
    }));
    return walks;
  }

  test('the start walks Żaromir from aside to his tutorial place and the player stays at the start', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    expect(walks.map(walk => walk.to)).toEqual([tutor]);
    expectAt('room-player', playerStart);
  });

  test('the player and Żaromir walk to their own spots at the chosen place and the chapter waits for both', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await act(async () => walks[0].done({ finished: true }));
    await press(hear('chronicle'));
    const chapter = walks.slice(1);
    expect(chapter.map(walk => walk.to).sort((a, b) => (a as { x: number }).x - (b as { x: number }).x)).toEqual([places.chronicle.guide, places.chronicle.player]);
    await act(async () => chapter[0].done({ finished: true }));
    expect(screen.queryByText(en.room.player.tutorial.chronicle.feminine)).toBeNull();
    await act(async () => chapter[1].done({ finished: true }));
    expect(screen.getByText(en.room.player.tutorial.chronicle.feminine)).toBeOnTheScreen();
  });

  test('at a told place the player handles it while Żaromir works, turns and talks', async () => {
    const walks = captureWalks();
    await render(room({ tutorial: 1 }));
    await press(hear('seals'));
    for (const walk of walks) await act(async () => walk.done({ finished: true }));
    expect(screen.getByTestId('hero-pose-seals', hidden)).toBeTruthy();
    await act(async () => { jest.advanceTimersByTime(ACT_BEFORE_TURN_MS + TURN_FRAME_MS * 4); });
    expect(screen.getByTestId('hero-talk', hidden)).toBeTruthy();
  });

  test('the door chapter puts the player in the doorway behind the seals and Żaromir in front of them', async () => {
    const onExit = jest.fn();
    await render(room({ tutorial: 1, onExit }));
    await press(hear('door'));
    expectAt('room-player', places.door.player);
    expectAt('room-guide', places.door.guide);
    expect(onExit).not.toHaveBeenCalled();
    // The player stands higher on screen, so is drawn first, then the drums cover the player's legs, then Żaromir.
    expect(drawOrder(['room-player', 'seals-cut-player', 'room-guide'])).toEqual(['room-player', 'seals-cut-player', 'room-guide']);
    const opacity = (id: string) => (StyleSheet.flatten(screen.getByTestId(id, hidden).props.style) as { opacity: number }).opacity;
    expect(opacity('seals-cut-player')).toBe(1);
    expect(opacity('seals-cut-guide')).toBe(0);
  });

  test('finishing the tutorial sends Żaromir back aside and the room is in normal mode', async () => {
    await render(room({ tutorial: 1 }));
    for (const [place, lines] of [['hearth', 4], ['seals', 3], ['chronicle', 2], ['door', 4]] as const) {
      await press(hear(place));
      for (let line = 0; line < lines; line++) await press(tut.next);
      await press(place === 'door' ? tut.finish : tut.another);
    }
    await press(tut.finish);
    expectAt('room-guide', aside);
    await press(en.room.hearth);
    expectAt('room-player', places.hearth.player);
    expect(screen.getByText(en.room.player.hearth)).toBeOnTheScreen();
  });

  test('with reduced motion both figures stand at the chapter place at once', async () => {
    await render(room({ tutorial: 1 }));
    await press(hear('hearth'));
    expectAt('room-player', places.hearth.player);
    expectAt('room-guide', places.hearth.guide);
    expect(screen.getByText(en.room.player.tutorial.hearth)).toBeOnTheScreen();
    expect(walkTimers()).toHaveLength(0);
  });
});

describe('dialogue panel', () => {
  const tut = en.room.tutorial;
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  const plate = () => screen.getByTestId('dialogue-plate', hidden);
  const ring = () => StyleSheet.flatten(screen.getByTestId('speaking-ring', hidden).props.style) as { left: number; top: number; width: number; height: number };
  const ringAt = (spot: { x: number; y: number }) => {
    const scene = cover(Dimensions.get('window'));
    const box = ring();
    expect(box.left + box.width / 2).toBeCloseTo(scene.left + spot.x * scene.width);
    expect(box.top + box.height / 2).toBeCloseTo(scene.top + spot.y * scene.height);
  };

  test('the player speaks first at a visited place, then Żaromir describes it and its action opens the screen', async () => {
    const onOpenStation = jest.fn();
    await render(room({ onOpenStation }));
    await press(en.room.hearth);
    expect(screen.getByText(en.room.player.hearth)).toBeOnTheScreen();
    expect(plate()).toHaveTextContent('Mira');
    expect(screen.queryByRole('button', { name: en.room.actions.hearth })).toBeNull();
    ringAt(places.hearth.player);
    await press(tut.next);
    expect(screen.getByText(en.room.descriptions.hearth)).toBeOnTheScreen();
    expect(plate()).toHaveTextContent('Zharomir');
    ringAt(aside);
    await pressAction(en.room.actions.hearth);
    expect(onOpenStation).toHaveBeenCalledWith('hearth');
  });

  test('a tutorial chapter opens with the player line, then counts only Żaromir\'s lines', async () => {
    await render(room({ tutorial: 1 }));
    await press(tut.hear.replace('{{place}}', en.room.seals));
    expect(screen.getByText(en.room.player.tutorial.seals)).toBeOnTheScreen();
    expect(screen.queryByText('1 / 3')).toBeNull();
    await press(tut.next);
    expect(screen.getByText(tut.seals['1'])).toBeOnTheScreen();
    expect(screen.getByText('1 / 3')).toBeOnTheScreen();
    await press(tut.next); await press(tut.next);
    expect(screen.getByText('3 / 3')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: tut.another })).toBeOnTheScreen();
  });

  test('the chronicle chapter opens with the line for the character\'s form', async () => {
    await render(room({ tutorial: 1 }, 'pl'));
    await fireEvent.press(screen.getByRole('button', { name: pl.room.tutorial.hear.replace('{{place}}', pl.room.chronicle) }));
    expect(screen.getByText(pl.room.player.tutorial.chronicle.feminine)).toBeOnTheScreen();
  });

  test('in the first-visit guide only Żaromir speaks', async () => {
    await render(room({ showGuide: true }));
    expect(screen.getByText(en.room.guide.hearth)).toBeOnTheScreen();
    expect(plate()).toHaveTextContent('Zharomir');
    expect(screen.getByText('1 / 4')).toBeOnTheScreen();
    ringAt(places.hearth.guide);
  });

  // Review finding: the ring glowed aside while Żaromir was still walking to his tutorial place.
  test('the ring waits until the speaker stands still, then glows under the speaker', async () => {
    motion.mockReturnValue(true);
    const walks: ((result: { finished: boolean }) => void)[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value) => ({
      start: done => { if (done && value instanceof Animated.ValueXY) walks.push(done); }, stop: jest.fn(), reset: jest.fn(),
    }));
    await render(room({ tutorial: 1 }));
    expect(screen.getByTestId('dialogue-panel')).toBeTruthy();
    expect(screen.queryByTestId('speaking-ring', hidden)).toBeNull();
    await act(async () => walks[0]({ finished: true }));
    ringAt(tutor);
  });

  test('closing the tutorial on the player\'s opening line ends it', async () => {
    const onTutorialEnd = jest.fn();
    await render(room({ tutorial: 1, onTutorialEnd }));
    await press(tut.hear.replace('{{place}}', en.room.door));
    await press(tut.close);
    expect(onTutorialEnd).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('dialogue-panel')).toBeNull();
  });

  test('with motion allowed a line types and the first touch completes it', async () => {
    motion.mockReturnValue(true);
    jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
    await render(room({ showGuide: true }));
    const text = () => ((screen.getByTestId('dialogue-text').props.children as unknown[])[0] as string);
    expect(text()).not.toBe(en.room.guide.hearth);
    await fireEvent.press(screen.getByTestId('dialogue-panel-touch'));
    expect(text()).toBe(en.room.guide.hearth);
  });

  // The longest Polish line on a 375 × 667 screen with slightly larger text.
  test('the panel keeps its bottom edge and never rises above the places', async () => {
    const se = { width: 375, height: 667, scale: 2, fontScale: 1.3 };
    Dimensions.set({ window: se, screen: se });
    await render(room({ tutorial: 1 }, 'pl'));
    const tpl = pl.room.tutorial;
    await fireEvent.press(screen.getByRole('button', { name: tpl.hear.replace('{{place}}', pl.room.seals) }));
    const first = StyleSheet.flatten(screen.getByTestId('dialogue-panel').props.style) as { bottom: number; maxHeight: number };
    for (let line = 0; line < 3; line++) await fireEvent.press(screen.getByRole('button', { name: tpl.next }));
    expect(screen.getByText(tpl.seals['3'])).toBeOnTheScreen();
    const last = StyleSheet.flatten(screen.getByTestId('dialogue-panel').props.style) as { bottom: number; maxHeight: number };
    expect(last.bottom).toBe(20);
    expect(first.bottom).toBe(20);
    const bottoms = (['hearth', 'seals', 'chronicle'] as const).map(station => {
      const style = StyleSheet.flatten(screen.getByRole('button', { name: tpl.hear.replace('{{place}}', pl.room[station]) }).props.style) as { top: number; marginTop: number; height: number };
      return style.top + style.marginTop + style.height;
    });
    expect(se.height - last.bottom - last.maxHeight).toBeGreaterThanOrEqual(Math.max(...bottoms));
  });
});

describe('first-visit guide with Żaromir walking', () => {
  function captureWalks() {
    motion.mockReturnValue(true);
    const walks: { to: unknown; done: (result: { finished: boolean }) => void }[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
      start: done => { if (value instanceof Animated.ValueXY) walks.push({ to: config.toValue, done: done ?? (() => undefined) }); }, stop: jest.fn(), reset: jest.fn(),
    }));
    return walks;
  }
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));

  test('Żaromir walks to each step\'s place while the player stays at the start', async () => {
    const walks = captureWalks();
    await render(room({ showGuide: true }));
    expect(walks.map(walk => walk.to)).toEqual([places.hearth.guide]);
    expect(screen.getByText(en.room.guide.hearth)).toBeOnTheScreen();
    for (const place of ['seals', 'chronicle', 'door'] as const) {
      await act(async () => walks[walks.length - 1].done({ finished: true }));
      await press(en.room.guide.next);
      expect(walks[walks.length - 1].to).toEqual(places[place].guide);
    }
    expectAt('room-player', playerStart);
  });

  test('at a step\'s place Żaromir turns to the player and talks', async () => {
    const walks = captureWalks();
    await render(room({ showGuide: true }));
    await act(async () => walks[0].done({ finished: true }));
    expect(screen.getByTestId('hero-talk', hidden)).toBeTruthy();
  });

  test('touching a place ends the guide, the player visits it and Żaromir goes aside', async () => {
    const onGuideComplete = jest.fn();
    await render(room({ showGuide: true, onGuideComplete }));
    expectAt('room-guide', places.hearth.guide);
    await press(en.room.seals);
    expect(onGuideComplete).toHaveBeenCalledTimes(1);
    expectAt('room-guide', aside);
    expectAt('room-player', places.seals.player);
    expect(screen.getByText(en.room.player.seals)).toBeOnTheScreen();
  });

  test.each([['finished', 'done'], ['skipped', 'skip']] as const)('a %s guide sends Żaromir aside', async (_name, how) => {
    await render(room({ showGuide: true }));
    if (how === 'skip') await press(en.room.guide.skip);
    else for (const label of [en.room.guide.next, en.room.guide.next, en.room.guide.next, en.room.guide.done]) await press(label);
    expectAt('room-guide', aside);
  });

  test('with reduced motion Żaromir stands at the step\'s place at once', async () => {
    await render(room({ showGuide: true }));
    expectAt('room-guide', places.hearth.guide);
    await press(en.room.guide.next);
    expectAt('room-guide', places.seals.guide);
    expect(walkTimers()).toHaveLength(0);
  });
});

describe('talking to Żaromir', () => {
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  const talk = () => press(en.room.talk.label);
  const card = () => screen.getByTestId('talk-card');

  test('Żaromir aside has a labelled touch target of at least 44 points, only in normal mode', async () => {
    const view = await render(room());
    const box = StyleSheet.flatten(screen.getByRole('button', { name: en.room.talk.label }).props.style) as { width: number; height: number };
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    await view.rerender(room({ tutorial: 1 }));
    expect(screen.queryByRole('button', { name: en.room.talk.label })).toBeNull();
  });

  // Review finding: on 375 point wide screens the talk target covered the edges of the hearth and chronicle touch areas.
  test.each([[375, 667], [375, 812], [440, 956]])('at %i × %i the talk target stays clear of every place', async (width, height) => {
    const window = { width, height, scale: 3, fontScale: 1 };
    Dimensions.set({ window, screen: window });
    await render(room());
    const box = (name: string) => {
      const style = StyleSheet.flatten(screen.getByRole('button', { name }).props.style) as { left: number; top: number; width: number; height: number; marginLeft?: number; marginTop?: number };
      const left = style.left + (style.marginLeft ?? 0);
      const top = style.top + (style.marginTop ?? 0);
      return { left, top, right: left + style.width, bottom: top + style.height };
    };
    const talkBox = box(en.room.talk.label);
    for (const place of [en.room.hearth, en.room.seals, en.room.chronicle, en.room.door]) {
      const other = box(place);
      const overlap = talkBox.left < other.right && other.left < talkBox.right && talkBox.top < other.bottom && other.top < talkBox.bottom;
      expect([place, overlap]).toEqual([place, false]);
    }
  });

  test('the guide hides the talk until it ends', async () => {
    await render(room({ showGuide: true }));
    expect(screen.queryByRole('button', { name: en.room.talk.label })).toBeNull();
    await press(en.room.guide.skip);
    expect(screen.getByRole('button', { name: en.room.talk.label })).toBeOnTheScreen();
  });

  test('the player asks, then Żaromir gives the hint for no current Oaths with the statistics card', async () => {
    const onTalk = jest.fn();
    await render(room({ onTalk, progress: { today: { total: 0, paused: false }, history: { total: 5 }, loading: false } }));
    await talk();
    expect(onTalk).toHaveBeenCalledTimes(1);
    expect(screen.getByText(en.room.player.talk)).toBeOnTheScreen();
    await press(en.room.tutorial.next);
    expect(screen.getByText(en.room.talk.hint.none)).toBeOnTheScreen();
    expect(card()).toHaveTextContent('Mira', { exact: false });
    expect(card()).toHaveTextContent('Oathkeeper', { exact: false });
    expect(card()).toHaveTextContent('Slight', { exact: false });
    expect(card()).toHaveTextContent('0 current Oaths', { exact: false });
    expect(card()).toHaveTextContent('5 chronicle entries', { exact: false });
  });

  test('one current Oath reads in the singular', async () => {
    await render(room({ progress: { today: { total: 1, paused: false }, history: { total: 1 }, loading: false } }));
    await talk(); await press(en.room.tutorial.next);
    expect(screen.getByText('You have 1 current Oath. Take a look at the seals.')).toBeOnTheScreen();
  });

  test('a restarted guide closes an open talk for good', async () => {
    const view = await render(room());
    await talk();
    await view.rerender(room({ showGuide: 2 }));
    await press(en.room.guide.skip);
    expect(screen.queryByText(en.room.player.talk)).toBeNull();
  });

  test('current Oaths are counted in the hint', async () => {
    await render(room({ progress: { today: { total: 3, paused: false }, history: { total: 1 }, loading: false } }));
    await talk(); await press(en.room.tutorial.next);
    expect(screen.getByText('You have 3 current Oaths. Take a look at the seals.')).toBeOnTheScreen();
    expect(card()).toHaveTextContent('1 chronicle entry', { exact: false });
  });

  test('a paused character hears the pause line first', async () => {
    await render(room({ progress: { today: { total: 3, paused: true }, history: { total: 1 }, loading: false } }));
    await talk(); await press(en.room.tutorial.next);
    expect(screen.getByText(en.room.talk.hint.paused)).toBeOnTheScreen();
  });

  test('without counts the hint says so and the card shows dashes', async () => {
    await render(room({ progress: { today: null, history: null, loading: false } }));
    await talk(); await press(en.room.tutorial.next);
    expect(screen.getByText(en.room.talk.hint.unavailable)).toBeOnTheScreen();
    expect(card()).toHaveTextContent('– current Oaths', { exact: false });
    expect(card()).toHaveTextContent('– chronicle entries', { exact: false });
  });

  test('Żaromir waits for a pending answer at most 2000 ms', async () => {
    await render(room({ progress: { today: null, history: null, loading: true } }));
    await talk(); await press(en.room.tutorial.next);
    expect(screen.queryByText(en.room.talk.hint.unavailable)).toBeNull();
    await act(async () => { jest.advanceTimersByTime(1999); });
    expect(screen.queryByText(en.room.talk.hint.unavailable)).toBeNull();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(screen.getByText(en.room.talk.hint.unavailable)).toBeOnTheScreen();
  });

  test('an answer arriving in time gives the counted hint at once', async () => {
    const view = await render(room({ progress: { today: null, history: null, loading: true } }));
    await talk(); await press(en.room.tutorial.next);
    await view.rerender(room({ progress: { today: { total: 2, paused: false }, history: { total: 4 }, loading: false } }));
    expect(screen.getByText('You have 2 current Oaths. Take a look at the seals.')).toBeOnTheScreen();
  });

  test('the Polish card uses the form title, build and plural labels', async () => {
    await render(room({ progress: { today: { total: 2, paused: false }, history: { total: 5 }, loading: false } }, 'pl'));
    await press(pl.room.talk.label);
    await press(pl.room.tutorial.next);
    expect(card()).toHaveTextContent('Obrończyni Przysięgi', { exact: false });
    expect(card()).toHaveTextContent('Wątła', { exact: false });
    expect(card()).toHaveTextContent('2 bieżące Przysięgi', { exact: false });
    expect(card()).toHaveTextContent('5 wpisów w kronice', { exact: false });
  });
});

describe('camera flight', () => {
  const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }));
  function captureTimings() {
    const timings: { duration?: number; to: unknown; done?: (result: { finished: boolean }) => void }[] = [];
    jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
      start: done => {
        if (value instanceof Animated.ValueXY) { done?.({ finished: true }); return; }
        timings.push({ duration: config.duration, to: config.toValue, done });
      }, stop: jest.fn(), reset: jest.fn(),
    }));
    return timings;
  }
  // With motion the first touch completes the typed player line, the second brings Żaromir's line with the action.
  async function visit(place: 'hearth' | 'seals' | 'chronicle') {
    await press(en.room[place]);
    await fireEvent.press(screen.getByTestId('dialogue-panel-touch'));
    await fireEvent.press(screen.getByTestId('dialogue-panel-touch'));
  }

  test('the place action flies into the close-up and opens its screen within 700 ms, ignoring a second touch', async () => {
    motion.mockReturnValue(true);
    const timings = captureTimings();
    const onOpenStation = jest.fn();
    await render(room({ onOpenStation }));
    await visit('seals');
    await press(en.room.actions.seals);
    expect(timings.filter(timing => timing.duration === 650)).toHaveLength(1);
    expect(screen.getByTestId('flight-closeup', hidden)).toBeTruthy();
    expect(onOpenStation).not.toHaveBeenCalled();
    await press(en.room.actions.seals);
    await act(async () => { jest.advanceTimersByTime(699); });
    expect(onOpenStation).not.toHaveBeenCalled();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(onOpenStation).toHaveBeenCalledTimes(1);
    expect(onOpenStation).toHaveBeenCalledWith('seals');
    expect(timings.filter(timing => timing.duration === 650)).toHaveLength(1);
  });

  test('a finished flight opens the screen at once and the time limit does not open it again', async () => {
    motion.mockReturnValue(true);
    const timings = captureTimings();
    const onOpenStation = jest.fn();
    await render(room({ onOpenStation }));
    await visit('chronicle');
    await press(en.room.actions.chronicle);
    await act(async () => timings.find(timing => timing.duration === 650)!.done!({ finished: true }));
    expect(onOpenStation).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(700); });
    expect(onOpenStation).toHaveBeenCalledTimes(1);
  });

  test('with reduced motion the close-up crossfades in 250 ms without scaling and the screen opens by 700 ms', async () => {
    const timings = captureTimings();
    const onOpenStation = jest.fn();
    await render(room({ onOpenStation }));
    await press(en.room.hearth);
    await press(en.room.tutorial.next);
    await press(en.room.actions.hearth);
    expect(timings.map(timing => timing.duration)).toEqual([250]);
    await act(async () => { jest.advanceTimersByTime(700); });
    expect(onOpenStation).toHaveBeenCalledTimes(1);
  });

  test('returning from a place starts on its close-up, flies back and shows the player at that place', async () => {
    motion.mockReturnValue(true);
    const timings = captureTimings();
    await render(room({ from: 'seals' }));
    expect(screen.getByTestId('flight-closeup', hidden)).toBeTruthy();
    expectAt('room-player', places.seals.player);
    const back = timings.find(timing => timing.duration === 650)!;
    expect(back.to).toBe(0);
    await act(async () => back.done!({ finished: true }));
    expect(screen.queryByTestId('flight-closeup', hidden)).toBeNull();
    // The entrance zoom does not play on top of the return.
    expect(timings.filter(timing => timing.duration === 1100)).toHaveLength(0);
  });

  test('the door is a visit: the player looks out, then the action pulls back and leaves once by 700 ms', async () => {
    const timings = captureTimings();
    const onExit = jest.fn();
    await render(room({ onExit }));
    await press(en.room.door);
    expectAt('room-player', places.door.player);
    expect(screen.getByText(en.room.player.door)).toBeOnTheScreen();
    expect(onExit).not.toHaveBeenCalled();
    await press(en.room.tutorial.next);
    expect(screen.getByText(en.room.descriptions.door)).toBeOnTheScreen();
    await press(en.room.exit);
    await press(en.room.exit);
    expect(timings.map(timing => timing.duration)).toContain(250);
    await act(async () => { jest.advanceTimersByTime(700); });
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  test('the Polish door line and action come from the catalog', async () => {
    await render(room({}, 'pl'));
    await fireEvent.press(screen.getByRole('button', { name: pl.room.door }));
    await fireEvent.press(screen.getByRole('button', { name: pl.room.tutorial.next }));
    expect(screen.getByText('Drzwi prowadzą do menu. Kuźnia poczeka na Twój powrót.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: pl.room.exit })).toBeOnTheScreen();
  });
});
