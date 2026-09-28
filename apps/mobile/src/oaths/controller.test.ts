import { createOathController } from './controller';
import type { SessionController, SessionState } from '../auth/session';
import type { OathClient } from '../api/oaths';
import type { PreviewInput } from '../api/oathSchema';
import type { PendingAcceptance, PendingStorage } from './pendingStorage';
const accountId = '10000000-0000-4000-8000-000000000001';
const previewId = '20000000-0000-4000-8000-000000000001';
const input: PreviewInput = { activity: 'running', activation: { mode: 'now' }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00' } };
const preview = { id: previewId, snapshot: {} };
const characterId = '30000000-0000-4000-8000-00000000000a';
const otherCharacter = '30000000-0000-4000-8000-00000000000b';
const key = (account = accountId, character = characterId) => `${account}.${character}`;
function setup() {
  let state: SessionState = { kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' };
  let token = 'A'.repeat(43);
  const listeners = new Set<() => void>();
  const session = { getState: () => state, getToken: () => state.kind === 'authenticated' ? token : undefined,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, reauthenticate: jest.fn() } as unknown as SessionController;
  const saved = new Map<string, PendingAcceptance | null>();
  const storage: PendingStorage = { read: jest.fn(async (account, character) => ({ kind: 'success' as const, value: saved.get(key(account, character)) ?? null })), write: jest.fn(async (account, character, value) => { saved.set(key(account, character), value); return { kind: 'success' as const }; }) };
  const api = { preview: jest.fn().mockResolvedValue({ kind: 'success', value: { preview, characterId, serverTime: '2026-10-24T00:00:00Z' } }),
    getPreview: jest.fn().mockResolvedValue({ kind: 'success', value: { preview, characterId, oathId: null } }),
    confirm: jest.fn().mockResolvedValue({ kind: 'unavailable', retry: 'request' }), detail: jest.fn(), list: jest.fn(), getPause: jest.fn(), pause: jest.fn() } as unknown as OathClient;
  const onCharacterRequired = jest.fn(); const onCharacterChanged = jest.fn();
  return { session, api, storage, saved, onCharacterRequired, onCharacterChanged, create: () => { const c = createOathController({ session, api, storage, onCharacterRequired, onCharacterChanged }); c.setCharacter({ accountId, characterId }); return c; },
    change(next: SessionState, nextToken = token) { state = next; token = nextToken; listeners.forEach(fn => fn()); } };
}
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
test('persists explicit acceptance before sending and repeats the same identity after restart', async () => {
  const f = setup(); const first = f.create(); first.start(); await flush();
  await first.preview(input);
  expect(f.api.confirm).not.toHaveBeenCalled(); expect(f.storage.write).not.toHaveBeenCalled();
  jest.mocked(f.api.confirm).mockImplementation(async () => { expect(f.saved.get(key())).toEqual({ version: 2, accountId, characterId, previewId, requestId: previewId }); return { kind: 'unavailable', retry: 'request' }; });
  await first.confirm(); first.stop();
  const restarted = f.create(); restarted.start(); await flush(); await restarted.recover();
  expect(f.api.confirm).toHaveBeenCalledTimes(2);
  expect(jest.mocked(f.api.confirm).mock.calls.map(call => call[1])).toEqual(Array(2).fill({ previewId, requestId: previewId, accepted: true }));
});
test('storage failure sends nothing; retry saves first and rapid presses send once', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input);
  jest.mocked(f.storage.write).mockResolvedValueOnce({ kind: 'unavailable' });
  await c.confirm(); expect(f.api.confirm).not.toHaveBeenCalled();
  const network = deferred<Awaited<ReturnType<OathClient['confirm']>>>();
  jest.mocked(f.api.confirm).mockReturnValueOnce(network.promise);
  const first = c.confirm(); await flush(); await c.confirm();
  expect(f.api.confirm).toHaveBeenCalledTimes(1);
  network.resolve({ kind: 'unavailable', retry: 'request' }); await first;
});
test('unknown prior acceptance blocks replacement by another preview', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input); await c.confirm();
  expect(c.resetCreation()).toBe(false);
  await c.preview({ ...input, activity: 'mobility' });
  expect(f.api.preview).toHaveBeenCalledTimes(1);
  await c.confirm();
  expect(jest.mocked(f.api.confirm).mock.calls[1][1]).toEqual({ previewId, requestId: previewId, accepted: true });
});
test('same-account replacement token recovers the durable identity', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input); await c.confirm();
  f.change({ kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }, 'B'.repeat(43));
  await flush(); await c.recover();
  expect(jest.mocked(f.api.confirm).mock.calls[1][0]).toBe('B'.repeat(43));
  expect(jest.mocked(f.api.confirm).mock.calls[1][1].requestId).toBe(previewId);
});
test('late success after logout cannot clear durable acceptance or republish private content', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input);
  const network = deferred<Awaited<ReturnType<OathClient['confirm']>>>(); jest.mocked(f.api.confirm).mockReturnValueOnce(network.promise);
  const saving = c.confirm(); await flush(); f.change({ kind: 'signed_out' });
  network.resolve({ kind: 'success', value: { oath: { id: previewId }, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['confirm']>>); await saving;
  expect(c.getState()).toEqual({ kind: 'idle' }); expect(f.saved.get(key())?.requestId).toBe(previewId);
  expect(f.storage.write).toHaveBeenCalledTimes(1);
});
test('account switch during storage write isolates keys and suppresses the old request', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input);
  const writing = deferred<{ kind: 'success' }>(); jest.mocked(f.storage.write).mockImplementationOnce(async (account, character, value) => { await writing.promise; f.saved.set(key(account, character), value); return { kind: 'success' as const }; });
  const saving = c.confirm(); await flush();
  const otherId = '10000000-0000-4000-8000-000000000002';
  f.change({ kind: 'authenticated', account: { id: otherId, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }, 'B'.repeat(43)); c.setCharacter({ accountId: otherId, characterId });
  writing.resolve({ kind: 'success' }); await saving; await flush();
  expect(f.api.confirm).not.toHaveBeenCalled(); expect(f.saved.get(key(otherId))).toBeUndefined();
  expect(c.getState()).toMatchObject({ kind: 'ready', preview: null, pending: null });
});
test.each(['preview_superseded', 'activation_elapsed', 'deadline_not_after_activation'] as const)('%s requires a fresh explicit preview instead of replaying changed rules', async code => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input);
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'oath_error', code });
  await c.confirm(); expect(c.getState()).toMatchObject({ kind: 'ready', preview: null, pending: null, needsReview: true });
  await c.confirm(); expect(f.api.confirm).toHaveBeenCalledTimes(1); expect(f.saved.get(key())).toBeNull();
});
test('401 delegates expiry to session owner while retaining acceptance for reauthentication', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input);
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'reauthenticate' }); await c.confirm();
  expect(f.session.reauthenticate).toHaveBeenCalledTimes(1); expect(f.saved.get(key())?.previewId).toBe(previewId);
});
test('invalid durable data blocks new acceptance without overwriting it', async () => {
  const f = setup(); jest.mocked(f.storage.read).mockResolvedValueOnce({ kind: 'invalid' });
  const c = f.create(); c.start(); await flush(); await c.preview(input); await c.confirm();
  expect(c.getState()).toEqual({ kind: 'storage_unavailable' }); expect(f.api.preview).not.toHaveBeenCalled(); expect(f.storage.write).not.toHaveBeenCalled();
});
test('successful replay clears pending only after validated server success', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input); await c.confirm();
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'success', value: { oath: { id: previewId }, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['confirm']>>);
  await c.recover(); expect(f.saved.get(key())).toBeNull(); expect(c.getState()).toMatchObject({ kind: 'ready', pending: null, oath: { id: previewId } });
  expect(c.resetCreation()).toBe(true); expect(c.getState()).toMatchObject({ kind: 'ready', preview: null, oath: null, pending: null });
});
test.each(['success', 'reauthenticate'] as const)('late old-account %s cannot affect replacement pending or session', async kind => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input);
  const network = deferred<Awaited<ReturnType<OathClient['confirm']>>>(); jest.mocked(f.api.confirm).mockReturnValueOnce(network.promise);
  const saving = c.confirm(); await flush();
  const otherId = '10000000-0000-4000-8000-000000000002';
  f.change({ kind: 'authenticated', account: { id: otherId, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }, 'B'.repeat(43)); c.setCharacter({ accountId: otherId, characterId }); await flush();
  await c.preview(input); await c.confirm();
  const replacement = f.saved.get(key(otherId));
  network.resolve(kind === 'reauthenticate' ? { kind } : { kind, value: { oath: { id: previewId }, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['confirm']>>); await saving;
  expect(f.saved.get(key(otherId))).toEqual(replacement); expect(f.saved.get(key())?.previewId).toBe(previewId);
  expect(f.session.reauthenticate).not.toHaveBeenCalled();
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: { accountId: otherId }, oath: null });
});
test('late preview and read results become cancelled or invisible after session changes', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const incoming = deferred<Awaited<ReturnType<OathClient['preview']>>>(); jest.mocked(f.api.preview).mockReturnValueOnce(incoming.promise);
  const previewing = c.preview(input); f.change({ kind: 'signed_out' });
  incoming.resolve({ kind: 'success', value: { preview, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['preview']>>); await previewing;
  expect(c.getState()).toEqual({ kind: 'idle' });
  await expect(c.detail(previewId)).resolves.toEqual({ kind: 'cancelled' });
});
test('failed cleanup after server success retains identity for harmless replay', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input); await c.confirm();
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'success', value: { oath: { id: previewId }, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['confirm']>>);
  jest.mocked(f.storage.write).mockResolvedValueOnce({ kind: 'unavailable' }); await c.recover();
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: { requestId: previewId }, error: { kind: 'storage' } });
  expect(f.saved.get(key())?.requestId).toBe(previewId);
  await c.preview({ ...input, activity: 'mobility' }); expect(f.api.preview).toHaveBeenCalledTimes(1);
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'success', value: { oath: { id: previewId }, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['confirm']>>);
  await c.recover();
  expect(jest.mocked(f.api.confirm).mock.calls[2][1]).toEqual({ previewId, requestId: previewId, accepted: true });
  expect(f.saved.get(key())).toBeNull();
});

