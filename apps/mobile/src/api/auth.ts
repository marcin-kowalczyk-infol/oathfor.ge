import { fetch as expoFetch } from 'expo/fetch';

export type Account = { id: string; onboardingStatus: 'pending' | 'complete' };
export type Session = { token: string; expiresAt: string };
export type Challenge = { challengeId: string; nonce: string; state: string; expiresAt: string };
export type ExchangeCredential = { challengeId: string; identityToken: string; authorizationCode: string };
export type Retry = 'request' | 'fresh_login';
export type AuthFailure =
  | { kind: 'reauthenticate' | 'fresh_challenge' | 'cancelled' | 'invalid_request' | 'configuration' }
  | { kind: 'unavailable'; retry: Retry }
  | { kind: 'rate_limited'; retry: Retry; retryAfterSeconds: number };
export type AuthResult<T> = { kind: 'success'; value: T } | AuthFailure;
export type AuthResponse = {
  status: number; url: string; redirected: boolean;
  headers: { get(name: string): string | null };
  body: { getReader(): { read(): Promise<{ done: boolean; value?: Uint8Array }>; cancel(): Promise<unknown>; releaseLock(): void } } | null;
};
export type AuthTransport = (url: string, init: {
  method: string; headers: Record<string, string>; body?: string; signal: AbortSignal;
  redirect: 'error'; credentials: 'omit';
}) => Promise<AuthResponse>;

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10000;
const secretPattern = /^[A-Za-z0-9_-]{43}$/;
const isSecret = (value: unknown): value is string => typeof value === 'string' && secretPattern.test(value);
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
}
function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value.replace('Z', '.000Z');
}
export function isAccount(value: unknown): value is Account {
  return exact(value, ['id', 'onboardingStatus']) && typeof value.id === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.id)
    && (value.onboardingStatus === 'pending' || value.onboardingStatus === 'complete');
}
export function isSession(value: unknown): value is Session {
  return exact(value, ['token', 'expiresAt']) && isSecret(value.token) && isTimestamp(value.expiresAt);
}
function isChallenge(value: unknown): value is Challenge {
  return exact(value, ['challengeId', 'nonce', 'state', 'expiresAt']) && isSecret(value.challengeId)
    && isSecret(value.nonce) && isSecret(value.state) && isTimestamp(value.expiresAt);
}
function baseOrigin(value: string, development: boolean): string | undefined {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/') return undefined;
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(development && loopback && url.protocol === 'http:')) return undefined;
    return url.origin;
  } catch { return undefined; }
}
function boundedString(value: unknown, bytes: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= bytes && new TextEncoder().encode(value).byteLength <= bytes;
}

