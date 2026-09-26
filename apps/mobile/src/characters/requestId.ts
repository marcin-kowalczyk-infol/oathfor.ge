import { randomUUID } from 'expo-crypto';
import { isUuid } from '../api/oathSchema';

// expo-crypto is listed in the Expo SDK bundled native modules, so Expo Go includes it.
// The API requires canonical lower case, which native generators do not guarantee.
export function createRequestId(): string | undefined {
  try {
    const value = randomUUID().toLowerCase();
    return isUuid(value) ? value : undefined;
  } catch { return undefined; }
}
