import type { File } from 'expo-file-system';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { createProofClient, PROOF_UPLOAD_TIMEOUT_MS } from './proofClient';
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const token = 'A'.repeat(43);
const characterId = '30000000-0000-4000-8000-00000000000c';
const oathId = '20000000-0000-4000-8000-000000000001';
const submissionId = '4a0b0c0d-0000-4000-8000-00000000000f';
const receivedAt = '2026-10-24T18:14:00Z';
const file = (name = `${submissionId}.jpg`) => ({ uri: `file:///var/mobile/Documents/proofs/${name}` }) as unknown as File;
const submission = (overrides: Record<string, unknown> = {}) => ({ submissionId, mode: 'photo' as const, file: file(), ...overrides });

function response(status: number, value: unknown, extra: { url?: string; redirected?: boolean; length?: string } = {}) {
  let consumed = false;
  return { status, url: extra.url ?? '', redirected: extra.redirected ?? false,
    headers: { get: (name: string) => name === 'content-type' ? 'application/json' : name === 'content-length' ? extra.length ?? null : null },
    body: { getReader: () => ({ read: async () => consumed ? { done: true } : (consumed = true, { done: false, value: new TextEncoder().encode(JSON.stringify(value)) }), cancel: async () => {}, releaseLock: () => {} }) } };
}
function receipt() {
  const snapshot = JSON.parse(JSON.stringify(catalog));
  snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  const proof = { submissionId, mode: 'photo', revision: 1, receivedAt, assessment: 'queued' };
  const oath = { id: oathId, characterId, state: 'proof_pending', snapshot, createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null, proof: { ...proof } };
  return { proof, oath, serverTime: '2026-10-24T18:20:00Z' } as Record<string, any>;
}
function client(transport: jest.Mock, baseUrl = 'https://api.example.test', development = false) { return createProofClient({ baseUrl, development, transport }); }

test('posts one multipart body to the Oath proof route with every request guard', async () => {
  const transport = jest.fn().mockResolvedValueOnce(response(201, receipt()));
  await expect(client(transport).submit(token, oathId, submission())).resolves.toEqual({ kind: 'success', value: { created: true, ...receipt() } });
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, init] = transport.mock.calls[0];
  expect(url).toBe(`https://api.example.test/api/oaths/${oathId}/proofs`);
  expect(init).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit' });
  // FormData sets its own multipart boundary, so no Content-Type is forced.
  expect(init.headers).toEqual({ Accept: 'application/json', Authorization: `Bearer ${token}` });
  expect(init.signal).toBeInstanceOf(AbortSignal);
  expect(init.body).toBeInstanceOf(FormData);
  // Jest uses Node's FormData, which stringifies the native File. Only names and text parts are meaningful here.
  const parts = [...(init.body as FormData).entries()];
  expect(parts.map(([name]) => name)).toEqual(['submissionId', 'mode', 'declaration', 'image']);
  expect(parts.slice(0, 3)).toEqual([['submissionId', submissionId], ['mode', 'photo'], ['declaration', 'true']]);
});

test('a replay with status 200 keeps the original receivedAt and reports it was not created', async () => {
  const transport = jest.fn().mockResolvedValueOnce(response(200, receipt()));
  const result = await client(transport).submit(token, oathId, submission());
  expect(result).toEqual({ kind: 'success', value: { created: false, ...receipt() } });
  expect(result.kind === 'success' && result.value.proof.receivedAt).toBe(receivedAt);
});

