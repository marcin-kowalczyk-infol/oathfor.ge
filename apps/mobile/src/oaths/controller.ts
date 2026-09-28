import type { SessionController } from '../auth/session';
import type { OathClient, OathResult, OathListQuery } from '../api/oaths';
import type { PreviewInput, Preview, Oath } from '../api/oathSchema';
import { isPendingAcceptance, type PendingStorage, type PendingAcceptance } from './pendingStorage';
import { createServerClock, type ServerClock } from './serverClock';

type Failure = Exclude<OathResult<never>, { kind: 'success' }>;
export type OathControllerState = { kind: 'idle' | 'loading' | 'storage_unavailable' }
  | { kind: 'ready'; busy: boolean; preview: Preview | null; pending: PendingAcceptance | null; oath: Oath | null; needsReview: boolean; error?: Failure | { kind: 'storage' } };

export type OathCharacter = { accountId: string; characterId: string };
/** Pause input without a character: the controller always sends its bound character. */
export type OathPauseChoice = { paused: true; revision: string } | { paused: false };
const changed = { kind: 'oath_error' as const, code: 'character_changed' as const };
export function createOathController(options: { session: SessionController; api: OathClient; storage: PendingStorage; onCharacterRequired?: () => void; onCharacterChanged?: () => void; clock?: ServerClock }) {
  const clock = options.clock ?? createServerClock();
  let state: OathControllerState = { kind: 'idle' };
  // Oath content belongs to one character of one account. The owner names it, the session supplies the token.
  let character: OathCharacter | null = null;
  let binding: { accountId: string; characterId: string; token: string } | undefined;
  let generation = 0;
  let unsubscribe: (() => void) | undefined;
  let disposed = false;
  let storageQueue: Promise<unknown> = Promise.resolve();
  let pending: PendingAcceptance | null = null;
  let selected: Preview | null = null;
  let oath: Oath | null = null;
  let needsReview = false;
  const listeners = new Set<() => void>();
  const requests = new Set<AbortController>();
  const current = (epoch: number) => !disposed && epoch === generation && binding !== undefined && options.session.getToken() === binding.token;
  function publish(next: OathControllerState) { if (!disposed) { state = next; listeners.forEach(fn => fn()); } }
  function ready(busy = false, error?: Failure | { kind: 'storage' }) { publish({ kind: 'ready', busy, preview: selected, pending, oath, needsReview, ...(error ? { error } : {}) }); }
  function invalidate() { generation++; requests.forEach(request => request.abort()); requests.clear(); }
  function storageCall<T>(action: () => Promise<T>): Promise<T> {
    const result = storageQueue.then(action); storageQueue = result.catch(() => {}); return result;
  }
  async function persist(value: PendingAcceptance | null, epoch: number) {
    if (!current(epoch)) return false;
    const { accountId, characterId } = binding!;
    const saved = await storageCall(async () => {
      if (!current(epoch)) return false;
      try { return (await options.storage.write(accountId, characterId, value)).kind === 'success'; } catch { return false; }
    });
    return current(epoch) && saved;
  }
  async function call<T>(action: (token: string, signal: AbortSignal) => Promise<OathResult<T>>, epoch = generation): Promise<OathResult<T>> {
    if (!current(epoch)) return { kind: 'cancelled' };
    const controller = new AbortController(); requests.add(controller);
    let result: OathResult<T>;
    try { result = await action(binding!.token, controller.signal); }
    catch { result = { kind: 'unavailable', retry: 'request' }; }
    finally { requests.delete(controller); }
    if (!current(epoch)) return { kind: 'cancelled' };
    if (result.kind === 'success' && result.value && typeof result.value === 'object' && 'serverTime' in result.value && typeof result.value.serverTime === 'string') clock.observe(result.value.serverTime);
    if (result.kind === 'reauthenticate') { await options.session.reauthenticate(); return result; }
    if (result.kind === 'oath_error' && result.code === 'character_required') options.onCharacterRequired?.();
    if (result.kind === 'oath_error' && result.code === 'character_changed') options.onCharacterChanged?.();
    return result;
  }
  // The server answers for its active character. Content for another one is never shown here, the owner reloads characters.
  async function owned<T>(action: (token: string, signal: AbortSignal) => Promise<OathResult<T>>, owner: (value: T) => string, epoch = generation): Promise<OathResult<T>> {
    const result = await call(action, epoch);
    if (result.kind !== 'success' || !current(epoch) || owner(result.value) === binding!.characterId) return result;
    options.onCharacterChanged?.();
    return changed;
  }
  async function hydrate(epoch: number) {
    if (!current(epoch)) return;
    const { accountId, characterId } = binding!;
    let stored: Awaited<ReturnType<PendingStorage['read']>>;
    try { stored = await storageCall(() => options.storage.read(accountId, characterId)); } catch { stored = { kind: 'unavailable' }; }
    if (!current(epoch)) return;
    if (stored.kind !== 'success' || (stored.value !== null && !isPendingAcceptance(stored.value, accountId, characterId))) { publish({ kind: 'storage_unavailable' }); return; }
    pending = stored.value;
    if (pending) {
      const result = await call((token, signal) => options.api.getPreview(token, pending!.previewId, signal), epoch);
      if (!current(epoch)) return;
      // A record whose preview names another character does not match its storage key and is never sent.
      if (result.kind === 'success' && result.value.characterId !== characterId) {
        // A misfiled record can never be sent for this character. Clearing it lets the player continue.
        if (!await persist(null, epoch)) { if (current(epoch)) publish({ kind: 'storage_unavailable' }); return; }
        pending = null; ready(false, changed); return;
      }
      if (result.kind === 'success' && result.value.preview.id === pending.previewId) selected = result.value.preview;
      else { ready(false, result.kind === 'success' ? { kind: 'unavailable', retry: 'request' } : result); return; }
    }
    ready();
  }
  function onSession() {
    invalidate();
    const auth = options.session.getState(); const token = options.session.getToken();
    const previous = binding;
    binding = undefined;
    // Hide all account content while auth is unknown; the durable record survives.
    pending = null; oath = null; needsReview = false;
    if (auth.kind === 'authenticated' && token && character?.accountId === auth.account.id) {
      binding = { accountId: auth.account.id, characterId: character.characterId, token };
      if (previous?.accountId !== binding.accountId || previous.characterId !== binding.characterId) selected = null;
      publish({ kind: 'loading' }); void hydrate(generation);
    } else { selected = null; publish({ kind: 'idle' }); }
  }
  async function preview(input: PreviewInput) {
    if (state.kind !== 'ready' || state.busy || pending) return;
    const epoch = generation; selected = null; oath = null; needsReview = false; ready(true);
    const result = await call((token, signal) => options.api.preview(token, input, signal), epoch);
    if (!current(epoch)) return;
    if (result.kind === 'success' && result.value.characterId === binding!.characterId) { selected = result.value.preview; ready(); }
    // The server's active character moved away from this binding, so its preview is not offered here.
    else if (result.kind === 'success') { options.onCharacterChanged?.(); ready(false, changed); }
    else ready(false, result);
  }
  async function send(epoch: number): Promise<void> {
    if (!pending || !current(epoch)) return;
    const identity = pending;
    const result = await call((token, signal) => options.api.confirm(token, { previewId: identity.previewId, requestId: identity.requestId, accepted: true }, signal), epoch);
    if (!current(epoch)) return;
    if (result.kind === 'success') {
      oath = result.value.oath;
      if (!await persist(null, epoch)) { if (current(epoch)) ready(false, { kind: 'storage' }); return; }
      pending = null; selected = null; needsReview = false; ready(); return;
    }
    const definitive = result.kind === 'time_error' || result.kind === 'invalid_request'
      || (result.kind === 'oath_error' && ['preview_superseded', 'activation_elapsed', 'deadline_not_after_activation', 'not_found', 'invalid_request', 'invalid_activity'].includes(result.code));
    if (definitive) {
      // An authoritative rejection establishes no commitment; require new review.
      if (!await persist(null, epoch)) { if (current(epoch)) ready(false, { kind: 'storage' }); return; }
      pending = null; selected = null; needsReview = true;
    }
    // Conflicts and unknown delivery retain identity for decisive replay/support.
    ready(false, result);
  }
  async function confirm() {
    if (state.kind !== 'ready' || state.busy) return;
    if (pending) { await recover(); return; }
    if (!selected || needsReview) return;
    const epoch = generation;
    const identity: PendingAcceptance = { version: 2, accountId: binding!.accountId, characterId: binding!.characterId, previewId: selected.id, requestId: selected.id };
    ready(true);
    if (!await persist(identity, epoch)) { if (current(epoch)) ready(false, { kind: 'storage' }); return; }
    pending = identity; ready(true); await send(epoch);
  }
  async function recover() {
    if (state.kind !== 'ready' || state.busy || !pending) return;
    ready(true); await send(generation);
  }
  async function refresh() {
    if (!binding || !options.session.getToken()) return;
    invalidate(); publish({ kind: 'loading' }); await hydrate(generation);
  }
  return {
    /** Server now from the latest current envelope. Display only, it never changes Oath state. */
    clock,
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { if (!disposed && !unsubscribe) { unsubscribe = options.session.subscribe(onSession); onSession(); } },
    /** The character this controller serves, so owners can wait until a rebind has happened. */
    boundCharacter: (): OathCharacter | null => character,
    /** Rebinds to another character: in-flight requests stop and that character's content and pending acceptance load. */
    setCharacter(next: OathCharacter | null) {
      if (next?.accountId === character?.accountId && next?.characterId === character?.characterId) return;
      character = next ? { ...next } : null;
      if (unsubscribe && !disposed) onSession();
    },
    stop() { invalidate(); unsubscribe?.(); unsubscribe = undefined; binding = undefined; selected = null; pending = null; oath = null; publish({ kind: 'idle' }); },
    dispose() { invalidate(); unsubscribe?.(); unsubscribe = undefined; disposed = true; listeners.clear(); },
    preview, confirm, recover, refresh,
    resetCreation() {
      if (state.kind !== 'ready' || state.busy || pending) return false;
      selected = null; oath = null; needsReview = false; ready(); return true;
    },
    detail: (id: string) => owned((token, signal) => options.api.detail(token, id, signal), value => value.oath.characterId),
    list: (query: OathListQuery) => owned((token, signal) => options.api.list(token, query, signal), value => value.characterId),
    getPause: () => owned((token, signal) => options.api.getPause(token, signal), value => value.characterId),
    pause(input: OathPauseChoice) {
      if (!binding) return Promise.resolve({ kind: 'cancelled' as const });
      const { characterId } = binding;
      return owned((token, signal) => options.api.pause(token, input.paused ? { characterId, paused: true, revision: input.revision } : { characterId, paused: false }, signal), value => value.characterId);
    },
  };
}
export type OathController = ReturnType<typeof createOathController>;
