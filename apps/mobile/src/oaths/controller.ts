import type { SessionController } from '../auth/session';
import type { OathClient, OathResult, OathListQuery, PauseInput } from '../api/oaths';
import type { PreviewInput, Preview, Oath } from '../api/oathSchema';
import { isPendingAcceptance, type PendingStorage, type PendingAcceptance } from './pendingStorage';

type Failure = Exclude<OathResult<never>, { kind: 'success' }>;
export type OathControllerState = { kind: 'idle' | 'loading' | 'storage_unavailable' }
  | { kind: 'ready'; busy: boolean; preview: Preview | null; pending: PendingAcceptance | null; oath: Oath | null; needsReview: boolean; error?: Failure | { kind: 'storage' } };

export function createOathController(options: { session: SessionController; api: OathClient; storage: PendingStorage }) {
  let state: OathControllerState = { kind: 'idle' };
  let binding: { accountId: string; token: string } | undefined;
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
    const accountId = binding!.accountId;
    const saved = await storageCall(async () => {
      if (!current(epoch)) return false;
      try { return (await options.storage.write(accountId, value)).kind === 'success'; } catch { return false; }
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
    if (result.kind === 'reauthenticate') { await options.session.reauthenticate(); return result; }
    return result;
  }
  async function hydrate(epoch: number) {
    if (!current(epoch)) return;
    const accountId = binding!.accountId;
    let stored: Awaited<ReturnType<PendingStorage['read']>>;
    try { stored = await storageCall(() => options.storage.read(accountId)); } catch { stored = { kind: 'unavailable' }; }
    if (!current(epoch)) return;
    if (stored.kind !== 'success' || (stored.value !== null && !isPendingAcceptance(stored.value, accountId))) { publish({ kind: 'storage_unavailable' }); return; }
    pending = stored.value;
    if (pending) {
      const result = await call((token, signal) => options.api.getPreview(token, pending!.previewId, signal), epoch);
      if (!current(epoch)) return;
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
    if (auth.kind === 'authenticated' && token) {
      binding = { accountId: auth.account.id, token };
      if (previous?.accountId !== binding.accountId) selected = null;
      publish({ kind: 'loading' }); void hydrate(generation);
    } else { selected = null; publish({ kind: 'idle' }); }
  }
  async function preview(input: PreviewInput) {
    if (state.kind !== 'ready' || state.busy || pending) return;
    const epoch = generation; selected = null; oath = null; needsReview = false; ready(true);
    const result = await call((token, signal) => options.api.preview(token, input, signal), epoch);
    if (!current(epoch)) return;
    if (result.kind === 'success') { selected = result.value.preview; ready(); }
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
    const identity: PendingAcceptance = { version: 1, accountId: binding!.accountId, previewId: selected.id, requestId: selected.id };
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
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { if (!disposed && !unsubscribe) { unsubscribe = options.session.subscribe(onSession); onSession(); } },
    stop() { invalidate(); unsubscribe?.(); unsubscribe = undefined; binding = undefined; selected = null; pending = null; oath = null; publish({ kind: 'idle' }); },
    dispose() { invalidate(); unsubscribe?.(); unsubscribe = undefined; disposed = true; listeners.clear(); },
    preview, confirm, recover, refresh,
    detail: (id: string) => call((token, signal) => options.api.detail(token, id, signal)),
    list: (query: OathListQuery) => call((token, signal) => options.api.list(token, query, signal)),
    getPause: () => call((token, signal) => options.api.getPause(token, signal)),
    pause: (input: PauseInput) => call((token, signal) => options.api.pause(token, input, signal)),
  };
}
export type OathController = ReturnType<typeof createOathController>;
