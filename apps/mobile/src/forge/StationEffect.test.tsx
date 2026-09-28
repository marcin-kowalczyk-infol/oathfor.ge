import { render, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import { StationEffect } from './StationEffect';

const point = (x: number, y: number) => ({ left: x * 400, top: y * 800 });
const effect = (station: 'hearth' | 'seals' | 'chronicle' | 'door', request: number, allowed: boolean) =>
  <StationEffect station={station} request={request} allowed={allowed} point={point} sceneWidth={400} />;

test('a touch response stops on backgrounding and does not replay on return', async () => {
  const stop = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
  const view = await render(effect('chronicle', 1, true));
  expect(timing).toHaveBeenCalledTimes(1);
  await view.rerender(effect('chronicle', 1, false));
  expect(stop).toHaveBeenCalledTimes(1);
  await view.rerender(effect('chronicle', 1, true));
  expect(timing).toHaveBeenCalledTimes(1);
  await view.rerender(effect('chronicle', 2, true));
  expect(timing).toHaveBeenCalledTimes(2);
  await view.unmount();
  expect(stop).toHaveBeenCalledTimes(2);
  jest.restoreAllMocks();
});

test('a reduced-motion touch stays static even if animation is enabled later', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const view = await render(effect('hearth', 1, false));
  await view.rerender(effect('hearth', 1, true));
  expect(timing).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});

test('the seal response lights all three seals from one timing', async () => {
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  await render(effect('seals', 1, true));
  expect(timing).toHaveBeenCalledTimes(1);
  for (const seal of [0, 1, 2]) expect(screen.getByTestId(`fx-seal-${seal}`, { includeHiddenElements: true })).toBeTruthy();
  jest.restoreAllMocks();
});

test.each([['hearth', 'fx-hearth'], ['chronicle', 'fx-chronicle'], ['door', 'fx-door']] as const)('%s has its own sprite response', async (station, id) => {
  jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  await render(effect(station, 1, true));
  expect(screen.getByTestId(id, { includeHiddenElements: true })).toBeTruthy();
  jest.restoreAllMocks();
});

// Review finding: the last light frame ended half a frame after the effect and stayed at half opacity.
test.each(['hearth', 'seals', 'chronicle', 'door'] as const)('a finished or reduced-motion %s response leaves nothing drawn', async station => {
  await render(effect(station, 1, false));
  const layers = screen.getAllByTestId(/^fx-/, { includeHiddenElements: true });
  for (const layer of layers) for (const frame of layer.children as unknown as { props: { style: object } }[]) {
    expect(StyleSheet.flatten(frame.props.style)).toMatchObject({ opacity: 0 });
  }
});
