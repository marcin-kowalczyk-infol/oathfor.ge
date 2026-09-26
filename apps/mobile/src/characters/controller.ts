import type { SessionController } from '../auth/session';
import type { Character, CharacterClient, CharacterForm, CharacterList, CharacterResult, CharacterCreationResult } from '../api/characters';
import { isCharacterForm, isPresetId } from '../api/characters';
import { validateCharacterName } from './name';
import { createRequestId as nativeRequestId } from './requestId';
import type { CreationStorage, PendingCreation } from './creationStorage';

type Failure = Exclude<CharacterResult<never> | CharacterCreationResult, { kind: 'success' }>;
export type CharacterError = Failure | { kind: 'storage' };
export type CharacterDraft = { name: string; presetId: string; form: CharacterForm };
export type CharacterControllerState = { kind: 'idle' | 'loading' | 'storage_unavailable' }
  | { kind: 'unavailable'; error: Failure }
  | { kind: 'ready'; characters: Character[]; activeCharacterId: string | null; presets: string[]; limit: number; busy: boolean;
    pendingCreation: PendingCreation | null; activeRevision: number; error?: CharacterError };

// Decisive answers mean the stored creation can never succeed, so its record is cleared.
const decisive = ['invalid_request', 'invalid_character_name', 'invalid_preset', 'character_limit_reached', 'idempotency_conflict', 'onboarding_incomplete'];

