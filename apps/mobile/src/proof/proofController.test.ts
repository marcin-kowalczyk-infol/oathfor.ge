import type { File } from 'expo-file-system';
import { createProofController } from './proofController';
import type { SessionController, SessionState } from '../auth/session';
import type { ProofClient, ProofResult, ProofSubmission } from './proofClient';
import type { PendingProof, ProofPendingStorage } from './proofPendingStorage';
import type { ProofFiles } from './proofFiles';

const accountId = '10000000-0000-4000-8000-000000000001';
const otherAccount = '10000000-0000-4000-8000-000000000002';
const characterId = '30000000-0000-4000-8000-00000000000a';
const otherCharacter = '30000000-0000-4000-8000-00000000000b';
const oathId = '20000000-0000-4000-8000-000000000001';
const submissionId = '4a0b0c0d-0000-4000-8000-00000000000f';
const secondId = '4a0b0c0d-0000-4000-8000-0000000000a0';
const source = 'file:///cache/ImageManipulator/normalized.jpg';
const receivedAt = '2026-10-24T18:14:00Z';
const key = (account = accountId, character = characterId) => `${account}.${character}`;
const record = (id = submissionId): PendingProof => ({ version: 1, accountId, characterId, oathId, submissionId: id, mode: 'photo', fileName: `${id}.jpg` });
const oath = (state = 'proof_pending', owner = characterId) => ({ id: oathId, characterId: owner, state, proof: { submissionId, mode: 'photo', revision: 1, receivedAt, assessment: 'queued' } });
const receipt = (created: boolean, owner = characterId) => ({ kind: 'success', value: { created, proof: { submissionId, mode: 'photo', revision: 1, receivedAt, assessment: 'queued' }, oath: oath('proof_pending', owner), serverTime: '2026-10-24T18:20:00Z' } }) as unknown as ProofResult;

function setup() {
  let state: SessionState = { kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' };
  let token = 'A'.repeat(43);
  const listeners = new Set<() => void>();
  const session = { getState: () => state, getToken: () => state.kind === 'authenticated' ? token : undefined,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, reauthenticate: jest.fn() } as unknown as SessionController;
  const saved = new Map<string, PendingProof | null>();
  const storage: ProofPendingStorage = {
    read: jest.fn(async (account: string, character: string) => ({ kind: 'success' as const, value: saved.get(key(account, character)) ?? null })),
    write: jest.fn(async (account: string, character: string, value: PendingProof | null) => { saved.set(key(account, character), value); return { kind: 'success' as const }; }),
  };
  // Bytes stand in for the image. A copy keeps them under the owner's folder and the submission's file name.
  const disk = new Map<string, string>([[source, 'JPEG-BYTES-1']]);
  const all = new Map<string, string>();
  const path = (owner: { accountId: string; characterId: string }, name: string) => `${owner.accountId}/${owner.characterId}/${name}`;
  const ownFolder = path({ accountId, characterId }, '');
  // The default owner's copies, keyed by file name.
  const documents = { get: (name: string) => all.get(ownFolder + name), get size() { return [...all.keys()].filter(uri => uri.startsWith(ownFolder)).length; } };
  const files: ProofFiles = {
    copy: jest.fn(async (owner, from: string, name: string) => { const bytes = disk.get(from); if (bytes === undefined) return { kind: 'unavailable' as const }; all.set(path(owner, name), bytes); return { kind: 'success' as const }; }),
    open: jest.fn(async (owner, name: string) => all.has(path(owner, name)) ? { kind: 'success' as const, file: { uri: `file:///cache/proofs/${path(owner, name)}` } as unknown as File } : { kind: 'missing' as const }),
    remove: jest.fn(async (owner, name: string) => { all.delete(path(owner, name)); return { kind: 'success' as const }; }),
    sweep: jest.fn(async (owner, keep: string | null) => {
      for (const uri of [...all.keys()]) if (uri.startsWith(path(owner, '')) && uri !== path(owner, keep ?? '')) all.delete(uri);
      return { kind: 'success' as const };
    }),
  };
  const sent: { token: string; oathId: string; submissionId: string; mode: string; bytes: string | undefined }[] = [];
  const api = { submit: jest.fn(async (sentToken: string, id: string, submission: ProofSubmission) => {
    sent.push({ token: sentToken, oathId: id, submissionId: submission.submissionId, mode: submission.mode, bytes: all.get(submission.file.uri.replace('file:///cache/proofs/', '')) });
    return { kind: 'unavailable', retry: 'request' } as ProofResult;
  }) } as unknown as ProofClient & { submit: jest.Mock };
  const ids = [submissionId, secondId];
  const createId = jest.fn(() => ids.shift());
  const onCharacterRequired = jest.fn(); const onCharacterChanged = jest.fn();
  return { session, api, storage, files, saved, documents, all, path, disk, sent, createId, onCharacterRequired, onCharacterChanged,
    create: (character = characterId, account = accountId) => {
      const c = createProofController({ session, api, storage, files, createId, onCharacterRequired, onCharacterChanged });
      c.setCharacter({ accountId: account, characterId: character }); return c;
    },
    change(next: SessionState, nextToken = token) { state = next; token = nextToken; listeners.forEach(fn => fn()); } };
}
const flush = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const order = (mock: unknown) => (mock as jest.Mock).mock.invocationCallOrder[0];

test('copies the image and writes the record before the first send', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  f.api.submit.mockImplementationOnce(async () => {
    expect(f.saved.get(key())).toEqual(record());
    expect(f.documents.get(`${submissionId}.jpg`)).toBe('JPEG-BYTES-1');
    return { kind: 'unavailable', retry: 'request' };
  });
  await c.submit({ oathId, mode: 'photo', source });
  expect(order(f.files.copy)).toBeLessThan(order(f.storage.write));
  expect(order(f.storage.write)).toBeLessThan(order(f.api.submit));
  expect(f.files.copy).toHaveBeenCalledWith({ accountId, characterId }, source, `${submissionId}.jpg`);
  expect(f.api.submit).toHaveBeenCalledTimes(1);
  expect(c.getState()).toMatchObject({ kind: 'ready', busy: false, pending: record(), error: { kind: 'unavailable' } });
});

