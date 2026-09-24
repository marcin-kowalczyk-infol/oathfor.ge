import * as Apple from 'expo-apple-authentication';
import { createAppleAuthentication } from './appleLogin';
import type { AuthClient } from '../api/auth';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-apple-authentication', () => ({ isAvailableAsync: jest.fn(), signInAsync: jest.fn() }));
const challenge = { challengeId: 'A'.repeat(43), nonce: 'B'.repeat(43), state: 'C'.repeat(43), expiresAt: '2026-09-24T12:05:00Z' };
const credential = { identityToken: 'DUMMY-token', authorizationCode: 'DUMMY-code', state: challenge.state };
const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' as const };
const session = { token: 'D'.repeat(43), expiresAt: '2026-10-24T12:00:00Z' };
function setup() {
  jest.mocked(Apple.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Apple.signInAsync).mockResolvedValue(credential as Apple.AppleAuthenticationCredential);
  const api = {
    challenge: jest.fn().mockResolvedValue({ kind: 'success', value: challenge }),
    exchange: jest.fn().mockResolvedValue({ kind: 'success', value: { account, session } }),
    me: jest.fn(), logout: jest.fn(),
  } satisfies AuthClient;
  return { api, authenticate: createAppleAuthentication(api) };
}
afterEach(() => jest.resetAllMocks());

test('composes fresh challenge, native correlation without scopes, and exact exchange fields', async () => {
  const { api, authenticate } = setup(); const signal = new AbortController().signal;
  await expect(authenticate(signal)).resolves.toEqual({ kind: 'success', value: { account, session } });
  expect(api.challenge).toHaveBeenCalledWith(signal);
  expect(Apple.signInAsync).toHaveBeenCalledWith({ nonce: challenge.nonce, state: challenge.state, requestedScopes: [] });
  expect(api.exchange).toHaveBeenCalledWith({ challengeId: challenge.challengeId, identityToken: credential.identityToken, authorizationCode: credential.authorizationCode }, signal);
});

test('native cancellation stays cancellation and never exchanges credentials', async () => {
  const { api, authenticate } = setup();
  jest.mocked(Apple.signInAsync).mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
  await expect(authenticate(new AbortController().signal)).resolves.toEqual({ kind: 'cancelled' });
  expect(api.exchange).not.toHaveBeenCalled();
});

test.each(['challenge', 'native'])('abort after %s prevents remaining credential work', async stage => {
  const { api, authenticate } = setup(); const controller = new AbortController();
  if (stage === 'challenge') api.challenge.mockImplementation(async () => { controller.abort(); return { kind: 'success', value: challenge }; });
  else jest.mocked(Apple.signInAsync).mockImplementation(async () => { controller.abort(); return credential as Apple.AppleAuthenticationCredential; });
  await expect(authenticate(controller.signal)).resolves.toEqual({ kind: 'cancelled' });
  expect(api.exchange).not.toHaveBeenCalled();
  if (stage === 'challenge') expect(Apple.signInAsync).not.toHaveBeenCalled();
});

test('pre-aborted login makes no challenge or provider request', async () => {
  const { api, authenticate } = setup(); const controller = new AbortController(); controller.abort();
  await expect(authenticate(controller.signal)).resolves.toEqual({ kind: 'cancelled' });
  expect(api.challenge).not.toHaveBeenCalled();
});

test('correlation failure never exchanges; retry after409 obtains a fresh native attempt', async () => {
  const { api, authenticate } = setup(); const signal = new AbortController().signal;
  jest.mocked(Apple.signInAsync).mockResolvedValueOnce({ ...credential, state: 'different' } as Apple.AppleAuthenticationCredential);
  await expect(authenticate(signal)).resolves.toEqual({ kind: 'unavailable', retry: 'fresh_login' });
  expect(api.exchange).not.toHaveBeenCalled();
  api.exchange.mockResolvedValueOnce({ kind: 'fresh_challenge' });
  await expect(authenticate(signal)).resolves.toEqual({ kind: 'fresh_challenge' });
  await expect(authenticate(signal)).resolves.toEqual({ kind: 'success', value: { account, session } });
  expect(api.challenge).toHaveBeenCalledTimes(3); expect(Apple.signInAsync).toHaveBeenCalledTimes(3);
});
