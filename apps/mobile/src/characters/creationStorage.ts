import * as SecureStore from 'expo-secure-store';
import { exact } from '../api/request';
import { isUuid } from '../api/oathSchema';
import { isCharacterForm, isPresetId, type CharacterForm } from '../api/characters';
import { validateCharacterName } from './name';

export type PendingCreation = { version: 1; accountId: string; requestId: string; name: string; presetId: string; form: CharacterForm };
export type CreationStorage = {
  read(accountId: string): Promise<{ kind: 'success'; value: PendingCreation | null } | { kind: 'invalid' | 'unavailable' }>;
  write(accountId: string, value: PendingCreation | null): Promise<{ kind: 'success' | 'unavailable' }>;
};
// The stored name went through the full pre-send rule and is replayed byte for byte.
export function isPendingCreation(value: unknown, accountId: string): value is PendingCreation {
  if (!exact(value, ['version', 'accountId', 'requestId', 'name', 'presetId', 'form']) || value.version !== 1 || !isUuid(accountId)
    || value.accountId !== accountId || !isUuid(value.requestId) || typeof value.name !== 'string' || !isPresetId(value.presetId) || !isCharacterForm(value.form)) return false;
  const check = validateCharacterName(value.name);
  return check.valid && check.name === value.name;
}
const options = { keychainService: 'oathforge.character-creation', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: false };
const key = (accountId: string) => `oathforge.character-creation.v1.${accountId}`;
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = queue.then(action); queue = result.catch(() => {}); return result;
}
export const secureCreationStorage: CreationStorage = {
  read(accountId) { return serial(async () => {
    if (!isUuid(accountId)) return { kind: 'invalid' as const };
    try {
      const encoded = await SecureStore.getItemAsync(key(accountId), options);
      if (encoded === null || encoded === 'null') return { kind: 'success' as const, value: null };
      if (encoded.length > 1024 || new TextEncoder().encode(encoded).byteLength > 1024) return { kind: 'invalid' as const };
      let value: unknown;
      try { value = JSON.parse(encoded); } catch { return { kind: 'invalid' as const }; }
      return isPendingCreation(value, accountId) ? { kind: 'success' as const, value } : { kind: 'invalid' as const };
    } catch { return { kind: 'unavailable' as const }; }
  }); },
  write(accountId, value) { return serial(async () => {
    if (!isUuid(accountId) || (value !== null && !isPendingCreation(value, accountId))) return { kind: 'unavailable' as const };
    try {
      await SecureStore.setItemAsync(key(accountId), JSON.stringify(value), options);
      return { kind: 'success' as const };
    } catch { return { kind: 'unavailable' as const }; }
  }); },
};
