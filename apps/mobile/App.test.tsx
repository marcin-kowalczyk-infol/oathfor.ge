import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App, { DiagnosticScreen } from './App';
import { Pressable } from 'react-native';
import { LocalizationProvider, useTranslation } from './src/localization/LocalizationProvider';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'de-DE' }] }));

const mockAuthProps: Record<string, unknown>[] = [];
jest.mock('./src/auth/AuthScreen', () => ({ AuthScreen: (props: Record<string, unknown>) => {
  mockAuthProps.push(props);
  const { Text } = require('react-native');
  const { useTranslation } = require('./src/localization/LocalizationProvider');
  return <Text>{useTranslation().t('auth.signInTitle')}</Text>;
} }));

beforeEach(() => {
  process.env.EXPO_PUBLIC_DIAGNOSTIC_MODE = 'true';
  process.env.EXPO_PUBLIC_API_BASE_URL = 'http://localhost:18082';
  process.env.EXPO_PUBLIC_DIAGNOSTIC_LOCALE = 'pl';
});

afterEach(() => jest.restoreAllMocks());

test.each([['pl', 'Sprawdzanie połączenia…', 'Połączenie z API działa.'], ['en', 'Checking connection…', 'Connected to the API.']])('shows pending then success in %s', async (locale, pending, success) => {
  process.env.EXPO_PUBLIC_DIAGNOSTIC_LOCALE = locale;
  let resolveRequest!: (value: Response) => void;
  jest.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
  await render(<App />);
  expect(screen.getByText(pending)).toBeOnTheScreen();
  await act(async () => resolveRequest({ status: 200, headers: { get: () => 'application/json' }, json: async () => ({ status: 'ok' }) } as unknown as Response));
  expect(screen.getByText(success)).toBeOnTheScreen();
});

test.each([['pl', 'Nie udało się potwierdzić połączenia.', 'Spróbuj ponownie', 'Połączenie z API działa.'], ['en', 'Could not confirm the connection.', 'Try again', 'Connected to the API.']])('recovers with an accessible retry in %s', async (locale, error, retry, success) => {
  process.env.EXPO_PUBLIC_DIAGNOSTIC_LOCALE = locale;
  jest.spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new Error('network unavailable'))
    .mockResolvedValueOnce({ status: 200, headers: { get: () => 'application/json' }, json: async () => ({ status: 'ok' }) } as unknown as Response);
  await render(<App />);
  expect(await screen.findByText(error)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: retry }));
  expect(await screen.findByText(success)).toBeOnTheScreen();
});

test('times out and ignores a late success', async () => {
  jest.useFakeTimers();
  let resolveRequest!: (value: Response) => void;
  jest.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise((resolve) => { resolveRequest = resolve; }));
  try {
    await render(<App />);
    await act(async () => { jest.advanceTimersByTime(8000); });
    expect(screen.getByText('Nie udało się potwierdzić połączenia.')).toBeOnTheScreen();
    await act(async () => resolveRequest({ status: 200, headers: { get: () => 'application/json' }, json: async () => ({ status: 'ok' }) } as unknown as Response));
    expect(screen.queryByText('Połączenie z API działa.')).not.toBeOnTheScreen();
  } finally {
    jest.useRealTimers();
  }
});

test('aborts pending work when the screen unmounts', async () => {
  let requestSignal: AbortSignal | undefined;
  jest.spyOn(globalThis, 'fetch').mockImplementation((_url, init) => {
    requestSignal = init?.signal as AbortSignal;
    return new Promise(() => {});
  });
  const view = await render(<App />);
  await view.unmount();
  expect(requestSignal?.aborted).toBe(true);
});

test('shows a recoverable error for a malformed response', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({ status: 200, headers: { get: () => 'application/json' }, json: async () => ({ status: 'wrong' }) } as unknown as Response);
  await render(<App />);
  expect(await screen.findByText('Nie udało się potwierdzić połączenia.')).toBeOnTheScreen();
  expect(screen.queryByText('Połączenie z API działa.')).not.toBeOnTheScreen();
});

function ChangeLanguage() {
  const { i18n } = useTranslation();
  return <Pressable accessibilityRole="button" accessibilityLabel="English" onPress={() => { void i18n.changeLanguage('en'); }} />;
}

test('uses English fallback for an unsupported device language without diagnostic override', async () => {
  delete process.env.EXPO_PUBLIC_DIAGNOSTIC_LOCALE;
  jest.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  await render(<App />);
  expect(screen.getByText('Checking connection…')).toBeOnTheScreen();
});

test('language changes translate pending work without restarting the request', async () => {
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  await render(<LocalizationProvider initialLocale="pl"><DiagnosticScreen /><ChangeLanguage /></LocalizationProvider>);
  expect(screen.getByText('Sprawdzanie połączenia…')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText('Checking connection…')).toBeOnTheScreen();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect((fetchMock.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(false);
});

test('product entry ignores diagnostic locale unless diagnostic mode is explicit', async () => {
  process.env.EXPO_PUBLIC_DIAGNOSTIC_MODE = 'false';
  const fetch = jest.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  await render(<App />);
  expect(screen.getByText('Welcome to Oathforge')).toBeOnTheScreen();
  expect(fetch).not.toHaveBeenCalled();
});

test('product entry wires the character client and secure creation storage like the Oath client', async () => {
  process.env.EXPO_PUBLIC_DIAGNOSTIC_MODE = 'false';
  jest.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise(() => {}));
  const { secureCreationStorage } = require('./src/characters/creationStorage');
  await render(<App />);
  const props = mockAuthProps[mockAuthProps.length - 1];
  expect(props.creationStorage).toBe(secureCreationStorage);
  expect(props.characterApi).toEqual(expect.objectContaining({ list: expect.any(Function), create: expect.any(Function), activate: expect.any(Function) }));
  expect(props.oathApi).toBeDefined();
});
