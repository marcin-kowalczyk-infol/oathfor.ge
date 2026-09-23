import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from './App';

beforeEach(() => {
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