export function createCharacterController(options: { session: SessionController; api: CharacterClient; storage: CreationStorage; createRequestId?: () => string | undefined }) {
  const createRequestId = options.createRequestId ?? nativeRequestId;
  let state: CharacterControllerState = { kind: 'idle' };
  let binding: { accountId: string; token: string } | undefined;
  let generation = 0;
  let unsubscribe: (() => void) | undefined;
  let disposed = false;
  let storageQueue: Promise<unknown> = Promise.resolve();
  let listing: CharacterList | null = null;
  let pending: PendingCreation | null = null;
  // Monotonic across accounts, so observers such as the Oath controller can rebind on any change.
  let activeRevision = 0;
  let activeKey: string | undefined;
  const listeners = new Set<() => void>();
  const requests = new Set<AbortController>();
  const current = (epoch: number) => !disposed && epoch === generation && binding !== undefined && options.session.getToken() === binding.token;
  function publish(next: CharacterControllerState) { if (!disposed) { state = next; listeners.forEach(fn => fn()); } }
  function ready(busy = false, error?: CharacterError) {
    if (!listing) return;
    const key = `${binding?.accountId}:${listing.activeCharacterId}`;
    if (key !== activeKey) { activeKey = key; activeRevision++; }
    publish({ kind: 'ready', characters: listing.characters, activeCharacterId: listing.activeCharacterId, presets: listing.presets, limit: listing.limit,
      busy, pendingCreation: pending, activeRevision, ...(error ? { error } : {}) });
  }
  function invalidate() { generation++; requests.forEach(request => request.abort()); requests.clear(); }
  function storageCall<T>(action: () => Promise<T>): Promise<T> {
    const result = storageQueue.then(action); storageQueue = result.catch(() => {}); return result;
  }
  async function persist(value: PendingCreation | null, epoch: number) {
    if (!current(epoch)) return false;
    const accountId = binding!.accountId;
    const saved = await storageCall(async () => {
      if (!current(epoch)) return false;
      try { return (await options.storage.write(accountId, value)).kind === 'success'; } catch { return false; }
    });
    return current(epoch) && saved;
  }
  async function call<T extends { kind: string }>(action: (token: string, signal: AbortSignal) => Promise<T>, epoch: number): Promise<T | { kind: 'cancelled' } | { kind: 'unavailable'; retry: 'request' }> {
    if (!current(epoch)) return { kind: 'cancelled' };
    const controller = new AbortController(); requests.add(controller);
    let result: T | { kind: 'unavailable'; retry: 'request' };
    try { result = await action(binding!.token, controller.signal); }
    catch { result = { kind: 'unavailable', retry: 'request' }; }
    finally { requests.delete(controller); }
    if (!current(epoch)) return { kind: 'cancelled' };
    if (result.kind === 'reauthenticate') await options.session.reauthenticate();
    return result;
  }
  async function hydrate(epoch: number) {
    if (!current(epoch)) return;
    const accountId = binding!.accountId;
    let stored: Awaited<ReturnType<CreationStorage['read']>>;
    try { stored = await storageCall(() => options.storage.read(accountId)); } catch { stored = { kind: 'unavailable' }; }
    if (!current(epoch)) return;
    if (stored.kind !== 'success') { publish({ kind: 'storage_unavailable' }); return; }
    const result = await call((token, signal) => options.api.list(token, signal), epoch);
    if (!current(epoch)) return;
    if (result.kind !== 'success') { publish({ kind: 'unavailable', error: result }); return; }
    listing = result.value; pending = stored.value;
    if (pending) { ready(true); await send(epoch); return; }
    ready();
  }
  function apply(character: Character, activeCharacterId: string) {
    const characters = listing!.characters.some(item => item.id === character.id) ? listing!.characters : [...listing!.characters, character];
    listing = { ...listing!, characters, activeCharacterId };
  }
  async function send(epoch: number) {
    if (!pending || !current(epoch)) return;
    const { requestId, name, presetId, form } = pending;
    const result = await call((token, signal) => options.api.create(token, { requestId, name, presetId, form }, signal), epoch);
    if (!current(epoch)) return;
    if (result.kind === 'success') {
      apply(result.value.character, result.value.activeCharacterId);
      if (!await persist(null, epoch)) { if (current(epoch)) ready(false, { kind: 'storage' }); return; }
      pending = null;
      // A replay may name an active character this list has not seen yet.
      if (!consistent()) { await reload(epoch); return; }
      ready(); return;
    }
    if (result.kind === 'character_error' && decisive.includes(result.code)) {
      if (!await persist(null, epoch)) { if (current(epoch)) ready(false, { kind: 'storage' }); return; }
      pending = null;
      // Another device filled the roster, so show it.
      if (result.code === 'character_limit_reached') { await reload(epoch, result); return; }
    }
    // Unknown delivery keeps the record so a retry replays the same request.
    ready(false, result);
  }
  const consistent = () => listing!.activeCharacterId === null || listing!.characters.some(item => item.id === listing!.activeCharacterId);
  async function reload(epoch: number, error?: CharacterError) {
    const result = await call((token, signal) => options.api.list(token, signal), epoch);
    if (!current(epoch)) return;
    if (result.kind === 'success') listing = result.value;
    // Never publish an active character that is missing from the list.
    if (!consistent()) { publish({ kind: 'unavailable', error: result.kind === 'success' ? { kind: 'unavailable', retry: 'request' } : result }); return; }
    ready(false, error ?? (result.kind === 'success' ? undefined : result));
  }
  async function create(draft: CharacterDraft) {
    if (state.kind !== 'ready' || state.busy || pending) return;
    const epoch = generation;
    const name = draft && typeof draft.name === 'string' ? validateCharacterName(draft.name) : undefined;
    if (!name?.valid || !isPresetId(draft.presetId) || !isCharacterForm(draft.form)) { ready(false, { kind: 'invalid_request' }); return; }
    const requestId = createRequestId();
    if (!requestId) { ready(false, { kind: 'configuration' }); return; }
    const record: PendingCreation = { version: 1, accountId: binding!.accountId, requestId, name: name.name, presetId: draft.presetId, form: draft.form };
    ready(true);
    if (!await persist(record, epoch)) { if (current(epoch)) ready(false, { kind: 'storage' }); return; }
    pending = record; ready(true); await send(epoch);
  }
  async function retryCreation() {
    if (state.kind !== 'ready' || state.busy || !pending) return;
    ready(true); await send(generation);
  }
  async function switchCharacter(characterId: string) {
    if (state.kind !== 'ready' || state.busy || characterId === state.activeCharacterId) return;
    const epoch = generation; ready(true);
    const result = await call((token, signal) => options.api.activate(token, characterId, signal), epoch);
    if (!current(epoch)) return;
    if (result.kind === 'success') { listing = result.value; ready(); } else ready(false, result);
  }
  function onSession() {
    invalidate();
    const auth = options.session.getState(); const token = options.session.getToken();
    binding = undefined; listing = null; pending = null;
    if (auth.kind === 'authenticated' && token) {
      binding = { accountId: auth.account.id, token };
      publish({ kind: 'loading' }); void hydrate(generation);
    } else publish({ kind: 'idle' });
  }
  async function refresh() {
    if (!binding || !options.session.getToken() || (state.kind === 'ready' && state.busy)) return;
    invalidate(); listing = null; pending = null; publish({ kind: 'loading' }); await hydrate(generation);
  }
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { if (!disposed && !unsubscribe) { unsubscribe = options.session.subscribe(onSession); onSession(); } },
    stop() { invalidate(); unsubscribe?.(); unsubscribe = undefined; binding = undefined; listing = null; pending = null; publish({ kind: 'idle' }); },
    dispose() { invalidate(); unsubscribe?.(); unsubscribe = undefined; disposed = true; listeners.clear(); },
    refresh, create, retryCreation, switch: switchCharacter,
  };
}
export type CharacterController = ReturnType<typeof createCharacterController>;
