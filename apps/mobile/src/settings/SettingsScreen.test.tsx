import { Dimensions } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Locale } from '../localization/locale';
import { SettingsScreen, type SettingsScreenProps } from './SettingsScreen';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));

type Data = Omit<SettingsScreenProps, 'onLocale' | 'onNotifications' | 'onRetryPermission' | 'onOpenSystemSettings' | 'onPause' | 'onSignOut' | 'onBack'>;
const base: Data = {
  locale: 'pl', localeState: { saving: false, error: false },
  notificationState: { permission: { kind: 'granted', canAskAgain: true }, busy: false }, preference: 'enabled',
  character: { name: 'Mira' }, paused: false,
};

async function setup(patch: Partial<Data> = {}, ui: Locale = 'en') {
  const handlers = { onLocale: jest.fn(), onNotifications: jest.fn(), onRetryPermission: jest.fn(), onOpenSystemSettings: jest.fn(), onPause: jest.fn(), onSignOut: jest.fn(), onBack: jest.fn() };
  const element = () => <LocalizationProvider initialLocale={ui}><SettingsScreen {...base} {...patch} {...handlers} /></LocalizationProvider>;
  const view = await render(element());
  await act(async () => {});
  return { ...handlers, rerender: async () => { await view.rerender(element()); await act(async () => {}); } };
}

test('selecting the other language calls onLocale once', async () => {
  const f = await setup();
  await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Polski' }));
  expect(f.onLocale).toHaveBeenCalledTimes(1);
  expect(f.onLocale).toHaveBeenCalledWith('en');
});

test('a tap the parent ignored does not block the next tap after a re-render', async () => {
  const f = await setup();
  await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
  await f.rerender();
  expect(screen.getByRole('radio', { name: 'English' })).toBeEnabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
  expect(f.onLocale).toHaveBeenCalledTimes(2);
});

test('while the language saves both options are disabled', async () => {
  const f = await setup({ localeState: { saving: true, error: false } });
  expect(screen.getByRole('radio', { name: 'Polski' })).toBeDisabled();
  expect(screen.getByRole('radio', { name: 'English' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'English' }));
  expect(f.onLocale).not.toHaveBeenCalled();
});

