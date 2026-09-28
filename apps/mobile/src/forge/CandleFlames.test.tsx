import { act, render, screen } from '@testing-library/react-native';
import { CANDLE_FRAME_MS, CandleFlames, candles } from './CandleFlames';

const point = (x: number, y: number) => ({ left: x * 400, top: y * 800 });

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

test('every painted flame gets one decorative flame', async () => {
  await render(<CandleFlames point={point} sceneWidth={400} allowed={false} />);
  expect(screen.getAllByTestId(/^candle-/, { includeHiddenElements: true })).toHaveLength(candles.length);
});

test('flames share one timer only while motion is allowed', async () => {
  const intervals = jest.spyOn(globalThis, 'setInterval');
  const clear = jest.spyOn(globalThis, 'clearInterval');
  const view = await render(<CandleFlames point={point} sceneWidth={400} allowed={false} />);
  expect(intervals).not.toHaveBeenCalled();
  await view.rerender(<CandleFlames point={point} sceneWidth={400} allowed />);
  expect(intervals.mock.calls.filter(call => call[1] === CANDLE_FRAME_MS)).toHaveLength(1);
  await act(async () => { jest.advanceTimersByTime(CANDLE_FRAME_MS * 2); });
  await view.rerender(<CandleFlames point={point} sceneWidth={400} allowed={false} />);
  expect(clear).toHaveBeenCalledWith(intervals.mock.results[0].value);
});
