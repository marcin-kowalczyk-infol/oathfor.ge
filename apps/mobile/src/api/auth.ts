import { createBoundedRequest, exact, isSecret, type ClientOptions } from './request';

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
function boundedString(value: unknown, bytes: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= bytes && new TextEncoder().encode(value).byteLength <= bytes;
}

export function createAuthClient(options: ClientOptions) {
  const request = createBoundedRequest(options);
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
