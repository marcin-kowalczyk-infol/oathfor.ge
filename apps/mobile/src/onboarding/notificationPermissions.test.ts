import * as Notifications from 'expo-notifications';
import { Linking } from 'react-native';
import { nativeNotificationPermissions } from './notificationPermissions';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(),
  IosAuthorizationStatus: { NOT_DETERMINED: 0, DENIED: 1, AUTHORIZED: 2, PROVISIONAL: 3, EPHEMERAL: 4 },
}));

const read = jest.mocked(Notifications.getPermissionsAsync);
const request = jest.mocked(Notifications.requestPermissionsAsync);
const settings = jest.spyOn(Linking, 'openSettings');
const unavailable = { kind: 'unavailable', canAskAgain: false };
const native = (value: unknown) => value as Notifications.NotificationPermissionsStatus;

beforeEach(() => jest.resetAllMocks());

test('reads every iOS authorization state without prompting and preserves canAskAgain', async () => {
  for (const [status, kind, canAskAgain] of [
    [0, 'not_determined', true], [1, 'denied', false], [2, 'granted', true],
    [3, 'provisional', true], [4, 'ephemeral', false],
  ] as const) {
    read.mockResolvedValueOnce(native({ status: 'granted', canAskAgain, ios: { status } }));
    await expect(nativeNotificationPermissions.read()).resolves.toEqual({ kind, canAskAgain });
  }
  expect(request).not.toHaveBeenCalled();
});

test('explicit request asks only for alerts, badges and sound and safely returns denial', async () => {
  request.mockResolvedValueOnce(native({ status: 'denied', canAskAgain: false, ios: { status: 1 } }));
  await expect(nativeNotificationPermissions.request()).resolves.toEqual({ kind: 'denied', canAskAgain: false });
  expect(request).toHaveBeenCalledWith({ ios: { allowAlert: true, allowBadge: true, allowSound: true } });
  expect(read).not.toHaveBeenCalled();
});

test('maps general platform statuses and rejects malformed native results without leaking errors', async () => {
  for (const [status, kind] of [['undetermined', 'not_determined'], ['granted', 'granted'], ['denied', 'denied']]) {
    read.mockResolvedValueOnce(native({ status, canAskAgain: true }));
    await expect(nativeNotificationPermissions.read()).resolves.toEqual({ kind, canAskAgain: true });
  }
  for (const value of [null, {}, { status: 'unknown', canAskAgain: true }, { status: 'denied', canAskAgain: 'false' },
    { status: 'granted', canAskAgain: true, ios: { status: 99 } }, { status: 'granted', canAskAgain: true, ios: {} }]) {
    read.mockResolvedValueOnce(native(value));
    await expect(nativeNotificationPermissions.read()).resolves.toEqual(unavailable);
  }
  read.mockRejectedValueOnce(new Error('DUMMY native error'));
  request.mockRejectedValueOnce(new Error('DUMMY native error'));
  await expect(nativeNotificationPermissions.read()).resolves.toEqual(unavailable);
  await expect(nativeNotificationPermissions.request()).resolves.toEqual(unavailable);
});

test('reports Settings launch success or failure without claiming permission changed', async () => {
  settings.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('DUMMY Settings error'));
  await expect(nativeNotificationPermissions.openSettings()).resolves.toBe(true);
  await expect(nativeNotificationPermissions.openSettings()).resolves.toBe(false);
  expect(read).not.toHaveBeenCalled();
  expect(request).not.toHaveBeenCalled();
});
