import { createCharacterController, type CharacterControllerState } from './controller';
import type { SessionController, SessionState } from '../auth/session';
import type { CharacterClient, CharacterList, Character } from '../api/characters';
import type { CreationStorage, PendingCreation } from './creationStorage';
const accountId = '10000000-0000-4000-8000-00000000000a';
const otherAccount = '10000000-0000-4000-8000-00000000000b';
const requestId = '40000000-0000-4000-8000-00000000000a';
const secondRequest = '40000000-0000-4000-8000-00000000000b';
const serverTime = '2026-09-26T12:00:00Z';
const mira: Character = { id: '30000000-0000-4000-8000-00000000000a', name: 'Mira', presetId: 'starter_01', build: 'heavy', form: 'feminine', createdAt: serverTime };
const bor: Character = { id: '30000000-0000-4000-8000-00000000000b', name: 'Bor', presetId: 'starter_04', build: 'thin', form: 'masculine', createdAt: serverTime };
const presets = ['starter_01', 'starter_02', 'starter_03', 'starter_04', 'starter_05', 'starter_06'];
const listing = (characters: Character[], activeCharacterId: string | null): CharacterList => ({ characters, activeCharacterId, limit: 3, presets, serverTime });
const draft = { name: '  Mira ', presetId: 'starter_01', build: 'heavy' as const, form: 'feminine' as const };
const record: PendingCreation = { version: 2, accountId, requestId, name: 'Mira', presetId: 'starter_01', build: 'heavy', form: 'feminine' };
const sent = { requestId, name: 'Mira', presetId: 'starter_01', build: 'heavy', form: 'feminine' };
const created = (created = true, active = mira.id) => ({ kind: 'success' as const, created, value: { character: mira, activeCharacterId: active, serverTime } });
const unavailable = { kind: 'unavailable' as const, retry: 'request' as const };
function setup(initial: CharacterList = listing([], null)) {
  let state: SessionState = { kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' };
  let token = 'A'.repeat(43);
  const listeners = new Set<() => void>();
  const session = { getState: () => state, getToken: () => state.kind === 'authenticated' ? token : undefined,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, reauthenticate: jest.fn() } as unknown as SessionController;
  const saved = new Map<string, PendingCreation | null>();
  const storage: CreationStorage = { read: jest.fn(async id => ({ kind: 'success' as const, value: saved.get(id) ?? null })), write: jest.fn(async (id, value) => { saved.set(id, value); return { kind: 'success' as const }; }) };
  const api = { list: jest.fn().mockResolvedValue({ kind: 'success', value: initial }), create: jest.fn().mockResolvedValue(unavailable), activate: jest.fn() } as unknown as CharacterClient;
  const createRequestId = jest.fn().mockReturnValueOnce(requestId).mockReturnValueOnce(secondRequest);
  return { session, api, storage, saved, createRequestId, create: () => createCharacterController({ session, api, storage, createRequestId }),
    change(next: SessionState, nextToken = token) { state = next; token = nextToken; listeners.forEach(fn => fn()); } };
}
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const ready = (state: CharacterControllerState) => { if (state.kind !== 'ready') throw new Error(`not ready: ${state.kind}`); return state; };

test('loads the account characters when started', async () => {
  const f = setup(listing([mira], mira.id)); const c = f.create(); c.start();
  expect(c.getState()).toEqual({ kind: 'loading' }); await flush();
  expect(c.getState()).toEqual({ kind: 'ready', characters: [mira], activeCharacterId: mira.id, presets, limit: 3, busy: false, pendingCreation: null, activeRevision: 1 });
  expect(f.storage.read).toHaveBeenCalledWith(accountId);
});

test('stores the creation identity before sending and shows the new active character after 201', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.create).mockImplementationOnce(async () => {
    expect(f.saved.get(accountId)).toEqual(record);
    expect(ready(c.getState())).toMatchObject({ busy: true, pendingCreation: record });
    return created();
  });
  await c.create(draft);
  expect(jest.mocked(f.api.create).mock.calls[0].slice(0, 2)).toEqual(['A'.repeat(43), sent]);
  expect(f.saved.get(accountId)).toBeNull();
  expect(ready(c.getState())).toMatchObject({ characters: [mira], activeCharacterId: mira.id, busy: false, pendingCreation: null, activeRevision: 2 });
  expect(ready(c.getState()).error).toBeUndefined();
});

