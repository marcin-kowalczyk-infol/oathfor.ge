import { createAuthClient, type AuthResponse } from './auth';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const secret = 'A'.repeat(43);
const expiresAt = '2026-10-24T12:00:00Z';
const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' };
const session = { token: secret, expiresAt };
const challenge = { challengeId: secret, nonce: secret, state: secret, expiresAt };
const credential = { challengeId: secret, identityToken: 'DUMMY.identity.token', authorizationCode: 'DUMMY-code' };

function response(status: number, value?: unknown, headers: Record<string, string> = {}) {
  const bytes = new TextEncoder().encode(JSON.stringify(value) ?? '');
  let read = false;
  return {
    status, url: '', redirected: false,
    headers: { get: (key: string) => ({ 'content-type': 'application/json', ...headers })[key] ?? null },
    body: { getReader: () => ({
      read: async () => { if (read) return { done: true, value: undefined }; read = true; return { done: false, value: bytes }; },
      cancel: jest.fn().mockResolvedValue(undefined), releaseLock: jest.fn(),
    }) },
  };
}

function setup(value: AuthResponse = response(201, challenge), baseUrl = 'https://api.example.test', development = false) {
  const transport = jest.fn().mockResolvedValue(value);
  return { transport, client: createAuthClient({ baseUrl, development, transport }) };
}

test('validates challenge, exchange, identity and bodyless revocation; sends only contract credentials', async () => {
  const { transport, client } = setup();
  await expect(client.challenge()).resolves.toEqual({ kind: 'success', value: challenge });
  transport.mockResolvedValueOnce(response(200, { account, session }));
  await expect(client.exchange(Object.assign({ accountId: 'ignored' }, credential))).resolves.toEqual({ kind: 'success', value: { account, session } });
  transport.mockResolvedValueOnce(response(200, { account: { ...account, onboardingStatus: 'complete' } }));
  await expect(client.me(secret)).resolves.toEqual({ kind: 'success', value: { account: { ...account, onboardingStatus: 'complete' } } });
  transport.mockResolvedValueOnce({ ...response(204), body: null });
  await expect(client.logout(secret)).resolves.toEqual({ kind: 'success', value: undefined });
  expect(transport.mock.calls.map(([url, init]) => [url, init.method, init.headers, init.body])).toEqual([
    ['https://api.example.test/api/auth/apple/challenges', 'POST', { Accept: 'application/json', 'Content-Type': 'application/json' }, '{}'],
    ['https://api.example.test/api/auth/apple/exchange', 'POST', { Accept: 'application/json', 'Content-Type': 'application/json' }, JSON.stringify(credential)],
    ['https://api.example.test/api/me', 'GET', { Accept: 'application/json', Authorization: `Bearer ${secret}` }, undefined],
    ['https://api.example.test/api/auth/session', 'DELETE', { Accept: 'application/json', Authorization: `Bearer ${secret}` }, undefined],
  ]);
  for (const [, init] of transport.mock.calls) expect(init).toMatchObject({ redirect: 'error', credentials: 'omit', signal: expect.any(AbortSignal) });
});

