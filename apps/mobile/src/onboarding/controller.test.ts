import { createOnboardingController } from './controller';
import { createSessionController } from '../auth/session';
import type { ProfileEnvelope } from '../api/profile';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' as const };
const session = { token: 'A'.repeat(43), expiresAt: '2026-10-24T12:00:00Z' };
const empty: ProfileEnvelope = {
  profile: { locale: null, timezone: null, intention: null, companionIntroduced: false, notificationPreference: null },
  onboardingStatus: 'pending',
};
const saved: ProfileEnvelope = {
  profile: { ...empty.profile, locale: 'pl', timezone: 'Europe/Warsaw', intention: 'regular_activity' },
  onboardingStatus: 'pending',
};
const success = (value: ProfileEnvelope) => ({ kind: 'success' as const, value });
const disposals: (() => void)[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

async function flush() {
  for (let i = 0; i < 30; i++) await Promise.resolve();
}

async function setup(value: ProfileEnvelope = empty) {
  const authApi = {
    me: jest.fn().mockResolvedValue({ kind: 'success', value: { account: { ...account, onboardingStatus: value.onboardingStatus } } }),
    logout: jest.fn().mockResolvedValue({ kind: 'success', value: undefined }),
  };
  const auth = createSessionController({
    api: authApi,
    storage: {
      read: async () => ({ kind: 'success', value: { version: 1, kind: 'active', session } }),
      write: async () => ({ kind: 'success' }),
    },
    now: () => Date.parse('2026-09-25T00:00:00Z'),
  });
  const api = {
    get: jest.fn().mockResolvedValue(success(value)),
    patch: jest.fn().mockResolvedValue(success(saved)),
    complete: jest.fn(),
  };
  const locale = jest.fn().mockResolvedValue(undefined);
  const controller = createOnboardingController({
    api, session: auth, applyLocale: locale,
    defaultLocale: () => 'en',
    suggestedTimezone: () => 'Europe/Warsaw',
  });
  disposals.push(() => { controller.dispose(); auth.dispose(); });
  await auth.start();
  return { auth, authApi, api, locale, controller };
}

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  disposals.splice(0).forEach(dispose => dispose());
  jest.useRealTimers();
});

test.each(['pending', 'complete'] as const)('hydrates %s account and applies saved locale before routing', async onboardingStatus => {
  const value = { ...saved, onboardingStatus };
  const { controller, api, locale } = await setup(value);
  const language = deferred<void>();
  locale.mockReturnValueOnce(language.promise);

  controller.start();
  await flush();
  expect(api.get).toHaveBeenCalledWith(session.token, expect.any(AbortSignal));
  expect(locale).toHaveBeenCalledWith('pl');
  expect(controller.getState().kind).toBe('loading');

  language.resolve();
  await flush();
  expect(controller.getState()).toMatchObject({ kind: 'ready', value, draft: { locale: 'pl', timezone: 'Europe/Warsaw', intention: true } });
});

test('suggestions stay unconfirmed and invalid basics never save', async () => {
  const { controller, api } = await setup();
  controller.start();
  await flush();
  expect(controller.getState()).toMatchObject({ kind: 'ready', value: empty, draft: { locale: 'en', timezone: 'Europe/Warsaw', intention: false } });
  expect(api.patch).not.toHaveBeenCalled();
  expect(await controller.saveBasics()).toBe(false);
  expect(controller.getState()).toMatchObject({ error: 'intention' });

  controller.setDraft({ intention: true, timezone: 'Mars/Base' });
  expect(await controller.saveBasics()).toBe(false);
  expect(api.patch).not.toHaveBeenCalled();
  expect(controller.getState()).toMatchObject({ error: 'timezone' });
});

test('explicit choices save only changed fields and confirmed progress survives a fresh owner', async () => {
  const value = { ...empty, profile: { ...empty.profile, locale: 'pl' as const } };
  const { controller, api } = await setup(value);
  controller.start();
  await flush();
  controller.setDraft({ timezone: 'Europe/Warsaw', intention: true });
  expect(await controller.saveBasics()).toBe(true);
  expect(api.patch).toHaveBeenCalledWith(session.token, { timezone: 'Europe/Warsaw', intention: 'regular_activity' }, expect.any(AbortSignal));
  expect(controller.getState()).toMatchObject({ value: saved });

  const restored = await setup(saved);
  restored.controller.start();
  await flush();
  expect(restored.controller.getState()).toMatchObject({ value: saved, draft: { locale: 'pl', timezone: 'Europe/Warsaw', intention: true } });
});