test('a failed storage write sends nothing and reports storage', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.storage.write).mockResolvedValueOnce({ kind: 'unavailable' });
  await c.create(draft);
  expect(f.api.create).not.toHaveBeenCalled();
  expect(ready(c.getState())).toMatchObject({ busy: false, pendingCreation: null, characters: [], error: { kind: 'storage' } });
});

test('invalid drafts and a missing request ID generator send and store nothing', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  for (const invalid of [{ ...draft, name: 'R2D2' }, { ...draft, presetId: 'Starter' }, { ...draft, build: 'broad' }, { ...draft, build: undefined }, { ...draft, form: 'other' }]) {
    await c.create(invalid as typeof draft);
    expect(ready(c.getState()).error).toEqual({ kind: 'invalid_request' });
  }
  f.createRequestId.mockReset().mockReturnValueOnce(undefined);
  await c.create(draft);
  expect(ready(c.getState()).error).toEqual({ kind: 'configuration' });
  expect(f.storage.write).not.toHaveBeenCalled(); expect(f.api.create).not.toHaveBeenCalled();
});

test('a lost reply keeps the record and retry replays the identical request', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.create(draft);
  expect(f.saved.get(accountId)).toEqual(record);
  expect(ready(c.getState())).toMatchObject({ busy: false, pendingCreation: record, characters: [], activeCharacterId: null, error: unavailable });
  await c.create({ ...draft, name: 'Other' });
  expect(f.api.create).toHaveBeenCalledTimes(1);
  jest.mocked(f.api.create).mockResolvedValueOnce(created(false));
  await c.retryCreation();
  expect(jest.mocked(f.api.create).mock.calls.map(call => call[1])).toEqual([sent, sent]);
  expect(f.createRequestId).toHaveBeenCalledTimes(1);
  expect(f.saved.get(accountId)).toBeNull();
  expect(ready(c.getState())).toMatchObject({ characters: [mira], activeCharacterId: mira.id, pendingCreation: null });
});

test('a stored creation is replayed once after restart and publishes the decisive result', async () => {
  const f = setup(); f.saved.set(accountId, record);
  jest.mocked(f.api.create).mockResolvedValueOnce(created(false));
  const c = f.create(); c.start(); await flush();
  expect(f.api.create).toHaveBeenCalledTimes(1);
  expect(jest.mocked(f.api.create).mock.calls[0][1]).toEqual(sent);
  expect(ready(c.getState())).toMatchObject({ characters: [mira], activeCharacterId: mira.id, pendingCreation: null, busy: false });
  const again = setup(); again.saved.set(accountId, record);
  const d = again.create(); d.start(); await flush();
  expect(again.api.create).toHaveBeenCalledTimes(1);
  expect(ready(d.getState())).toMatchObject({ pendingCreation: record, error: unavailable, busy: false });
});

test.each([
  { kind: 'character_error', code: 'invalid_character_name' },
  { kind: 'character_error', code: 'invalid_preset' },
  { kind: 'character_error', code: 'character_limit_reached' },
  { kind: 'character_error', code: 'idempotency_conflict' },
  { kind: 'character_error', code: 'onboarding_incomplete' },
  { kind: 'character_error', code: 'invalid_request' },
] as const)('decisive %o clears the record without inventing a character', async failure => {
  const f = setup(listing([bor], bor.id)); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.create).mockResolvedValueOnce(failure);
  jest.mocked(f.api.list).mockResolvedValueOnce({ kind: 'success', value: listing([bor], bor.id) });
  await c.create(draft);
  expect(f.saved.get(accountId)).toBeNull();
  expect(ready(c.getState())).toMatchObject({ characters: [bor], activeCharacterId: bor.id, pendingCreation: null, busy: false, error: failure, activeRevision: 1 });
});

