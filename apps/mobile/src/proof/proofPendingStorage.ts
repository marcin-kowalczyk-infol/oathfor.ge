import * as SecureStore from 'expo-secure-store';
import { exact } from '../api/request';
import { isUuid } from '../api/oathSchema';

export type ProofMode = 'photo' | 'activity_record';
/** One unresolved proof per account and character. `fileName` names its copy in the document directory. */
export type PendingProof = { version: 1; accountId: string; characterId: string; oathId: string; submissionId: string; mode: ProofMode; fileName: string };
export type ProofPendingStorage = {
  read(accountId: string, characterId: string): Promise<{ kind: 'success'; value: PendingProof | null } | { kind: 'invalid' | 'unavailable' }>;
  write(accountId: string, characterId: string, value: PendingProof | null): Promise<{ kind: 'success' | 'unavailable' }>;
};
// The basename becomes the multipart filename and the extension sets its Content-Type.
export const proofFileName = (submissionId: string) => `${submissionId}.jpg`;
export function isPendingProof(value: unknown, accountId: string, characterId: string): value is PendingProof {
  return exact(value, ['version', 'accountId', 'characterId', 'oathId', 'submissionId', 'mode', 'fileName']) && value.version === 1
    && isUuid(accountId) && value.accountId === accountId && isUuid(characterId) && value.characterId === characterId
    && isUuid(value.oathId) && isUuid(value.submissionId) && (value.mode === 'photo' || value.mode === 'activity_record')
    && value.fileName === proofFileName(value.submissionId);
}
const options = { keychainService: 'oathforge.proof', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: false };
const key = (accountId: string, characterId: string) => `oathforge.proof.v1.${accountId}.${characterId}`;
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const result = queue.then(action); queue = result.catch(() => {}); return result;
}
export const secureProofPendingStorage: ProofPendingStorage = {
  read(accountId, characterId) { return serial(async () => {
    if (!isUuid(accountId) || !isUuid(characterId)) return { kind: 'invalid' as const };
    try {
      const encoded = await SecureStore.getItemAsync(key(accountId, characterId), options);
      if (encoded === null || encoded === 'null') return { kind: 'success' as const, value: null };
      if (encoded.length > 1024 || new TextEncoder().encode(encoded).byteLength > 1024) return { kind: 'invalid' as const };
      let value: unknown;
      try { value = JSON.parse(encoded); } catch { return { kind: 'invalid' as const }; }
      return isPendingProof(value, accountId, characterId) ? { kind: 'success' as const, value } : { kind: 'invalid' as const };
    } catch { return { kind: 'unavailable' as const }; }
  }); },
  write(accountId, characterId, value) { return serial(async () => {
    if (!isUuid(accountId) || !isUuid(characterId) || (value !== null && !isPendingProof(value, accountId, characterId))) return { kind: 'unavailable' as const };
    try {
      await SecureStore.setItemAsync(key(accountId, characterId), JSON.stringify(value), options);
      return { kind: 'success' as const };
    } catch { return { kind: 'unavailable' as const }; }
  }); },
};
