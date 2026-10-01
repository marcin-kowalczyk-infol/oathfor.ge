import type { SessionController } from '../auth/session';
import type { Oath } from '../api/oathSchema';
import { isUuid } from '../api/oathSchema';
import { createRequestId } from '../characters/requestId';
import type { ProofClient, ProofMode, ProofRefusal, ProofResult } from './proofClient';
import type { ProofFiles } from './proofFiles';
import { isPendingProof, proofFileName, type PendingProof, type ProofPendingStorage } from './proofPendingStorage';

type Failure = Exclude<ProofResult, { kind: 'success' }>;
/**
 * `storage`: the copy or record could not be saved or cleared. `file_missing`: a recorded copy is gone (for example purged from the cache),
 * so a new picture is needed. `too_large`: the image is above the API limit and nothing was copied or sent.
 */
export type ProofControllerError = Failure | { kind: 'storage' } | { kind: 'file_missing' } | { kind: 'too_large' };
/**
 * The final refusal of a recorded proof, kept with its Oath after the record is cleared, so the reason can still be shown,
 * also after an automatic resend on load. It belongs to this binding and goes with the next send or `dismissRefusal()`.
 */
export type ProofLastRefusal = { oathId: string; submissionId: string; code: ProofRefusal['code']; state?: ProofRefusal['state'] };
/** `deleting`: the busy step is a discard, not a send. */
export type ProofControllerState = { kind: 'idle' | 'loading' | 'storage_unavailable' }
  | { kind: 'ready'; busy: boolean; pending: PendingProof | null; oath: Oath | null; error?: ProofControllerError; lastRefusal?: ProofLastRefusal; deleting?: true };
export type ProofCharacter = { accountId: string; characterId: string };
/** `source` is the normalized JPEG without EXIF that the capture step produced. */
export type ProofInput = { oathId: string; mode: ProofMode; source: string };

// Server answers that the same request can never change. Everything else keeps both for a retry,
// including a local `invalid_request`, which never reached the server and must not destroy the only copy.
const isFinal = (result: Failure) => result.kind === 'proof_refused';
// Refusals that close the Oath to proof. Other refusals of the player's own send were shown on the proof screen already.
const closingCodes = new Set(['receipt_cutoff_passed', 'oath_not_active', 'proof_already_submitted']);