test('a created character stays visible when clearing the record fails, and the record is kept for replay', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.create).mockResolvedValueOnce(created());
  const write = jest.mocked(f.storage.write).getMockImplementation()!;
  jest.mocked(f.storage.write).mockImplementationOnce(write).mockResolvedValueOnce({ kind: 'unavailable' });
  await c.create(draft);
  expect(f.saved.get(accountId)).toEqual(record);
  expect(ready(c.getState())).toMatchObject({ characters: [mira], activeCharacterId: mira.id, pendingCreation: record, error: { kind: 'storage' } });
});

test('switching changes the active character only after 200, notifies subscribers and skips the current one', async () => {
  const f = setup(listing([mira, bor], mira.id)); const c = f.create(); c.start(); await flush();
  const listener = jest.fn(); c.subscribe(listener);
  const reply = deferred<Awaited<ReturnType<CharacterClient['activate']>>>();
  jest.mocked(f.api.activate).mockReturnValueOnce(reply.promise);
  const switching = c.switch(bor.id); await flush();
  expect(ready(c.getState())).toMatchObject({ activeCharacterId: mira.id, busy: true, activeRevision: 1 });
  await c.create(draft); await c.switch(mira.id);
  expect(f.api.create).not.toHaveBeenCalled(); expect(f.api.activate).toHaveBeenCalledTimes(1);
  reply.resolve({ kind: 'success', value: listing([mira, bor], bor.id) }); await switching;
  expect(ready(c.getState())).toMatchObject({ activeCharacterId: bor.id, busy: false, activeRevision: 2 });
  expect(listener).toHaveBeenCalled();
  await c.switch(bor.id);
  expect(f.api.activate).toHaveBeenCalledTimes(1);
  expect(jest.mocked(f.api.activate).mock.calls[0].slice(0, 2)).toEqual(['A'.repeat(43), bor.id]);
});

test('a failed switch keeps the active character and exposes the error', async () => {
  const f = setup(listing([mira, bor], mira.id)); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.activate).mockResolvedValueOnce({ kind: 'character_error', code: 'not_found' }).mockResolvedValueOnce(unavailable);
  await c.switch(bor.id);
  expect(ready(c.getState())).toMatchObject({ activeCharacterId: mira.id, busy: false, activeRevision: 1, error: { kind: 'character_error', code: 'not_found' } });
  await c.switch(bor.id);
  expect(ready(c.getState())).toMatchObject({ activeCharacterId: mira.id, error: unavailable });
});

test('a create while another create is in flight is ignored', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const reply = deferred<Awaited<ReturnType<CharacterClient['create']>>>();
  jest.mocked(f.api.create).mockReturnValueOnce(reply.promise);
  const first = c.create(draft); await flush();
  await c.create(draft); await c.retryCreation();
  expect(f.api.create).toHaveBeenCalledTimes(1);
  reply.resolve(created()); await first;
  expect(f.createRequestId).toHaveBeenCalledTimes(1);
});

test('authentication failures reauthenticate and keep the stored creation', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.create).mockResolvedValueOnce({ kind: 'reauthenticate' });
  await c.create(draft);
  expect(f.session.reauthenticate).toHaveBeenCalledTimes(1);
  expect(f.saved.get(accountId)).toEqual(record);
});

