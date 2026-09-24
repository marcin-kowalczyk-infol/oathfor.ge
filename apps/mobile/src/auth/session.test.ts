import { createSessionController } from './session';
import type { SessionEnvelope, SessionStorage } from './sessionStorage';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' as const };
const now = Date.parse('2026-09-24T12:00:00Z');
const session = { token: 'A'.repeat(43), expiresAt: '2026-10-24T12:00:00Z' };
const active: SessionEnvelope = { version: 1, kind: 'active', session };
const signedOut: SessionEnvelope = { version: 1, kind: 'signed_out' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
function setup(initial: SessionEnvelope | null = null) {
  let envelope = initial;
  const storage = {
    read: jest.fn<ReturnType<SessionStorage['read']>, []>(async () => ({ kind: 'success', value: envelope })),
    write: jest.fn<ReturnType<SessionStorage['write']>, [SessionEnvelope]>(async value => { envelope = value; return { kind: 'success' }; }),
  };
  const api = { me: jest.fn().mockResolvedValue({ kind: 'success', value: { account } }), logout: jest.fn().mockResolvedValue({ kind: 'success', value: undefined }) };
  const controller = createSessionController({ storage, api, now: () => now });
  return { controller, storage, api, envelope: () => envelope };
}

afterEach(() => jest.useRealTimers());
beforeEach(() => jest.useFakeTimers());

test('restart checks the server before exposing a stored session', async () => {
  const { controller, api } = setup(active);
  const read = deferred<unknown>(); api.me.mockReturnValue(read.promise);
  const started = controller.start();
  await Promise.resolve(); await Promise.resolve();
  expect(api.me).toHaveBeenCalledWith(session.token, expect.any(AbortSignal));
  expect(controller.getState()).toEqual({ kind: 'validating' });
  read.resolve({ kind: 'success', value: { account } }); await started;
  expect(controller.getState()).toEqual({ kind: 'authenticated', account, expiresAt: session.expiresAt });
});

async function flush() { for (let i = 0; i < 12; i++) await Promise.resolve(); }
const authenticated = async () => ({ kind: 'success' as const, value: { account, session } });

test('login persists only app session before authenticated access', async () => {
  const { controller, storage } = setup(); await controller.start();
  const written = deferred<{ kind: 'success' }>(); storage.write.mockReturnValueOnce(written.promise);
  const login = controller.login(authenticated); await flush();
  expect(storage.write).toHaveBeenCalledWith(active);
  expect(controller.getState().kind).toBe('authenticating');
  expect(controller.getToken()).toBeUndefined();
  written.resolve({ kind: 'success' }); await login;
  expect(controller.getState()).toEqual({ kind: 'authenticated', account, expiresAt: session.expiresAt });
  expect(controller.getToken()).toBe(session.token);
});

test('failed login persistence blocks login until revocation and durable cleanup', async () => {
  const { controller, storage, api } = setup(); await controller.start();
  storage.write.mockResolvedValueOnce({ kind: 'unavailable' });
  await controller.login(authenticated);
  expect(controller.getState().kind).toBe('cleanup_required');
  expect(controller.getToken()).toBeUndefined();
  const anotherLogin = jest.fn(authenticated); await controller.login(anotherLogin);
  expect(anotherLogin).not.toHaveBeenCalled();
  await controller.retry();
  expect(api.logout).toHaveBeenCalledWith(session.token, expect.any(AbortSignal));
  expect(storage.write.mock.calls.map(([value]) => value.kind)).toEqual(['active', 'revocation_pending', 'signed_out']);
  expect(controller.getState().kind).toBe('signed_out');
});

test('offline logout hides access immediately and survives restart solely as pending revocation', async () => {
  const { controller, api, storage, envelope } = setup(active); await controller.start();
  api.logout.mockResolvedValue({ kind: 'unavailable', retry: 'request' });
  const logout = controller.logout();
  expect(controller.getState().kind).toBe('revocation_pending');
  expect(controller.getToken()).toBeUndefined(); await logout;
  expect(envelope()).toEqual({ version: 1, kind: 'revocation_pending', session });
  const anotherLogin = jest.fn(authenticated); await controller.login(anotherLogin);
  expect(anotherLogin).not.toHaveBeenCalled();
  const restarted = createSessionController({ storage, api, now: () => now });
  api.me.mockClear(); await restarted.start();
  expect(api.me).not.toHaveBeenCalled();
  expect(restarted.getState().kind).toBe('revocation_pending');
  api.logout.mockResolvedValue({ kind: 'success', value: undefined });
  await restarted.foreground();
  expect(envelope()).toEqual(signedOut);
  expect(restarted.getState().kind).toBe('signed_out');
});

test('logout serializes behind an unfinished active write and cannot be undone by it', async () => {
  const { controller, storage, api } = setup(); await controller.start();
  const written = deferred<{ kind: 'success' }>(); storage.write.mockReturnValueOnce(written.promise);
  const login = controller.login(authenticated); await flush();
  const logout = controller.logout(); await flush();
  expect(controller.getState().kind).toBe('revocation_pending');
  expect(storage.write).toHaveBeenCalledTimes(1);
  expect(api.logout).not.toHaveBeenCalled();
  written.resolve({ kind: 'success' }); await login; await logout;
  expect(storage.write.mock.calls.map(([value]) => value.kind)).toEqual(['active', 'revocation_pending', 'signed_out']);
  expect(controller.getState().kind).toBe('signed_out');
});

test('logout during the whole native login invalidates its generation and revokes late success', async () => {
  const { controller, api, storage } = setup(); await controller.start();
  const provider = deferred<Awaited<ReturnType<typeof authenticated>>>();
  const authenticate = jest.fn((_signal: AbortSignal) => provider.promise);
  const login = controller.login(authenticate); await flush();
  const logout = controller.logout();
  expect(controller.getState().kind).toBe('revocation_pending');
  expect(authenticate.mock.calls[0][0].aborted).toBe(true);
  const anotherLogin = jest.fn(authenticated); await controller.login(anotherLogin);
  expect(anotherLogin).not.toHaveBeenCalled();
  provider.resolve(await authenticated()); await login; await logout;
  expect(api.logout).toHaveBeenCalledWith(session.token, expect.any(AbortSignal));
  expect(storage.write.mock.calls.map(([value]) => value.kind)).toEqual(['revocation_pending', 'signed_out']);
  expect(controller.getState().kind).toBe('signed_out');
});

test('failed pending write prevents HTTP revocation and reports incomplete local cleanup', async () => {
  const { controller, storage, api } = setup(active); await controller.start();
  storage.write.mockResolvedValueOnce({ kind: 'unavailable' });
  await controller.logout();
  expect(controller.getState()).toMatchObject({ kind: 'cleanup_required', serverRevoked: false });
  expect(api.logout).not.toHaveBeenCalled();
  await controller.retry();
  expect(controller.getState().kind).toBe('signed_out');
});

test('204 plus failed tombstone write stays cleanup-blocked until durable retry', async () => {
  const { controller, storage, api, envelope } = setup(active); await controller.start();
  storage.write.mockImplementationOnce(async value => ({ kind: 'success' }));
  storage.write.mockResolvedValueOnce({ kind: 'unavailable' });
  await controller.logout();
  expect(controller.getState()).toMatchObject({ kind: 'cleanup_required', serverRevoked: true });
  expect(controller.getToken()).toBeUndefined();
  await controller.retry();
  expect(api.logout).toHaveBeenCalledTimes(1);
  expect(envelope()).toEqual(signedOut);
});

test('unavailable restart offers validation retry and logout without trusting local credentials', async () => {
  const { controller, api } = setup(active);
  api.me.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  await controller.start();
  expect(controller.getState().kind).toBe('verification_unavailable');
  expect(controller.getToken()).toBeUndefined();
  await controller.retry();
  expect(controller.getState().kind).toBe('authenticated');
  api.me.mockResolvedValue({ kind: 'unavailable', retry: 'request' });
  await controller.foreground();
  expect(controller.getState().kind).toBe('verification_unavailable');
  await controller.logout();
  expect(controller.getState().kind).toBe('signed_out');
});

test('401 at restart requires durable clearing and never authenticates', async () => {
  const { controller, api, storage } = setup(active);
  api.me.mockResolvedValue({ kind: 'reauthenticate' });
  storage.write.mockResolvedValueOnce({ kind: 'unavailable' });
  await controller.start();
  expect(controller.getState().kind).toBe('cleanup_required');
  await controller.retry();
  expect(controller.getState().kind).toBe('signed_out');
  expect(api.logout).not.toHaveBeenCalled();
});

test('read errors block login and retry reads; corrupt storage requires durable cleanup', async () => {
  const { controller, storage } = setup(active);
  storage.read.mockResolvedValueOnce({ kind: 'unavailable' });
  await controller.start(); expect(controller.getState().kind).toBe('cleanup_required');
  const authenticate = jest.fn(authenticated); await controller.login(authenticate);
  expect(authenticate).not.toHaveBeenCalled();
  await controller.retry(); expect(controller.getState().kind).toBe('authenticated');
  const corrupt = setup(); corrupt.storage.read.mockResolvedValueOnce({ kind: 'invalid' });
  corrupt.storage.write.mockResolvedValueOnce({ kind: 'unavailable' });
  await corrupt.controller.start(); expect(corrupt.controller.getState().kind).toBe('cleanup_required');
  await corrupt.controller.retry(); expect(corrupt.envelope()).toEqual(signedOut);
});

test('logout while storage is being read retains the discovered token solely for revocation', async () => {
  const { controller, storage, api } = setup();
  const read = deferred<Awaited<ReturnType<SessionStorage['read']>>>(); storage.read.mockReturnValueOnce(read.promise);
  const start = controller.start(); const logout = controller.logout();
  read.resolve({ kind: 'success', value: active }); await start; await logout;
  expect(api.me).not.toHaveBeenCalled();
  expect(api.logout).toHaveBeenCalledWith(session.token, expect.any(AbortSignal));
  expect(controller.getState().kind).toBe('signed_out');
});

test('late identity response after native revocation cannot restore access', async () => {
  const { controller, api } = setup(active);
  const identity = deferred<unknown>(); api.me.mockReturnValue(identity.promise);
  const start = controller.start(); await flush();
  await controller.nativeRevoked();
  identity.resolve({ kind: 'success', value: { account } }); await start;
  expect(controller.getState().kind).toBe('signed_out');
});

test('duplicate foreground revocation retries share one operation; late acknowledgement cannot replace new login', async () => {
  const { controller, api } = setup(active); await controller.start();
  const revoked = deferred<unknown>(); api.logout.mockReturnValueOnce(revoked.promise);
  const logout = controller.logout(); await flush();
  const foreground = controller.foreground();
  expect(api.logout).toHaveBeenCalledTimes(1);
  const newLogin = jest.fn(authenticated); await controller.login(newLogin); expect(newLogin).not.toHaveBeenCalled();
  revoked.resolve({ kind: 'success', value: undefined }); await logout; await foreground;
  await controller.login(authenticated);
  expect(controller.getState().kind).toBe('authenticated');
  expect(api.logout).toHaveBeenCalledTimes(1);
});

test('fixed expiry removes access at the exact second with bounded timers and foreground checks', async () => {
  let clock = now;
  const { storage, api } = setup(active);
  const timer = jest.spyOn(globalThis, 'setTimeout');
  const controller = createSessionController({ storage, api, now: () => clock }); await controller.start();
  expect(timer.mock.calls.every(([, delay]) => typeof delay === 'number' && delay > 0 && delay <= 2147483647)).toBe(true);
  clock = Date.parse(session.expiresAt);
  expect(controller.getToken()).toBeUndefined();
  await controller.foreground();
  expect(controller.getState().kind).toBe('signed_out');
  expect(api.me).toHaveBeenCalledTimes(1);
  const expired = createSessionController({ storage: { ...storage, read: async () => ({ kind: 'success', value: active }) }, api, now: () => clock });
  await expired.start(); expect(expired.getState().kind).toBe('signed_out');
  expect(api.me).toHaveBeenCalledTimes(1);
  timer.mockRestore();
});

test('session listeners observe access changes and disposal invalidates delayed login', async () => {
  const { controller, storage } = setup(); await controller.start();
  const listener = jest.fn(); const unsubscribe = controller.subscribe(listener);
  const provider = deferred<Awaited<ReturnType<typeof authenticated>>>();
  const login = controller.login(() => provider.promise);
  expect(listener).toHaveBeenCalled();
  unsubscribe(); listener.mockClear(); controller.dispose();
  provider.resolve(await authenticated()); await login;
  expect(controller.getState().kind).not.toBe('authenticated');
  expect(storage.write).not.toHaveBeenCalled(); expect(listener).not.toHaveBeenCalled();
});

test('retrying a failed read during logout preserves sign-out intent instead of reauthenticating', async () => {
  const { controller, storage, api } = setup(active);
  const read = deferred<Awaited<ReturnType<SessionStorage['read']>>>(); storage.read.mockReturnValueOnce(read.promise);
  const start = controller.start(); const logout = controller.logout();
  read.resolve({ kind: 'unavailable' }); await start; await logout;
  expect(controller.getState().kind).toBe('cleanup_required');
  await controller.retry();
  expect(api.me).not.toHaveBeenCalled();
  expect(api.logout).toHaveBeenCalledWith(session.token, expect.any(AbortSignal));
  expect(controller.getState().kind).toBe('signed_out');
});

test('native revocation after a failed read also preserves logout intent through retry', async () => {
  const { controller, storage, api } = setup(active);
  storage.read.mockResolvedValueOnce({ kind: 'unavailable' });
  await controller.start(); await controller.nativeRevoked(); await controller.retry();
  expect(api.me).not.toHaveBeenCalled();
  expect(api.logout).toHaveBeenCalledWith(session.token, expect.any(AbortSignal));
  expect(controller.getState().kind).toBe('signed_out');
});

test('the expiry timer leaves a reauthentication reason after durable clearing', async () => {
  let clock = Date.parse(session.expiresAt) - 1000;
  const { storage, api } = setup(active);
  const controller = createSessionController({ storage, api, now: () => clock });
  await controller.start(); clock += 1000;
  await jest.advanceTimersByTimeAsync(1000);
  expect(controller.getState()).toEqual({ kind: 'signed_out', error: { kind: 'reauthenticate' } });
});
