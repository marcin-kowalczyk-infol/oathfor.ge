import { createNotificationController } from './notifications';
import { createOnboardingController } from './controller';
import { createSessionController } from '../auth/session';
import type { ProfileEnvelope } from '../api/profile';
import type { DevicePermission } from './notificationPermissions';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' as const };
const session = { token: 'A'.repeat(43), expiresAt: '2026-10-24T12:00:00Z' };
const basics: ProfileEnvelope = { profile: { locale: 'en', timezone: 'UTC', intention: 'regular_activity', companionIntroduced: true, notificationPreference: null }, onboardingStatus: 'pending' };
const pending: DevicePermission = { kind: 'not_determined', canAskAgain: true };
const denied: DevicePermission = { kind: 'denied', canAskAgain: false };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
async function flush() { for (let index = 0; index < 30; index++) await Promise.resolve(); }
const disposals: (() => void)[] = [];
async function setup(preference: 'enabled' | 'disabled' | null = null) {
  let stored: ProfileEnvelope = { ...basics, profile: { ...basics.profile, notificationPreference: preference } };
  const auth = createSessionController({ now: () => Date.parse('2026-09-25T00:00:00Z'), api: { me: async () => ({ kind: 'success', value: { account } }), logout: async () => ({ kind: 'success', value: undefined }) }, storage: { read: async () => ({ kind: 'success', value: { version: 1, kind: 'active', session } }), write: async () => ({ kind: 'success' }) } });
  const api = {
    get: jest.fn().mockImplementation(async () => ({ kind: 'success', value: stored })),
    patch: jest.fn().mockImplementation(async (_token, patch) => { stored = { ...stored, profile: { ...stored.profile, ...patch } }; return { kind: 'success', value: stored }; }),
    complete: jest.fn(),
  };
  const onboarding = createOnboardingController({ session: auth, api, applyLocale: async () => {}, defaultLocale: () => 'en', suggestedTimezone: () => 'UTC' });
  const permissions = { read: jest.fn<Promise<DevicePermission>, []>().mockResolvedValue(pending), request: jest.fn<Promise<DevicePermission>, []>().mockResolvedValue(denied), openSettings: jest.fn<Promise<boolean>, []>().mockResolvedValue(true) };
  const notifications = createNotificationController({ session: auth, onboarding, permissions });
  disposals.push(() => { notifications.stop(); onboarding.dispose(); auth.dispose(); });
  await auth.start(); onboarding.start(); notifications.start(); await flush();
  return { auth, api, onboarding, permissions, notifications, stored: () => stored };
}
beforeEach(() => jest.useFakeTimers());
afterEach(() => { disposals.splice(0).forEach(dispose => dispose()); jest.useRealTimers(); });

test('explicit enable saves first and denial still permits continuation with enabled preference', async () => {
  const { notifications, permissions, api, stored } = await setup();
  const write = deferred<{ kind: 'success'; value: ProfileEnvelope }>();
  api.patch.mockReturnValueOnce(write.promise);
  const enable = notifications.enable(); await flush();
  expect(api.patch).toHaveBeenCalledWith(session.token, { notificationPreference: 'enabled' }, expect.any(AbortSignal));
  expect(permissions.request).not.toHaveBeenCalled();
  const saved: ProfileEnvelope = { ...stored(), profile: { ...stored().profile, notificationPreference: 'enabled' } };
  write.resolve({ kind: 'success', value: saved }); await enable;
  expect(permissions.request).toHaveBeenCalledTimes(1);
  expect(notifications.getState()).toMatchObject({ permission: denied, busy: false });
  expect(notifications.getState().busy).toBe(false);
});

test('restart reads saved preference without prompting; foreground refreshes device permission', async () => {
  const { notifications, permissions } = await setup('enabled');
  expect(permissions.read).toHaveBeenCalledTimes(1);
  expect(permissions.request).not.toHaveBeenCalled();
  permissions.read.mockResolvedValue(denied);
  await notifications.refresh();
  expect(notifications.getState().permission).toEqual(denied);
  expect(notifications.getState().busy).toBe(false);
});
test('skip durably saves disabled without requesting permission', async () => {
  const { notifications, permissions, stored } = await setup();
  await notifications.skip();
  expect(stored().profile.notificationPreference).toBe('disabled');
  expect(permissions.request).not.toHaveBeenCalled();
  expect(notifications.getState().busy).toBe(false);
});
test('failed preference save never prompts and leaves retry or skip usable', async () => {
  const { notifications, permissions, api } = await setup();
  api.patch.mockResolvedValueOnce({ kind: 'unavailable' });
  await notifications.enable();
  expect(notifications.getState()).toMatchObject({ busy: false, error: 'save' });
  expect(permissions.request).not.toHaveBeenCalled();
  expect(notifications.getState().error).toBe('save');
  await notifications.skip(); expect(notifications.getState().busy).toBe(false);
});
test('late permission result after logout is ignored', async () => {
  const { notifications, permissions, auth } = await setup();
  const request = deferred<DevicePermission>(); permissions.request.mockReturnValueOnce(request.promise);
  const action = notifications.enable(); await flush();
  await auth.logout();
  request.resolve(denied); await action;
  expect(notifications.getState()).toMatchObject({ busy: false, permission: { kind: 'checking' } });
});
test('same-account foreground validation during OS prompt recovers without another prompt', async () => {
  const { notifications, permissions, auth } = await setup();
  const request = deferred<DevicePermission>(); permissions.request.mockReturnValueOnce(request.promise);
  const action = notifications.enable(); await flush();
  permissions.read.mockResolvedValue(denied);
  const foreground = auth.foreground(); await notifications.refresh();
  request.resolve(denied); await action; await foreground; await flush();
  expect(notifications.getState()).toMatchObject({ busy: false, permission: denied });
  expect(permissions.request).toHaveBeenCalledTimes(1);
  expect(permissions.read.mock.calls.length).toBeGreaterThan(1);
  expect(notifications.getState().busy).toBe(false);
});
test('nonaskable denial uses Settings, whose failure leaves continuation usable', async () => {
  const { notifications, permissions } = await setup('enabled');
  permissions.read.mockResolvedValue(denied); await notifications.refresh();
  await notifications.retryPermission(); expect(permissions.request).not.toHaveBeenCalled();
  permissions.openSettings.mockResolvedValue(false); await notifications.settings();
  expect(notifications.getState()).toMatchObject({ error: 'settings', busy: false });
  expect(notifications.getState().busy).toBe(false);
});
