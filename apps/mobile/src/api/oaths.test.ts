import { createOathClient } from './oaths';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const token = 'A'.repeat(43);
const id = '20000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-00000000000c';
function response(status: number, value: unknown) {
  let consumed = false;
  return { status, url: '', redirected: false, headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
    body: { getReader: () => ({ read: async () => consumed ? { done: true } : (consumed = true, { done: false, value: new TextEncoder().encode(JSON.stringify(value)) }), cancel: async () => {}, releaseLock: () => {} }) } };
}
test('preserves validated server DST choices instead of turning them into network failure', async () => {
  const error = { code: 'ambiguous_local_time', field: 'deadline', validOffsets: ['+02:00', '+01:00'] };
  const transport = jest.fn().mockResolvedValueOnce(response(400, { error }));
  const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  await expect(client.confirm(token, { previewId: id, requestId: id, accepted: true })).resolves.toEqual({ kind: 'time_error', ...error });
});
function fixture() {
  const snapshot = JSON.parse(JSON.stringify(catalog));
  snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { oath: { id, characterId, state: 'active', snapshot, createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null }, serverTime: '2026-10-24T00:00:00Z' };
}
test('confirmation accepts created and replayed real immutable snapshot envelopes', async () => {
  const envelope = fixture(); const transport = jest.fn().mockResolvedValueOnce(response(201, envelope)).mockResolvedValueOnce(response(200, envelope));
  const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  for (let i = 0; i < 2; i++) await expect(client.confirm(token, { previewId: id, requestId: id, accepted: true })).resolves.toEqual({ kind: 'success', value: envelope });
});
test('bounded list transport accepts 100 complete snapshots exceeding the legacy 64KiB limit', async () => {
  const { oath, serverTime } = fixture();
  const envelope = { items: Array.from({ length: 100 }, (_, i) => ({ ...oath, id: `20000000-0000-4000-8000-${String(i).padStart(12, '0')}` })), nextCursor: null, total: 100, serverTime, paused: false, characterId };
  expect(new TextEncoder().encode(JSON.stringify(envelope)).byteLength).toBeGreaterThan(64 * 1024);
  const transport = jest.fn().mockResolvedValueOnce(response(200, envelope)); const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  await expect(client.list(token, { view: 'today', limit: 100 })).resolves.toEqual({ kind: 'success', value: envelope });
  transport.mockResolvedValueOnce(response(200, envelope));
  await expect(client.list(token, { view: 'today', limit: 20 })).resolves.toMatchObject({ kind: 'unavailable' });
  transport.mockResolvedValueOnce(response(200, { padding: 'x'.repeat(4 * 1024 * 1024) }));
  await expect(client.list(token, { view: 'today', limit: 100 })).resolves.toMatchObject({ kind: 'unavailable' });
});
test('a first page without a further cursor is accepted as sent, the server owns the total', async () => {
  const { oath, serverTime } = fixture();
  const page = { items: [oath], nextCursor: null, total: 2, serverTime, paused: false, characterId };
  const transport = jest.fn().mockResolvedValueOnce(response(200, page));
  const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  await expect(client.list(token, { view: 'today', limit: 20 })).resolves.toEqual({ kind: 'success', value: page });
});
test('single envelope keeps its 64KiB budget and malformed error metadata is not exposed', async () => {
  const transport = jest.fn(); const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  transport.mockResolvedValueOnce(response(200, { padding: 'x'.repeat(65536) }));
  await expect(client.detail(token, id)).resolves.toMatchObject({ kind: 'unavailable' });
  for (const error of [{ code: 'ambiguous_local_time', field: 'deadline', validOffsets: ['+02:00'] }, { code: 'ambiguous_local_time', field: 'deadline', validOffsets: ['+02:00', '+02:00'] }, { code: 'invalid_timezone', field: 'account' }, { code: 'activation_elapsed', debug: 'private' }]) {
    transport.mockResolvedValueOnce(response(400, { error }));
    await expect(client.confirm(token, { previewId: id, requestId: id, accepted: true })).resolves.toMatchObject({ kind: 'unavailable' });
  }
});
test('maps safe conflicts, ownership and auth errors, retaining safe service unavailability', async () => {
  const transport = jest.fn(); const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  for (const code of ['activation_elapsed', 'preview_superseded', 'idempotency_conflict', 'pause_preview_changed']) {
    transport.mockResolvedValueOnce(response(409, { error: { code } }));
    await expect(client.confirm(token, { previewId: id, requestId: id, accepted: true })).resolves.toEqual({ kind: 'oath_error', code });
  }
  for (const [status, code, kind] of [[404, 'not_found', 'oath_error'], [401, 'unauthenticated', 'reauthenticate'], [503, 'temporarily_unavailable', 'unavailable']] as const) {
    transport.mockResolvedValueOnce(response(status, { error: { code } })); await expect(client.detail(token, id)).resolves.toMatchObject({ kind });
  }
});
test('supports distinct preview shapes and complete pause sets larger than a list page', async () => {
  const { oath, serverTime } = fixture(); const preview = { id, snapshot: { ...oath.snapshot, activation: { mode: 'now', time: null } } };
  const pause = { paused: false, revision: 'a'.repeat(64), withdraw: Array.from({ length: 150 }, (_, i) => `20000000-0000-4000-8000-${String(i).padStart(12, '0')}`), preserve: [], serverTime, characterId };
  const transport = jest.fn().mockResolvedValueOnce(response(201, { preview, characterId, serverTime })).mockResolvedValueOnce(response(200, { preview, characterId, oathId: null })).mockResolvedValueOnce(response(200, pause)).mockResolvedValueOnce(response(200, { ...pause, paused: true, withdraw: [] }));
  const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  await expect(client.preview(token, { activity: 'running', activation: { mode: 'now' }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00' } })).resolves.toMatchObject({ kind: 'success' });
  await expect(client.getPreview(token, id)).resolves.toEqual({ kind: 'success', value: { preview, characterId, oathId: null } });
  await expect(client.getPause(token)).resolves.toEqual({ kind: 'success', value: pause });
  await expect(client.pause(token, { characterId, paused: true, revision: pause.revision })).resolves.toMatchObject({ kind: 'success' });
  expect(transport.mock.calls[3][1].body).toBe(JSON.stringify({ characterId, paused: true, revision: pause.revision }));
});
test('pause refuses input without a canonical character before transport', async () => {
  const transport = jest.fn(); const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  for (const input of [{ paused: false }, { paused: true, revision: 'a'.repeat(64) }, { characterId: characterId.toUpperCase(), paused: false },
    { characterId: null, paused: false }, { characterId, paused: true }, { characterId, paused: false, revision: 'a'.repeat(64) }, { characterId, paused: false, extra: 1 }]) {
    await expect(client.pause(token, input as Parameters<typeof client.pause>[1])).resolves.toEqual({ kind: 'invalid_request' });
  }
  expect(transport).not.toHaveBeenCalled();
  transport.mockResolvedValueOnce(response(200, { paused: false, revision: 'a'.repeat(64), withdraw: [], preserve: [], serverTime: '2026-10-24T00:00:00Z', characterId }));
  await expect(client.pause(token, { characterId, paused: false })).resolves.toMatchObject({ kind: 'success' });
  expect(transport.mock.calls[0][1].body).toBe(JSON.stringify({ characterId, paused: false }));
});
test('maps character ownership conflicts and rejects the retired account pause code', async () => {
  const transport = jest.fn(); const client = createOathClient({ baseUrl: 'https://api.example.test', transport });
  for (const code of ['character_required', 'character_changed', 'character_paused']) {
    transport.mockResolvedValueOnce(response(409, { error: { code } }));
    await expect(client.pause(token, { characterId, paused: false })).resolves.toEqual({ kind: 'oath_error', code });
  }
  transport.mockResolvedValueOnce(response(409, { error: { code: 'account_paused' } }));
  await expect(client.confirm(token, { previewId: id, requestId: id, accepted: true })).resolves.toMatchObject({ kind: 'unavailable' });
  transport.mockResolvedValueOnce(response(400, { error: { code: 'character_required' } }));
  await expect(client.getPause(token)).resolves.toMatchObject({ kind: 'unavailable' });
});
