import * as SecureStore from 'expo-secure-store';
import { secureCreationStorage } from './creationStorage';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' }));
const accountId = '10000000-0000-4000-8000-00000000000a';
const otherAccount = '10000000-0000-4000-8000-00000000000b';
const requestId = '40000000-0000-4000-8000-00000000000a';
const record = { version: 1 as const, accountId, requestId, name: 'Mira', presetId: 'dummy_braid', form: 'feminine' as const };
const key = `oathforge.character-creation.v1.${accountId}`;
beforeEach(() => jest.clearAllMocks());

test('stores the creation identity per account with device-only protection and reads it back', async () => {
  await expect(secureCreationStorage.write(accountId, record)).resolves.toEqual({ kind: 'success' });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, JSON.stringify(record), expect.objectContaining({ keychainAccessible: 'device-only', requireAuthentication: false }));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(record));
  await expect(secureCreationStorage.read(accountId)).resolves.toEqual({ kind: 'success', value: record });
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(key, expect.any(Object));
});

test.each([
  ['oversized', 'x'.repeat(1025)],
  ['corrupt', '{'],
  ['another account', JSON.stringify({ ...record, accountId: otherAccount })],
  ['unexpected field', JSON.stringify({ ...record, token: 'secret' })],
  ['other version', JSON.stringify({ ...record, version: 2 })],
  ['uppercase request ID', JSON.stringify({ ...record, requestId: requestId.toUpperCase() })],
  ['name failing the full rule', JSON.stringify({ ...record, name: 'R2D2' })],
  ['unnormalized name', JSON.stringify({ ...record, name: ' Mira' })],
  ['malformed preset', JSON.stringify({ ...record, presetId: 'Dummy' })],
  ['unknown form', JSON.stringify({ ...record, form: 'other' })],
])('rejects a %s record', async (_label, encoded) => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(encoded);
  await expect(secureCreationStorage.read(accountId)).resolves.toEqual({ kind: 'invalid' });
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});

test('reports native failures, clears with a tombstone and never writes a foreign or invalid record', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(secureCreationStorage.read(accountId)).resolves.toEqual({ kind: 'unavailable' });
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(secureCreationStorage.write(accountId, record)).resolves.toEqual({ kind: 'unavailable' });
  await expect(secureCreationStorage.write(otherAccount, record)).resolves.toEqual({ kind: 'unavailable' });
  await expect(secureCreationStorage.write(accountId, { ...record, name: 'A' })).resolves.toEqual({ kind: 'unavailable' });
  await expect(secureCreationStorage.read('not-an-account')).resolves.toEqual({ kind: 'invalid' });
  await expect(secureCreationStorage.write(accountId, null)).resolves.toEqual({ kind: 'success' });
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(key, 'null', expect.any(Object));
  for (const empty of [null, 'null']) {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(empty);
    await expect(secureCreationStorage.read(accountId)).resolves.toEqual({ kind: 'success', value: null });
  }
});