test('ambiguous save refetches, retains unsaved draft on mismatch, then allows explicit retry', async () => {
  const { controller, api } = await setup();
  controller.start();
  await flush();
  controller.setDraft({ locale: 'pl', intention: true });
  api.patch.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });

  expect(await controller.saveBasics()).toBe(false);
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(controller.getState()).toMatchObject({ kind: 'ready', value: empty, draft: { locale: 'pl', intention: true }, error: 'save' });
  expect(await controller.saveBasics()).toBe(true);
  expect(api.patch).toHaveBeenCalledTimes(2);
});

test('a lost successful response is reconciled without replaying PATCH', async () => {
  const { controller, api } = await setup();
  controller.start();
  await flush();
  controller.setDraft({ locale: 'pl', intention: true });
  api.patch.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  api.get.mockResolvedValueOnce(success(saved));

  expect(await controller.saveBasics()).toBe(true);
  expect(controller.getState()).toMatchObject({ value: saved });
  expect(api.patch).toHaveBeenCalledTimes(1);
});

test('failed reconciliation must GET again before a manual retry can write', async () => {
  const { controller, api } = await setup();
  controller.start();
  await flush();
  controller.setDraft({ locale: 'pl', intention: true });
  api.patch.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  api.get.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  expect(await controller.saveBasics()).toBe(false);

  api.get.mockResolvedValueOnce(success(saved));
  expect(await controller.saveBasics()).toBe(true);
  expect(api.patch).toHaveBeenCalledTimes(1);
});

test('partial writes are serialized and preserve fields from each authoritative result', async () => {
  const { controller, api } = await setup();
  controller.start();
  await flush();
  const first = deferred<ReturnType<typeof success>>();
  api.patch.mockReturnValueOnce(first.promise);

  const one = controller.save({ locale: 'pl' });
  const two = controller.save({ timezone: 'Europe/Warsaw' });
  await flush();
  expect(api.patch).toHaveBeenCalledTimes(1);

  first.resolve(success({ ...empty, profile: { ...empty.profile, locale: 'pl' } }));
  await one;
  await two;
  expect(api.patch.mock.calls.map(([, patch]) => patch)).toEqual([{ locale: 'pl' }, { timezone: 'Europe/Warsaw' }]);
});

test('logout clears profile and draft, ignores late read, and restores resolved language', async () => {
  const { controller, api, auth, locale } = await setup(saved);
  const read = deferred<ReturnType<typeof success>>();
  api.get.mockReturnValueOnce(read.promise);

  controller.start();
  await flush();
  await auth.logout();
  read.resolve(success(saved));
  await flush();
  expect(controller.getState().kind).toBe('idle');
  expect(locale).toHaveBeenLastCalledWith('en');
});

test('logout serializes language reset behind an already running account locale change', async () => {
  const { controller, auth, locale } = await setup(saved);
  const language = deferred<void>();
  locale.mockReturnValueOnce(language.promise);

  controller.start();
  await flush();
  await auth.logout();
  language.resolve();
  await flush();
  expect(controller.getState().kind).toBe('idle');
  expect(locale).toHaveBeenLastCalledWith('en');
});

test('logout during PATCH ignores its late profile and cannot overwrite a new account', async () => {
  const { controller, api, auth } = await setup();
  controller.start();
  await flush();
  controller.setDraft({ locale: 'pl', intention: true });
  const write = deferred<ReturnType<typeof success>>();
  api.patch.mockReturnValueOnce(write.promise);

  const saving = controller.saveBasics();
  await flush();
  await auth.logout();
  const nextSession = { ...session, token: 'B'.repeat(43) };
  await auth.login(async () => ({ kind: 'success', value: { account: { ...account, id: '01997aed-8950-7f7a-bda4-36b64697b563' }, session: nextSession } }));
  await flush();
  write.resolve(success(saved));
  await saving;
  await flush();
  expect(controller.getState()).toMatchObject({ value: empty, draft: { locale: 'en', intention: false } });
  expect(api.get).toHaveBeenLastCalledWith(nextSession.token, expect.any(AbortSignal));
});

test('profile401 returns to durable session recovery and prevents further requests', async () => {
  const { controller, api, auth } = await setup();
  api.get.mockResolvedValueOnce({ kind: 'reauthenticate' });
  controller.start();
  await flush();
  expect(auth.getState()).toEqual({ kind: 'signed_out', error: { kind: 'reauthenticate' } });
  expect(controller.getState().kind).toBe('idle');
});

test('foreground session validation reloads authoritative profile without resetting same-account locale', async () => {
  const { controller, api, auth, locale } = await setup(saved);
  controller.start();
  await flush();
  locale.mockClear();
  api.get.mockResolvedValueOnce(success({ ...saved, profile: { ...saved.profile, timezone: 'Europe/London' } }));

  await auth.foreground();
  await flush();
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(controller.getState()).toMatchObject({ value: { profile: { timezone: 'Europe/London' } } });
  expect(locale).not.toHaveBeenCalledWith('en');
});

