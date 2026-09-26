import { render } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { StationEffect } from './StationEffect';

test('a touch response stops on backgrounding and does not replay on return', async () => {
  const stop = jest.fn();
  const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
  const view = await render(<StationEffect station="chronicle" request={1} allowed anchor={{ left: 10, top: 20 }} />);
  expect(timing).toHaveBeenCalledTimes(1);
  await view.rerender(<StationEffect station="chronicle" request={1} allowed={false} anchor={{ left: 10, top: 20 }} />);
  expect(stop).toHaveBeenCalledTimes(1);
  await view.rerender(<StationEffect station="chronicle" request={1} allowed anchor={{ left: 10, top: 20 }} />);
  expect(timing).toHaveBeenCalledTimes(1);
  await view.rerender(<StationEffect station="chronicle" request={2} allowed anchor={{ left: 10, top: 20 }} />);
  expect(timing).toHaveBeenCalledTimes(2);
  await view.unmount();
  expect(stop).toHaveBeenCalledTimes(2);
  jest.restoreAllMocks();
});

test('a reduced-motion touch stays static even if animation is enabled later', async () => {
  const timing = jest.spyOn(Animated, 'timing');
  const view = await render(<StationEffect station="hearth" request={1} allowed={false} anchor={{ left: 0, top: 0 }} />);
  await view.rerender(<StationEffect station="hearth" request={1} allowed anchor={{ left: 0, top: 0 }} />);
  expect(timing).not.toHaveBeenCalled();
  jest.restoreAllMocks();
});