test('an account change drops content, ignores in-flight replies and never reads the other account record', async () => {
  const f = setup(listing([mira], mira.id)); f.saved.set(otherAccount, { ...record, accountId: otherAccount });
  const c = f.create(); c.start(); await flush();
  const reply = deferred<Awaited<ReturnType<CharacterClient['activate']>>>();
  jest.mocked(f.api.activate).mockReturnValueOnce(reply.promise);
  jest.mocked(f.api.list).mockResolvedValue({ kind: 'success', value: listing([bor], bor.id) });
  jest.mocked(f.api.create).mockResolvedValueOnce({ kind: 'character_error', code: 'character_limit_reached' });
  const switching = c.switch(bor.id); await flush();
  const signal = jest.mocked(f.api.activate).mock.calls[0][2] as AbortSignal;
  f.change({ kind: 'authenticated', account: { id: otherAccount, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }, 'B'.repeat(43));
  expect(signal.aborted).toBe(true);
  expect(c.getState()).toEqual({ kind: 'loading' });
  reply.resolve({ kind: 'success', value: listing([mira, bor], bor.id) }); await switching; await flush();
  expect(f.storage.read).toHaveBeenLastCalledWith(otherAccount);
  expect(jest.mocked(f.api.create).mock.calls[0][0]).toBe('B'.repeat(43));
  expect(ready(c.getState())).toMatchObject({ characters: [bor], activeCharacterId: bor.id, pendingCreation: null, activeRevision: 2 });
  expect(f.saved.get(accountId)).toBeUndefined();
  f.change({ kind: 'signed_out' });
  expect(c.getState()).toEqual({ kind: 'idle' });
});

test('storage and list failures do not fabricate an empty character list', async () => {
  const f = setup(); jest.mocked(f.storage.read).mockResolvedValueOnce({ kind: 'invalid' });
  const c = f.create(); c.start(); await flush();
  expect(c.getState()).toEqual({ kind: 'storage_unavailable' }); expect(f.api.list).not.toHaveBeenCalled();
  jest.mocked(f.api.list).mockResolvedValueOnce(unavailable);
  await c.refresh();
  expect(c.getState()).toEqual({ kind: 'unavailable', error: unavailable });
  await c.refresh();
  expect(ready(c.getState())).toMatchObject({ characters: [], activeCharacterId: null });
  c.stop(); expect(c.getState()).toEqual({ kind: 'idle' });
});

test('a client-side refusal before sending keeps the stored creation', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.create).mockResolvedValueOnce({ kind: 'invalid_request' });
  await c.create(draft);
  expect(f.saved.get(accountId)).toEqual(record);
  expect(ready(c.getState())).toMatchObject({ pendingCreation: record, error: { kind: 'invalid_request' } });
});

test('a decisive rejection whose clearing write fails keeps the record and reports storage', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.create).mockResolvedValueOnce({ kind: 'character_error', code: 'invalid_preset' });
  const write = jest.mocked(f.storage.write).getMockImplementation()!;
  jest.mocked(f.storage.write).mockImplementationOnce(write).mockResolvedValueOnce({ kind: 'unavailable' });
  await c.create(draft);
  expect(f.saved.get(accountId)).toEqual(record);
  expect(ready(c.getState())).toMatchObject({ pendingCreation: record, busy: false, error: { kind: 'storage' } });
});

test('a stored creation is not replayed when the list cannot load', async () => {
  const f = setup(); f.saved.set(accountId, record);
  jest.mocked(f.api.list).mockResolvedValueOnce(unavailable);
  const c = f.create(); c.start(); await flush();
  expect(f.api.create).not.toHaveBeenCalled();
  expect(c.getState()).toEqual({ kind: 'unavailable', error: unavailable });
  expect(f.saved.get(accountId)).toEqual(record);
});

