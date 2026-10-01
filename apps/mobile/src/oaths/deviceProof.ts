import type { Oath } from '../api/oathSchema';
import type { ProofControllerError, ProofControllerState } from '../proof/proofController';

/** What the device holds for one Oath's proof. A submission the server already holds is `none`. */
export type DeviceProof = 'none' | 'waiting' | 'sending' | 'deleting' | 'refused' | 'failed';
/** The Oath whose upload the player resumed or deleted, with the error shown at the press. Only a newer error is news. */
export type ProofSubject = { oathId: string; before?: ProofControllerError } | null;

/** After a lost reply the server already holds this submission. Its replay runs quietly, so nothing reads as interrupted. */
export function heldByServer(oath: Oath, state: ProofControllerState): boolean {
  const pending = state.kind === 'ready' ? state.pending : null;
  return !!pending && oath.id === pending.oathId && oath.proof?.submissionId === pending.submissionId;
}

/**
 * The error to show for this Oath: its final refusal, or the error that followed the player's own resend or delete.
 * A refusal clears the record, so its reason only shows through `lastRefusal`.
 */
export function deviceProofError(oath: Oath, state: ProofControllerState, subject: ProofSubject): ProofControllerError | undefined {
  if (state.kind !== 'ready') return undefined;
  const refused = state.lastRefusal?.oathId === oath.id ? state.lastRefusal : undefined;
  if (refused) return { kind: 'proof_refused', code: refused.code, ...(refused.state ? { state: refused.state } : {}) };
  const fresh = subject && state.error && state.error !== subject.before ? state.error : undefined;
  return subject?.oathId === oath.id && fresh?.kind !== 'proof_refused' ? fresh : undefined;
}

/** A kept record waits for a resend even after a failed one. Nothing here claims a receipt. */
export function deviceProof(oath: Oath, state: ProofControllerState, subject: ProofSubject): DeviceProof {
  if (state.kind !== 'ready' || heldByServer(oath, state)) return 'none';
  if (state.pending?.oathId === oath.id) return state.busy ? state.deleting ? 'deleting' : 'sending' : 'waiting';
  if (state.lastRefusal?.oathId === oath.id) return 'refused';
  return deviceProofError(oath, state, subject) ? 'failed' : 'none';
}