test('switching character aborts Oath requests, hides the pending acceptance and restores it on return', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush(); await c.preview(input); await c.confirm();
  expect(f.saved.get(key())).toMatchObject({ version: 2, characterId });
  const reading = deferred<Awaited<ReturnType<OathClient['detail']>>>(); jest.mocked(f.api.detail).mockReturnValueOnce(reading.promise);
  const detail = c.detail(previewId); await flush();
  const signal = jest.mocked(f.api.detail).mock.calls[0][2] as AbortSignal;
  c.setCharacter({ accountId, characterId: otherCharacter });
  expect(signal.aborted).toBe(true);
  expect(c.getState()).toEqual({ kind: 'loading' });
  reading.resolve({ kind: 'success', value: { oath: { id: previewId }, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['detail']>>);
  await expect(detail).resolves.toEqual({ kind: 'cancelled' }); await flush();
  expect(f.storage.read).toHaveBeenLastCalledWith(accountId, otherCharacter);
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: null, preview: null, oath: null });
  await c.recover(); expect(f.api.confirm).toHaveBeenCalledTimes(1);
  c.setCharacter({ accountId, characterId }); await flush();
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: { characterId, previewId } });
  await c.recover();
  expect(f.api.confirm).toHaveBeenCalledTimes(2);
  expect(jest.mocked(f.api.confirm).mock.calls[1][1]).toEqual({ previewId, requestId: previewId, accepted: true });
});

