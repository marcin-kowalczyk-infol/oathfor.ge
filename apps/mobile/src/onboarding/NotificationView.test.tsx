import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { NotificationView, type NotificationViewProps } from './NotificationView';

const callbacks = () => ({ onEnable: jest.fn(), onSkip: jest.fn(), onRetryPermission: jest.fn(), onSettings: jest.fn() });

test.each([
  ['en', 'Saved preference: notifications enabled.', 'This device does not allow notifications. You can continue without changing this.', 'Continue', 'Open Settings', 'About notifications'],
  ['pl', 'Zapisany wybór: powiadomienia włączone.', 'To urządzenie nie zezwala na powiadomienia. Możesz kontynuować bez zmiany tego ustawienia.', 'Dalej', 'Otwórz ustawienia', 'O powiadomieniach'],
] as const)('%s keeps saved opt-in separate from denial and leaves completion to the final review', async (locale, preference, denied, next, settings, link) => {
  const actions = callbacks();
  await render(<LocalizationProvider initialLocale={locale}><NotificationView {...actions} preference="enabled"
    state={{ permission: { kind: 'denied', canAskAgain: false }, busy: false }} /></LocalizationProvider>);
  // MVP-22-B1 (G6): the denial blocks the chosen notifications, so it stays visible. The saved preference sentence opens behind the link.
  expect(screen.getByText(denied)).toBeOnTheScreen();
  expect(screen.queryByText(preference)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: link }));
  expect(screen.getByText(preference)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: settings }));
  expect(actions.onSettings).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: next })).toBeNull();
  expect(actions.onEnable).not.toHaveBeenCalled();
  expect(actions.onRetryPermission).not.toHaveBeenCalled();
});

test('only explicit controls request permission; busy disables choice and quiet access does not prompt again', async () => {
  const actions = callbacks();
  const fixture = (preference: NotificationViewProps['preference'], state: NotificationViewProps['state']) =>
    <LocalizationProvider initialLocale="en"><NotificationView {...actions} preference={preference} state={state} /></LocalizationProvider>;
  const initial = { permission: { kind: 'not_determined' as const, canAskAgain: true }, busy: false };
  const view = await render(fixture(null, initial));
  expect(actions.onEnable).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(actions.onSkip).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Enable notifications' }));
  expect(actions.onEnable).toHaveBeenCalledTimes(1);
  await view.rerender(fixture(null, { ...initial, busy: true }));
  await fireEvent.press(screen.getByRole('button', { name: 'Enable notifications', disabled: true }));
  expect(actions.onEnable).toHaveBeenCalledTimes(1);
  await view.rerender(fixture('enabled', initial));
  await fireEvent.press(screen.getByRole('button', { name: 'Ask for permission' }));
  expect(actions.onRetryPermission).toHaveBeenCalledTimes(1);
  await view.rerender(fixture('enabled', { ...initial, permission: { kind: 'provisional', canAskAgain: true }, error: 'settings' }));
  expect(screen.getByText('This device allows quiet notifications. Alerts and sounds are not guaranteed.')).toBeOnTheScreen();
  expect(screen.getByText('Settings could not be opened. You can try again or continue.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Ask for permission' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Continue' })).toBeNull();
});

// MVP-22-A2 (clarity.md rule 1), revised in MVP-22-B1 (G6): before the choice the honesty line and the buttons stay visible.
// The preference sentence and the account and device explanations fold behind one link. The device line stays out only when
// it blocks the notifications the player turned on.
const fixture = (locale: 'pl' | 'en', permission: NotificationViewProps['state']['permission'], preference: NotificationViewProps['preference'] = 'enabled', error?: 'save') =>
  <LocalizationProvider initialLocale={locale}><NotificationView {...callbacks()} preference={preference} state={{ permission, busy: false, ...(error ? { error } : {}) }} /></LocalizationProvider>;

test.each([
  ['pl', 'Przypomnienia nie są jeszcze wysyłane.', 'O powiadomieniach', 'Twój wybór', 'To urządzenie zezwala na powiadomienia. Ich dostarczenie zależy też od ustawień urządzenia.'],
  ['en', 'Reminders are not sent yet.', 'About notifications', 'Your choice', 'This device allows notifications. Delivery also depends on your device settings.'],
] as const)('%s folds the explanations and keeps the honesty line visible', async (locale, honesty, link, heading, granted) => {
  await render(fixture(locale, { kind: 'granted', canAskAgain: true }, null));
  expect(screen.getByText(honesty)).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: heading })).toBeNull();
  expect(screen.queryByText(granted)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: link }));
  expect(screen.getByRole('header', { name: heading })).toBeOnTheScreen();
  expect(screen.getByText(granted)).toBeOnTheScreen();
});

test.each([
  [{ kind: 'denied', canAskAgain: false }, 'This device does not allow notifications. You can continue without changing this.'],
  [{ kind: 'unavailable', canAskAgain: false }, 'We could not check notification permission on this device. After saving your choice, you can continue without it.'],
  [{ kind: 'provisional', canAskAgain: true }, 'This device allows quiet notifications. Alerts and sounds are not guaranteed.'],
] as const)('a %o device line stays visible because it blocks the notifications the player turned on', async (permission, line) => {
  await render(fixture('en', permission));
  expect(screen.getAllByText(line)).toHaveLength(1);
});

test.each([
  [null, { kind: 'denied', canAskAgain: false }, 'This device does not allow notifications. You can continue without changing this.'],
  ['disabled', { kind: 'denied', canAskAgain: false }, 'This device does not allow notifications. You can continue without changing this.'],
  ['disabled', { kind: 'unavailable', canAskAgain: false }, 'We could not check notification permission on this device. After saving your choice, you can continue without it.'],
  ['enabled', { kind: 'granted', canAskAgain: true }, 'This device allows notifications. Delivery also depends on your device settings.'],
] as const)('with preference %s a %o device line blocks nothing and opens behind the link', async (preference, permission, line) => {
  await render(fixture('en', permission, preference));
  expect(screen.queryByText(line)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'About notifications' }));
  expect(screen.getAllByText(line)).toHaveLength(1);
});

test('after the choice the honesty line opens behind the link too, before it the preference sentence does', async () => {
  const honesty = 'Reminders are not sent yet.';
  const undecided = 'Choose whether you want notifications. Nothing is saved until you choose.';
  const view = await render(fixture('en', { kind: 'granted', canAskAgain: true }, null));
  expect(screen.getByText(honesty)).toBeOnTheScreen();
  expect(screen.queryByText(undecided)).toBeNull();
  await view.rerender(fixture('en', { kind: 'granted', canAskAgain: true }, 'disabled'));
  expect(screen.queryByText(honesty)).toBeNull();
});

test.each([
  ['pl', 'Nie udało się potwierdzić zapisu wyboru, więc nie pytaliśmy o zgodę. Spróbuj ponownie lub wybierz Nie teraz.'],
  ['en', 'We could not confirm your choice was saved, so we did not ask for permission. Try again or choose Not now.'],
] as const)('%s failed save is uncertain, says no prompt opened, in two sentences', async (locale, line) => {
  await render(fixture(locale, { kind: 'not_determined', canAskAgain: true }, null, 'save'));
  expect(screen.getByText(line)).toBeOnTheScreen();
});
