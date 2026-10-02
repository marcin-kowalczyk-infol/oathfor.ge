import * as SecureStore from 'expo-secure-store';
import { isUuid } from '../api/oathSchema';

type SecureStoreLike = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync'>;
export type GuideStorage = { read(accountId: string): Promise<boolean>; markSeen(accountId: string): Promise<void> };

// A device-local convenience flag, never sent to the server. Losing it only shows the guide again.
// The name separates guides: 'forge-guide' for the first room visit, 'oath-rules-guide' for Żaromir's rule cards,
// 'proof-guide' for his teaching bark on the first proof screen (MVP-22-E2.4).
export function createGuideStorage(store: SecureStoreLike = SecureStore, name: 'forge-guide' | 'oath-rules-guide' | 'proof-guide' = 'forge-guide'): GuideStorage {
  const options = { keychainService: `oathforge.${name}`, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: false };
  const key = (accountId: string) => `oathforge.${name}.v1.${accountId}`;
  return {
    async read(accountId) {
      if (!isUuid(accountId)) return false;
      try { return await store.getItemAsync(key(accountId), options) === 'seen'; } catch { return false; }
    },
    async markSeen(accountId) {
      if (!isUuid(accountId)) return;
      try { await store.setItemAsync(key(accountId), 'seen', options); } catch { /* The guide may show again. */ }
    },
  };
}
