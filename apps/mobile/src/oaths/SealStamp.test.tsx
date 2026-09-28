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

test('Reduce Motion shows the sealed frame at once without sparks', async () => {
  jest.mocked(useMotionAllowed).mockReturnValue(false);
  const onDone = jest.fn();
  await render(<SealStamp width={300} onDone={onDone} />);
  expect(frame()).toBe(7);
  expect(screen.queryByTestId('seal-sparks', { includeHiddenElements: true })).toBeNull();
  expect(onDone).toHaveBeenCalledTimes(1);
});
