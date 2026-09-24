import { fireEvent, render, screen } from '@testing-library/react-native';
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
  expect(screen.getByText('Sign-out is not yet confirmed by the server. Reconnect and try again to finish.')).toBeOnTheScreen();
  expect(screen.getAllByRole('button')).toHaveLength(1);
  await view.rerender(fixture({ kind: 'cleanup_required', serverRevoked: true }));
  expect(screen.getByText('The server has confirmed sign-out, but this device still needs to finish clearing the saved session. Try again.')).toBeOnTheScreen();
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