test.each([
  ['another submission', (value: Record<string, any>) => { value.proof.submissionId = oathId; value.oath.proof.submissionId = oathId; }],
  ['another mode', (value: Record<string, any>) => { value.proof.mode = 'activity_record'; value.oath.proof.mode = 'activity_record'; }],
  ['another Oath', (value: Record<string, any>) => { value.oath.id = submissionId; }],
  ['an Oath without proof', (value: Record<string, any>) => { value.oath.proof = null; }],
  ['an extra key', (value: Record<string, any>) => { value.url = 'https://cdn.example.test/proof.jpg'; }],
  ['a missing key', (value: Record<string, any>) => { delete value.serverTime; }],
  ['an extra proof key', (value: Record<string, any>) => { value.proof.storageKey = 'proofs/x'; }],
  ['a fractional serverTime', (value: Record<string, any>) => { value.serverTime = '2026-10-24T18:20:00.000Z'; }],
  ['an invalid Oath', (value: Record<string, any>) => { value.oath.state = 'passed'; }],
])('rejects a success body with %s', async (_label, mutate) => {
  const value = receipt(); mutate(value);
  const transport = jest.fn().mockResolvedValueOnce(response(201, value));
  await expect(client(transport).submit(token, oathId, submission())).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test.each([
  [409, { code: 'receipt_cutoff_passed' }, { kind: 'proof_refused', code: 'receipt_cutoff_passed' }],
  [409, { code: 'oath_not_active', state: 'withdrawn' }, { kind: 'proof_refused', code: 'oath_not_active', state: 'withdrawn' }],
  [409, { code: 'proof_already_submitted' }, { kind: 'proof_refused', code: 'proof_already_submitted' }],
  [409, { code: 'idempotency_conflict' }, { kind: 'proof_refused', code: 'idempotency_conflict' }],
  // The API finds the Oath through the active character, so 404 means the character changed elsewhere.
  [404, { code: 'not_found' }, { kind: 'proof_error', code: 'not_found' }],
  // Until the native multipart check runs, these two may mean the transport lost the image part.
  [400, { code: 'invalid_request' }, { kind: 'upload_rejected', code: 'invalid_request' }],
  [422, { code: 'image_required', field: 'image' }, { kind: 'upload_rejected', code: 'image_required' }],
  [422, { code: 'image_required' }, { kind: 'unavailable', retry: 'request' }],
  [413, { code: 'request_too_large' }, { kind: 'proof_refused', code: 'request_too_large' }],
  [415, { code: 'unsupported_media_type' }, { kind: 'proof_refused', code: 'unsupported_media_type' }],
  [422, { code: 'invalid_submission_id', field: 'submissionId' }, { kind: 'proof_refused', code: 'invalid_submission_id', field: 'submissionId' }],
  [422, { code: 'invalid_mode', field: 'mode' }, { kind: 'proof_refused', code: 'invalid_mode', field: 'mode' }],
  [422, { code: 'declaration_required', field: 'declaration' }, { kind: 'proof_refused', code: 'declaration_required', field: 'declaration' }],
  [422, { code: 'too_large', field: 'image' }, { kind: 'proof_refused', code: 'too_large', field: 'image' }],
  [422, { code: 'unsupported_type', field: 'image' }, { kind: 'proof_refused', code: 'unsupported_type', field: 'image' }],
  [422, { code: 'too_many_pixels', field: 'image' }, { kind: 'proof_refused', code: 'too_many_pixels', field: 'image' }],
  [422, { code: 'unreadable_image', field: 'image' }, { kind: 'proof_refused', code: 'unreadable_image', field: 'image' }],
  [409, { code: 'character_required' }, { kind: 'proof_error', code: 'character_required' }],
  [401, { code: 'unauthenticated' }, { kind: 'reauthenticate' }],
  [503, { code: 'temporarily_unavailable' }, { kind: 'unavailable', retry: 'request' }],
  [429, { code: 'rate_limited' }, { kind: 'rate_limited', retry: 'request', retryAfterSeconds: 60 }],
  [409, { code: 'oath_not_active' }, { kind: 'unavailable', retry: 'request' }],
  [409, { code: 'oath_not_active', state: 'paused' }, { kind: 'unavailable', retry: 'request' }],
  [409, { code: 'receipt_cutoff_passed', state: 'missed' }, { kind: 'unavailable', retry: 'request' }],
  [422, { code: 'too_large', field: 'mode' }, { kind: 'unavailable', retry: 'request' }],
  [422, { code: 'too_large' }, { kind: 'unavailable', retry: 'request' }],
  [422, { code: 'blurry', field: 'image' }, { kind: 'unavailable', retry: 'request' }],
  [409, { code: 'not_found' }, { kind: 'unavailable', retry: 'request' }],
  [404, { code: 'receipt_cutoff_passed' }, { kind: 'unavailable', retry: 'request' }],
])('maps status %i with %j', async (status, error, expected) => {
  const transport = jest.fn().mockResolvedValueOnce(response(status, { error }));
  await expect(client(transport).submit(token, oathId, submission())).resolves.toEqual(expected);
});

test('refuses a non-https host outside development loopback before sending', async () => {
  for (const [baseUrl, development] of [['http://api.example.test', false], ['http://api.example.test', true], ['http://localhost:8000', false], ['ftp://api.example.test', true]] as const) {
    const transport = jest.fn();
    await expect(client(transport, baseUrl, development).submit(token, oathId, submission())).resolves.toEqual({ kind: 'configuration' });
    expect(transport).not.toHaveBeenCalled();
  }
  const loopback = jest.fn().mockResolvedValueOnce(response(201, receipt()));
  await expect(client(loopback, 'http://localhost:8000', true).submit(token, oathId, submission())).resolves.toMatchObject({ kind: 'success' });
  expect(loopback.mock.calls[0][0]).toBe(`http://localhost:8000/api/oaths/${oathId}/proofs`);
});

test.each([
  ['a malformed Oath ID', () => ['20000000-0000-4000-8000-00000000000A', submission()]],
  ['a path in the Oath ID', () => [`../${oathId}`, submission()]],
  ['a malformed submission ID', () => [oathId, submission({ submissionId: 'proof-1', file: file('proof-1.jpg') })]],
  ['an unknown mode', () => [oathId, submission({ mode: 'video' })]],
  ['a file not named after the submission', () => [oathId, submission({ file: file('IMG_0001.jpg') })]],
  ['a file with another extension', () => [oathId, submission({ file: file(`${submissionId}.heic`) })]],
  ['a missing file', () => [oathId, submission({ file: undefined })]],
  ['an extra field', () => [oathId, submission({ declaration: true })]],
  ['a malformed token', () => [oathId, submission(), 'short']],
])('refuses %s before sending', async (_label, args) => {
  const transport = jest.fn();
  const [id, input, sentToken = token] = args() as [string, never, string?];
  await expect(client(transport).submit(sentToken, id, input)).resolves.toEqual({ kind: 'invalid_request' });
  expect(transport).not.toHaveBeenCalled();
});

test('an upload outlives the JSON timeout and stops at the upload timeout', async () => {
  jest.useFakeTimers();
  try {
    expect(PROOF_UPLOAD_TIMEOUT_MS).toBe(60000);
    const transport = jest.fn(() => new Promise(() => {}));
    let settled: unknown;
    void client(transport).submit(token, oathId, submission()).then(result => { settled = result; });
    await jest.advanceTimersByTimeAsync(59999);
    const signal = (transport.mock.calls[0] as unknown as [string, { signal: AbortSignal }])[1].signal;
    expect(settled).toBeUndefined(); expect(signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ kind: 'unavailable', retry: 'request' }); expect(signal.aborted).toBe(true);
  } finally { jest.useRealTimers(); }
});

test('a caller abort cancels the upload', async () => {
  const transport = jest.fn((_url: string, init: { signal: AbortSignal }) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')))));
  const caller = new AbortController();
  const result = client(transport).submit(token, oathId, submission(), caller.signal);
  caller.abort();
  await expect(result).resolves.toEqual({ kind: 'cancelled' });
});

test('a redirect, a foreign response origin or an oversized declared body is unavailable', async () => {
  for (const extra of [{ redirected: true }, { url: 'https://evil.example.test/api/oaths' }, { length: String(64 * 1024 + 1) }]) {
    const transport = jest.fn().mockResolvedValueOnce(response(201, receipt(), extra));
    await expect(client(transport).submit(token, oathId, submission())).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  }
  const thrown = jest.fn().mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(client(thrown).submit(token, oathId, submission())).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});
