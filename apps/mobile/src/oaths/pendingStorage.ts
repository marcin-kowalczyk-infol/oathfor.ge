export type PendingAcceptance = { version: 1; accountId: string; previewId: string; requestId: string };
export type PendingStorage = {
  read(accountId: string): Promise<{ kind: 'success'; value: PendingAcceptance | null } | { kind: 'invalid' | 'unavailable' }>;
  write(accountId: string, value: PendingAcceptance | null): Promise<{ kind: 'success' | 'unavailable' }>;
};
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export function isPendingAcceptance(value: unknown, accountId: string): value is PendingAcceptance {
  return exact(value, ['version', 'accountId', 'previewId', 'requestId']) && value.version === 1
    && uuid(accountId) && value.accountId === accountId && uuid(value.previewId) && value.requestId === value.previewId;
}
const options = { keychainService: 'oathforge.acceptance', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: false };
const key = (accountId: string) => `oathforge.acceptance.v1.${accountId}`;
// Serializing both reads and writes also covers controllers replaced during remounts.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = queue.then(action); queue = result.catch(() => {}); return result;
}
export const securePendingStorage: PendingStorage = {
  read(accountId) { return serial(async () => {
    if (!uuid(accountId)) return { kind: 'invalid' as const };
    try {
      const encoded = await SecureStore.getItemAsync(key(accountId), options);
      if (encoded === null || encoded === 'null') return { kind: 'success' as const, value: null };
      if (encoded.length > 1024 || new TextEncoder().encode(encoded).byteLength > 1024) return { kind: 'invalid' as const };
      let value: unknown;
      try { value = JSON.parse(encoded); } catch { return { kind: 'invalid' as const }; }
      return isPendingAcceptance(value, accountId) ? { kind: 'success' as const, value } : { kind: 'invalid' as const };
    } catch { return { kind: 'unavailable' as const }; }
  }); },
  write(accountId, value) { return serial(async () => {
    if (!uuid(accountId) || (value !== null && !isPendingAcceptance(value, accountId))) return { kind: 'unavailable' as const };
    try {
      await SecureStore.setItemAsync(key(accountId), JSON.stringify(value), options);
      return { kind: 'success' as const };
    } catch { return { kind: 'unavailable' as const }; }
  }); },
};
import * as SecureStore from 'expo-secure-store';
import { exact } from '../api/request';
