import { render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { GameChoice } from './GameChoice';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));

// MVP-22-G24: a drawn Polish label keeps a single-letter word with the next word. The spoken label stays plain.
test.each([['pl', 'W przyszłym terminie', 'W przyszłym terminie'], ['en', 'At a later time', 'At a later time']] as const)('%s binds only the drawn label', async (locale, label, drawn) => {
  await render(<LocalizationProvider initialLocale={locale}><GameChoice label={label} symbol="◷" selected={false} disabled={false} onPress={jest.fn()} /></LocalizationProvider>);
  expect(screen.getByText(drawn, { normalizer: text => text })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: label })).toBeOnTheScreen();
});
