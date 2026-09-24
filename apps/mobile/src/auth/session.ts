import { isAccount, isSession, type Account, type AuthClient, type AuthFailure, type AuthResult, type Session } from '../api/auth';
import type { SessionEnvelope, SessionStorage } from './sessionStorage';

// Capture the generation before the challenge/native prompt, not just before exchange.
export type Authentication = (signal: AbortSignal) => Promise<AuthResult<{ account: Account; session: Session }>>;
export type SessionState =
  | { kind: 'initializing' | 'authenticating' | 'validating' | 'verification_unavailable' | 'revocation_pending' }
  | { kind: 'signed_out'; error?: AuthFailure }
  | { kind: 'cleanup_required'; serverRevoked: boolean }
  | { kind: 'authenticated'; account: Account; expiresAt: string };

export function createSessionController(options: { storage: SessionStorage; api: Pick<AuthClient, 'me' | 'logout'>; now?: () => number }) {
  const now = options.now ?? Date.now;
  let state: SessionState = { kind: 'initializing' };
  let session: Session | undefined;
  let generation = 0;
  let disposed = false;
  let started = false;
  let cleanup: 'read' | 'revoke' | 'clear' | undefined;
  let serverRevoked = false;
  let logoutRequested = false;
  let clearingError: AuthFailure | undefined;
  let pendingPersisted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let writes: Promise<unknown> = Promise.resolve();
  let reading: ReturnType<SessionStorage['read']> | undefined;
  let authenticating: ReturnType<Authentication> | undefined;
  let signingOut: Promise<void> | undefined;
  const requests = new Set<AbortController>();
  const listeners = new Set<() => void>();
  const current = (epoch: number) => !disposed && generation === epoch;
  const expired = () => session !== undefined && now() >= Date.parse(session.expiresAt);

  function armExpiry() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!session || disposed || !['authenticated', 'validating', 'verification_unavailable'].includes(state.kind)) return;
    timer = setTimeout(() => {
      if (expired()) {
        const epoch = invalidate();
        publish({ kind: 'revocation_pending' });
        void clearSession(epoch, { kind: 'reauthenticate' });
      } else armExpiry();
    }, Math.max(1, Math.min(60000, Date.parse(session.expiresAt) - now())));
  }
  function publish(next: SessionState) {
    if (disposed) return;
    state = next;
    armExpiry();
    listeners.forEach(listener => listener());
  }
  function invalidate() {
    generation++;
    requests.forEach(controller => controller.abort());
    requests.clear();
    if (timer !== undefined) clearTimeout(timer);
    return generation;
  }
  async function call<T>(action: (signal: AbortSignal) => Promise<AuthResult<T>>): Promise<AuthResult<T>> {
    const controller = new AbortController(); requests.add(controller);
    try { return await action(controller.signal); }
    catch { return { kind: 'unavailable', retry: 'request' }; }
    finally { requests.delete(controller); }
  }
  function persist(value: SessionEnvelope, epoch: number): Promise<'success' | 'unavailable' | 'stale'> {
    const write = writes.then(async () => {
      if (!current(epoch)) return 'stale' as const;
      try { return (await options.storage.write(value)).kind; }
      catch { return 'unavailable' as const; }
    });
    writes = write;
    return write;
  }
  function blocked(action: typeof cleanup) {
    cleanup = action;
    publish({ kind: 'cleanup_required', serverRevoked });
  }
  async function clearSession(epoch: number, error?: AuthFailure) {
    if (error) clearingError = error;
    cleanup = 'clear';
    const result = await persist({ version: 1, kind: 'signed_out' }, epoch);
    if (!current(epoch)) return;
    if (result !== 'success') { blocked('clear'); return; }
    session = undefined;
    logoutRequested = false;
    cleanup = undefined;
    pendingPersisted = false;
    const finalError = clearingError;
    clearingError = undefined;
    publish(finalError ? { kind: 'signed_out', error: finalError } : { kind: 'signed_out' });
  }
  async function validate(epoch: number) {
    if (!session || !current(epoch)) return;
    if (expired()) { publish({ kind: 'revocation_pending' }); await clearSession(epoch, { kind: 'reauthenticate' }); return; }
    const token = session.token;
    publish({ kind: 'validating' });
    const result = await call(signal => options.api.me(token, signal));
    if (!current(epoch) || session?.token !== token) return;
    if (expired() || result.kind === 'reauthenticate') {
      publish({ kind: 'revocation_pending' }); await clearSession(epoch, { kind: 'reauthenticate' });
    } else if (result.kind === 'success' && isAccount(result.value.account)) {
      publish({ kind: 'authenticated', account: result.value.account, expiresAt: session.expiresAt });
    } else publish({ kind: 'verification_unavailable' });
  }
  async function start() {
    if (disposed || started) return;
    started = true;
    const epoch = generation;
    publish({ kind: 'initializing' });
    reading = options.storage.read().catch(() => ({ kind: 'unavailable' as const }));
    const result = await reading;
    reading = undefined;
    if (!current(epoch)) return;
    if (result.kind !== 'success') {
      if (result.kind === 'unavailable') blocked('read');
      else await clearSession(epoch);
      return;
    }
    cleanup = undefined;
    if (!result.value || result.value.kind === 'signed_out') { logoutRequested = false; publish({ kind: 'signed_out' }); return; }
    session = result.value.session;
    if (result.value.kind === 'revocation_pending' || logoutRequested) {
      pendingPersisted = result.value.kind === 'revocation_pending';
      await logout();
    } else await validate(epoch);
  }
  async function login(authenticate: Authentication) {
    if (disposed || signingOut || state.kind !== 'signed_out') return;
    const epoch = invalidate();
    serverRevoked = false;
    publish({ kind: 'authenticating' });
    const attempt = call(authenticate);
    authenticating = attempt;
    const result = await attempt;
    if (authenticating === attempt) authenticating = undefined;
    if (!current(epoch)) return;
    if (result.kind !== 'success') { publish({ kind: 'signed_out', error: result }); return; }
    if (!isSession(result.value.session) || !isAccount(result.value.account)) {
      publish({ kind: 'signed_out', error: { kind: 'unavailable', retry: 'fresh_login' } }); return;
    }
    session = result.value.session;
    if (expired()) { publish({ kind: 'revocation_pending' }); await clearSession(epoch, { kind: 'reauthenticate' }); return; }
    const written = await persist({ version: 1, kind: 'active', session }, epoch);
    if (!current(epoch)) return;
    if (written !== 'success') { blocked('revoke'); return; }
    if (expired()) { publish({ kind: 'revocation_pending' }); await clearSession(epoch, { kind: 'reauthenticate' }); return; }
    publish({ kind: 'authenticated', account: result.value.account, expiresAt: session.expiresAt });
  }
  function logout(): Promise<void> {
    if (disposed) return Promise.resolve();
    if (signingOut) return signingOut;
    logoutRequested = true;
    if (cleanup === 'read' && !reading) return Promise.resolve();
    const epoch = invalidate();
    const pendingLogin = authenticating;
    const pendingRead = reading;
    publish({ kind: 'revocation_pending' });
    const operation = async () => {
      if (pendingRead) {
        const result = await pendingRead;
        if (!current(epoch)) return;
        if (result.kind === 'unavailable') { blocked('read'); return; }
        if (result.kind === 'success' && result.value && result.value.kind !== 'signed_out') {
          session = result.value.session;
          pendingPersisted = result.value.kind === 'revocation_pending';
        }
      }
      if (pendingLogin) {
        const result = await pendingLogin;
        if (!current(epoch)) return;
        if (result.kind === 'success' && isSession(result.value.session)) session = result.value.session;
      }
      if (!current(epoch)) return;
      if (!session || expired() || cleanup === 'clear') { await clearSession(epoch); return; }
      cleanup = 'revoke';
      if (!pendingPersisted) {
        const written = await persist({ version: 1, kind: 'revocation_pending', session }, epoch);
        if (!current(epoch)) return;
        if (written !== 'success') { blocked('revoke'); return; }
        pendingPersisted = true;
      }
      const token = session.token;
      const result = await call(signal => options.api.logout(token, signal));
      if (!current(epoch) || session?.token !== token) return;
      if (result.kind === 'success' || result.kind === 'reauthenticate' || expired()) {
        serverRevoked = result.kind === 'success';
        await clearSession(epoch);
      } else publish({ kind: 'revocation_pending' });
    };
    signingOut = operation().finally(() => { signingOut = undefined; });
    return signingOut;
  }
  async function retry() {
    if (disposed) return;
    if (state.kind === 'cleanup_required' && cleanup === 'read') { started = false; await start(); }
    else if (state.kind === 'cleanup_required' || state.kind === 'revocation_pending') await logout();
    else if (state.kind === 'verification_unavailable') await validate(invalidate());
  }
  async function foreground() {
    if (disposed) return;
    if (state.kind === 'authenticated') await validate(invalidate());
    else await retry();
  }
  return {
    getState: () => state,
    getToken: () => !disposed && state.kind === 'authenticated' && !expired() ? session?.token : undefined,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start, login, logout, retry, foreground, nativeRevoked: logout,
    dispose() { disposed = true; invalidate(); listeners.clear(); },
  };
}
export type SessionController = ReturnType<typeof createSessionController>;
