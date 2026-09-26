import { Text, Pressable } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { createTranslation } from './createTranslation';
import { LocalizationProvider, useTranslation } from './LocalizationProvider';
import { formatDeadline } from './format';

test.each([
  [1, 'Pozostała 1 próba uzupełnienia.'],
  [2, 'Pozostały 2 próby uzupełnienia.'],
  [5, 'Pozostało 5 prób uzupełnienia.'],
  [12, 'Pozostało 12 prób uzupełnienia.'],
  [22, 'Pozostały 22 próby uzupełnienia.'],
  [1.5, 'Pozostało 1,5 próby uzupełnienia.'],
])('renders Polish plural category for %s', (count, expected) => {
  expect(createTranslation('pl').t('evidence.correctionsRemaining', { count })).toBe(expected);
});

test('selects Polish and English plurals without Intl.PluralRules, as on Hermes for iOS', () => {
  const original = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!;
  Object.defineProperty(Intl, 'PluralRules', { value: undefined, configurable: true, writable: true });
  try {
    const pl = createTranslation('pl');
    expect(pl.t('auth.rateLimited', { count: 5 })).toBe('Zbyt wiele prób. Poczekaj 5 sekund przed ponownym logowaniem.');
    expect(pl.t('auth.rateLimited', { count: 22 })).toBe('Zbyt wiele prób. Poczekaj 22 sekundy przed ponownym logowaniem.');
    const en = createTranslation('en');
    expect(en.t('auth.rateLimited', { count: 1 })).toBe('Too many attempts. Wait 1 second before signing in again.');
    expect(en.t('auth.rateLimited', { count: 5 })).toBe('Too many attempts. Wait 5 seconds before signing in again.');
  } finally { Object.defineProperty(Intl, 'PluralRules', original); }
});

test('renders complete English messages with named interpolation', () => {
  const { t } = createTranslation('en');
  expect(t('evidence.correctionsRemaining', { count: 1 })).toBe('1 correction attempt remains.');
  expect(t('evidence.correctionsRemaining', { count: 2 })).toBe('2 correction attempts remain.');
  expect(t('common.greeting', { name: 'Żaromir & friend' })).toBe('Welcome, Żaromir & friend.');
});

function LanguageProbe() {
  const { t, i18n } = useTranslation();
  return <><Text>{t('diagnostics.pending')}</Text><Pressable accessibilityRole="button" accessibilityLabel="English" onPress={() => { void i18n.changeLanguage('en'); }} /></>;
}

test('updates mounted consumers when language changes', async () => {
  await render(<LocalizationProvider initialLocale="pl"><LanguageProbe /></LocalizationProvider>);
  expect(screen.getByText('Sprawdzanie połączenia…')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'English' }));
  expect(screen.getByText('Checking connection…')).toBeOnTheScreen();
  expect(screen.queryByText('Sprawdzanie połączenia…')).not.toBeOnTheScreen();
});

test('formats the same deadline in its committed timezone in both languages', () => {
  const instant = new Date('2026-09-24T18:00:00.000Z');
  for (const locale of ['pl', 'en'] as const) {
    expect(formatDeadline(instant, locale, 'Europe/Warsaw')).toContain('20:00');
    expect(formatDeadline(instant, locale, 'UTC')).toContain('18:00');
  }
  expect(instant.toISOString()).toBe('2026-09-24T18:00:00.000Z');
});
