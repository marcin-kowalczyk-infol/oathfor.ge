import { Dimensions } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { AuthView, type AuthViewProps } from './AuthView';

jest.mock('expo-apple-authentication', () => {
  const { Pressable } = require('react-native');
  return {
    AppleAuthenticationButton: (props: object) => <Pressable {...props} testID="native-apple-button" />,
    AppleAuthenticationButtonType: { SIGN_IN: 0 },
    AppleAuthenticationButtonStyle: { WHITE: 0 },
  };
});

const account = { id: '01997aed-8950-7f7a-bda4-36b64697b562', onboardingStatus: 'pending' as const };
const expiresAt = '2026-10-24T12:00:00Z';

test.each([
  ['en', 'Your first steps are coming soon.', 'Your first Oath will be available here. No Oath has started.', 'Sign out'],
  ['pl', 'Pierwsze kroki będą dostępne wkrótce.', 'Tutaj pojawi się Twoja pierwsza Przysięga. Żadna Przysięga jeszcze się nie rozpoczęła.', 'Wyloguj się'],
] as const)('%s offers native login and the correct provisional destination', async (locale, pending, complete, logout) => {
  const callbacks = { onLogin: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const fixture = (state: AuthViewProps['state']) => <LocalizationProvider initialLocale={locale}>
    <AuthView {...callbacks} state={state} availability="available" />
  </LocalizationProvider>;
  const view = await render(fixture({ kind: 'signed_out', error: { kind: 'cancelled' } }));
  await fireEvent.press(screen.getByTestId('native-apple-button'));
  expect(callbacks.onLogin).toHaveBeenCalledTimes(1);
  await view.rerender(fixture({ kind: 'authenticated', account, expiresAt }));
  expect(screen.getByText(pending)).toBeOnTheScreen();
  expect(screen.queryByTestId('native-apple-button')).toBeNull();
  await view.rerender(fixture({ kind: 'authenticated', account: { ...account, onboardingStatus: 'complete' }, expiresAt }));
  expect(screen.getByText(complete)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: logout }));
  expect(callbacks.onLogout).toHaveBeenCalledTimes(1);
});