test('a storage write failure sends nothing and removes the fresh copy', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.storage.write).mockResolvedValueOnce({ kind: 'unavailable' });
  await c.submit({ oathId, mode: 'photo', source });
  expect(f.api.submit).not.toHaveBeenCalled();
  expect(f.files.remove).toHaveBeenCalledWith({ accountId, characterId }, `${submissionId}.jpg`); expect(f.documents.size).toBe(0);
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: null, error: { kind: 'storage' } });
});

test('a copy failure sends nothing and writes no record', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.submit({ oathId, mode: 'photo', source: 'file:///cache/missing.jpg' });
  expect(f.api.submit).not.toHaveBeenCalled(); expect(f.storage.write).not.toHaveBeenCalled();
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: null, error: { kind: 'storage' } });
});

test('a timed out send resends the same submissionId and the same bytes after restart', async () => {
  const f = setup(); const first = f.create(); first.start(); await flush();
  await first.submit({ oathId, mode: 'photo', source });
  first.dispose();
  // The original temporary image is gone, only the document copy survives.
  f.disk.clear();
  const restarted = f.create(); restarted.start(); await flush();
  expect(restarted.getState()).toMatchObject({ kind: 'ready', pending: record() });
  await restarted.recover();
  expect(f.sent).toEqual(Array(2).fill({ token: 'A'.repeat(43), oathId, submissionId, mode: 'photo', bytes: 'JPEG-BYTES-1' }));
  expect(f.createId).toHaveBeenCalledTimes(1); expect(f.files.copy).toHaveBeenCalledTimes(1);
});

test('a 200 replay with the original receivedAt deletes the record and file and updates the Oath', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.submit({ oathId, mode: 'photo', source });
  f.api.submit.mockResolvedValueOnce(receipt(false));
  await c.recover();
  expect(f.saved.get(key())).toBeNull(); expect(f.documents.size).toBe(0);
  expect(order(f.files.remove)).toBeGreaterThan(jest.mocked(f.storage.write).mock.invocationCallOrder[1]);
  expect(c.getState()).toEqual({ kind: 'ready', busy: false, pending: null, oath: oath() });
  expect((c.getState() as { oath: { proof: { receivedAt: string } } }).oath.proof.receivedAt).toBe(receivedAt);
});