test('a stored acceptance whose preview belongs to another character is cleared as a recoverable error and never sent', async () => {
  const f = setup(); f.saved.set(key(), { version: 2, accountId, characterId, previewId, requestId: previewId });
  jest.mocked(f.api.getPreview).mockResolvedValueOnce({ kind: 'success', value: { preview, characterId: otherCharacter, oathId: null } } as Awaited<ReturnType<OathClient['getPreview']>>);
  const c = f.create(); c.start(); await flush(); await c.recover();
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: null, preview: null, error: { kind: 'oath_error', code: 'character_changed' } });
  expect(f.saved.get(key())).toBeNull();
  expect(f.api.confirm).not.toHaveBeenCalled();
  await c.preview(input); expect(c.getState()).toMatchObject({ kind: 'ready', preview: { id: previewId } });
});

test('a preview created for another character is not offered for acceptance', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.preview).mockResolvedValueOnce({ kind: 'success', value: { preview, characterId: otherCharacter, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['preview']>>);
  await c.preview(input);
  expect(c.getState()).toMatchObject({ kind: 'ready', preview: null, error: { kind: 'oath_error', code: 'character_changed' } });
  expect(f.onCharacterChanged).toHaveBeenCalledTimes(1);
  await c.confirm(); expect(f.storage.write).not.toHaveBeenCalled();
});

