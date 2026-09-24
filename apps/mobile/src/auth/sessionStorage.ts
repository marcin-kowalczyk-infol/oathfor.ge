import * as SecureStore from 'expo-secure-store';
import { isSession, type Session } from '../api/auth';

export type SessionEnvelope = { version: 1; kind: 'signed_out' }
  | { version: 1; kind: 'active' | 'revocation_pending'; session: Session };
export type SessionStorage = {
  read(): Promise<{ kind: 'success'; value: SessionEnvelope | null } | { kind: 'invalid' | 'unavailable' }>;
  write(value: SessionEnvelope): Promise<{ kind: 'success' } | { kind: 'unavailable' }>;
};

const key = 'oathforge.session.v1';
const options: SecureStore.SecureStoreOptions = {
  keychainService: 'oathforge.session',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  requireAuthentication: false,
};
const MAX_ENVELOPE_BYTES = 2048;

function isEnvelope(value: unknown): value is SessionEnvelope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  if (record.version !== 1 || !Object.hasOwn(record, 'version') || !Object.hasOwn(record, 'kind')) return false;
  if (record.kind === 'signed_out') return Object.keys(record).length === 2;
  return (record.kind === 'active' || record.kind === 'revocation_pending')
    && Object.keys(record).length === 3 && Object.hasOwn(record, 'session') && isSession(record.session);
}

function isBounded(value: string): boolean {
  return value.length <= MAX_ENVELOPE_BYTES && new TextEncoder().encode(value).byteLength <= MAX_ENVELOPE_BYTES;
}

export const secureSessionStorage: SessionStorage = {
  async read() {
    let encoded: string | null;
    try { encoded = await SecureStore.getItemAsync(key, options); }
    catch { return { kind: 'unavailable' }; }
    if (encoded === null) return { kind: 'success', value: null };
    try {
      if (!isBounded(encoded)) return { kind: 'invalid' };
      const value: unknown = JSON.parse(encoded);
      return isEnvelope(value) ? { kind: 'success', value } : { kind: 'invalid' };
    } catch { return { kind: 'invalid' }; }
  },
  async write(value) {
    try {
      if (!isEnvelope(value)) return { kind: 'unavailable' };
      const encoded = JSON.stringify(value);
      if (!isBounded(encoded)) return { kind: 'unavailable' };
      await SecureStore.setItemAsync(key, encoded, options);
      return { kind: 'success' };
    } catch { return { kind: 'unavailable' }; }
  },
};
