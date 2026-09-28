import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { ACT_BEFORE_TURN_MS, HeroSprite, TALK_GESTURE_MS, TURN_FRAME_MS, WALK_FRAME_MS, type HeroPose } from './HeroSprite';

const HEIGHT = 100;
const WIDTH = 90;
const frameOf = (testID: string) => {
  const style = StyleSheet.flatten((screen.getByTestId(testID, { includeHiddenElements: true }).children[0] as unknown as { props: { style: object } }).props.style) as { left: number; top: number; width: number };
  const cols = Math.round(style.width / WIDTH);
  return Math.round(-style.top / HEIGHT) * cols + Math.round(-style.left / WIDTH);
};
const sprite = (pose: HeroPose, allowed = true) => <HeroSprite pose={pose} allowed={allowed} height={HEIGHT} />;

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('a walk steps through all eight frames of its direction and loops', async () => {
  await render(sprite({ kind: 'walk', direction: 'back-left' }));
  expect(frameOf('hero-walk-back-left')).toBe(0);
  await act(async () => { jest.advanceTimersByTime(WALK_FRAME_MS * 3); });
  expect(frameOf('hero-walk-back-left')).toBe(3);
  await act(async () => { jest.advanceTimersByTime(WALK_FRAME_MS * 5); });
  expect(frameOf('hero-walk-back-left')).toBe(0);
});

test('reduced motion holds the first frame without a timer', async () => {
  const intervals = jest.spyOn(globalThis, 'setInterval');
  await render(sprite({ kind: 'idle' }, false));
  expect(intervals).not.toHaveBeenCalled();
  expect(frameOf('hero-idle')).toBe(0);
});

test('a station pose loops its four frames facing the place', async () => {
  await render(sprite({ kind: 'act', place: 'seals' }));
  expect(screen.getByTestId('hero-pose-seals', { includeHiddenElements: true })).toBeTruthy();
  await act(async () => { jest.advanceTimersByTime(ACT_BEFORE_TURN_MS / 2); });
  expect(frameOf('hero-pose-seals')).toBe(2);
  await act(async () => { jest.advanceTimersByTime(ACT_BEFORE_TURN_MS / 2); });
  expect(frameOf('hero-pose-seals')).toBe(0);
});

test('the turn plays once and holds the frame facing the player', async () => {
  const clear = jest.spyOn(globalThis, 'clearInterval');
  await render(sprite({ kind: 'turn' }));
  await act(async () => { jest.advanceTimersByTime(TURN_FRAME_MS * 3); });
  expect(frameOf('hero-turn')).toBe(3);
  expect(clear).toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(TURN_FRAME_MS * 5); });
  expect(frameOf('hero-turn')).toBe(3);
});

test('talking cycles only the requested gestures', async () => {
  await render(sprite({ kind: 'talk', gestures: [0, 3] }));
  expect(frameOf('hero-talk')).toBe(0);
  await act(async () => { jest.advanceTimersByTime(TALK_GESTURE_MS); });
  expect(frameOf('hero-talk')).toBe(3);
  await act(async () => { jest.advanceTimersByTime(TALK_GESTURE_MS); });
  expect(frameOf('hero-talk')).toBe(0);
});

test('reduced-motion talk shows the first gesture', async () => {
  await render(sprite({ kind: 'talk', gestures: [1, 2] }, false));
  expect(frameOf('hero-talk')).toBe(1);
});

test('unmounting clears the frame timer', async () => {
  const clear = jest.spyOn(globalThis, 'clearInterval');
  const intervals = jest.spyOn(globalThis, 'setInterval');
  const view = await render(sprite({ kind: 'walk', direction: 'front' }));
  const timer = intervals.mock.results[0].value;
  await view.unmount();
  expect(clear).toHaveBeenCalledWith(timer);
});

// Native check: a transform scale blurred the sprite on iOS, so depth changes the drawn size instead.
test('depth scale changes the drawn size along the walk, without a transform', async () => {
  const height = () => StyleSheet.flatten(screen.getByTestId('hero-walk-back', { includeHiddenElements: true }).props.style) as { height: number; transform?: unknown };
  await render(<HeroSprite pose={{ kind: 'walk', direction: 'back' }} allowed height={HEIGHT} scale={{ from: 1, to: 0.8, duration: WALK_FRAME_MS * 10 }} />);
  expect(height().height).toBeCloseTo(100);
  await act(async () => { jest.advanceTimersByTime(WALK_FRAME_MS * 5); });
  expect(height().height).toBeLessThan(100);
  expect(height().height).toBeGreaterThan(80);
  await act(async () => { jest.advanceTimersByTime(WALK_FRAME_MS * 6); });
  expect(height().height).toBeCloseTo(80);
  expect(height().transform).toBeUndefined();
});

test('a resting pose is drawn at its fixed depth', async () => {
  await render(<HeroSprite pose={{ kind: 'idle' }} allowed={false} height={HEIGHT} scale={0.9} />);
  expect(StyleSheet.flatten(screen.getByTestId('hero-idle', { includeHiddenElements: true }).props.style)).toMatchObject({ height: 90 });
});

// Native check: a new sheet loads asynchronously, so the first walking frame was empty for a moment.
test('the previous frame stays underneath until the next sheet has loaded', async () => {
  const view = await render(sprite({ kind: 'idle' }));
  await view.rerender(sprite({ kind: 'walk', direction: 'front' }));
  expect(screen.getByTestId('hero-previous', { includeHiddenElements: true })).toBeTruthy();
  // Native check: both figures showed for one frame. The new sheet stays hidden until it has loaded.
  const wrapper = screen.getByTestId('hero-walk-front', { includeHiddenElements: true }).parent as unknown as { props: { style: object } };
  expect(StyleSheet.flatten(wrapper.props.style)).toMatchObject({ opacity: 0 });
  await act(async () => { fireEvent(screen.getByTestId('hero-walk-front', { includeHiddenElements: true }).children[0] as never, 'load'); });
  expect(screen.queryByTestId('hero-previous', { includeHiddenElements: true })).toBeNull();
});

test('a new run restarts the frame timer without remounting', async () => {
  const intervals = jest.spyOn(globalThis, 'setInterval');
  const view = await render(<HeroSprite pose={{ kind: 'walk', direction: 'front' }} allowed height={HEIGHT} run={1} />);
  await act(async () => { jest.advanceTimersByTime(WALK_FRAME_MS * 3); });
  await view.rerender(<HeroSprite pose={{ kind: 'walk', direction: 'front' }} allowed height={HEIGHT} run={2} />);
  expect(intervals.mock.calls.filter(call => call[1] === WALK_FRAME_MS)).toHaveLength(2);
  expect(frameOf('hero-walk-front')).toBe(0);
});

test('a sheet that never reports loading still shows after a short wait', async () => {
  const view = await render(sprite({ kind: 'idle' }));
  await view.rerender(sprite({ kind: 'walk', direction: 'front' }));
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(screen.queryByTestId('hero-previous', { includeHiddenElements: true })).toBeNull();
});

// Review finding: a new pose showed the previous pose's step for one render.
test('a new pose starts at its first frame on its first render', async () => {
  const view = await render(sprite({ kind: 'turn' }));
  await act(async () => { jest.advanceTimersByTime(TURN_FRAME_MS * 3); });
  await view.rerender(sprite({ kind: 'talk', gestures: [0, 3] }));
  expect(frameOf('hero-talk')).toBe(0);
});