export function createAuthClient(options: { baseUrl: string; development?: boolean; transport?: AuthTransport }) {
  const transport: AuthTransport = options.transport ?? expoFetch;
  const origin = baseOrigin(options.baseUrl, options.development === true);
  async function request<T>(path: string, method: string, status: number, validate: (value: unknown) => value is T,
    body?: string, token?: string, signal?: AbortSignal): Promise<AuthResult<T>> {
    const retry: Retry = path.endsWith('/exchange') ? 'fresh_login' : 'request';
    const unavailable: AuthFailure = { kind: 'unavailable', retry };
    if (!origin) return { kind: 'configuration' };
    if (signal?.aborted) return { kind: 'cancelled' };
    if (token !== undefined && !isSecret(token)) return { kind: 'invalid_request' };
    const controller = new AbortController();
    let reader: ReturnType<NonNullable<AuthResponse['body']>['getReader']> | undefined;
    const closeReader = () => {
      if (!reader) return;
      const current = reader;
      reader = undefined;
      try { void current.cancel().catch(() => {}); } catch { /* Safe cleanup only. */ }
      try { current.releaseLock(); } catch { /* A native pending read may still hold the lock. */ }
    };
    // Race as well as abort: an injected or native transport may not settle on cancellation.
    let finishAbort: (result: AuthFailure) => void = () => {};
    const interrupted = new Promise<AuthFailure>(resolve => { finishAbort = resolve; });
    const stop = (result: AuthFailure) => {
      finishAbort(result);
      controller.abort();
      closeReader();
    };
    const onAbort = () => stop({ kind: 'cancelled' });
    signal?.addEventListener('abort', onAbort);
    const timeout = setTimeout(() => stop(unavailable), REQUEST_TIMEOUT_MS);
    const perform = async (): Promise<AuthResult<T>> => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (token !== undefined) headers.Authorization = `Bearer ${token}`;
        const response = await transport(`${origin}${path}`, { method, headers, body, signal: controller.signal, redirect: 'error', credentials: 'omit' });
        if (controller.signal.aborted) return unavailable;
        if (response.redirected || (response.url && new URL(response.url).origin !== origin)) return unavailable;
        if (response.status === 204 && status === 204) return { kind: 'success', value: undefined as T };
        const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
        const length = response.headers.get('content-length');
        if (contentType !== 'application/json' || (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) || !response.body) return unavailable;
        reader = response.body.getReader();
        const activeReader = reader;
        const decoder = new TextDecoder();
        let text = '';
        let bytes = 0;
        while (true) {
          const chunk = await activeReader.read();
          if (controller.signal.aborted) return unavailable;
          if (chunk.done) break;
          if (!chunk.value) return unavailable;
          bytes += chunk.value.byteLength;
          if (bytes > MAX_RESPONSE_BYTES) return unavailable;
          text += decoder.decode(chunk.value, { stream: true });
        }
        const value: unknown = JSON.parse(text + decoder.decode());
        if (response.status === status && validate(value)) return { kind: 'success', value };
        if (!exact(value, ['error']) || !exact(value.error, ['code'])) return unavailable;
        const code = value.error.code;
        if (response.status === 401 && code === (retry === 'fresh_login' ? 'invalid_credential' : 'unauthenticated')) return { kind: 'reauthenticate' };
        if (response.status === 409 && retry === 'fresh_login' && code === 'challenge_unavailable') return { kind: 'fresh_challenge' };
        if (response.status === 429 && code === 'rate_limited') {
          const header = response.headers.get('retry-after') ?? '';
          const seconds = /^\d+$/.test(header) ? Math.min(60, Math.max(1, Number(header))) : 60;
          return { kind: 'rate_limited', retry, retryAfterSeconds: seconds };
        }
        return unavailable;
      } catch { return unavailable; }
    };
    try { return await Promise.race([perform(), interrupted]); }
    finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', onAbort);
      controller.abort();
      // Do not wait for a misbehaving stream's cancellation to finish.
      closeReader();
    }
  }
  return {
    challenge: (signal?: AbortSignal) => request('/api/auth/apple/challenges', 'POST', 201, isChallenge, '{}', undefined, signal),
    exchange: (credential: ExchangeCredential, signal?: AbortSignal): Promise<AuthResult<{ account: Account; session: Session }>> => {
      if (!credential || !isSecret(credential.challengeId) || !boundedString(credential.identityToken, 12 * 1024) || !boundedString(credential.authorizationCode, 2048)) return Promise.resolve({ kind: 'invalid_request' });
      const { challengeId, identityToken, authorizationCode } = credential;
      const body = JSON.stringify({ challengeId, identityToken, authorizationCode });
      if (new TextEncoder().encode(body).byteLength > 16 * 1024) return Promise.resolve({ kind: 'invalid_request' });
      return request('/api/auth/apple/exchange', 'POST', 200,
        (value): value is { account: Account; session: Session } => exact(value, ['account', 'session']) && isAccount(value.account) && isSession(value.session),
        body, undefined, signal);
    },
    me: (token: string, signal?: AbortSignal) => request('/api/me', 'GET', 200,
      (value): value is { account: Account } => exact(value, ['account']) && isAccount(value.account), undefined, token, signal),
    logout: (token: string, signal?: AbortSignal) => request('/api/auth/session', 'DELETE', 204,
      (value): value is void => value === undefined, undefined, token, signal),
  };
}
export type AuthClient = ReturnType<typeof createAuthClient>;
