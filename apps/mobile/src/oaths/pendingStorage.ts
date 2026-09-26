export type PendingAcceptance = { version: 2; accountId: string; characterId: string; previewId: string; requestId: string };
// A pending acceptance belongs to its preview's character, so another character never reads or sends it.
export type PendingStorage = {
  read(accountId: string, characterId: string): Promise<{ kind: 'success'; value: PendingAcceptance | null } | { kind: 'invalid' | 'unavailable' }>;
  write(accountId: string, characterId: string, value: PendingAcceptance | null): Promise<{ kind: 'success' | 'unavailable' }>;
};
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export function isPendingAcceptance(value: unknown, accountId: string, characterId: string): value is PendingAcceptance {
  return exact(value, ['version', 'accountId', 'characterId', 'previewId', 'requestId']) && value.version === 2
    && uuid(accountId) && value.accountId === accountId && uuid(characterId) && value.characterId === characterId
    && uuid(value.previewId) && value.requestId === value.previewId;
}
const options = { keychainService: 'oathforge.acceptance', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: false };
// Version 1 keys held one record per account and are never read again (local test data only).
const key = (accountId: string, characterId: string) => `oathforge.acceptance.v2.${accountId}.${characterId}`;
// Serializing both reads and writes also covers controllers replaced during remounts.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = queue.then(action); queue = result.catch(() => {}); return result;
}
export const securePendingStorage: PendingStorage = {
  read(accountId, characterId) { return serial(async () => {
    if (!uuid(accountId) || !uuid(characterId)) return { kind: 'invalid' as const };
    try {
      const encoded = await SecureStore.getItemAsync(key(accountId, characterId), options);
      if (encoded === null || encoded === 'null') return { kind: 'success' as const, value: null };
      if (encoded.length > 1024 || new TextEncoder().encode(encoded).byteLength > 1024) return { kind: 'invalid' as const };
      let value: unknown;
      try { value = JSON.parse(encoded); } catch { return { kind: 'invalid' as const }; }
      return isPendingAcceptance(value, accountId, characterId) ? { kind: 'success' as const, value } : { kind: 'invalid' as const };
    } catch { return { kind: 'unavailable' as const }; }
  }); },
  write(accountId, characterId, value) { return serial(async () => {
    if (!uuid(accountId) || !uuid(characterId) || (value !== null && !isPendingAcceptance(value, accountId, characterId))) return { kind: 'unavailable' as const };
    try {
      await SecureStore.setItemAsync(key(accountId, characterId), JSON.stringify(value), options);
      return { kind: 'success' as const };
    } catch { return { kind: 'unavailable' as const }; }
  }); },
};
import * as SecureStore from 'expo-secure-store';
import { exact } from '../api/request';
