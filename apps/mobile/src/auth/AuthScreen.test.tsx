import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { AuthScreen, type AppleAvailability } from './AuthScreen';
import { createAppleAuthentication } from './appleLogin';
import { createSessionController, type SessionController } from './session';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { SessionStorage } from './sessionStorage';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  return { isAvailableAsync: jest.fn(), signInAsync: jest.fn(), addRevokeListener: jest.fn(), AppleAuthenticationButtonType: { SIGN_IN: 0 }, AppleAuthenticationButtonStyle: { WHITE: 2 }, AppleAuthenticationButton: (props: object) => <Pressable {...props} accessibilityRole="button" accessibilityLabel="Apple sign in" /> };
});
const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' as const };
const session = { token: 'A'.repeat(43), expiresAt: '2026-10-24T12:00:00Z' };
const challenge = { challengeId: 'B'.repeat(43), nonce: 'C'.repeat(43), state: 'D'.repeat(43), expiresAt: '2026-09-24T12:05:00Z' };
const controllers: SessionController[] = [];
function setup() {
  const api = { challenge: jest.fn().mockResolvedValue({ kind: 'success', value: challenge }), exchange: jest.fn().mockResolvedValue({ kind: 'success', value: { account, session } }), me: jest.fn().mockResolvedValue({ kind: 'success', value: { account } }), logout: jest.fn().mockResolvedValue({ kind: 'success', value: undefined }) };
  const storage: SessionStorage = { read: jest.fn().mockResolvedValue({ kind: 'success', value: null }), write: jest.fn().mockResolvedValue({ kind: 'success' }) };
  const controller = createSessionController({ api, storage, now: () => Date.parse('2026-09-24T12:00:00Z') }); controllers.push(controller);
  let revoke = () => {};
  const remove = jest.fn();
  const apple: AppleAvailability = { isAvailable: jest.fn().mockResolvedValue(true), onRevoked: listener => { revoke = listener; return remove; } };
  jest.mocked(Apple.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(Apple.signInAsync).mockResolvedValue({ state: challenge.state, identityToken: 'DUMMY-token', authorizationCode: 'DUMMY-code' } as Apple.AppleAuthenticationCredential);
  return { api, storage, controller, apple, remove, revoke: () => revoke(), authenticate: createAppleAuthentication(api) };
}
afterEach(() => { controllers.splice(0).forEach(controller => controller.dispose()); jest.restoreAllMocks(); });

test.each([['en', 'Your journey begins'], ['pl', 'Początek Twojej drogi']] as const)('native sign-in reaches persisted onboarding handoff in %s', async (locale, heading) => {
  const runtime = setup();
  await render(<LocalizationProvider initialLocale={locale}><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByText(heading)).toBeOnTheScreen();
  expect(runtime.storage.write).toHaveBeenCalledWith({ version: 1, kind: 'active', session });
  expect(Apple.signInAsync).toHaveBeenCalledWith({ nonce: challenge.nonce, state: challenge.state, requestedScopes: [] });
});

test('provider availability failure is recoverable without exposing the native button', async () => {
  const runtime = setup();
  jest.mocked(runtime.apple.isAvailable).mockRejectedValueOnce(new Error('PRIVATE provider failure'));
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  expect(await screen.findByText('Sign in with Apple is unavailable on this device right now.')).toBeOnTheScreen();
  expect(screen.queryByTestId('native-apple-button')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByTestId('native-apple-button')).toBeOnTheScreen();
});

test('native revocation hides access, foreground retries pending logout, and subscriptions are removed', async () => {
  const runtime = setup();
  let onChange: (state: AppStateStatus) => void = () => {};
  const removeAppState = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { onChange = listener; return { remove: removeAppState }; });
  const view = await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  await screen.findByText('Your journey begins');
  runtime.api.logout.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  await act(async () => runtime.revoke());
  expect(runtime.controller.getState().kind).toBe('revocation_pending');
  expect(screen.queryByText('Your journey begins')).not.toBeOnTheScreen();
  await act(async () => { onChange('background'); onChange('active'); });
  expect(runtime.controller.getState().kind).toBe('signed_out');
  await view.unmount();
  expect(runtime.remove).toHaveBeenCalledTimes(1); expect(removeAppState).toHaveBeenCalledTimes(1);
});

test('one pending native login is cancelled without exchanging a late credential', async () => {
  const runtime = setup();
  let resolveNative!: (value: Apple.AppleAuthenticationCredential) => void;
  jest.mocked(Apple.signInAsync).mockReturnValueOnce(new Promise(resolve => { resolveNative = resolve; }));
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(screen.queryByTestId('native-apple-button')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel sign-in' }));
  await act(async () => resolveNative({ state: challenge.state, identityToken: 'DUMMY-token', authorizationCode: 'DUMMY-code' } as Apple.AppleAuthenticationCredential));
  expect(runtime.api.challenge).toHaveBeenCalledTimes(1);
  expect(runtime.api.exchange).not.toHaveBeenCalled();
  expect(await screen.findByTestId('native-apple-button')).toBeOnTheScreen();
});