test('a creation in flight during an account change is aborted, kept and replayed identically for the same account', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const reply = deferred<Awaited<ReturnType<CharacterClient['create']>>>();
  jest.mocked(f.api.create).mockReturnValueOnce(reply.promise);
  const creating = c.create(draft); await flush();
  const signal = jest.mocked(f.api.create).mock.calls[0][2] as AbortSignal;
  f.change({ kind: 'authenticated', account: { id: otherAccount, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }, 'B'.repeat(43)); await flush();
  expect(signal.aborted).toBe(true);
  const other = c.getState();
  reply.resolve(created()); await creating; await flush();
  expect(c.getState()).toBe(other);
  expect(f.saved.get(accountId)).toEqual(record);
  jest.mocked(f.api.create).mockResolvedValueOnce(created());
  f.change({ kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }, 'C'.repeat(43)); await flush();
  expect(jest.mocked(f.api.create).mock.calls.map(call => call.slice(0, 2))).toEqual([['A'.repeat(43), sent], ['C'.repeat(43), sent]]);
  expect(f.saved.get(accountId)).toBeNull();
  expect(ready(c.getState())).toMatchObject({ characters: [mira], activeCharacterId: mira.id, pendingCreation: null });
});

test('a replay naming an unknown active character reloads the list, and a failed reload is not published as ready', async () => {
  const f = setup(listing([mira], mira.id)); f.saved.set(accountId, record);
  jest.mocked(f.api.create).mockResolvedValueOnce(created(false, bor.id)).mockResolvedValueOnce(created(false, bor.id));
  jest.mocked(f.api.list).mockResolvedValueOnce({ kind: 'success', value: listing([mira], mira.id) }).mockResolvedValueOnce({ kind: 'success', value: listing([mira, bor], bor.id) });
  const c = f.create(); c.start(); await flush();
  expect(ready(c.getState())).toMatchObject({ characters: [mira, bor], activeCharacterId: bor.id, pendingCreation: null });
  const g = setup(listing([mira], mira.id)); g.saved.set(accountId, record);
  jest.mocked(g.api.create).mockResolvedValueOnce(created(false, bor.id));
  jest.mocked(g.api.list).mockResolvedValueOnce({ kind: 'success', value: listing([mira], mira.id) }).mockResolvedValueOnce(unavailable);
  const d = g.create(); const states: CharacterControllerState[] = []; d.subscribe(() => states.push(d.getState())); d.start(); await flush();
  expect(d.getState()).toEqual({ kind: 'unavailable', error: unavailable });
  for (const state of states) if (state.kind === 'ready' && state.activeCharacterId !== null) expect(state.characters.map(item => item.id)).toContain(state.activeCharacterId);
});

test('character_limit_reached reloads the list so the full roster is shown', async () => {
  const third: Character = { ...bor, id: '30000000-0000-4000-8000-00000000000c', name: 'Wit' };
  const f = setup(listing([bor], bor.id)); const c = f.create(); c.start(); await flush();
  jest.mocked(f.api.create).mockResolvedValueOnce({ kind: 'character_error', code: 'character_limit_reached' });
  jest.mocked(f.api.list).mockResolvedValueOnce({ kind: 'success', value: listing([bor, mira, third], third.id) });
  await c.create(draft);
  expect(f.api.list).toHaveBeenCalledTimes(2);
  expect(ready(c.getState())).toMatchObject({ characters: [bor, mira, third], activeCharacterId: third.id, pendingCreation: null, error: { kind: 'character_error', code: 'character_limit_reached' } });
});

test('switching is ignored while a creation is unresolved, so a later replay cannot surprise the player', async () => {
  const f = setup(listing([bor], bor.id)); const c = f.create(); c.start(); await flush();
  await c.create(draft);
  expect(ready(c.getState()).pendingCreation).toEqual(record);
  await c.switch(mira.id);
  expect(f.api.activate).not.toHaveBeenCalled();
  expect(ready(c.getState())).toMatchObject({ activeCharacterId: bor.id, busy: false });
});

test('clearError removes a shown error without touching the stored creation', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.create(draft);
  expect(ready(c.getState()).error).toEqual(unavailable);
  c.clearError();
  expect(ready(c.getState()).error).toBeUndefined();
  expect(ready(c.getState()).pendingCreation).toEqual(record);
  expect(f.saved.get(accountId)).toEqual(record);
});