test('a failed language save shows the error line and keeps the current language selected', async () => {
  await setup({ localeState: { saving: false, error: true } });
  expect(screen.getByText('Could not save the language, the previous one stays. Try again.')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Polski' })).toBeSelected();
  expect(screen.getByRole('radio', { name: 'English' })).not.toBeSelected();
});

test('notifications show on for an enabled preference and turning off saves disabled', async () => {
  const f = await setup();
  const toggle = screen.getByRole('switch', { name: 'Notifications' });
  expect(toggle).toBeChecked();
  await fireEvent.press(toggle);
  expect(f.onNotifications).toHaveBeenCalledTimes(1);
  expect(f.onNotifications).toHaveBeenCalledWith(false);
});

test('notifications show off for a disabled preference and turning on saves enabled', async () => {
  const f = await setup({ preference: 'disabled' });
  const toggle = screen.getByRole('switch', { name: 'Notifications' });
  expect(toggle).not.toBeChecked();
  await fireEvent.press(toggle);
  expect(f.onNotifications).toHaveBeenCalledWith(true);
});

test('denied permission with an enabled preference explains it and opens iOS Settings', async () => {
  const f = await setup({ notificationState: { permission: { kind: 'denied', canAskAgain: false }, busy: false } });
  expect(screen.getByText('iOS blocks notifications from Oathforge. Turn them on in iOS Settings.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Ask for permission' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Open iOS Settings' }));
  expect(f.onOpenSystemSettings).toHaveBeenCalledTimes(1);
});

test('a permission that can be asked again offers a retry instead of iOS Settings', async () => {
  const f = await setup({ notificationState: { permission: { kind: 'denied', canAskAgain: true }, busy: false } });
  expect(screen.queryByRole('button', { name: 'Open iOS Settings' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Ask for permission' }));
  expect(f.onRetryPermission).toHaveBeenCalledTimes(1);
});

test('a busy notification change disables the switch', async () => {
  const f = await setup({ notificationState: { permission: { kind: 'granted', canAskAgain: true }, busy: true } });
  const toggle = screen.getByRole('switch', { name: 'Notifications' });
  expect(toggle).toBeDisabled();
  await fireEvent.press(toggle);
  expect(f.onNotifications).not.toHaveBeenCalled();
});

test('a busy notification change says so in text', async () => {
  await setup({ notificationState: { permission: { kind: 'granted', canAskAgain: true }, busy: true } });
  expect(screen.getByText('Updating notifications…')).toBeOnTheScreen();
});

test.each([
  [{ kind: 'unavailable', canAskAgain: false }, 'Could not check notification permission. Your choice is saved.'],
  [{ kind: 'checking', canAskAgain: false }, 'Checking notification permission on this device…'],
] as const)('an enabled preference with %o permission gets a hint', async (permission, hint) => {
  await setup({ notificationState: { permission, busy: false } });
  expect(screen.getByText(hint)).toBeOnTheScreen();
});

test('a failed notification save shows the error line', async () => {
  await setup({ notificationState: { permission: { kind: 'granted', canAskAgain: true }, busy: false, error: 'save' } });
  expect(screen.getByText('The notification choice was not saved. Try again.')).toBeOnTheScreen();
});

test.each([
  [false, 'Mira: in play'],
  [true, 'Mira: paused'],
  [null, 'Mira: state unknown'],
] as const)('the pause row for paused=%s reads "%s" and opens the pause review', async (paused, label) => {
  const f = await setup({ paused });
  await fireEvent.press(screen.getByRole('button', { name: label }));
  expect(f.onPause).toHaveBeenCalledTimes(1);
});

test('sign out calls onSignOut once', async () => {
  const f = await setup();
  const button = screen.getByRole('button', { name: 'Sign out' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(f.onSignOut).toHaveBeenCalledTimes(1);
});

test('back returns to the menu', async () => {
  const f = await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to menu' }));
  expect(f.onBack).toHaveBeenCalledTimes(1);
});

test('renders in Polish without the character gender', async () => {
  await setup({ paused: true, notificationState: { permission: { kind: 'denied', canAskAgain: false }, busy: false } }, 'pl');
  expect(screen.getByRole('header', { name: 'Ustawienia' })).toBeOnTheScreen();
  expect(screen.getByRole('switch', { name: 'Powiadomienia' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Postać Mira: w pauzie' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Otwórz ustawienia iOS' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Wyloguj się' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Wróć do menu' })).toBeOnTheScreen();
});

test('renders in English', async () => {
  await setup({}, 'en');
  expect(screen.getByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Language' })).toBeOnTheScreen();
  expect(screen.getByText('Reminders are not sent yet. Your choice is kept for later.')).toBeOnTheScreen();
});

test('text inside the cards is capped so long Polish words never break mid-word at the largest text', async () => {
  // Native MVP-18 check on iPhone SE 3: "Zapamiętamy" broke as "Zapamiętam / y" in the notifications card.
  await setup({ notificationState: { permission: { kind: 'denied', canAskAgain: false }, busy: false }, localeState: { saving: false, error: true } }, 'pl');
  for (const text of [
    'Przypomnienia nie są jeszcze wysyłane. Zapamiętamy Twój wybór na później.',
    'iOS blokuje powiadomienia z Oathforge. Włącz je w ustawieniach iOS.',
    'Nie udało się zapisać języka, został poprzedni. Spróbuj ponownie.',
    'W grze',
  ]) expect(screen.getByText(text).props.maxFontSizeMultiplier).toBeLessThanOrEqual(2.5);
});

test('without an injected style control Settings has no art style row, as in production', async () => {
  await setup();
  expect(screen.queryByRole('header', { name: 'Face of the Forge' })).toBeNull();
  expect(screen.queryByRole('radio', { name: 'Cinematic' })).toBeNull();
});

test.each([['en', 'Face of the Forge', 'Classic', 'Cinematic'], ['pl', 'Oblicze Kuźni', 'Dawne', 'Filmowe']] as const)('the demo art style row in %s selects the other style once', async (ui, title, classic, cinematic) => {
  const onChange = jest.fn();
  await setup({ artStyle: { value: 'current', onChange } }, ui);
  expect(screen.getByRole('header', { name: title })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: classic, selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: classic }));
  expect(onChange).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('radio', { name: cinematic }));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith('cinematic');
});

// MVP-22-A1: the pause row carries the shared PauseMark, Settings never shows a filled button, and both languages hold at 200% text.
const size = (fontScale: number) => Dimensions.set({ window: { width: 402, height: 874, scale: 3, fontScale }, screen: { width: 402, height: 874, scale: 3, fontScale } });
afterEach(() => size(1));
const filled = () => screen.queryAllByRole('button').filter(button => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0);

test.each([[false, 'In play'], [true, 'Paused'], [null, 'Unknown']] as const)('the pause row for paused=%s shows the "%s" mark', async (paused, label) => {
  await setup({ paused });
  const row = screen.getByRole('button', { name: /^Mira: / });
  expect(within(row).getByTestId('pause-mark')).toHaveProp('accessibilityLabel', label);
  expect(within(row).getByText(label)).toBeOnTheScreen();
});

test.each([
  ['pl', { paused: true, localeState: { saving: false, error: true }, notificationState: { permission: { kind: 'denied', canAskAgain: false }, busy: false, error: 'save' } }, 'W pauzie', 'Nie udało się zapisać języka, został poprzedni. Spróbuj ponownie.'],
  ['en', { paused: false, notificationState: { permission: { kind: 'unavailable', canAskAgain: false }, busy: false } }, 'In play', 'Could not check notification permission. Your choice is saved.'],
  ['pl', { paused: null, notificationState: { permission: { kind: 'granted', canAskAgain: true }, busy: true } }, 'Stan nieznany', 'Aktualizowanie powiadomień…'],
] as const)('%s at text scale 2 keeps every line, the mark and no filled button', async (ui, patch, mark, line) => {
  size(2);
  await setup(patch as Partial<Data>, ui);
  expect(screen.getByText(mark)).toBeOnTheScreen();
  expect(screen.getByText(line)).toBeOnTheScreen();
  expect(filled()).toHaveLength(0);
});
