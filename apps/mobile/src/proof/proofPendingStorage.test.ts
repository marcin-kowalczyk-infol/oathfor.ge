import * as SecureStore from 'expo-secure-store';
import { proofFileName, secureProofPendingStorage } from './proofPendingStorage';
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(), setItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'device-only' }));
const accountId = '10000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-00000000000a';
const otherCharacter = '30000000-0000-4000-8000-00000000000b';
const oathId = '20000000-0000-4000-8000-000000000001';
const submissionId = '4a0b0c0d-0000-4000-8000-00000000000f';
const pending = { version: 1 as const, accountId, characterId, oathId, submissionId, mode: 'photo' as const, fileName: `${submissionId}.jpg` };
const key = `oathforge.proof.v1.${accountId}.${characterId}`;
beforeEach(() => jest.clearAllMocks());

test('names the copy after the submission so the multipart part is a JPEG named by its UUID', () => {
  expect(proofFileName(submissionId)).toBe(`${submissionId}.jpg`);
});
test('durably stores the pending proof per account and character with device-only protection', async () => {
  await expect(secureProofPendingStorage.write(accountId, characterId, pending)).resolves.toEqual({ kind: 'success' });
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(key, JSON.stringify(pending), expect.objectContaining({ keychainService: 'oathforge.proof', keychainAccessible: 'device-only', requireAuthentication: false }));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify(pending));
  await expect(secureProofPendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'success', value: pending });
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith(key, expect.objectContaining({ keychainService: 'oathforge.proof' }));
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(JSON.stringify({ ...pending, mode: 'activity_record' }));
  await expect(secureProofPendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'success', value: { ...pending, mode: 'activity_record' } });
});
test.each([
  ['oversized', 'x'.repeat(1025)],
  ['corrupt', '{'],
  ['foreign account', JSON.stringify({ ...pending, accountId: oathId })],
  ['foreign character', JSON.stringify({ ...pending, characterId: otherCharacter })],
  ['other version', JSON.stringify({ ...pending, version: 2 })],
  ['extra field', JSON.stringify({ ...pending, token: 'secret' })],
  ['missing field', JSON.stringify({ ...pending, fileName: undefined })],
  ['unknown mode', JSON.stringify({ ...pending, mode: 'video' })],
  ['uppercase submission', JSON.stringify({ ...pending, submissionId: submissionId.toUpperCase(), fileName: `${submissionId.toUpperCase()}.jpg` })],
  ['malformed Oath', JSON.stringify({ ...pending, oathId: 'oath-1' })],
  ['file of another submission', JSON.stringify({ ...pending, fileName: `${oathId}.jpg` })],
  ['path in file name', JSON.stringify({ ...pending, fileName: `../${submissionId}.jpg` })],
  ['array', JSON.stringify([pending])],
])('rejects a %s record', async (_label, encoded) => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(encoded);
  await expect(secureProofPendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'invalid' });
  expect(SecureStore.setItemAsync).not.toHaveBeenCalled();
});
test('reports native failures, refuses foreign writes and clears with a bounded tombstone', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(secureProofPendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'unavailable' });
  jest.mocked(SecureStore.setItemAsync).mockRejectedValueOnce(new Error('DUMMY failure'));
  await expect(secureProofPendingStorage.write(accountId, characterId, pending)).resolves.toEqual({ kind: 'unavailable' });
  await expect(secureProofPendingStorage.write(accountId, otherCharacter, pending)).resolves.toEqual({ kind: 'unavailable' });
  await expect(secureProofPendingStorage.write(oathId, characterId, pending)).resolves.toEqual({ kind: 'unavailable' });
  await expect(secureProofPendingStorage.read(accountId, 'not-a-character')).resolves.toEqual({ kind: 'invalid' });
  expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  await expect(secureProofPendingStorage.write(accountId, characterId, null)).resolves.toEqual({ kind: 'success' });
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith(key, 'null', expect.any(Object));
  for (const empty of [null, 'null']) {
    jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(empty);
    await expect(secureProofPendingStorage.read(accountId, characterId)).resolves.toEqual({ kind: 'success', value: null });
  }
});
