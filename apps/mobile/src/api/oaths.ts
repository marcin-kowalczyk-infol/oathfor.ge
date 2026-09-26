import type { AuthFailure } from './auth';
import { createBoundedRequest, exact, type ClientOptions } from './request';
import { isUuid, isPreviewInput, isPreviewEnvelope, isStoredPreviewEnvelope, isOathEnvelope, isOathListEnvelope, isPauseEnvelope,
  type PreviewInput, type PreviewEnvelope, type StoredPreviewEnvelope, type OathEnvelope, type OathListEnvelope, type PauseEnvelope } from './oathSchema';

export type OathCode = 'invalid_request' | 'invalid_activity' | 'onboarding_incomplete' | 'character_paused' | 'character_required' | 'character_changed'
  | 'activation_elapsed' | 'deadline_not_after_activation' | 'preview_superseded' | 'idempotency_conflict' | 'not_found' | 'pause_preview_changed';
export type TimeCode = 'invalid_local_time' | 'invalid_timezone' | 'invalid_offset' | 'nonexistent_local_time' | 'ambiguous_local_time' | 'offset_mismatch' | 'unsupported_time_offset';
export type OathFailure = { kind: 'oath_error'; code: OathCode }
  | { kind: 'time_error'; code: TimeCode; field: 'activation' | 'deadline'; validOffsets?: string[] };
export type OathResult<T> = { kind: 'success'; value: T } | AuthFailure | OathFailure;
export type OathListQuery = { view: 'today' | 'history'; limit?: number; cursor?: string };
export type PauseInput = { characterId: string; paused: true; revision: string } | { characterId: string; paused: false };

function safeError(status: number, error: unknown): OathFailure | undefined {
  if (status === 400 && error && typeof error === 'object' && 'code' in error) {
    const codes = ['invalid_local_time', 'invalid_timezone', 'invalid_offset', 'nonexistent_local_time', 'ambiguous_local_time', 'offset_mismatch', 'unsupported_time_offset'];
    if (typeof error.code === 'string' && codes.includes(error.code)) {
      const ambiguous = error.code === 'ambiguous_local_time';
      if (!exact(error, ambiguous ? ['code', 'field', 'validOffsets'] : ['code', 'field'])) return undefined;
      const metadata = error as Record<string, unknown>;
      if (metadata.field !== 'activation' && metadata.field !== 'deadline') return undefined;
      if (ambiguous && (!Array.isArray(metadata.validOffsets) || metadata.validOffsets.length < 2 || metadata.validOffsets.length > 8
        || !metadata.validOffsets.every(offset => typeof offset === 'string' && /^[+-](?:[01]\d|2[0-3]):[0-5]\d$/.test(offset) && offset !== '-00:00')
        || new Set(metadata.validOffsets).size !== metadata.validOffsets.length)) return undefined;
      return { kind: 'time_error', code: error.code as TimeCode, field: metadata.field, ...(ambiguous ? { validOffsets: metadata.validOffsets as string[] } : {}) };
    }
  }
  if (exact(error, ['code']) && typeof error.code === 'string') {
    const codes: Record<number, string[]> = { 400: ['invalid_request', 'invalid_activity'], 404: ['not_found'],
      409: ['onboarding_incomplete', 'character_paused', 'character_required', 'character_changed', 'activation_elapsed', 'deadline_not_after_activation', 'preview_superseded', 'idempotency_conflict', 'pause_preview_changed'] };
    if (codes[status]?.includes(error.code)) return { kind: 'oath_error', code: error.code as OathCode };
  }
  return undefined;
}
export function createOathClient(options: ClientOptions) {
  const request = createBoundedRequest<OathFailure>(options);
  const policy = { mapStructuredError: safeError };
  const invalid = <T>(): Promise<OathResult<T>> => Promise.resolve({ kind: 'invalid_request' });
  return {
    preview(token: string, input: PreviewInput, signal?: AbortSignal): Promise<OathResult<PreviewEnvelope>> {
      if (!isPreviewInput(input)) return invalid();
      return request('/api/oath-previews', 'POST', 201, isPreviewEnvelope, JSON.stringify(input), token, signal, policy);
    },
    getPreview(token: string, id: string, signal?: AbortSignal): Promise<OathResult<StoredPreviewEnvelope>> {
      if (!isUuid(id)) return invalid();
      return request(`/api/oath-previews/${id}`, 'GET', 200, isStoredPreviewEnvelope, undefined, token, signal, policy);
    },
    confirm(token: string, input: { previewId: string; requestId: string; accepted: true }, signal?: AbortSignal): Promise<OathResult<OathEnvelope>> {
      if (!exact(input, ['previewId', 'requestId', 'accepted']) || !isUuid(input.previewId) || !isUuid(input.requestId) || input.accepted !== true) return invalid();
      return request('/api/oaths', 'POST', [200, 201], isOathEnvelope, JSON.stringify(input), token, signal, policy);
    },
    detail(token: string, id: string, signal?: AbortSignal): Promise<OathResult<OathEnvelope>> {
      if (!isUuid(id)) return invalid();
      return request(`/api/oaths/${id}`, 'GET', 200, isOathEnvelope, undefined, token, signal, policy);
    },
    list(token: string, query: OathListQuery, signal?: AbortSignal): Promise<OathResult<OathListEnvelope>> {
      if (!query || typeof query !== 'object' || Object.keys(query).some(key => !['view', 'limit', 'cursor'].includes(key))
        || !['today', 'history'].includes(query.view) || (query.limit !== undefined && (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 100))
        || (query.cursor !== undefined && (typeof query.cursor !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(query.cursor)))) return invalid();
      const limit = query.limit ?? 20;
      const path = `/api/oaths?view=${query.view}&limit=${limit}${query.cursor ? `&cursor=${query.cursor}` : ''}`;
      return request(path, 'GET', 200, (value): value is OathListEnvelope => isOathListEnvelope(value) && value.items.length <= limit, undefined, token, signal, { ...policy, maxResponseBytes: 4 * 1024 * 1024 });
    },
    getPause(token: string, signal?: AbortSignal): Promise<OathResult<PauseEnvelope>> {
      return request('/api/oath-pause', 'GET', 200, isPauseEnvelope, undefined, token, signal, policy);
    },
    pause(token: string, input: PauseInput, signal?: AbortSignal): Promise<OathResult<PauseEnvelope>> {
      const valid = (exact(input, ['characterId', 'paused']) && input.paused === false)
        || (exact(input, ['characterId', 'paused', 'revision']) && input.paused === true && typeof input.revision === 'string' && /^[0-9a-f]{64}$/.test(input.revision));
      if (!valid || !isUuid(input.characterId)) return invalid();
      return request('/api/oath-pause', 'POST', 200, isPauseEnvelope, JSON.stringify(input), token, signal, policy);
    },
  };
}
export type OathClient = ReturnType<typeof createOathClient>;
