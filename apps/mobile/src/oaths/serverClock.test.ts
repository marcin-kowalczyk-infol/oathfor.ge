import { createServerClock } from './serverClock';

test('server now is the device time corrected by the offset at receipt', () => {
  let device = 1000;
  const clock = createServerClock(() => device);
  expect(clock.now()).toBeNull();
  clock.observe('1970-01-01T00:00:06Z');
  device = 2500;
  expect(clock.now()).toBe(7500);
});

test('the latest envelope wins and each observation notifies once', () => {
  let device = 0;
  const clock = createServerClock(() => device);
  const listener = jest.fn();
  clock.subscribe(listener);
  clock.observe('1970-01-01T00:00:10Z');
  device = 1000;
  clock.observe('1970-01-01T00:00:05Z');
  expect(clock.now()).toBe(5000);
  expect(listener).toHaveBeenCalledTimes(2);
});
