import * as SecureStore from 'expo-secure-store';
import { isUuid } from '../api/oathSchema';

type SecureStoreLike = Pick<typeof SecureStore, 'getItemAsync' | 'setItemAsync'>;
export type GuideStorage = { read(accountId: string): Promise<boolean>; markSeen(accountId: string): Promise<void> };
const options = { keychainService: 'oathforge.forge-guide', keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, requireAuthentication: false };
const key = (accountId: string) => `oathforge.forge-guide.v1.${accountId}`;

// A device-local convenience flag, never sent to the server. Losing it only shows the guide again.
export function createGuideStorage(store: SecureStoreLike = SecureStore): GuideStorage {
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
