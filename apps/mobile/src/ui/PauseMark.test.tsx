import { render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { PauseMark } from './PauseMark';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));

// docs/product/clarity.md rules 4 and 5: each pause state has its own shape and a visible label, never only a colour.
test.each([
  ['pl', 'active', 'W grze', 'seal'], ['pl', 'paused', 'W pauzie', 'bars'], ['pl', 'unknown', 'Stan nieznany', 'ring'],
  ['en', 'active', 'In play', 'seal'], ['en', 'paused', 'Paused', 'bars'], ['en', 'unknown', 'Unknown', 'ring'],
] as const)('%s %s shows "%s" beside its %s shape', async (locale, state, label, shape) => {
  await render(<LocalizationProvider initialLocale={locale}><PauseMark state={state} /></LocalizationProvider>);
  expect(screen.getByText(label)).toBeOnTheScreen();
  expect(screen.getByTestId(`pause-mark-${shape}`, { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByTestId('pause-mark')).toHaveProp('accessibilityLabel', label);
});