export function createProofController(options: { session: SessionController; api: ProofClient; storage: ProofPendingStorage; files: ProofFiles;
  createId?: () => string | undefined; onCharacterRequired?: () => void; onCharacterChanged?: () => void }) {
  const createId = options.createId ?? createRequestId;
  let state: ProofControllerState = { kind: 'idle' };
  let character: ProofCharacter | null = null;
  let binding: { accountId: string; characterId: string; token: string } | undefined;
  let generation = 0;
  let unsubscribe: (() => void) | undefined;
  let disposed = false;
  let storageQueue: Promise<unknown> = Promise.resolve();
  let pending: PendingProof | null = null;
  let oath: Oath | null = null;
  let refusal: ProofLastRefusal | null = null;
  let deleting = false;
  const listeners = new Set<() => void>();
  const requests = new Set<AbortController>();
  const current = (epoch: number) => !disposed && epoch === generation && binding !== undefined && options.session.getToken() === binding.token;
  function publish(next: ProofControllerState) { if (!disposed) { state = next; listeners.forEach(fn => fn()); } }
  function ready(busy = false, error?: ProofControllerError) {
    publish({ kind: 'ready', busy, pending, oath, ...(error ? { error } : {}), ...(refusal ? { lastRefusal: refusal } : {}), ...(busy && deleting ? { deleting: true as const } : {}) });
  }
  function invalidate() { generation++; requests.forEach(request => request.abort()); requests.clear(); }
  // Record and file changes for one controller run in order, so a clear never overtakes the write it follows.
  function storageCall<T>(action: () => Promise<T>): Promise<T> {
    const result = storageQueue.then(action); storageQueue = result.catch(() => {}); return result;
  }
  /**
   * `saved` also when the binding changed while the write ran: the record is durable, so its file must stay (or, for a clear, go).
   * `skipped` means nothing was written. Callers check `current` separately before touching visible state.
   */
  async function persist(value: PendingProof | null, epoch: number): Promise<'saved' | 'skipped' | 'failed'> {
    if (!current(epoch)) return 'skipped';
    const { accountId, characterId } = binding!;
    return storageCall(async () => {
      if (!current(epoch)) return 'skipped' as const;
      try { return (await options.storage.write(accountId, characterId, value)).kind === 'success' ? 'saved' as const : 'failed' as const; } catch { return 'failed' as const; }
    });
  }
  // Removal is best effort. A leftover copy is never sent, because only a record names a file to send, and the next load sweeps it.
  const removeFile = (record: PendingProof) => storageCall(async () => {
    try { await options.files.remove({ accountId: record.accountId, characterId: record.characterId }, record.fileName); } catch { /* Best effort only. */ }
  });
  async function hydrate(epoch: number) {
    if (!current(epoch)) return;
    const { accountId, characterId } = binding!;
    let stored: Awaited<ReturnType<ProofPendingStorage['read']>>;
    // Reading and sweeping in one queued step: no copy or record change of this controller runs in between.
    try {
      stored = await storageCall(async () => {
        const read = await options.storage.read(accountId, characterId);
        // Copies without a record (a crash between copy and record, a failed removal) are raw proof nobody can send.
        if (read.kind === 'success' && (read.value === null || isPendingProof(read.value, accountId, characterId))) {
          try { await options.files.sweep({ accountId, characterId }, read.value?.fileName ?? null); } catch { /* Retried on the next load. */ }
        }
        return read;
      });
    } catch { stored = { kind: 'unavailable' }; }
    if (!current(epoch)) return;
    if (stored.kind !== 'success' || (stored.value !== null && !isPendingProof(stored.value, accountId, characterId))) { publish({ kind: 'storage_unavailable' }); return; }
    pending = stored.value; ready();
  }
  function onSession() {
    invalidate();
    const auth = options.session.getState(); const token = options.session.getToken();
    binding = undefined;
    // Hide the previous owner's proof while auth is unknown. The durable record survives for that owner.
    pending = null; oath = null; refusal = null; deleting = false;
    if (auth.kind === 'authenticated' && token && character?.accountId === auth.account.id) {
      binding = { accountId: auth.account.id, characterId: character.characterId, token };
      publish({ kind: 'loading' }); void hydrate(generation);
    } else publish({ kind: 'idle' });
  }
  /** Clears the record first. A failed clear keeps the file, so a later replay still sends the same bytes. */
  async function settle(epoch: number, record: PendingProof) {
    if (await persist(null, epoch) !== 'saved') return false;
    // Another binding's state is never touched, but the cleared record's file goes in every case.
    if (current(epoch)) pending = null;
    await removeFile(record);
    return current(epoch);
  }
  /** `resend`: a recovery of a recorded proof, whose answer the player may not see where it was sent. */
  async function send(epoch: number, resend: boolean): Promise<void> {
    if (!pending || !current(epoch)) return;
    const record = pending;
    let opened: Awaited<ReturnType<ProofFiles['open']>>;
    try { opened = await storageCall(() => options.files.open({ accountId: record.accountId, characterId: record.characterId }, record.fileName)); } catch { opened = { kind: 'unavailable' }; }
    if (!current(epoch)) return;
    if (opened.kind === 'missing') {
      // Without the same bytes the submission cannot be replayed. The player needs a new picture.
      const cleared = await persist(null, epoch);
      if (!current(epoch)) return;
      if (cleared !== 'saved') { ready(false, { kind: 'storage' }); return; }
      pending = null; ready(false, { kind: 'file_missing' }); return;
    }
    if (opened.kind !== 'success') { ready(false, { kind: 'storage' }); return; }
    const controller = new AbortController(); requests.add(controller);
    let result: ProofResult;
    try { result = await options.api.submit(binding!.token, record.oathId, { submissionId: record.submissionId, mode: record.mode, file: opened.file }, controller.signal); }
    catch { result = { kind: 'unavailable', retry: 'request' }; }
    finally { requests.delete(controller); }
    // A late answer for a previous account, character or session changes nothing here.
    if (!current(epoch)) return;
    if (result.kind === 'success') {
      const value = result.value;
      if (!await settle(epoch, record)) { if (current(epoch)) ready(false, { kind: 'storage' }); return; }
      // The receipt stands either way. Content for another character is not shown in this one.
      if (value.oath.characterId === binding!.characterId) oath = value.oath;
      else options.onCharacterChanged?.();
      ready(); return;
    }
    if (result.kind === 'reauthenticate') { await options.session.reauthenticate(); if (current(epoch)) ready(false, result); return; }
    if (result.kind === 'proof_error' && result.code === 'character_required') options.onCharacterRequired?.();
    // The server looks the Oath up through its active character. Nothing was committed, so the copy waits for that character.
    if (result.kind === 'proof_error' && result.code === 'not_found') options.onCharacterChanged?.();
    if (isFinal(result)) {
      if (!await settle(epoch, record)) { if (current(epoch)) ready(false, { kind: 'storage' }); return; }
      if (resend || closingCodes.has(result.code)) refusal = { oathId: record.oathId, submissionId: record.submissionId, code: result.code, ...(result.state ? { state: result.state } : {}) };
    }
    ready(false, result);
  }
  async function submit(input: ProofInput) {
    if (state.kind !== 'ready' || state.busy || pending) return;
    if (!input || !isUuid(input.oathId) || (input.mode !== 'photo' && input.mode !== 'activity_record') || typeof input.source !== 'string' || input.source.length === 0) return;
    const epoch = generation;
    const submissionId = createId();
    if (submissionId === undefined || !isUuid(submissionId)) { ready(false, { kind: 'storage' }); return; }
    const record: PendingProof = { version: 1, accountId: binding!.accountId, characterId: binding!.characterId, oathId: input.oathId, submissionId, mode: input.mode, fileName: proofFileName(submissionId) };
    oath = null; refusal = null; ready(true);
    // The copy and its record exist before the first byte is sent. Without both, nothing is sent.
    let copied: Awaited<ReturnType<ProofFiles['copy']>>;
    try { copied = await storageCall(() => options.files.copy({ accountId: record.accountId, characterId: record.characterId }, input.source, record.fileName)); } catch { copied = { kind: 'unavailable' }; }
    if (copied.kind !== 'success' || !current(epoch)) {
      if (copied.kind === 'success') await removeFile(record);
      if (current(epoch)) ready(false, copied.kind === 'too_large' ? { kind: 'too_large' } : { kind: 'storage' });
      return;
    }
    const saved = await persist(record, epoch);
    // Only an unsaved record frees its copy. A record saved during a rebind keeps it for that owner's recovery.
    if (saved !== 'saved') {
      await removeFile(record);
      if (current(epoch)) ready(false, { kind: 'storage' });
      return;
    }
    if (!current(epoch)) return;
    pending = record; ready(true); await send(epoch, false);
  }
  async function recover() {
    if (state.kind !== 'ready' || state.busy || !pending) return;
    refusal = null; ready(true); await send(generation, true);
  }
  /** The player gives up an unresolved proof of the current binding: its record and copy are cleared. */
  async function discard() {
    if (state.kind !== 'ready' || state.busy || !pending) return;
    const epoch = generation; const record = pending;
    deleting = true; ready(true);
    const cleared = await settle(epoch, record);
    if (!current(epoch)) return;
    deleting = false;
    ready(false, cleared ? undefined : { kind: 'storage' });
  }
  return {
    getState: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start() { if (!disposed && !unsubscribe) { unsubscribe = options.session.subscribe(onSession); onSession(); } },
    boundCharacter: (): ProofCharacter | null => character,
    /** Rebinds to another character: an in-flight send stops counting and that character's pending proof loads. */
    setCharacter(next: ProofCharacter | null) {
      if (next?.accountId === character?.accountId && next?.characterId === character?.characterId) return;
      character = next ? { ...next } : null;
      if (unsubscribe && !disposed) onSession();
    },
    stop() { invalidate(); unsubscribe?.(); unsubscribe = undefined; binding = undefined; pending = null; oath = null; refusal = null; deleting = false; publish({ kind: 'idle' }); },
    /** The player has read the reason of the last final refusal. */
    dismissRefusal() { if (refusal && state.kind === 'ready') { refusal = null; ready(state.busy, state.error); } },
    dispose() { invalidate(); unsubscribe?.(); unsubscribe = undefined; disposed = true; listeners.clear(); },
    submit, recover, discard,
  };
}
export type ProofController = ReturnType<typeof createProofController>;