test('a 201 clears both on the first send', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  f.api.submit.mockResolvedValueOnce(receipt(true));
  await c.submit({ oathId, mode: 'photo', source });
  expect(f.saved.get(key())).toBeNull(); expect(f.documents.size).toBe(0);
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: null, oath: { id: oathId, state: 'proof_pending' } });
});

test.each([
  [{ kind: 'proof_refused', code: 'receipt_cutoff_passed' }],
  [{ kind: 'proof_refused', code: 'oath_not_active', state: 'withdrawn' }],
  [{ kind: 'proof_refused', code: 'proof_already_submitted' }],
  [{ kind: 'proof_refused', code: 'idempotency_conflict' }],
  [{ kind: 'proof_refused', code: 'unreadable_image', field: 'image' }],
  [{ kind: 'proof_refused', code: 'request_too_large' }],
])('final refusal %j deletes the record and file and exposes the reason', async refusal => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  f.api.submit.mockResolvedValueOnce(refusal as ProofResult);
  await c.submit({ oathId, mode: 'photo', source });
  expect(f.saved.get(key())).toBeNull(); expect(f.documents.size).toBe(0);
  // A refusal of the player's own send stays with the Oath only when it closes the Oath to proof. The proof screen showed the rest.
  const { code, state } = refusal as { code: string; state?: string };
  const closing = ['receipt_cutoff_passed', 'oath_not_active', 'proof_already_submitted'].includes(code);
  expect(c.getState()).toEqual({ kind: 'ready', busy: false, pending: null, oath: null, error: refusal, ...(closing ? { lastRefusal: { oathId, submissionId, code, ...(state ? { state } : {}) } } : {}) });
  await c.recover(); expect(f.api.submit).toHaveBeenCalledTimes(1);
});

test.each([
  [{ kind: 'unavailable', retry: 'request' }],
  [{ kind: 'rate_limited', retry: 'request', retryAfterSeconds: 30 }],
  [{ kind: 'cancelled' }],
  [{ kind: 'configuration' }],
  [{ kind: 'proof_error', code: 'character_required' }],
  [{ kind: 'reauthenticate' }],
  [{ kind: 'invalid_request' }],
  [{ kind: 'proof_error', code: 'not_found' }],
  [{ kind: 'upload_rejected', code: 'invalid_request' }],
  [{ kind: 'upload_rejected', code: 'image_required' }],
])('retryable failure %j keeps the record and file', async failure => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  f.api.submit.mockResolvedValueOnce(failure as ProofResult);
  await c.submit({ oathId, mode: 'photo', source });
  expect(f.saved.get(key())).toEqual(record()); expect(f.documents.get(`${submissionId}.jpg`)).toBe('JPEG-BYTES-1');
  expect(f.files.remove).not.toHaveBeenCalled();
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: record(), error: failure });
  expect(f.session.reauthenticate).toHaveBeenCalledTimes(failure.kind === 'reauthenticate' ? 1 : 0);
  const code = (failure as { code?: string }).code;
  expect(f.onCharacterRequired).toHaveBeenCalledTimes(code === 'character_required' ? 1 : 0);
  expect(f.onCharacterChanged).toHaveBeenCalledTimes(failure.kind === 'proof_error' && code === 'not_found' ? 1 : 0);
});

test('a failed record clear after success keeps the file for a later replay', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  f.api.submit.mockResolvedValueOnce(receipt(true));
  jest.mocked(f.storage.write).mockImplementation(async (account, character, value) => {
    if (value === null) return { kind: 'unavailable' };
    f.saved.set(key(account, character), value); return { kind: 'success' };
  });
  await c.submit({ oathId, mode: 'photo', source });
  expect(f.saved.get(key())).toEqual(record()); expect(f.files.remove).not.toHaveBeenCalled();
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: record(), error: { kind: 'storage' } });
});

