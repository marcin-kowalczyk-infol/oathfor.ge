import * as SecureStore from 'expo-secure-store';
import { securePendingStorage } from './pendingStorage';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' }));
const accountId = '10000000-0000-4000-8000-000000000001';
const previewId = '20000000-0000-4000-8000-000000000001';
const pending = { version: 1 as const, accountId, previewId, requestId: previewId };
beforeEach(() => jest.clearAllMocks());
test('durably stores only account-scoped confirmation identity using device-only protection', async () => {
  await expect(securePendingStorage.write(accountId, pending)).resolves.toEqual({ kind: 'success' });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(`oathforge.acceptance.v1.${accountId}`, JSON.stringify(pending), expect.objectContaining({ keychainAccessible: 'device-only', requireAuthentication: false }));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(pending));
  await expect(securePendingStorage.read(accountId)).resolves.toEqual({ kind: 'success', value: pending });
});
test('rejects oversized, corrupt, foreign-account and unexpected-field envelopes', async () => {
  for (const encoded of ['x'.repeat(1025), '{', JSON.stringify({ ...pending, accountId: previewId }), JSON.stringify({ ...pending, token: 'secret' }), JSON.stringify({ ...pending, requestId: accountId })]) {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(encoded);
    await expect(securePendingStorage.read(accountId)).resolves.toEqual({ kind: 'invalid' });
  }
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
test('reports native storage failures, clears with a bounded tombstone and separates owners', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(securePendingStorage.read(accountId)).resolves.toEqual({ kind: 'unavailable' });
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(securePendingStorage.write(accountId, pending)).resolves.toEqual({ kind: 'unavailable' });
  await expect(securePendingStorage.write(previewId, pending)).resolves.toEqual({ kind: 'unavailable' });
  await expect(securePendingStorage.write(accountId, null)).resolves.toEqual({ kind: 'success' });
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(`oathforge.acceptance.v1.${accountId}`, 'null', expect.any(Object));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce('null');
  await expect(securePendingStorage.read(accountId)).resolves.toEqual({ kind: 'success', value: null });
});
