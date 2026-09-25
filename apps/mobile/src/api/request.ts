import { fetch as expoFetch } from 'expo/fetch';
import type { AuthFailure, AuthResult, AuthResponse, AuthTransport, Retry } from './auth';

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 10000;
const secretPattern = /^[A-Za-z0-9_-]{43}$/;
export const isSecret = (value: unknown): value is string => typeof value === 'string' && secretPattern.test(value);
export function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
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
export type ClientOptions = { baseUrl: string; development?: boolean; transport?: AuthTransport };
export type RequestPolicy<F> = {
  maxResponseBytes?: number;
  mapStructuredError?: (status: number, error: unknown) => F | undefined;
};

export function createBoundedRequest<F = never>(options: ClientOptions, mapError?: (path: string, status: number, code: unknown) => F | undefined) {
  const transport: AuthTransport = options.transport ?? expoFetch;
  const origin = baseOrigin(options.baseUrl, options.development === true);
  async function request<T>(path: string, method: string, status: number | readonly number[], validate: (value: unknown) => value is T,
    body?: string, token?: string, signal?: AbortSignal, policy: RequestPolicy<F> = {}): Promise<AuthResult<T> | F> {
    const accepts = (candidate: number) => typeof status === 'number' ? candidate === status : status.includes(candidate);
    const maxBytes = policy.maxResponseBytes ?? MAX_RESPONSE_BYTES;
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
    const perform = async (): Promise<AuthResult<T> | F> => {
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        if (token !== undefined) headers.Authorization = `Bearer ${token}`;
        const response = await transport(`${origin}${path}`, { method, headers, body, signal: controller.signal, redirect: 'error', credentials: 'omit' });
        if (controller.signal.aborted) return unavailable;
        if (response.redirected || (response.url && new URL(response.url).origin !== origin)) return unavailable;
        if (response.status === 204 && accepts(204)) return { kind: 'success', value: undefined as T };
        const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
        const length = response.headers.get('content-length');
        if (contentType !== 'application/json' || (length !== null && (!/^\d+$/.test(length) || Number(length) > maxBytes)) || !response.body) return unavailable;
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
          if (bytes > maxBytes) return unavailable;
          text += decoder.decode(chunk.value, { stream: true });
        }
        const value: unknown = JSON.parse(text + decoder.decode());
        if (accepts(response.status) && validate(value)) return { kind: 'success', value };
        if (!exact(value, ['error'])) return unavailable;
        const structured = policy.mapStructuredError?.(response.status, value.error);
        if (structured !== undefined) return structured;
        if (!exact(value.error, ['code'])) return unavailable;
        const code = value.error.code;
        const mapped = mapError?.(path, response.status, code);
        if (mapped !== undefined) return mapped;
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
  return request;
}
