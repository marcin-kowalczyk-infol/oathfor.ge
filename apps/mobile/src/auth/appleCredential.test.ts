import * as Apple from 'expo-apple-authentication';
import { requestAppleCredential } from './appleCredential';

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
}));

const available = jest.mocked(Apple.isAvailableAsync);
const signIn = jest.mocked(Apple.signInAsync);
const request = { nonce: 'DUMMY-nonce', state: 'DUMMY-state' };
const credential: Apple.AppleAuthenticationCredential = {
  user: 'DUMMY-user', state: request.state, identityToken: 'DUMMY-unverified-token',
  authorizationCode: 'DUMMY-authorization-code', email: null, fullName: null, realUserStatus: 0,
};

beforeEach(() => {
  jest.resetAllMocks();
  available.mockResolvedValue(true);
  signIn.mockResolvedValue(credential);
});

test('returns the unverified token and code after a correlated response without profile scopes', async () => {
  await expect(requestAppleCredential(request)).resolves.toEqual({ kind: 'unverified', identityToken: credential.identityToken, authorizationCode: credential.authorizationCode });
  expect(signIn).toHaveBeenCalledWith({ ...request, requestedScopes: [] });
});

test('does not open native sign-in when unavailable', async () => {
  available.mockResolvedValue(false);
  await expect(requestAppleCredential(request)).resolves.toEqual({ kind: 'unavailable' });
  expect(signIn).not.toHaveBeenCalled();
});

test('treats user cancellation as a separate outcome', async () => {
  signIn.mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });
  await expect(requestAppleCredential(request)).resolves.toEqual({ kind: 'cancelled' });
});

test.each(['availability', 'sign-in'])('contains %s errors without exposing provider details', async (stage) => {
  const error = new Error('DUMMY private provider details');
  if (stage === 'availability') available.mockRejectedValue(error);
  else signIn.mockRejectedValue(error);
  await expect(requestAppleCredential(request)).resolves.toEqual({ kind: 'failed' });
});

test.each([
  { identityToken: null }, { identityToken: '  ' }, { authorizationCode: null }, { authorizationCode: '' }, { authorizationCode: '  ' }, { state: null }, { state: 'another-request' },
])('rejects an unusable or uncorrelated response: %j', async (patch) => {
  signIn.mockResolvedValue({ ...credential, ...patch });
  await expect(requestAppleCredential(request)).resolves.toEqual({ kind: 'invalid' });
});

test.each([{ ...request, nonce: '' }, { ...request, state: '  ' }])('does not open native sign-in without correlation input: %j', async (input) => {
  await expect(requestAppleCredential(input)).resolves.toEqual({ kind: 'invalid' });
  expect(signIn).not.toHaveBeenCalled();
});
