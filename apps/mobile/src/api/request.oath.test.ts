import { createBoundedRequest } from './request';
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
function response(status: number, value: unknown) {
  let consumed = false;
  return { status, url: '', redirected: false, headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
    body: { getReader: () => ({ read: async () => consumed ? { done: true } : (consumed = true, { done: false, value: new TextEncoder().encode(JSON.stringify(value)) }), cancel: async () => {}, releaseLock: () => {} }) } };
}
test('accepts both creation and replay statuses for an Oath confirmation', async () => {
  const transport = jest.fn().mockResolvedValueOnce(response(201, { saved: true })).mockResolvedValueOnce(response(200, { saved: true }));
  const request = createBoundedRequest({ baseUrl: 'https://api.example.test', transport });
  for (let i = 0; i < 2; i++) await expect(request('/api/oaths', 'POST', [200, 201], (value): value is { saved: true } => !!value && typeof value === 'object' && 'saved' in value)).resolves.toEqual({ kind: 'success', value: { saved: true } });
});

import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { isOathEnvelope, isOathListEnvelope } from './oathSchema';
const characterId = '30000000-0000-4000-8000-00000000000c';
const submissionId = '4a0b0c0d-0000-4000-8000-00000000000f';
function pendingProof() {
  const snapshot = JSON.parse(JSON.stringify(catalog));
  snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  const proof: Record<string, unknown> | null = { submissionId, mode: 'photo', revision: 1, receivedAt: '2026-10-24T18:14:00Z', assessment: 'queued' };
  const oath: Record<string, unknown> = { id: '20000000-0000-4000-8000-000000000001', characterId, state: 'proof_pending', snapshot, createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null, proof };
  return { oath, serverTime: '2026-10-24T18:14:05Z' };
}
async function read(guard: (value: unknown) => boolean, value: unknown) {
  const request = createBoundedRequest({ baseUrl: 'https://api.example.test', transport: jest.fn().mockResolvedValueOnce(response(200, value)) });
  return request('/api/oaths/x', 'GET', [200], guard as (value: unknown) => value is unknown);
}
test('accepts Oath detail with queued proof metadata and with no proof', async () => {
  const pending = pendingProof();
  await expect(read(isOathEnvelope, pending)).resolves.toEqual({ kind: 'success', value: pending });
  const recordProof = pendingProof(); (recordProof.oath.proof as Record<string, unknown>).mode = 'activity_record'; (recordProof.oath.proof as Record<string, unknown>).revision = 2;
  await expect(read(isOathEnvelope, recordProof)).resolves.toEqual({ kind: 'success', value: recordProof });
  const none = pendingProof(); none.oath.state = 'active'; none.oath.proof = null;
  await expect(read(isOathEnvelope, none)).resolves.toEqual({ kind: 'success', value: none });
});
test.each([
  ['missing proof', (oath: Record<string, any>) => { delete oath.proof; }],
  ['extra proof key', (oath: Record<string, any>) => { oath.proof.url = 'https://cdn.example.test/proof.jpg'; }],
  ['missing proof key', (oath: Record<string, any>) => { delete oath.proof.assessment; }],
  ['unknown mode', (oath: Record<string, any>) => { oath.proof.mode = 'video'; }],
  ['fractional receivedAt', (oath: Record<string, any>) => { oath.proof.receivedAt = '2026-10-24T18:14:00.000Z'; }],
  ['offset receivedAt', (oath: Record<string, any>) => { oath.proof.receivedAt = '2026-10-24T20:14:00+02:00'; }],
  ['impossible receivedAt', (oath: Record<string, any>) => { oath.proof.receivedAt = '2026-02-30T18:14:00Z'; }],
  ['zero revision', (oath: Record<string, any>) => { oath.proof.revision = 0; }],
  ['fractional revision', (oath: Record<string, any>) => { oath.proof.revision = 1.5; }],
  ['text revision', (oath: Record<string, any>) => { oath.proof.revision = '1'; }],
  ['uppercase submissionId', (oath: Record<string, any>) => { oath.proof.submissionId = submissionId.toUpperCase(); }],
  ['non-UUID submissionId', (oath: Record<string, any>) => { oath.proof.submissionId = 'proof-1'; }],
  ['unknown assessment', (oath: Record<string, any>) => { oath.proof.assessment = 'passed'; }],
  ['array proof', (oath: Record<string, any>) => { oath.proof = []; }],
])('rejects an Oath envelope with %s', async (_label, mutate) => {
  const value = pendingProof(); mutate(value.oath);
  await expect(read(isOathEnvelope, value)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});
test('list envelopes require proof on every item', async () => {
  const { oath, serverTime } = pendingProof();
  const list = { items: [oath], nextCursor: null, total: 1, serverTime, paused: false, characterId };
  await expect(read(isOathListEnvelope, list)).resolves.toEqual({ kind: 'success', value: list });
  delete oath.proof;
  await expect(read(isOathListEnvelope, list)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});