test('recovery explains unavailable Apple sign-in, pending revocation and confirmed server revocation separately', async () => {
  const callbacks = { onLogin: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const fixture = (state: AuthViewProps['state']) => <LocalizationProvider initialLocale="en">
    <AuthView {...callbacks} state={state} availability="unavailable" />
  </LocalizationProvider>;
  const view = await render(fixture({ kind: 'signed_out' }));
  expect(screen.getByText('Sign in with Apple is unavailable on this device right now.')).toBeOnTheScreen();
  expect(screen.queryByTestId('native-apple-button')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(callbacks.onRetry).toHaveBeenCalledTimes(1);
  await view.rerender(fixture({ kind: 'revocation_pending' }));
  expect(screen.getByText('The server has not confirmed sign-out yet. Reconnect and try again to finish.')).toBeOnTheScreen();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  await view.rerender(fixture({ kind: 'cleanup_required', serverRevoked: true }));
  expect(screen.getByText('The server has confirmed sign-out, but this device still needs to finish clearing the saved session. Try again.')).toBeOnTheScreen();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});

// MVP-22-A3 (clarity.md decision 3): an error after the player's own sign-in replaces the description, at most one filled
// button in every state, PL and EN at 200% text.
const size = (fontScale: number) => Dimensions.set({ window: { width: 402, height: 874, scale: 3, fontScale }, screen: { width: 402, height: 874, scale: 3, fontScale } });
afterEach(() => size(1));
const filled = () => screen.queryAllByRole('button').filter(button => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0);
const show = (locale: 'pl' | 'en', state: AuthViewProps['state'], availability: AuthViewProps['availability'] = 'available') =>
  render(<LocalizationProvider initialLocale={locale}><AuthView onLogin={jest.fn()} onRetry={jest.fn()} onLogout={jest.fn()} state={state} availability={availability} /></LocalizationProvider>);

test.each([
  ['pl', 'Ta próba logowania jest już nieważna. Zaloguj się przez Apple jeszcze raz.', 'Zaloguj się przez Apple, aby rozpocząć swoją drogę lub wrócić do konta.'],
  ['en', 'This sign-in attempt is no longer valid. Sign in with Apple again.', 'Sign in with Apple to begin your journey or return to your account.'],
] as const)('%s a spent sign-in attempt replaces the description with its short line', async (locale, error, description) => {
  await show(locale, { kind: 'signed_out', error: { kind: 'fresh_challenge' } });
  expect(screen.getByText(error)).toBeOnTheScreen();
  expect(screen.queryByText(description)).toBeNull();
  expect(screen.getByTestId('native-apple-button')).toBeOnTheScreen();
});

// MVP-22-G24: the drawn Polish heading and description keep a single-letter word with the next word. English keeps ordinary spaces.
test.each([
  ['pl', 'Witaj w Oathforge', 'Nie udało się potwierdzić sesji. Sprawdź połączenie i spróbuj ponownie lub wyloguj się.'],
  ['en', 'Welcome to Oathforge', 'We could not confirm your session. Check your connection and try again, or sign out.'],
] as const)('%s binds single-letter words in drawn lines only in Polish', async (locale, heading, description) => {
  const raw = { normalizer: (text: string) => text };
  const view = await show(locale, { kind: 'signed_out' });
  expect(screen.getByText(heading, raw)).toBeOnTheScreen();
  await view.unmount();
  await show(locale, { kind: 'verification_unavailable' });
  expect(screen.getByText(description, raw)).toBeOnTheScreen();
});

test('while Apple sign-in is unavailable the reason stays instead of an older error', async () => {
  await show('en', { kind: 'signed_out', error: { kind: 'unavailable', retry: 'request' } }, 'unavailable');
  expect(screen.getByText('Sign in with Apple is unavailable on this device right now.')).toBeOnTheScreen();
  expect(screen.queryByText('We could not finish signing you in. Check your connection and start a new sign-in attempt.')).toBeNull();
});

test.each([
  ['pl', 'Wylogowanie nie jest zakończone, bo nie udało się odczytać lub zaktualizować zapisanej sesji na tym urządzeniu. Spróbuj ponownie przed logowaniem.'],
  ['en', 'Sign-out is not complete because this device could not read or update the saved session. Try again before signing in.'],
] as const)('%s an unconfirmed cleanup says so in two sentences with one filled retry', async (locale, line) => {
  await show(locale, { kind: 'cleanup_required', serverRevoked: false });
  expect(screen.getByText(line)).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
});

const states: [string, AuthViewProps['state'], AuthViewProps['availability']][] = [
  ['signed out', { kind: 'signed_out' }, 'available'],
  ['signed out, Apple unavailable', { kind: 'signed_out' }, 'unavailable'],
  ['signed out after a rate limit', { kind: 'signed_out', error: { kind: 'rate_limited', retry: 'request', retryAfterSeconds: 30 } }, 'available'],
  ['authenticating', { kind: 'authenticating' }, 'available'],
  ['verification unavailable', { kind: 'verification_unavailable' }, 'available'],
  ['revocation pending', { kind: 'revocation_pending' }, 'available'],
  ['cleanup required', { kind: 'cleanup_required', serverRevoked: true }, 'available'],
  ['authenticated', { kind: 'authenticated', account, expiresAt }, 'available'],
];
test.each((['pl', 'en'] as const).flatMap(locale => states.map(([name, state, availability]) => [locale, name, state, availability] as const)))('%s %s at text scale 2 shows a heading and at most one filled button', async (locale, _name, state, availability) => {
  size(2);
  await show(locale, state, availability);
  expect(screen.getByRole('header')).toBeOnTheScreen();
  expect(filled().length).toBeLessThanOrEqual(1);
});
