import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Dimensions, type AppStateStatus } from 'react-native';
import * as Apple from 'expo-apple-authentication';
import { AuthScreen, type AppleAvailability } from './AuthScreen';
import { createAppleAuthentication } from './appleLogin';
import { createSessionController, type SessionController } from './session';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import * as characterControllers from '../characters/controller';
import type { SessionStorage } from './sessionStorage';
import type { OathClient } from '../api/oaths';
import type { Character, CharacterClient, CharacterList } from '../api/characters';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: mockDeviceLanguage }], getCalendars: () => [{ timeZone: 'Europe/Warsaw' }] }));
jest.mock('../onboarding/notificationPermissions', () => ({ nativeNotificationPermissions: { read: jest.fn().mockResolvedValue({ kind: 'unavailable', canAskAgain: false }), request: jest.fn(), openSettings: jest.fn() } }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
// Routing tests use the static room. Walking and the flame are covered by the room's own tests.
jest.mock('../ui/useMotion', () => ({ ...jest.requireActual('../ui/useMotion'), useMotionAllowed: () => false }));
jest.mock('expo-crypto', () => ({ randomUUID: () => '40000000-0000-4000-8000-00000000000a' }));
jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  return { isAvailableAsync: jest.fn(), signInAsync: jest.fn(), addRevokeListener: jest.fn(), AppleAuthenticationButtonType: { SIGN_IN: 0 }, AppleAuthenticationButtonStyle: { WHITE: 2 }, AppleAuthenticationButton: (props: object) => <Pressable {...props} accessibilityRole="button" accessibilityLabel="Apple sign in" /> };
});
const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' as const };
const session = { token: 'A'.repeat(43), expiresAt: '2026-10-24T12:00:00Z' };
const challenge = { challengeId: 'B'.repeat(43), nonce: 'C'.repeat(43), state: 'D'.repeat(43), expiresAt: '2026-09-24T12:05:00Z' };
let mockDeviceLanguage = 'en';
const mira = { id: '30000000-0000-4000-8000-00000000000a', name: 'Mira', presetId: 'dummy_braid', form: 'feminine' as const, createdAt: '2026-09-24T12:00:00Z' };
const listing = (characters: Character[], activeCharacterId: string | null): CharacterList => ({ characters, activeCharacterId, limit: 3, presets: ['dummy_braid', 'dummy_cropped', 'dummy_curly', 'dummy_tied'], serverTime: '2026-09-24T12:00:00Z' });
const forgeTile = { name: 'Enter the Forge, Hearth, seals and chronicle' };
const menuPl = { name: 'Wejdź do Kuźni, Palenisko, pieczęcie i kronika' };
const completeProfile = { profile: { locale: 'en', timezone: 'UTC', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' }, onboardingStatus: 'complete' };
const phone = (fontScale: number) => ({ width: 390, height: 844, scale: 3, fontScale });
// The Jest window defaults to 750 pt at fontScale 2, the simple layout. Tests use a phone at normal text unless they say otherwise.
beforeEach(() => { mockDeviceLanguage = 'en'; Dimensions.set({ window: phone(1), screen: phone(1) }); });
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
  const oathApi = { list: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-09-24T12:00:00Z', paused: false, characterId: mira.id } }) } as unknown as OathClient;
  const acceptanceStorage = { read: jest.fn().mockResolvedValue({ kind: 'success', value: null }), write: jest.fn().mockResolvedValue({ kind: 'success' }) };
  const characterApi = { list: jest.fn().mockResolvedValue({ kind: 'success', value: listing([mira], mira.id) }), create: jest.fn(), activate: jest.fn() };
  const creationStorage = { read: jest.fn().mockResolvedValue({ kind: 'success', value: null }), write: jest.fn().mockResolvedValue({ kind: 'success' }) };
  const seen = new Set<string>();
  const guideStorage = { read: jest.fn(async (owner: string) => seen.has(owner)), markSeen: jest.fn(async (owner: string) => { seen.add(owner); }) };
  return { api, profileApi, oathApi, acceptanceStorage, characterApi: characterApi as typeof characterApi & CharacterClient, creationStorage, guideStorage, storage, controller, apple, remove, revoke: () => revoke(), authenticate: createAppleAuthentication(api) };
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
  const listeners = new Set<(state: AppStateStatus) => void>();
  const onChange = (state: AppStateStatus) => [...listeners].forEach(listener => listener(state));
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.add(listener); return { remove: () => { listeners.delete(listener); } }; });
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
  expect(runtime.remove).toHaveBeenCalledTimes(1); expect(listeners.size).toBe(0);
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
  expect(screen.queryByRole('button', menuPl)).not.toBeOnTheScreen();
  await act(async () => resolveProfile({ kind: 'success', value: { profile: { locale: 'pl', timezone: 'Europe/Warsaw', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' }, onboardingStatus: 'complete' } }));
  expect(await screen.findByRole('button', menuPl)).toBeOnTheScreen();
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
    expect(await screen.findByRole('button', menuPl)).toBeOnTheScreen();
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
  // A return from iOS Settings passes through the background, so the session is validated while the permission answer is pending.
  const checks = runtime.api.me.mock.calls.length;
  await act(async () => { onChange('background'); onChange('active'); resolvePermission({ kind: 'denied', canAskAgain: false }); });
  expect(runtime.api.me).toHaveBeenCalledTimes(checks + 1);
  expect(await screen.findByText('Your choices are saved')).toBeOnTheScreen();
  expect(screen.getByText('This device does not allow notifications. You can continue without changing this.')).toBeOnTheScreen();
  runtime.profileApi.complete.mockResolvedValue({ kind: 'success', value: { ...stored, onboardingStatus: 'complete' } });
  await fireEvent.press(await screen.findByRole('button', { name: 'Continue', disabled: false }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
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
  expect(screen.queryByRole('button', forgeTile)).toBeNull();
  expect(runtime.profileApi.get).toHaveBeenCalledTimes(2);
  runtime.profileApi.complete.mockResolvedValueOnce({ kind: 'success', value: { ...saved, onboardingStatus: 'complete' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
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

test('routes a completed account without a character to creation', async () => {
  const runtime = setup();
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: completeProfile });
  runtime.characterApi.list.mockResolvedValue({ kind: 'success', value: listing([], null) });
  runtime.characterApi.create.mockResolvedValue({ kind: 'success', created: true, value: { character: mira, activeCharacterId: mira.id, serverTime: '2026-09-24T12:00:00Z' } });
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByRole('header', { name: 'Forge your character' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', forgeTile)).toBeNull();
  expect(runtime.oathApi.list).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Mira');
  await fireEvent.press(screen.getByRole('radio', { name: 'Oathkeeper, she / her' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create character' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.getByText('Mira')).toBeOnTheScreen();
  expect(runtime.characterApi.create.mock.calls[0][1]).toEqual({ requestId: '40000000-0000-4000-8000-00000000000a', name: 'Mira', presetId: 'dummy_braid', form: 'feminine' });
  expect(runtime.creationStorage.write).toHaveBeenCalledWith(account.id, expect.objectContaining({ requestId: '40000000-0000-4000-8000-00000000000a' }));
  expect(runtime.acceptanceStorage.read).toHaveBeenCalledWith(account.id, mira.id);
});

test('character loading and failures never show creation, and retry reloads', async () => {
  const runtime = setup();
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: completeProfile });
  let resolveList!: (value: unknown) => void;
  runtime.characterApi.list.mockReturnValueOnce(new Promise(resolve => { resolveList = resolve; })).mockResolvedValueOnce({ kind: 'success', value: listing([mira], mira.id) });
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByText('Gathering your characters…')).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Forge your character' })).toBeNull();
  await act(async () => resolveList({ kind: 'unavailable', retry: 'request' }));
  expect(screen.getByText('The Forge cannot be reached right now. Check your connection and try again.')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Name')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
});

test('character_required from an Oath call reloads characters and returns to creation', async () => {
  const runtime = setup();
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: completeProfile });
  runtime.characterApi.list.mockResolvedValueOnce({ kind: 'success', value: listing([mira], mira.id) }).mockResolvedValue({ kind: 'success', value: listing([], null) });
  jest.mocked(runtime.oathApi.list).mockResolvedValue({ kind: 'oath_error', code: 'character_required' });
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByRole('header', { name: 'Forge your character' })).toBeOnTheScreen();
  expect(runtime.characterApi.list).toHaveBeenCalledTimes(2);
});

test('an Oath response for another character reloads characters and rebinds to the server active one', async () => {
  const runtime = setup();
  const bor = { ...mira, id: '30000000-0000-4000-8000-00000000000b', name: 'Bor' };
  const events: string[] = [];
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: completeProfile });
  runtime.characterApi.list.mockImplementationOnce(async () => { events.push('characters'); return { kind: 'success', value: listing([mira, bor], mira.id) }; })
    .mockImplementation(async () => { events.push('characters'); return { kind: 'success', value: listing([mira, bor], bor.id) }; });
  runtime.acceptanceStorage.read.mockImplementation(async (_account: string, character: string) => { events.push(`read ${character === bor.id ? 'B' : 'A'}`); return { kind: 'success', value: null }; });
  let served = mira.id;
  jest.mocked(runtime.oathApi.list).mockImplementation(async (_token, query) => { events.push(query.limit === 1 ? 'summary' : 'oaths'); const characterId = served; served = bor.id; return { kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-09-24T12:00:00Z', paused: false, characterId } }; });
  served = bor.id;
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  await act(async () => {});
  // The menu summary is the first Oath request. Its answer for B reloads the characters, and only B's content loads after that.
  expect(events).toEqual(['characters', 'summary', 'read A', 'characters', 'summary', 'read B', 'oaths']);
  expect(screen.getByText('Bor')).toBeOnTheScreen();
  expect(runtime.acceptanceStorage.read).toHaveBeenLastCalledWith(account.id, bor.id);
});

test('a switch rebinds the Oath controller before the new character screen sends any Oath request', async () => {
  const runtime = setup();
  const bor = { ...mira, id: '30000000-0000-4000-8000-00000000000b', name: 'Bor' };
  let serverActive = mira.id;
  const events: string[] = [];
  const created: characterControllers.CharacterController[] = [];
  const original = characterControllers.createCharacterController;
  jest.spyOn(characterControllers, 'createCharacterController').mockImplementation(options => { const made = original(options); created.push(made); return made; });
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: completeProfile });
  runtime.characterApi.list.mockImplementation(async () => ({ kind: 'success', value: listing([mira, bor], serverActive) }));
  runtime.characterApi.activate.mockImplementation(async (_token: string, id: string) => { events.push('activate'); serverActive = id; return { kind: 'success', value: listing([mira, bor], id) }; });
  runtime.acceptanceStorage.read.mockImplementation(async (_account: string, character: string) => { events.push(`read ${character === bor.id ? 'B' : 'A'}`); return { kind: 'success', value: null }; });
  jest.mocked(runtime.oathApi.list).mockImplementation(async (_token, query) => { events.push(query.limit === 1 ? 'summary' : 'oaths'); return { kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-09-24T12:00:00Z', paused: false, characterId: serverActive } }; });
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  await act(async () => {});
  expect(events).toEqual(['summary', 'read A', 'oaths']);
  events.length = 0;
  await act(async () => { await created[created.length - 1].switch(bor.id); });
  await act(async () => {});
  expect(events).toEqual(['activate', 'summary', 'read B', 'oaths']);
  expect(screen.getByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.getByText('Bor')).toBeOnTheScreen();
});

test('the menu card opens character change, and a switch or a new character lands on the menu with its card', async () => {
  const runtime = setup();
  const bor = { ...mira, id: '30000000-0000-4000-8000-00000000000b', name: 'Bor', form: 'masculine' as const };
  const wit = { ...mira, id: '30000000-0000-4000-8000-00000000000c', name: 'Wit', form: 'neutral' as const, presetId: 'dummy_tied' };
  let serverActive = mira.id; let roster: Character[] = [mira, bor];
  runtime.characterApi.list.mockImplementation(async () => ({ kind: 'success', value: listing(roster, serverActive) }));
  runtime.characterApi.activate.mockImplementation(async (_token: string, id: string) => { serverActive = id; return { kind: 'success', value: listing(roster, id) }; });
  runtime.characterApi.create.mockImplementation(async () => { roster = [...roster, wit]; serverActive = wit.id; return { kind: 'success', created: true, value: { character: wit, activeCharacterId: wit.id, serverTime: '2026-09-24T12:00:00Z' } }; });
  jest.mocked(runtime.oathApi.list).mockImplementation(async () => ({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-09-24T12:00:00Z', paused: false, characterId: serverActive } }));
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Change character' }));
  expect(await screen.findByRole('header', { name: 'Change character' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Mira, Oathkeeper, active character' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(runtime.characterApi.activate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Change character' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Bor, Oathkeeper' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.getByText('Bor')).toBeOnTheScreen();
  expect(runtime.acceptanceStorage.read).toHaveBeenLastCalledWith(account.id, bor.id);
  await fireEvent.press(screen.getByRole('button', { name: 'Change character' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'New character' }));
  expect(await screen.findByRole('header', { name: 'Forge your character' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to characters' }));
  expect(await screen.findByRole('header', { name: 'Change character' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'New character' }));
  await fireEvent.changeText(await screen.findByLabelText('Name'), 'Wit');
  await fireEvent.press(screen.getByRole('radio', { name: 'Oathkeeper, they / them' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Create character' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.getByText('Wit')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Change character' }));
  expect(await screen.findByText('All three places are taken.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to menu' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
});

test('first-run creation offers sign-out but no way back', async () => {
  const runtime = setup();
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: completeProfile });
  runtime.characterApi.list.mockResolvedValue({ kind: 'success', value: listing([], null) });
  await render(<LocalizationProvider initialLocale="en"><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByRole('header', { name: 'Forge your character' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Back to characters' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Welcome to Oathforge')).toBeOnTheScreen();
});

test('a failed switch error does not follow the player into new character creation', async () => {
  const runtime = setup();
  const bor = { ...mira, id: '30000000-0000-4000-8000-00000000000b', name: 'Bor', form: 'masculine' as const };
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: completeProfile });
  runtime.characterApi.list.mockResolvedValue({ kind: 'success', value: listing([mira, bor], mira.id) });
  runtime.characterApi.activate.mockResolvedValue({ kind: 'character_error', code: 'not_found' });
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Change character' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Bor, Oathkeeper' }));
  expect(await screen.findByText('This character is no longer available. Choose another one.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'New character' }));
  expect(await screen.findByRole('header', { name: 'Forge your character' })).toBeOnTheScreen();
  expect(screen.queryByText('We could not create this character. Check your choices and try again.')).toBeNull();
});

async function signIn(runtime: ReturnType<typeof setup>, locale: 'en' | 'pl' = 'en') {
  runtime.profileApi.get.mockResolvedValue({ kind: 'success', value: completeProfile });
  await render(<LocalizationProvider initialLocale={locale}><AuthScreen {...runtime} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
}

test('lands on the menu after a character exists', async () => {
  const runtime = setup();
  await signIn(runtime);
  expect(await screen.findByRole('button', { name: 'Enter the Forge, Hearth, seals and chronicle' })).toBeOnTheScreen();
  expect(screen.getByText('Mira')).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Your Oaths' })).toBeNull();
});

const oathLists = (runtime: ReturnType<typeof setup>) => jest.mocked(runtime.oathApi.list).mock.calls.filter(([, query]) => query.limit !== 1).map(([, query]) => query.view);
const summaries = (runtime: ReturnType<typeof setup>) => jest.mocked(runtime.oathApi.list).mock.calls.filter(([, query]) => query.limit === 1).length;
async function enterRoom() {
  await fireEvent.press(await screen.findByRole('button', forgeTile));
  expect(await screen.findByRole('button', { name: 'Leave the Forge' })).toBeOnTheScreen();
}
async function useStation(station: 'Hearth' | 'Seals' | 'Chronicle', action: string) {
  await fireEvent.press(screen.getByRole('button', { name: station }));
  await fireEvent.press(screen.getByRole('button', { name: action }));
}

test('the room leads to creation, Today and History, the Oath door returns to the room and the room door to the menu', async () => {
  const runtime = setup();
  runtime.guideStorage.read.mockResolvedValue(true);
  await signIn(runtime);
  await enterRoom();
  expect(screen.queryByRole('button', forgeTile)).toBeNull();
  await useStation('Hearth', 'Shape an Oath');
  expect(await screen.findByLabelText('Completion date')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Return to the Forge' }));
  await useStation('Seals', 'View current Oaths');
  expect(await screen.findByRole('button', { name: 'Today', selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Return to the Forge' }));
  await useStation('Chronicle', 'Read history');
  expect(await screen.findByRole('button', { name: 'History', selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Return to the Forge' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Leave the Forge' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
});

test('the first room entry shows the guide and stores the flag, the next entry does not, and Tutorial restarts it', async () => {
  const runtime = setup();
  let answer!: (seen: boolean) => void;
  runtime.guideStorage.read.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', forgeTile));
  // The room waits for the flag, so the guide never starts late.
  expect(screen.getByTestId('forge-room-waiting')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Leave the Forge' })).toBeNull();
  await act(async () => answer(false));
  await fireEvent.press(await screen.findByRole('button', { name: 'Skip introduction' }));
  expect(runtime.guideStorage.markSeen).toHaveBeenCalledWith(account.id);
  await fireEvent.press(screen.getByRole('button', { name: 'Leave the Forge' }));
  await enterRoom();
  expect(screen.queryByRole('button', { name: 'Skip introduction' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Leave the Forge' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Tutorial, Zharomir explains the rules' }));
  expect(await screen.findByRole('button', { name: 'Skip introduction' })).toBeOnTheScreen();
  expect(runtime.guideStorage.read).toHaveBeenCalledTimes(1);
});

test('a guide flag read that does not answer within 1.5 s opens the room with the guide and a late answer is ignored', async () => {
  const runtime = setup();
  let answer!: (seen: boolean) => void;
  runtime.guideStorage.read.mockImplementationOnce(() => new Promise(resolve => { answer = resolve; }));
  await signIn(runtime);
  await screen.findByRole('button', forgeTile);
  jest.useFakeTimers();
  try {
    await fireEvent.press(screen.getByRole('button', forgeTile));
    await act(async () => { jest.advanceTimersByTime(1499); });
    expect(screen.getByTestId('forge-room-waiting')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(screen.getByRole('button', { name: 'Skip introduction' })).toBeOnTheScreen();
    await act(async () => answer(true));
    expect(screen.getByRole('button', { name: 'Skip introduction' })).toBeOnTheScreen();
  } finally { jest.useRealTimers(); }
});

test('in simple layout the Forge opens Today and the header Menu button returns to the menu', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const runtime = setup();
  await signIn(runtime);
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Tutorial, Zharomir explains the rules' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', forgeTile));
  expect(await screen.findByRole('button', { name: 'Today', selected: true })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Leave the Forge' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to menu' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
});

test('a pending acceptance makes the Forge resume Oath creation', async () => {
  const runtime = setup();
  const previewId = '20000000-0000-4000-8000-000000000009';
  runtime.acceptanceStorage.read.mockResolvedValue({ kind: 'success', value: { version: 2, accountId: account.id, characterId: mira.id, previewId, requestId: previewId } });
  Object.assign(runtime.oathApi, { getPreview: jest.fn().mockResolvedValue({ kind: 'unavailable', retry: 'request' }) });
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Enter the Forge, An Oath awaits confirmation' }));
  expect(await screen.findByRole('button', { name: 'Check confirmation' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Leave the Forge' })).toBeNull();
});

function pausable(runtime: ReturnType<typeof setup>) {
  let paused = false;
  const summary = () => ({ paused, revision: 'a'.repeat(64), withdraw: [], preserve: [], serverTime: '2026-09-24T12:00:00Z', characterId: mira.id });
  jest.mocked(runtime.oathApi.list).mockImplementation(async () => ({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-09-24T12:00:00Z', paused, characterId: mira.id } }));
  Object.assign(runtime.oathApi, {
    getPause: jest.fn(async () => ({ kind: 'success', value: summary() })),
    pause: jest.fn(async (_token: string, input: { paused: boolean }) => { paused = input.paused; return { kind: 'success', value: summary() }; }),
  });
}

test('Settings opens the pause review, which returns to Settings', async () => {
  const runtime = setup(); pausable(runtime);
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Mira: active' }));
  expect(await screen.findByRole('header', { name: 'Review pause' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to Settings' }));
  expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to menu' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
});

test('a confirmed pause returns to Settings, refreshes the summary and reloads the mounted Oath list', async () => {
  const runtime = setup(); pausable(runtime);
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Mira: active' }));
  const lists = oathLists(runtime).length;
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm pause' }));
  expect(await screen.findByRole('button', { name: 'Mira: paused' })).toBeOnTheScreen();
  expect(oathLists(runtime)).toHaveLength(lists + 1);
  await fireEvent.press(screen.getByRole('button', { name: 'Back to menu' }));
  expect(await screen.findByText('Character paused')).toBeOnTheScreen();
  await enterRoom();
  await useStation('Seals', 'View current Oaths');
  expect(await screen.findByText('Gameplay is paused. Existing reviews continue. Withdrawn Oaths will not return.')).toBeOnTheScreen();
});

test('sign-out in Settings returns to the sign-in screen', async () => {
  const runtime = setup();
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Sign out' }));
  expect(await screen.findByText('Welcome to Oathforge')).toBeOnTheScreen();
  expect(runtime.api.logout).toHaveBeenCalledTimes(1);
  // A sign-out resets the route, so the next sign-in starts at the menu.
  await fireEvent.press(await screen.findByTestId('native-apple-button'));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Settings' })).toBeNull();
});

test('a language chosen in Settings applies after the server saves it', async () => {
  const runtime = setup();
  runtime.profileApi.patch.mockResolvedValue({ kind: 'success', value: { ...completeProfile, profile: { ...completeProfile.profile, locale: 'pl' } } });
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Polski' }));
  expect(await screen.findByRole('header', { name: 'Ustawienia' })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Polski', selected: true })).toBeOnTheScreen();
  expect(runtime.profileApi.patch).toHaveBeenCalledWith(session.token, { locale: 'pl' }, expect.any(AbortSignal));
});

test('a language the server rejects keeps the current language and shows the error', async () => {
  const runtime = setup();
  runtime.profileApi.patch.mockResolvedValue({ kind: 'invalid_value', field: 'locale' });
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Polski' }));
  expect(await screen.findByText('The language was not saved. Your current language stays. Try again.')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'English', selected: true })).toBeOnTheScreen();
});

test('a language save still running stays locked after leaving and reopening Settings, so it is sent once', async () => {
  const runtime = setup();
  let answer!: (value: unknown) => void;
  runtime.profileApi.patch.mockImplementation(() => new Promise(resolve => { answer = resolve; }));
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(await screen.findByRole('radio', { name: 'Polski' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Back to menu' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  expect(await screen.findByText('Saving the language…')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Polski' }));
  await act(async () => answer({ kind: 'success', value: { ...completeProfile, profile: { ...completeProfile.profile, locale: 'pl' } } }));
  expect(await screen.findByRole('header', { name: 'Ustawienia' })).toBeOnTheScreen();
  expect(runtime.profileApi.patch).toHaveBeenCalledTimes(1);
});

test('returning from the room and Settings refreshes the menu summary without reloading the mounted Oath list', async () => {
  const runtime = setup();
  runtime.guideStorage.read.mockResolvedValue(true);
  await signIn(runtime);
  await screen.findByRole('button', forgeTile);
  await act(async () => {});
  expect(oathLists(runtime)).toEqual(['today']);
  expect(summaries(runtime)).toBe(1);
  await enterRoom();
  await fireEvent.press(screen.getByRole('button', { name: 'Leave the Forge' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Back to menu' }));
  await screen.findByRole('button', forgeTile);
  await act(async () => {});
  expect(oathLists(runtime)).toEqual(['today']);
  expect(summaries(runtime)).toBe(3);
});

function appStates() {
  const listeners = new Set<(state: AppStateStatus) => void>();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => { listeners.add(listener); return { remove: () => { listeners.delete(listener); } }; });
  return async (...states: AppStateStatus[]) => { for (const next of states) await act(async () => { listeners.forEach(listener => listener(next)); }); };
}

test('returning from the background validates the session again and keeps Settings open', async () => {
  const runtime = setup(); const emit = appStates();
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  const checks = runtime.api.me.mock.calls.length; const loaded = summaries(runtime);
  await emit('background', 'active');
  expect(runtime.api.me).toHaveBeenCalledTimes(checks + 1);
  expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  expect(await screen.findByRole('button', { name: 'Mira: active' })).toBeOnTheScreen();
  expect(summaries(runtime)).toBeGreaterThan(loaded);
});

test('an inactive and active cycle, such as a permission alert, does not validate the session again', async () => {
  const runtime = setup(); const emit = appStates();
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  const checks = runtime.api.me.mock.calls.length;
  await emit('inactive', 'active');
  expect(runtime.api.me).toHaveBeenCalledTimes(checks);
  expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
});

function switchable(runtime: ReturnType<typeof setup>) {
  const bor = { ...mira, id: '30000000-0000-4000-8000-00000000000b', name: 'Bor', form: 'masculine' as const };
  let serverActive = mira.id;
  const created: characterControllers.CharacterController[] = [];
  const original = characterControllers.createCharacterController;
  jest.spyOn(characterControllers, 'createCharacterController').mockImplementation(options => { const made = original(options); created.push(made); return made; });
  runtime.characterApi.list.mockImplementation(async () => ({ kind: 'success', value: listing([mira, bor], serverActive) }));
  runtime.characterApi.activate.mockImplementation(async (_token: string, id: string) => { serverActive = id; return { kind: 'success', value: listing([mira, bor], id) }; });
  jest.mocked(runtime.oathApi.list).mockImplementation(async () => ({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-09-24T12:00:00Z', paused: false, characterId: serverActive } }));
  Object.assign(runtime.oathApi, { getPause: jest.fn(async () => ({ kind: 'success', value: { paused: false, revision: 'a'.repeat(64), withdraw: [], preserve: [], serverTime: '2026-09-24T12:00:00Z', characterId: serverActive } })) });
  return async () => { await act(async () => { await created[created.length - 1].switch(bor.id); }); await act(async () => {}); };
}

test('a character switch while in Settings resets to the menu', async () => {
  const runtime = setup(); const switchToBor = switchable(runtime);
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  await switchToBor();
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.getByText('Bor')).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Settings' })).toBeNull();
});

test('a pause review never stays open for another character', async () => {
  const runtime = setup(); const switchToBor = switchable(runtime);
  await signIn(runtime);
  await fireEvent.press(await screen.findByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Mira: active' }));
  expect(await screen.findByRole('header', { name: 'Review pause' })).toBeOnTheScreen();
  await switchToBor();
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Review pause' })).toBeNull();
  expect(screen.queryByText('Mira')).toBeNull();
});
