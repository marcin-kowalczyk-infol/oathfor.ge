import type { File } from 'expo-file-system';
import type { AuthFailure } from '../api/auth';
import { createBoundedRequest, exact, isSecret, UPLOAD_TIMEOUT_MS, type ClientOptions } from '../api/request';
import { isOath, isOathState, isProof, isUtcTime, isUuid, type Oath, type OathState, type Proof } from '../api/oathSchema';
import { proofFileName, type ProofMode } from './proofPendingStorage';

export type { ProofMode };
export const PROOF_UPLOAD_TIMEOUT_MS = UPLOAD_TIMEOUT_MS;
/** `file` is the document copy named `<submissionId>.jpg`. Its basename becomes the multipart filename. */
export type ProofSubmission = { submissionId: string; mode: ProofMode; file: File };
/** `created` is false for a replay, which carries the original `receivedAt`. */
export type ProofReceipt = { created: boolean; proof: Proof; oath: Oath; serverTime: string };
export type ProofField = 'submissionId' | 'mode' | 'declaration' | 'image';
export type ProofRefusalCode = 'receipt_cutoff_passed' | 'oath_not_active' | 'proof_already_submitted' | 'idempotency_conflict'
  | 'request_too_large' | 'unsupported_media_type'
  | 'invalid_submission_id' | 'invalid_mode' | 'declaration_required' | 'too_large' | 'unsupported_type' | 'too_many_pixels' | 'unreadable_image';
/** A final answer: sending the same request again cannot change it. */
export type ProofRefusal = { kind: 'proof_refused'; code: ProofRefusalCode; state?: OathState; field?: ProofField };
/**
 * `character_required`: the server has no active character. `not_found`: the API finds the Oath through its active character,
 * so on a first send this means the character changed elsewhere and nothing was committed. Both may succeed later unchanged.
 */
export type ProofError = { kind: 'proof_error'; code: 'character_required' | 'not_found' };
/**
 * The server saw no usable image part. Until the native multipart check runs (T11), this may be a transport fault,
 * so the copy stays and the player chooses to retry or discard.
 */
export type ProofUploadRejected = { kind: 'upload_rejected'; code: 'invalid_request' | 'image_required' };
export type ProofResult = { kind: 'success'; value: ProofReceipt } | AuthFailure | ProofRefusal | ProofError | ProofUploadRejected;

const plainCodes: Record<number, ProofRefusalCode[]> = {
  413: ['request_too_large'], 415: ['unsupported_media_type'],
  409: ['receipt_cutoff_passed', 'proof_already_submitted', 'idempotency_conflict'],
};
const fieldCodes: Record<string, ProofField> = {
  invalid_submission_id: 'submissionId', invalid_mode: 'mode', declaration_required: 'declaration',
  too_large: 'image', unsupported_type: 'image', too_many_pixels: 'image', unreadable_image: 'image',
};
function proofError(status: number, error: unknown): ProofRefusal | ProofError | ProofUploadRejected | undefined {
  if (status === 422 && exact(error, ['code', 'field']) && error.code === 'image_required' && error.field === 'image') return { kind: 'upload_rejected', code: 'image_required' };
  if (status === 422 && exact(error, ['code', 'field']) && typeof error.code === 'string' && Object.hasOwn(fieldCodes, error.code) && fieldCodes[error.code] === error.field) {
    return { kind: 'proof_refused', code: error.code as ProofRefusalCode, field: fieldCodes[error.code] };
  }
  if (status === 409 && exact(error, ['code', 'state']) && error.code === 'oath_not_active' && isOathState(error.state) && error.state !== 'active') {
    return { kind: 'proof_refused', code: 'oath_not_active', state: error.state };
  }
  if (!exact(error, ['code']) || typeof error.code !== 'string') return undefined;
  if (status === 409 && error.code === 'character_required') return { kind: 'proof_error', code: 'character_required' };
  if (status === 404 && error.code === 'not_found') return { kind: 'proof_error', code: 'not_found' };
  if (status === 400 && error.code === 'invalid_request') return { kind: 'upload_rejected', code: 'invalid_request' };
  if (plainCodes[status]?.includes(error.code as ProofRefusalCode)) return { kind: 'proof_refused', code: error.code as ProofRefusalCode };
  return undefined;
}
function validSubmission(value: unknown): value is ProofSubmission {
  if (!exact(value, ['submissionId', 'mode', 'file']) || !isUuid(value.submissionId) || (value.mode !== 'photo' && value.mode !== 'activity_record')) return false;
  const file = value.file as { uri?: unknown } | null;
  return !!file && typeof file === 'object' && typeof file.uri === 'string' && file.uri.endsWith(`/${proofFileName(value.submissionId)}`);
}

export function createProofClient(options: ClientOptions) {
  const request = createBoundedRequest<ProofRefusal | ProofError | ProofUploadRejected>(options);
  return {
    submit(token: string, oathId: string, submission: ProofSubmission, signal?: AbortSignal): Promise<ProofResult> {
      if (!isSecret(token) || !isUuid(oathId) || !validSubmission(submission)) return Promise.resolve({ kind: 'invalid_request' });
      const { submissionId, mode, file } = submission;
      const body = new FormData();
      body.append('submissionId', submissionId);
      body.append('mode', mode);
      body.append('declaration', 'true');
      // expo/fetch reads an expo-file-system File as a Blob. A `{uri,name,type}` object is rejected there.
      body.append('image', file);
      // The status decides `created`, so the guard keeps it for this one call.
      let created = false;
      const valid = (value: unknown, status: number): value is Omit<ProofReceipt, 'created'> => {
        created = status === 201;
        return exact(value, ['proof', 'oath', 'serverTime']) && isProof(value.proof) && isOath(value.oath) && isUtcTime(value.serverTime)
          && value.proof.submissionId === submissionId && value.proof.mode === mode && value.oath.id === oathId && value.oath.proof !== null;
      };
      return request(`/api/oaths/${oathId}/proofs`, 'POST', [200, 201], valid, body, token, signal, { mapStructuredError: proofError, timeoutMs: UPLOAD_TIMEOUT_MS })
        .then(result => result.kind === 'success' ? { kind: 'success' as const, value: { created, ...result.value } } : result);
    },
  };
}
export type ProofClient = ReturnType<typeof createProofClient>;