test('a pending proof blocks another submission and rapid presses send once', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const network = deferred<ProofResult>(); f.api.submit.mockReturnValueOnce(network.promise);
  const first = c.submit({ oathId, mode: 'photo', source }); await flush();
  await c.submit({ oathId, mode: 'photo', source }); await c.recover();
  expect(f.api.submit).toHaveBeenCalledTimes(1);
  network.resolve({ kind: 'unavailable', retry: 'request' }); await first;
  await c.submit({ oathId, mode: 'activity_record', source });
  expect(f.createId).toHaveBeenCalledTimes(1); expect(f.api.submit).toHaveBeenCalledTimes(1);
});

test('a recorded proof whose file is gone is cleared without a request', async () => {
  const f = setup(); f.saved.set(key(), record());
  const c = f.create(); c.start(); await flush();
  await c.recover();
  expect(f.api.submit).not.toHaveBeenCalled(); expect(f.saved.get(key())).toBeNull();
  expect(c.getState()).toEqual({ kind: 'ready', busy: false, pending: null, oath: null, error: { kind: 'file_missing' } });
});

test('unreadable durable data blocks submission without overwriting it', async () => {
  const f = setup(); jest.mocked(f.storage.read).mockResolvedValueOnce({ kind: 'invalid' });
  const c = f.create(); c.start(); await flush();
  await c.submit({ oathId, mode: 'photo', source });
  expect(c.getState()).toEqual({ kind: 'storage_unavailable' });
  expect(f.files.copy).not.toHaveBeenCalled(); expect(f.storage.write).not.toHaveBeenCalled();
});

test('invalid input copies nothing and sends nothing', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.submit({ oathId: 'not-an-oath', mode: 'photo', source });
  await c.submit({ oathId, mode: 'video' as 'photo', source });
  expect(f.files.copy).not.toHaveBeenCalled(); expect(f.api.submit).not.toHaveBeenCalled();
});

test.each(['account', 'character'] as const)('a late success after the %s changed is ignored', async change => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const network = deferred<ProofResult>(); f.api.submit.mockReturnValueOnce(network.promise);
  const sending = c.submit({ oathId, mode: 'photo', source }); await flush();
  const signal = f.api.submit.mock.calls[0][3] as AbortSignal;
  if (change === 'account') {
    f.change({ kind: 'authenticated', account: { id: otherAccount, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }, 'B'.repeat(43));
    c.setCharacter({ accountId: otherAccount, characterId });
  } else c.setCharacter({ accountId, characterId: otherCharacter });
  await flush();
  expect(signal.aborted).toBe(true);
  network.resolve(receipt(true)); await sending; await flush();
  expect(f.saved.get(key())).toEqual(record()); expect(f.documents.get(`${submissionId}.jpg`)).toBe('JPEG-BYTES-1');
  expect(f.files.remove).not.toHaveBeenCalled();
  expect(c.getState()).toEqual({ kind: 'ready', busy: false, pending: null, oath: null });
});

test('a late success after sign-out cannot clear the durable record', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const network = deferred<ProofResult>(); f.api.submit.mockReturnValueOnce(network.promise);
  const sending = c.submit({ oathId, mode: 'photo', source }); await flush();
  f.change({ kind: 'signed_out' });
  network.resolve(receipt(true)); await sending;
  expect(c.getState()).toEqual({ kind: 'idle' });
  expect(f.saved.get(key())).toEqual(record()); expect(f.files.remove).not.toHaveBeenCalled();
});

test('an account change during the copy leaves no record and sends nothing', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const copying = deferred<{ kind: 'success' }>();
  jest.mocked(f.files.copy).mockImplementationOnce(async (owner, _from, name) => { await copying.promise; f.all.set(f.path(owner, name), 'JPEG-BYTES-1'); return { kind: 'success' }; });
  const sending = c.submit({ oathId, mode: 'photo', source }); await flush();
  f.change({ kind: 'authenticated', account: { id: otherAccount, onboardingStatus: 'complete' }, expiresAt: '2027-01-01T00:00:00Z' }, 'B'.repeat(43));
  c.setCharacter({ accountId: otherAccount, characterId });
  copying.resolve({ kind: 'success' }); await sending; await flush();
  expect(f.storage.write).not.toHaveBeenCalled(); expect(f.api.submit).not.toHaveBeenCalled();
  expect(f.documents.size).toBe(0);
});

