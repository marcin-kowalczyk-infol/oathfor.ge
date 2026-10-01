import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import type { Oath } from '../api/oathSchema';
import type { ProofControllerState } from '../proof/proofController';
import { deviceProof, deviceProofError, heldByServer } from './deviceProof';

const A = '20000000-0000-4000-8000-000000000001';
const B = '20000000-0000-4000-8000-000000000002';
const submissionId = '40000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-000000000001';
function oath(patch: Partial<Oath> = {}): Oath {
  const snapshot = JSON.parse(JSON.stringify(catalog));
  return { id: A, characterId, snapshot, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null, proof: null, ...patch };
}
const record = (oathId = A) => ({ version: 1 as const, accountId: 'account', characterId, oathId, submissionId, mode: 'photo' as const, fileName: 'proof.jpg' });
const ready = (patch: Partial<Extract<ProofControllerState, { kind: 'ready' }>> = {}): ProofControllerState => ({ kind: 'ready', busy: false, pending: record(), oath: null, ...patch });
const received = { submissionId, mode: 'photo' as const, revision: 1, receivedAt: '2026-10-24T10:00:00Z', assessment: 'queued' as const };

test('a record for the Oath waits, and a running send or delete says so', () => {
  expect(deviceProof(oath(), ready(), null)).toBe('waiting');
  expect(deviceProof(oath(), ready({ busy: true }), null)).toBe('sending');
  expect(deviceProof(oath(), ready({ busy: true, deleting: true }), null)).toBe('deleting');
});

test('a submission the server already holds is nothing on the device', () => {
  const held = oath({ state: 'proof_pending', proof: received });
  expect(heldByServer(held, ready())).toBe(true);
  expect(deviceProof(held, ready(), null)).toBe('none');
});

test('a final refusal belongs to its own Oath only', () => {
  const state = ready({ pending: null, lastRefusal: { oathId: A, submissionId, code: 'receipt_cutoff_passed' } });
  expect(deviceProof(oath(), state, null)).toBe('refused');
  expect(deviceProofError(oath(), state, null)).toEqual({ kind: 'proof_refused', code: 'receipt_cutoff_passed' });
  expect(deviceProof(oath({ id: B }), state, null)).toBe('none');
});

test('a record for another Oath, or no ready controller, is nothing for this one', () => {
  expect(deviceProof(oath(), ready({ pending: record(B) }), null)).toBe('none');
  expect(deviceProof(oath(), { kind: 'loading' }, null)).toBe('none');
});

test('an error after the player acted on this Oath fails it, an older error does not', () => {
  const missing = { kind: 'file_missing' as const };
  expect(deviceProof(oath(), ready({ pending: null, error: missing }), { oathId: A })).toBe('failed');
  expect(deviceProofError(oath(), ready({ pending: null, error: missing }), { oathId: A })).toBe(missing);
  expect(deviceProof(oath(), ready({ pending: null, error: missing }), { oathId: A, before: missing })).toBe('none');
  expect(deviceProof(oath({ id: B }), ready({ pending: null, error: missing }), { oathId: A })).toBe('none');
});

test('a kept record still waits when its resend failed, so the resend stays offered', () => {
  const offline = { kind: 'unavailable' as const, retry: 'request' as const };
  expect(deviceProof(oath(), ready({ error: offline }), { oathId: A })).toBe('waiting');
  expect(deviceProofError(oath(), ready({ error: offline }), { oathId: A })).toBe(offline);
});

test('a kept record outranks an earlier refusal of the same Oath, and the refusal is still the message', () => {
  const state = ready({ lastRefusal: { oathId: A, submissionId, code: 'receipt_cutoff_passed' } });
  expect(deviceProof(oath(), state, null)).toBe('waiting');
  expect(deviceProofError(oath(), state, null)).toEqual({ kind: 'proof_refused', code: 'receipt_cutoff_passed' });
});
