import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { AuthScreen, type AppleAvailability } from './AuthScreen';
import { createAppleAuthentication } from './appleLogin';
import { createSessionController, type SessionController } from './session';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { SessionStorage } from './sessionStorage';
import type { OathClient } from '../api/oaths';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: mockDeviceLanguage }], getCalendars: () => [{ timeZone: 'Europe/Warsaw' }] }));
jest.mock('../onboarding/notificationPermissions', () => ({ nativeNotificationPermissions: { read: jest.fn().mockResolvedValue({ kind: 'unavailable', canAskAgain: false }), request: jest.fn(), openSettings: jest.fn() } }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  return { isAvailableAsync: jest.fn(), signInAsync: jest.fn(), addRevokeListener: jest.fn(), AppleAuthenticationButtonType: { SIGN_IN: 0 }, AppleAuthenticationButtonStyle: { WHITE: 2 }, AppleAuthenticationButton: (props: object) => <Pressable {...props} accessibilityRole="button" accessibilityLabel="Apple sign in" /> };
});
const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' as const };
const session = { token: 'A'.repeat(43), expiresAt: '2026-10-24T12:00:00Z' };
const challenge = { challengeId: 'B'.repeat(43), nonce: 'C'.repeat(43), state: 'D'.repeat(43), expiresAt: '2026-09-24T12:05:00Z' };
let mockDeviceLanguage = 'en';
beforeEach(() => { mockDeviceLanguage = 'en'; });
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
  const profileApi = { get: jest.fn().mockResolvedValue({ kind: 'success', value: { profile: { locale: null, timezone: null, intention: null, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' } }), patch: jest.fn(), complete: jest.fn() };
  const oathApi = { list: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [], nextCursor: null, serverTime: '2026-09-24T12:00:00Z', paused: false } }) } as unknown as OathClient;
  const acceptanceStorage = { read: jest.fn().mockResolvedValue({ kind: 'success', value: null }), write: jest.fn().mockResolvedValue({ kind: 'success' }) };
  return { api, profileApi, oathApi, acceptanceStorage, storage, controller, apple, remove, revoke: () => revoke(), authenticate: createAppleAuthentication(api) };
}
afterEach(() => { controllers.splice(0).forEach(controller => controller.dispose()); jest.restoreAllMocks(); });

test.each([['en', 'Your first steps'], ['pl', 'Twoje pierwsze kroki']] as const)('native sign-in reaches persisted onboarding handoff in %s', async (locale, heading) => {
  const runtime = setup();
  mockDeviceLanguage = locale;
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
  await screen.findByText('Your first steps');
  runtime.api.logout.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  await act(async () => runtime.revoke());
  expect(runtime.controller.getState().kind).toBe('revocation_pending');
  expect(screen.queryByText('Your first steps')).not.toBeOnTheScreen();
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


test('completed accounts load profile and confirmed language before their destination', async () => {
  const runtime = setup();
  runtime.api.exchange.mockResolvedValue({ kind: 'success', value: { account: { ...account, onboardingStatus: 'complete' }, session } });
  let resolveProfile!: (value: unknown) => void;
  runtime.profileApi.get.mockReturnValueOnce(new Promise(resolve => { resolveProfile = resolve; }));
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(screen.queryByRole('header', { name: 'Today' })).not.toBeOnTheScreen();
  await act(async () => resolveProfile({ kind: 'success', value: { profile: { locale: 'pl', timezone: 'Europe/Warsaw', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' }, onboardingStatus: 'complete' } }));
  expect(await screen.findByRole('header', { name: 'Dzisiaj' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Złóż Przysięgę' }));
  expect(await screen.findByRole('button', { name: 'Zobacz zasady' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Wyloguj się' }));
  expect(await screen.findByText('Welcome to Oathforge')).toBeOnTheScreen();
});

test('language preview keeps the draft and explicit confirmation saves basics before the companion handoff', async () => {
  const runtime = setup();
  runtime.profileApi.patch.mockResolvedValue({ kind: 'success', value: { profile: { locale: 'pl', timezone: 'Europe/Warsaw', intention: 'regular_activity', companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' } });
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Polski' }));
  expect(await screen.findByText('Twoje pierwsze kroki')).toBeOnTheScreen();
  expect(runtime.profileApi.patch).not.toHaveBeenCalled();
  expect(runtime.profileApi.get).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('checkbox', { name: 'Chcę regularnie podejmować aktywność' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Potwierdź wybory' }));
  expect(await screen.findByText('Poznaj Żaromira')).toBeOnTheScreen();
  expect(runtime.profileApi.patch).toHaveBeenCalledWith(session.token, { locale: 'pl', timezone: 'Europe/Warsaw', intention: 'regular_activity' }, expect.any(AbortSignal));
});

test.each(['pending', 'complete'] as const)('saved timezone unavailable on this device keeps %s account language and requires correction only while pending', async onboardingStatus => {
  const runtime = setup();
  const original = Intl.DateTimeFormat;
  jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locales, options) => {
    if (options?.timeZone === 'Europe/Warsaw') throw new RangeError('Unsupported on this device');
    return new original(locales, options);
  });
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: { profile: { locale: 'pl', timezone: 'Europe/Warsaw', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' }, onboardingStatus } });
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  if (onboardingStatus === 'complete') {
    expect(await screen.findByRole('header', { name: 'Dzisiaj' })).toBeOnTheScreen();
    expect(screen.queryByRole('checkbox')).toBeNull();
  } else {
    expect(await screen.findByLabelText('Strefa czasowa')).toBeOnTheScreen();
    expect(screen.getByDisplayValue('Europe/Warsaw')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Potwierdź wybory', disabled: true })).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText('Strefa czasowa'), 'Europe/London');
    expect(screen.getByRole('button', { name: 'Potwierdź wybory', disabled: false })).toBeOnTheScreen();
    expect(runtime.profileApi.patch).not.toHaveBeenCalled();
  }
});

test.each([
  ['en', 'Meet Zharomir', 'Continue', 'Try again', 'Notifications', 'We could not confirm this step. Please try again.'],
  ['pl', 'Poznaj Żaromira', 'Dalej', 'Spróbuj ponownie', 'Powiadomienia', 'Nie udało się potwierdzić tego kroku. Spróbuj ponownie.'],
] as const)('%s companion acknowledgment advances only after saving and survives reload', async (locale, introduction, next, retry, notifications, failure) => {
  const runtime = setup();
  mockDeviceLanguage = locale;
  let stored = { profile: { locale, timezone: 'Europe/Warsaw', intention: 'regular_activity', companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' };
  runtime.profileApi.get.mockImplementation(async () => ({ kind: 'success', value: stored }));
  runtime.profileApi.patch.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  runtime.profileApi.patch.mockImplementationOnce(async () => {
    stored = { ...stored, profile: { ...stored.profile, companionIntroduced: true } };
    return { kind: 'success', value: stored };
  });
  const fixture = () => <LocalizationProvider initialLocale={locale}><AuthScreen {...runtime} /></LocalizationProvider>;
  let view = await render(fixture());
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByText(introduction)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: next }));
  expect(await screen.findByText(failure)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: retry })).toBeOnTheScreen();
  expect(screen.queryByText(notifications)).toBeNull();
  expect(runtime.profileApi.patch).toHaveBeenCalledWith(session.token, { companionIntroduced: true }, expect.any(AbortSignal));
  await view.unmount();
  view = await render(fixture());
  expect(await screen.findByText(introduction)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: next }));
  expect(await screen.findByText(notifications)).toBeOnTheScreen();
  await view.unmount();
  await render(fixture());
  expect(await screen.findByText(notifications)).toBeOnTheScreen();
  expect(screen.queryByText(introduction)).toBeNull();
  expect(runtime.profileApi.patch).toHaveBeenCalledTimes(2);
});


test('notification action survives saved-profile routing and native foreground validation', async () => {
  const runtime = setup();
  let stored = { profile: { locale: 'en', timezone: 'UTC', intention: 'regular_activity', companionIntroduced: true, notificationPreference: null as null | string }, onboardingStatus: 'pending' };
  runtime.profileApi.get.mockImplementation(async () => ({ kind: 'success', value: stored }));
  runtime.profileApi.patch.mockImplementation(async (_token, patch) => { stored = { ...stored, profile: { ...stored.profile, ...patch } }; return { kind: 'success', value: stored }; });
  let onChange: (state: AppStateStatus) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { onChange = listener; return { remove: jest.fn() }; });
  let resolvePermission!: (value: { kind: 'denied'; canAskAgain: false }) => void;
  const permissions = { read: jest.fn().mockResolvedValue({ kind: 'denied', canAskAgain: false }), request: jest.fn().mockImplementation(() => new Promise(resolve => { resolvePermission = resolve; })), openSettings: jest.fn() };
  permissions.read.mockResolvedValueOnce({ kind: 'not_determined', canAskAgain: true });
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} permissions={permissions} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  await fireEvent.press(await screen.findByRole('button', { name: 'Enable notifications' }));
  expect(permissions.request).toHaveBeenCalledTimes(1);
  expect(stored.profile.notificationPreference).toBe('enabled');
  await act(async () => { onChange('inactive'); onChange('active'); resolvePermission({ kind: 'denied', canAskAgain: false }); });
  expect(await screen.findByText('Your choices are saved')).toBeOnTheScreen();
  expect(screen.getByText('This device does not allow notifications. You can continue without changing this.')).toBeOnTheScreen();
  runtime.profileApi.complete.mockResolvedValue({ kind: 'success', value: { ...stored, onboardingStatus: 'complete' } });
  await fireEvent.press(await screen.findByRole('button', { name: 'Continue', disabled: false }));
  expect(await screen.findByRole('header', { name: 'Today' })).toBeOnTheScreen();
  expect(permissions.request).toHaveBeenCalledTimes(1);
  expect(runtime.profileApi.complete).toHaveBeenCalledTimes(1);
});


test.each(['denied', 'unavailable'] as const)('saved opt-in restart reviews without prompting; %s permission does not prevent explicit completion', async kind => {
  const runtime = setup();
  const saved = { profile: { locale: 'en', timezone: 'UTC', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'enabled' }, onboardingStatus: 'pending' };
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: saved });
  runtime.profileApi.complete.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  const permissions = { read: jest.fn().mockResolvedValue({ kind, canAskAgain: false }), request: jest.fn(), openSettings: jest.fn() };
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} permissions={permissions} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByText('Your choices are saved')).toBeOnTheScreen();
  expect(screen.getByText('Timezone: UTC')).toBeOnTheScreen();
  expect(permissions.read).toHaveBeenCalled(); expect(permissions.request).not.toHaveBeenCalled();
  expect(runtime.profileApi.complete).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.queryByRole('header', { name: 'Today' })).toBeNull();
  expect(runtime.profileApi.get).toHaveBeenCalledTimes(2);
  runtime.profileApi.complete.mockResolvedValueOnce({ kind: 'success', value: { ...saved, onboardingStatus: 'complete' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('header', { name: 'Today' })).toBeOnTheScreen();
  expect(permissions.request).not.toHaveBeenCalled();
});

test('default native adapter unmounts safely when the unavailable Expo module returns no subscription', async () => {
  const runtime = setup();
  jest.mocked(Apple.isAvailableAsync).mockResolvedValue(false);
  // SDK57's unavailable-module fallback returns undefined despite its public type.
  jest.mocked(Apple.addRevokeListener).mockReturnValueOnce(undefined as unknown as ReturnType<typeof Apple.addRevokeListener>);
  const view = await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} apple={undefined} /></LocalizationProvider>);
  expect(await screen.findByText('Sign in with Apple is unavailable on this device right now.')).toBeOnTheScreen();
  await expect(view.unmount()).resolves.toBeUndefined();
});

test('default native adapter removes a valid revocation subscription exactly once', async () => {
  const runtime = setup();
  const remove = jest.fn();
  jest.mocked(Apple.addRevokeListener).mockReturnValueOnce({ remove });
  const view = await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} apple={undefined} /></LocalizationProvider>);
  await screen.findByTestId('native-apple-button');
  expect(remove).not.toHaveBeenCalled();
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
});