test.each([
  ['extra challenge field', { ...challenge, extra: true }],
  ['array', []], ['null', null],
  ['bad secret', { ...challenge, nonce: 'x'.repeat(42) }],
  ['secret alphabet', { ...challenge, state: '+'.repeat(43) }],
  ['nonexistent date', { ...challenge, expiresAt: '2026-02-30T12:00:00Z' }],
  ['fractional date', { ...challenge, expiresAt: '2026-10-24T12:00:00.000Z' }],
  ['offset date', { ...challenge, expiresAt: '2026-10-24T12:00:00+00:00' }],
])('rejects %s', async (_name, value) => {
  await expect(setup(response(201, value)).client.challenge()).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test.each([
  { account: { ...account, id: 'not-a-uuid' }, session },
  { account: { ...account, onboardingStatus: 'deleted' }, session },
  { account: { ...account, email: 'private' }, session },
  { account, session: { ...session, token: 'bad' } },
  { account, session: { ...session, expiresAt: null } },
  { account, session, extra: true },
])('invalid exchange never authenticates: %j', async value => {
  await expect(setup(response(200, value)).client.exchange(credential)).resolves.toEqual({ kind: 'unavailable', retry: 'fresh_login' });
});

test.each([200, 204, 302, 400, 500])('challenge status %s cannot become success', async status => {
  await expect(setup(response(status, challenge)).client.challenge()).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test.each([
  [401, 'invalid_credential', { kind: 'reauthenticate' }],
  [409, 'challenge_unavailable', { kind: 'fresh_challenge' }],
  [429, 'rate_limited', { kind: 'rate_limited', retry: 'fresh_login', retryAfterSeconds: 60 }],
  [503, 'temporarily_unavailable', { kind: 'unavailable', retry: 'fresh_login' }],
])('maps safe exchange status %s without replaying a code', async (status, code, expected) => {
  const { client, transport } = setup(response(status, { error: { code } }, { 'retry-after': '999999999999' }));
  await expect(client.exchange(credential)).resolves.toEqual(expected);
  expect(transport).toHaveBeenCalledTimes(1);
});

test.each([['12', 12], ['0', 1], ['-1', 60], ['tomorrow', 60], ['', 60]])('bounds Retry-After %s', async (header, expected) => {
  await expect(setup(response(429, { error: { code: 'rate_limited' } }, { 'retry-after': header })).client.challenge()).resolves.toEqual({ kind: 'rate_limited', retry: 'request', retryAfterSeconds: expected });
});

test('malformed error bodies do not control authentication state', async () => {
  await expect(setup(response(401, { error: { code: 'unauthenticated', detail: 'PRIVATE' } })).client.me(secret)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  await expect(setup(response(401, { error: { code: 'unauthenticated' } })).client.me(secret)).resolves.toEqual({ kind: 'reauthenticate' });
  await expect(setup(response(200, { account, session })).client.me(secret)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  await expect(setup(response(200, {})).client.logout(secret)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test.each(['', 'bad', 'http://api.example.test', 'https://user:pass@api.example.test', 'https://api.example.test/path', 'https://api.example.test?token=x', 'https://api.example.test#x', 'http://localhost.evil.test'])('rejects unsafe base %s before sending credentials', async baseUrl => {
  const { client, transport } = setup(undefined, baseUrl);
  await expect(client.exchange(credential)).resolves.toEqual({ kind: 'configuration' });
  expect(transport).not.toHaveBeenCalled();
});

test('HTTP loopback requires explicit development configuration', async () => {
  await expect(setup(undefined, 'http://localhost:18082').client.challenge()).resolves.toEqual({ kind: 'configuration' });
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    await expect(setup(undefined, `http://${host}:18082`, true).client.challenge()).resolves.toEqual({ kind: 'success', value: challenge });
  }
});

test('rejects invalid outgoing credentials without HTTP or raw errors', async () => {
  const { client, transport } = setup();
  await expect(client.me('bad\r\nHeader: injected')).resolves.toEqual({ kind: 'invalid_request' });
  await expect(client.exchange({ ...credential, identityToken: ' ' })).resolves.toEqual({ kind: 'invalid_request' });
  await expect(client.exchange({ ...credential, authorizationCode: 'ą'.repeat(1025) })).resolves.toEqual({ kind: 'invalid_request' });
  await expect(client.exchange({ ...credential, identityToken: 'x'.repeat(12289) })).resolves.toEqual({ kind: 'invalid_request' });
  expect(transport).not.toHaveBeenCalled();
});

test('network and rejected redirects are safe unavailable results', async () => {
  const { client, transport } = setup();
  transport.mockRejectedValue(new Error('PRIVATE provider details'));
  await expect(client.exchange(credential)).resolves.toEqual({ kind: 'unavailable', retry: 'fresh_login' });
  transport.mockResolvedValue({ ...response(200, { account, session }), redirected: true, url: 'https://evil.test' });
  await expect(client.exchange(credential)).resolves.toEqual({ kind: 'unavailable', retry: 'fresh_login' });
});

test('rejects wrong content type, invalid JSON and oversized streamed responses', async () => {
  const { client, transport } = setup(response(201, challenge, { 'content-type': 'text/html' }));
  await expect(client.challenge()).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  transport.mockResolvedValue(response(201, challenge, { 'content-length': '65537' }));
  await expect(client.challenge()).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  transport.mockResolvedValue(response(201, 'x'.repeat(65537)));
  await expect(client.challenge()).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  transport.mockResolvedValue(response(201));
  await expect(client.challenge()).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test('pre-aborted requests never start HTTP', async () => {
  const { client, transport } = setup();
  const controller = new AbortController(); controller.abort();
  await expect(client.challenge(controller.signal)).resolves.toEqual({ kind: 'cancelled' });
  expect(transport).not.toHaveBeenCalled();
});

test('abort and total deadline settle even when transport ignores the signal', async () => {
  jest.useFakeTimers();
  try {
    const { client, transport } = setup();
    transport.mockImplementation(() => new Promise(() => {}));
    const controller = new AbortController();
    const cancelled = client.me(secret, controller.signal); controller.abort();
    await jest.advanceTimersByTimeAsync(10000);
    await expect(cancelled).resolves.toEqual({ kind: 'cancelled' });
    const timedOut = client.exchange(credential);
    await jest.advanceTimersByTimeAsync(10000);
    await expect(timedOut).resolves.toEqual({ kind: 'unavailable', retry: 'fresh_login' });
    expect(transport.mock.calls[1][1].signal.aborted).toBe(true);
  } finally { jest.useRealTimers(); }
});

test('total deadline also bounds a stalled body', async () => {
  jest.useFakeTimers();
  try {
    const cancel = jest.fn().mockResolvedValue(undefined);
    const releaseLock = jest.fn();
    const { client } = setup({ ...response(201), body: { getReader: () => ({ read: () => new Promise(() => {}), cancel, releaseLock }) } });
    const result = client.challenge();
    await jest.advanceTimersByTimeAsync(10000);
    await expect(result).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
    expect(cancel).toHaveBeenCalled();
    expect(releaseLock).toHaveBeenCalled();
  } finally { jest.useRealTimers(); }
});

test.each(['\n', '\r'])('rejects trailing line terminators in credentials and response identifiers (%j)', async ending => {
  const { client, transport } = setup(response(201, { ...challenge, nonce: secret + ending }));
  await expect(client.challenge()).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  transport.mockResolvedValue(response(200, { account: { ...account, id: account.id + ending }, session }));
  await expect(client.exchange(credential)).resolves.toEqual({ kind: 'unavailable', retry: 'fresh_login' });
  transport.mockResolvedValue(response(200, { account, session: { ...session, token: secret + ending } }));
  await expect(client.exchange(credential)).resolves.toEqual({ kind: 'unavailable', retry: 'fresh_login' });
  transport.mockClear();
  await expect(client.me(secret + ending)).resolves.toEqual({ kind: 'invalid_request' });
  await expect(client.exchange({ ...credential, challengeId: secret + ending })).resolves.toEqual({ kind: 'invalid_request' });
  expect(transport).not.toHaveBeenCalled();
});