test('a success for an Oath of another character clears both but is not shown', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  f.api.submit.mockResolvedValueOnce(receipt(true, otherCharacter));
  await c.submit({ oathId, mode: 'photo', source });
  expect(f.saved.get(key())).toBeNull(); expect(f.documents.size).toBe(0);
  expect(f.onCharacterChanged).toHaveBeenCalledTimes(1);
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: null, oath: null });
});

test('an image above the API limit is refused locally without a record or a request', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  jest.mocked(f.files.copy).mockResolvedValueOnce({ kind: 'too_large' });
  await c.submit({ oathId, mode: 'photo', source });
  expect(f.storage.write).not.toHaveBeenCalled(); expect(f.api.submit).not.toHaveBeenCalled();
  expect(c.getState()).toEqual({ kind: 'ready', busy: false, pending: null, oath: null, error: { kind: 'too_large' } });
});

test('a record saved while the character changed keeps its file for a later recovery', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const writing = deferred<void>();
  jest.mocked(f.storage.write).mockImplementationOnce(async (account, character, value) => { await writing.promise; f.saved.set(key(account, character), value); return { kind: 'success' as const }; });
  const sending = c.submit({ oathId, mode: 'photo', source }); await flush();
  c.setCharacter({ accountId, characterId: otherCharacter }); await flush();
  writing.resolve(); await sending; await flush();
  expect(f.api.submit).not.toHaveBeenCalled();
  expect(f.saved.get(key())).toEqual(record()); expect(f.documents.get(`${submissionId}.jpg`)).toBe('JPEG-BYTES-1');
  c.setCharacter({ accountId, characterId }); await flush();
  await c.recover();
  expect(f.sent).toEqual([{ token: 'A'.repeat(43), oathId, submissionId, mode: 'photo', bytes: 'JPEG-BYTES-1' }]);
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: record(), error: { kind: 'unavailable' } });
});

test('a record cleared while the character changed still removes its file', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.submit({ oathId, mode: 'photo', source });
  f.api.submit.mockResolvedValueOnce(receipt(true));
  const clearing = deferred<void>();
  jest.mocked(f.storage.write).mockImplementationOnce(async (account, character, value) => { await clearing.promise; f.saved.set(key(account, character), value); return { kind: 'success' as const }; });
  const recovering = c.recover(); await flush();
  c.setCharacter({ accountId, characterId: otherCharacter }); await flush();
  clearing.resolve(); await recovering; await flush();
  expect(f.saved.get(key())).toBeNull(); expect(f.documents.size).toBe(0);
});

test('loading a binding sweeps copies its record does not name and leaves other characters alone', async () => {
  const f = setup(); f.saved.set(key(), record());
  const own = { accountId, characterId }; const other = { accountId, characterId: otherCharacter };
  f.all.set(f.path(own, `${submissionId}.jpg`), 'JPEG-BYTES-1');
  f.all.set(f.path(own, `${secondId}.jpg`), 'ORPHAN');
  f.all.set(f.path(other, `${secondId}.jpg`), 'OTHER-CHARACTER');
  const c = f.create(); c.start(); await flush();
  expect(f.files.sweep).toHaveBeenCalledWith(own, `${submissionId}.jpg`);
  expect(order(f.storage.read)).toBeLessThan(order(f.files.sweep));
  expect([...f.all.keys()].sort()).toEqual([f.path(own, `${submissionId}.jpg`), f.path(other, `${secondId}.jpg`)].sort());
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: record() });
});

test('loading a binding without a record sweeps all of its copies', async () => {
  const f = setup();
  f.all.set(f.path({ accountId, characterId }, `${secondId}.jpg`), 'ORPHAN');
  const c = f.create(); c.start(); await flush();
  expect(f.files.sweep).toHaveBeenCalledWith({ accountId, characterId }, null);
  expect(f.documents.size).toBe(0);
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: null });
});

test('unreadable records are never swept', async () => {
  const f = setup(); jest.mocked(f.storage.read).mockResolvedValueOnce({ kind: 'unavailable' });
  const c = f.create(); c.start(); await flush();
  expect(f.files.sweep).not.toHaveBeenCalled(); expect(c.getState()).toEqual({ kind: 'storage_unavailable' });
});