test('interrupted foreground PATCH is reconciled after settling before another write', async () => {
  const { controller, api, auth } = await setup();
  controller.start();
  await flush();
  controller.setDraft({ locale: 'pl', intention: true });
  const write = deferred<ReturnType<typeof success>>();
  api.patch.mockReturnValueOnce(write.promise);

  const saving = controller.saveBasics();
  await flush();
  await auth.foreground();
  await flush();
  write.resolve(success(saved));
  await saving;
  api.get.mockResolvedValueOnce(success(saved));
  expect(await controller.saveBasics()).toBe(true);
  expect(api.patch).toHaveBeenCalledTimes(1);
});


const reviewed: ProfileEnvelope = { ...saved, profile: { ...saved.profile, companionIntroduced: true, notificationPreference: 'enabled' } };
const completed: ProfileEnvelope = { ...reviewed, onboardingStatus: 'complete' };
test('explicit completion accepts only authoritative complete and repeated actions are harmless', async () => {
  const { controller, api } = await setup(reviewed); controller.start(); await flush();
  api.complete.mockResolvedValue(success(completed));
  expect(api.complete).not.toHaveBeenCalled();
  expect(await controller.complete()).toBe(true);
  expect(controller.getState()).toMatchObject({ value: completed, busy: false });
  expect(await controller.complete()).toBe(true);
  expect(api.complete).toHaveBeenCalledTimes(1);
  expect(api.complete).toHaveBeenCalledWith(session.token, expect.any(AbortSignal));
});
test('completion rejection reloads missing steps and never claims completed', async () => {
  const { controller, api } = await setup(reviewed); controller.start(); await flush();
  api.complete.mockResolvedValue({ kind: 'onboarding_incomplete' });
  api.get.mockResolvedValueOnce(success(saved));
  expect(await controller.complete()).toBe(false);
  expect(api.get).toHaveBeenCalledTimes(2);
  expect(controller.getState()).toMatchObject({ value: saved, busy: false });
});
test('ambiguous completion reconciles its committed result without replay', async () => {
  const { controller, api } = await setup(reviewed); controller.start(); await flush();
  api.complete.mockResolvedValue({ kind: 'unavailable', retry: 'request' });
  api.get.mockResolvedValueOnce(success(completed));
  expect(await controller.complete()).toBe(true);
  expect(controller.getState()).toMatchObject({ value: completed });
  expect(api.complete).toHaveBeenCalledTimes(1);
});
test('failed reconciliation reads before retry and an uncommitted completion stays on review', async () => {
  const { controller, api } = await setup(reviewed); controller.start(); await flush();
  api.complete.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  api.get.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  expect(await controller.complete()).toBe(false);
  expect(controller.getState()).toMatchObject({ value: reviewed, error: 'load', busy: false });
  api.get.mockResolvedValueOnce(success(reviewed));
  api.complete.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  expect(await controller.complete()).toBe(false);
  expect(controller.getState()).toMatchObject({ value: reviewed, error: 'complete', busy: false });
  api.complete.mockResolvedValueOnce(success(completed));
  expect(await controller.complete()).toBe(true);
});
test('completion serializes behind a pending profile write and ignores a late result after logout', async () => {
  const { controller, api, auth } = await setup(reviewed); controller.start(); await flush();
  const patch = deferred<ReturnType<typeof success>>(); api.patch.mockReturnValueOnce(patch.promise);
  const completion = deferred<ReturnType<typeof success>>(); api.complete.mockReturnValueOnce(completion.promise);
  const saving = controller.save({ notificationPreference: 'enabled' });
  const finishing = controller.complete(); await flush();
  expect(api.complete).not.toHaveBeenCalled();
  patch.resolve(success(reviewed)); await saving; await flush();
  expect(api.complete).toHaveBeenCalledTimes(1);
  await auth.logout(); completion.resolve(success(completed));
  expect(await finishing).toBe(false); expect(controller.getState().kind).toBe('idle');
});

test('interrupted completion reconciles after foreground validation before replay', async () => {
  const { controller, api, auth } = await setup(reviewed); controller.start(); await flush();
  const write = deferred<ReturnType<typeof success>>(); api.complete.mockReturnValueOnce(write.promise);
  const finishing = controller.complete(); await flush();
  await auth.foreground(); await flush();
  write.resolve(success(completed)); expect(await finishing).toBe(false);
  api.get.mockResolvedValueOnce(success(completed));
  expect(await controller.complete()).toBe(true);
  expect(api.complete).toHaveBeenCalledTimes(1);
});
