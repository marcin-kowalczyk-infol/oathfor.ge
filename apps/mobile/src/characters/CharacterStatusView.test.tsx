import { render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { CharacterStatusView } from './CharacterStatusView';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));

const raw = { normalizer: (text: string) => text };
const unavailable = { kind: 'unavailable', error: { kind: 'unavailable', retry: 'request' } } as const;

test.each([
  ['pl', 'Kuźnia jest teraz nieosiągalna. Sprawdź połączenie i spróbuj ponownie.'],
  ['en', 'The Forge cannot be reached right now. Check your connection and try again.'],
] as const)('%s keeps single-letter words with the next word only in Polish', async (locale, message) => {
  await render(<LocalizationProvider initialLocale={locale}><CharacterStatusView state={unavailable} onRetry={jest.fn()} onLogout={jest.fn()} /></LocalizationProvider>);
  expect(screen.getByText(message, raw)).toBeOnTheScreen();
});