test('discard clears the record and the file of the current binding', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  f.api.submit.mockResolvedValueOnce({ kind: 'upload_rejected', code: 'image_required' } as ProofResult);
  await c.submit({ oathId, mode: 'photo', source });
  await c.discard();
  expect(f.saved.get(key())).toBeNull(); expect(f.documents.size).toBe(0);
  expect(c.getState()).toEqual({ kind: 'ready', busy: false, pending: null, oath: null });
  await c.recover(); expect(f.api.submit).toHaveBeenCalledTimes(1);
});

test('discard keeps both when the record cannot be cleared and does nothing while sending', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  const network = deferred<ProofResult>(); f.api.submit.mockReturnValueOnce(network.promise);
  const sending = c.submit({ oathId, mode: 'photo', source }); await flush();
  await c.discard();
  expect(f.saved.get(key())).toEqual(record());
  network.resolve({ kind: 'unavailable', retry: 'request' }); await sending;
  jest.mocked(f.storage.write).mockResolvedValueOnce({ kind: 'unavailable' });
  await c.discard();
  expect(f.saved.get(key())).toEqual(record()); expect(f.documents.get(`${submissionId}.jpg`)).toBe('JPEG-BYTES-1');
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: record(), error: { kind: 'storage' } });
});

test('a recovered record refused for good keeps its Oath and reason for this binding until dismissed or the next send', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.submit({ oathId, mode: 'photo', source });
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: record() });
  f.api.submit.mockResolvedValueOnce({ kind: 'proof_refused', code: 'receipt_cutoff_passed' } as ProofResult);
  await c.recover();
  expect(f.saved.get(key())).toBeNull();
  expect(c.getState()).toMatchObject({ kind: 'ready', pending: null, lastRefusal: { oathId, submissionId, code: 'receipt_cutoff_passed' } });
  c.dismissRefusal();
  expect(c.getState()).not.toHaveProperty('lastRefusal');
  f.api.submit.mockResolvedValueOnce({ kind: 'proof_refused', code: 'oath_not_active', state: 'review_pending' } as ProofResult);
  await c.submit({ oathId, mode: 'photo', source });
  expect(c.getState()).toMatchObject({ lastRefusal: { oathId, submissionId: secondId, code: 'oath_not_active', state: 'review_pending' } });
  // A new send starts without it, and another character never sees it.
  const network = deferred<ProofResult>(); f.api.submit.mockReturnValueOnce(network.promise);
  f.disk.set(source, 'JPEG-BYTES-2'); f.createId.mockReturnValueOnce('4a0b0c0d-0000-4000-8000-0000000000a1');
  const sending = c.submit({ oathId, mode: 'photo', source }); await flush();
  expect(c.getState()).not.toHaveProperty('lastRefusal');
  network.resolve({ kind: 'proof_refused', code: 'receipt_cutoff_passed' } as ProofResult); await sending;
  expect(c.getState()).toHaveProperty('lastRefusal');
  c.setCharacter({ accountId, characterId: otherCharacter }); await flush();
  expect(c.getState()).not.toHaveProperty('lastRefusal');
});

test('discard reports deleting while it clears, never a send', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.submit({ oathId, mode: 'photo', source });
  const write = deferred<{ kind: 'success' }>(); jest.mocked(f.storage.write).mockReturnValueOnce(write.promise);
  const discarding = c.discard(); await flush();
  expect(c.getState()).toMatchObject({ kind: 'ready', busy: true, deleting: true });
  write.resolve({ kind: 'success' }); await discarding;
  expect(c.getState()).toEqual({ kind: 'ready', busy: false, pending: null, oath: null });
});

test('an image refusal of a resend is kept with its Oath, because the player may not have seen it', async () => {
  const f = setup(); const c = f.create(); c.start(); await flush();
  await c.submit({ oathId, mode: 'photo', source });
  f.api.submit.mockResolvedValueOnce({ kind: 'proof_refused', code: 'unreadable_image', field: 'image' } as ProofResult);
  await c.recover();
  expect(c.getState()).toMatchObject({ pending: null, lastRefusal: { oathId, submissionId, code: 'unreadable_image' } });
});
