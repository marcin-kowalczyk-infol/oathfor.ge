import type { NetworkState } from 'expo-network';
import { createNetworkEvents } from './networkEvents';

function fakeNetwork(initial: NetworkState | Promise<NetworkState>) {
  const listeners = new Set<(state: NetworkState) => void>();
  const remove = jest.fn();
  const events = createNetworkEvents(
    listener => { listeners.add(listener); return { remove: () => { listeners.delete(listener); remove(); } }; },
    () => Promise.resolve(initial),
  );
  return { events, remove, emit: (state: NetworkState) => listeners.forEach(listener => listener(state)) };
}
const settle = () => new Promise<void>(resolve => setImmediate(resolve));

test('only a change from offline to online reports a reconnect', async () => {
  const network = fakeNetwork({ isConnected: true, isInternetReachable: true });
  const reconnect = jest.fn();
  network.events.onReconnect(reconnect);
  await settle();
  network.emit({ isConnected: true, isInternetReachable: true });
  expect(reconnect).not.toHaveBeenCalled();
  network.emit({ isConnected: false, isInternetReachable: false });
  network.emit({ isConnected: true, isInternetReachable: true });
  expect(reconnect).toHaveBeenCalledTimes(1);
  network.emit({ isConnected: true, isInternetReachable: true });
  expect(reconnect).toHaveBeenCalledTimes(1);
});

test('starting offline, the first online report is a reconnect', async () => {
  const network = fakeNetwork({ isConnected: false, isInternetReachable: false });
  const reconnect = jest.fn();
  network.events.onReconnect(reconnect);
  await settle();
  network.emit({ isConnected: true, isInternetReachable: true });
  expect(reconnect).toHaveBeenCalledTimes(1);
});

test('a link without internet counts as offline and an unknown state changes nothing', async () => {
  const network = fakeNetwork({ isConnected: true, isInternetReachable: true });
  const reconnect = jest.fn();
  network.events.onReconnect(reconnect);
  await settle();
  network.emit({ isConnected: true, isInternetReachable: false });
  network.emit({});
  network.emit({ isConnected: true, isInternetReachable: true });
  expect(reconnect).toHaveBeenCalledTimes(1);
});

test('a change seen before the first reading wins over that reading', async () => {
  let resolve!: (state: NetworkState) => void;
  const network = fakeNetwork(new Promise<NetworkState>(done => { resolve = done; }));
  const reconnect = jest.fn();
  network.events.onReconnect(reconnect);
  network.emit({ isConnected: false });
  resolve({ isConnected: true });
  await settle();
  network.emit({ isConnected: true });
  expect(reconnect).toHaveBeenCalledTimes(1);
});

test('unsubscribing stops the reports', async () => {
  const network = fakeNetwork({ isConnected: false });
  const reconnect = jest.fn();
  const stop = network.events.onReconnect(reconnect);
  await settle();
  stop();
  network.emit({ isConnected: true });
  expect(reconnect).not.toHaveBeenCalled();
  expect(network.remove).toHaveBeenCalledTimes(1);
});
