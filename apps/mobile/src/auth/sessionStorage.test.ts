import * as SecureStore from 'expo-secure-store';
import { secureSessionStorage, type SessionEnvelope } from './sessionStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(), setItemAsync: jest.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 7,
}));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const getItem = jest.mocked(SecureStore.getItemAsync);
const setItem = jest.mocked(SecureStore.setItemAsync);
const session = { token: 'A'.repeat(43), expiresAt: '2026-10-24T12:00:00Z' };
const options = { keychainService: 'oathforge.session', keychainAccessible: 7, requireAuthentication: false };

beforeEach(() => { jest.resetAllMocks(); setItem.mockResolvedValue(undefined); });

test.each<SessionEnvelope>([
  { version: 1, kind: 'active', session },
  { version: 1, kind: 'revocation_pending', session },
  { version: 1, kind: 'signed_out' },
])('persists and reads one exact $kind envelope using the fixed device-only key', async envelope => {
  await expect(secureSessionStorage.write(envelope)).resolves.toEqual({ kind: 'success' });
  expect(setItem).toHaveBeenCalledTimes(1);
  expect(setItem).toHaveBeenCalledWith('oathforge.session.v1', JSON.stringify(envelope), options);
  getItem.mockResolvedValue(JSON.stringify(envelope));
  await expect(secureSessionStorage.read()).resolves.toEqual({ kind: 'success', value: envelope });
  expect(getItem).toHaveBeenCalledWith('oathforge.session.v1', options);
});

test('distinguishes missing storage from malformed data and unavailable native storage', async () => {
  getItem.mockResolvedValueOnce(null).mockResolvedValueOnce('{').mockRejectedValueOnce(new Error('DUMMY secret native error'));
  await expect(secureSessionStorage.read()).resolves.toEqual({ kind: 'success', value: null });
  await expect(secureSessionStorage.read()).resolves.toEqual({ kind: 'invalid' });
  await expect(secureSessionStorage.read()).resolves.toEqual({ kind: 'unavailable' });
  setItem.mockRejectedValueOnce(new Error('DUMMY secret native error'));
  await expect(secureSessionStorage.write({ version: 1, kind: 'signed_out' })).resolves.toEqual({ kind: 'unavailable' });
});

test.each([
  null, [], {}, { version: 2, kind: 'signed_out' }, { version: 1, kind: 'unknown' },
  { version: 1, kind: 'signed_out', session }, { version: 1, kind: 'active' },
  { version: 1, kind: 'active', session: { ...session, token: 'invalid' } },
  { version: 1, kind: 'active', session: { ...session, expiresAt: '2026-02-30T12:00:00Z' } },
  { version: 1, kind: 'active', session, account: { id: 'DUMMY' } },
  { version: 1, kind: 'active', session: { ...session, identityToken: 'DUMMY' } },
  { version: 1, kind: 'active', session, authorizationCode: 'DUMMY' },
])('rejects unexpected envelope data without writing it: %j', async value => {
  getItem.mockResolvedValue(JSON.stringify(value));
  await expect(secureSessionStorage.read()).resolves.toEqual({ kind: 'invalid' });
  await expect(secureSessionStorage.write(value as SessionEnvelope)).resolves.toEqual({ kind: 'unavailable' });
  expect(setItem).not.toHaveBeenCalled();
});

test('rejects stored strings exceeding the byte bound even when the JSON is valid', async () => {
  getItem.mockResolvedValue(' '.repeat(2048) + JSON.stringify({ version: 1, kind: 'signed_out' }));
  await expect(secureSessionStorage.read()).resolves.toEqual({ kind: 'invalid' });
});
