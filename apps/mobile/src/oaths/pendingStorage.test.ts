import * as SecureStore from 'expo-secure-store';
import { securePendingStorage } from './pendingStorage';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' }));
const accountId = '10000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-00000000000a';
const otherCharacter = '30000000-0000-4000-8000-00000000000b';
const previewId = '20000000-0000-4000-8000-000000000001';
const pending = { version: 2 as const, accountId, characterId, previewId, requestId: previewId };
const key = `oathforge.acceptance.v2.${accountId}.${characterId}`;
beforeEach(() => jest.clearAllMocks());
test('durably stores confirmation identity per account and character using device-only protection', async () => {
  await expect(securePendingStorage.write(accountId, characterId, pending)).resolves.toEqual({ kind: 'success' });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, JSON.stringify(pending), expect.objectContaining({ keychainAccessible: 'device-only', requireAuthentication: false }));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(pending));
  await expect(securePendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'success', value: pending });
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(key, expect.any(Object));
});
test('never reads version 1 records, which were keyed by account only', async () => {
  jest.mocked(SecureStore.getItemAsync).mockImplementation(async name => name === `oathforge.acceptance.v1.${accountId}` ? JSON.stringify({ version: 1, accountId, previewId, requestId: previewId }) : null);
  await expect(securePendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'success', value: null });
  expect(jest.mocked(SecureStore.getItemAsync).mock.calls.map(call => call[0])).toEqual([key]);
  jest.mocked(SecureStore.getItemAsync).mockReset();
});
test('rejects oversized, corrupt, foreign-owner, version 1 and unexpected-field envelopes', async () => {
  for (const encoded of ['x'.repeat(1025), '{', JSON.stringify({ ...pending, accountId: previewId }), JSON.stringify({ ...pending, characterId: otherCharacter }),
    JSON.stringify({ version: 1, accountId, previewId, requestId: previewId }), JSON.stringify({ ...pending, token: 'secret' }), JSON.stringify({ ...pending, requestId: accountId })]) {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(encoded);
    await expect(securePendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'invalid' });
  }
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
test('reports native storage failures, clears with a bounded tombstone and separates owners', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(securePendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'unavailable' });
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(securePendingStorage.write(accountId, characterId, pending)).resolves.toEqual({ kind: 'unavailable' });
  await expect(securePendingStorage.write(previewId, characterId, pending)).resolves.toEqual({ kind: 'unavailable' });
  await expect(securePendingStorage.write(accountId, otherCharacter, pending)).resolves.toEqual({ kind: 'unavailable' });
  await expect(securePendingStorage.read(accountId, 'not-a-character')).resolves.toEqual({ kind: 'invalid' });
  await expect(securePendingStorage.write(accountId, characterId, null)).resolves.toEqual({ kind: 'success' });
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(key, 'null', expect.any(Object));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('null');
  await expect(securePendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'success', value: null });
});
