import { act, render, screen } from '@testing-library/react-native';
import { useMotionAllowed } from '../ui/useMotion';
import { SealStamp } from './SealStamp';
jest.mock('../ui/useMotion', () => ({ useMotionAllowed: jest.fn() }));

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const frame = () => screen.getByTestId('seal-stamp', { includeHiddenElements: true }).props.accessibilityValue?.now;

test('presses the stamp over 1200 ms with sparks from the press, then reports done once', async () => {
  jest.mocked(useMotionAllowed).mockReturnValue(true);
  const onDone = jest.fn();
  await render(<SealStamp width={300} onDone={onDone} />);
  expect(frame()).toBe(0);
  expect(screen.queryByTestId('seal-sparks', { includeHiddenElements: true })).toBeNull();
  await act(async () => { jest.advanceTimersByTime(450); });
  expect(frame()).toBe(3);
  expect(screen.getByTestId('seal-sparks', { includeHiddenElements: true })).toBeOnTheScreen();
  await act(async () => { jest.advanceTimersByTime(600); });
  expect(frame()).toBe(7);
  expect(onDone).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(150); });
  expect(onDone).toHaveBeenCalledTimes(1);
  expect(screen.queryByTestId('seal-sparks', { includeHiddenElements: true })).toBeNull();
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('Reduce Motion shows the sealed frame once the preference wait ends, without sparks', async () => {
  jest.mocked(useMotionAllowed).mockReturnValue(false);
  const onDone = jest.fn();
  await render(<SealStamp width={300} onDone={onDone} />);
  expect(onDone).not.toHaveBeenCalled();
  await act(async () => { jest.advanceTimersByTime(400); });
  expect(frame()).toBe(7);
  expect(screen.queryByTestId('seal-sparks', { includeHiddenElements: true })).toBeNull();
  expect(onDone).toHaveBeenCalledTimes(1);
});

// Native check, 2026-09-30: the motion preference arrives after mount, so the first render saw no motion and sealed at once.
test('a motion preference that arrives after mount still presses the stamp', async () => {
  jest.mocked(useMotionAllowed).mockReturnValue(false);
  const onDone = jest.fn();
  const view = await render(<SealStamp width={300} onDone={onDone} />);
  await act(async () => { jest.advanceTimersByTime(50); });
  jest.mocked(useMotionAllowed).mockReturnValue(true);
  await view.rerender(<SealStamp width={300} onDone={onDone} />);
  expect(onDone).not.toHaveBeenCalled();
  expect(frame()).toBe(0);
  await act(async () => { jest.advanceTimersByTime(450); });
  expect(frame()).toBe(3);
  await act(async () => { jest.advanceTimersByTime(750); });
  expect(onDone).toHaveBeenCalledTimes(1);
});

test('a sealed scroll shows the last frame at once and never reports done again', async () => {
  jest.mocked(useMotionAllowed).mockReturnValue(true);
  const onDone = jest.fn();
  await render(<SealStamp width={300} sealed onDone={onDone} />);
  expect(screen.getByTestId('seal-sealed', { includeHiddenElements: true }).props.accessibilityValue?.now).toBe(7);
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(onDone).not.toHaveBeenCalled();
  expect(screen.queryByTestId('seal-sparks', { includeHiddenElements: true })).toBeNull();
});