test('without a character for the signed-in account the controller stays idle', async () => {
  const f = setup(); const c = createOathController({ session: f.session, api: f.api, storage: f.storage }); c.start(); await flush();
  expect(c.getState()).toEqual({ kind: 'idle' }); expect(f.storage.read).not.toHaveBeenCalled();
  c.setCharacter({ accountId: '10000000-0000-4000-8000-000000000002', characterId }); await flush();
  expect(c.getState()).toEqual({ kind: 'idle' });
  c.setCharacter({ accountId, characterId }); await flush();
  expect(c.getState()).toMatchObject({ kind: 'ready' });
  c.setCharacter(null); expect(c.getState()).toEqual({ kind: 'idle' });
});

test('character_required from an Oath call asks the owner to reload characters', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.preview).mockResolvedValueOnce({ kind: 'oath_error', code: 'character_required' });
  await c.preview(input);
  expect(f.onCharacterRequired).toHaveBeenCalledTimes(1);
});

const summary = (character: string) => ({ paused: false, revision: 'a'.repeat(64), withdraw: [], preserve: [], serverTime: '2026-10-24T00:00:00Z', characterId: character });
test('responses naming another character become character_changed and ask the owner to reload characters', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.list).mockResolvedValueOnce({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-10-24T00:00:00Z', paused: false, characterId: otherCharacter } });
  jest.mocked(f.api.detail).mockResolvedValueOnce({ kind: 'success', value: { oath: { id: previewId, characterId: otherCharacter }, serverTime: '2026-10-24T00:00:00Z' } } as Awaited<ReturnType<OathClient['detail']>>);
  jest.mocked(f.api.getPause).mockResolvedValueOnce({ kind: 'success', value: summary(otherCharacter) });
  jest.mocked(f.api.pause).mockResolvedValueOnce({ kind: 'success', value: summary(otherCharacter) }).mockResolvedValueOnce({ kind: 'oath_error', code: 'character_changed' });
  const changed = { kind: 'oath_error', code: 'character_changed' };
  await expect(c.list({ view: 'today' })).resolves.toEqual(changed);
  await expect(c.detail(previewId)).resolves.toEqual(changed);
  await expect(c.getPause()).resolves.toEqual(changed);
  await expect(c.pause({ paused: false })).resolves.toEqual(changed);
  await expect(c.pause({ paused: false })).resolves.toEqual(changed);
  expect(f.onCharacterChanged).toHaveBeenCalledTimes(5);
  jest.mocked(f.api.getPause).mockResolvedValueOnce({ kind: 'success', value: summary(characterId) });
  await expect(c.getPause()).resolves.toEqual({ kind: 'success', value: summary(characterId) });
});

test('pause always sends the bound character, never one from a response', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.pause).mockResolvedValue({ kind: 'success', value: summary(characterId) });
  await c.pause({ paused: true, revision: 'a'.repeat(64) });
  await c.pause({ paused: false });
  expect(jest.mocked(f.api.pause).mock.calls.map(call => call[1])).toEqual([{ characterId, paused: true, revision: 'a'.repeat(64) }, { characterId, paused: false }]);
});
test('successful envelopes set the server clock, stale ones do not', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  expect(c.clock.now()).toBeNull();
  jest.mocked(f.api.list).mockResolvedValueOnce({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2030-01-01T00:00:00Z', paused: false, characterId } });
  await c.list({ view: 'today' });
  expect(Math.abs(c.clock.now()! - Date.parse('2030-01-01T00:00:00Z'))).toBeLessThan(1000);
  const late = deferred<Awaited<ReturnType<OathClient['list']>>>();
  jest.mocked(f.api.list).mockReturnValueOnce(late.promise);
  const pending = c.list({ view: 'today' });
  c.setCharacter({ accountId, characterId: otherCharacter });
  late.resolve({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2040-01-01T00:00:00Z', paused: false, characterId } });
  await pending;
  expect(c.clock.now()! < Date.parse('2031-01-01T00:00:00Z')).toBe(true);
});
