import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { PlayerFigure } from './PlayerFigure';
import { presetArt } from '../characters/presetArt';
import { FIGURE_FOOT, FIGURE_HEIGHT } from './sceneLayout';

const hidden = { includeHiddenElements: true };
const box = (id: string) => StyleSheet.flatten(screen.getByTestId(id, hidden).props.style) as { top: number; height: number; width: number };

test('draws the character figure still, standing on the foot point', async () => {
  await render(<PlayerFigure presetId="starter_02" build="thin" pose={{ kind: 'idle' }} allowed scale={1} />);
  const figure = screen.getByTestId('player-dummy', hidden);
  expect(figure.props.source).toBe(presetArt('starter_02', 'thin')!.figure);
  const { top, height } = box('player-dummy');
  // The soles are at 968 of 984 pixels.
  expect(top + height * 968 / 984).toBeCloseTo(FIGURE_HEIGHT * FIGURE_FOOT);
});

test('deeper in the room the figure is drawn smaller', async () => {
  const view = await render(<PlayerFigure presetId="starter_02" build="heavy" pose={{ kind: 'idle' }} allowed scale={1} />);
  const near = box('player-dummy').height;
  await view.rerender(<PlayerFigure presetId="starter_02" build="heavy" pose={{ kind: 'idle' }} allowed scale={0.86} />);
  expect(box('player-dummy').height).toBeCloseTo(near * 0.86);
});

test('a preset without art draws a neutral silhouette', async () => {
  await render(<PlayerFigure presetId="starter_99" build="thin" pose={{ kind: 'idle' }} allowed scale={1} />);
  expect(screen.queryByTestId('player-dummy', hidden)).toBeNull();
  expect(screen.getByTestId('player-silhouette', hidden)).toBeTruthy();
});

test('during a walk the size follows the depth and the step timer stops on arrival and unmount', async () => {
  jest.useFakeTimers();
  const clear = jest.spyOn(globalThis, 'clearInterval');
  const walk = { from: 1, to: 0.86, duration: 900 };
  const view = await render(<PlayerFigure presetId="starter_02" build="thin" pose={{ kind: 'idle' }} allowed scale={walk} run={1} />);
  const start = box('player-dummy').height;
  await act(async () => { jest.advanceTimersByTime(450); });
  const halfway = box('player-dummy').height;
  expect(halfway).toBeLessThan(start);
  await act(async () => { jest.advanceTimersByTime(900); });
  expect(box('player-dummy').height).toBeCloseTo(start * 0.86);
  const cleared = clear.mock.calls.length;
  await view.rerender(<PlayerFigure presetId="starter_02" build="thin" pose={{ kind: 'idle' }} allowed scale={0.86} run={1} />);
  expect(clear.mock.calls.length).toBeGreaterThan(cleared);
  await view.unmount();
  jest.useRealTimers();
});
