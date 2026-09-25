import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { NotificationView, type NotificationViewProps } from './NotificationView';

const callbacks = () => ({ onEnable: jest.fn(), onSkip: jest.fn(), onRetryPermission: jest.fn(), onSettings: jest.fn(), onContinue: jest.fn() });

test.each([
  ['en', 'Saved preference: notifications enabled.', 'This device does not allow notifications. You can continue without changing this.', 'Continue', 'Open Settings'],
  ['pl', 'Zapisany wybór: powiadomienia włączone.', 'To urządzenie nie zezwala na powiadomienia. Możesz kontynuować bez zmiany tego ustawienia.', 'Dalej', 'Otwórz ustawienia'],
] as const)('%s keeps saved opt-in separate from denial and offers continuation', async (locale, preference, denied, next, settings) => {
  const actions = callbacks();
  await render(<LocalizationProvider initialLocale={locale}><NotificationView {...actions} preference="enabled"
    state={{ permission: { kind: 'denied', canAskAgain: false }, busy: false, continued: false }} /></LocalizationProvider>);
  expect(screen.getByText(preference)).toBeOnTheScreen();
  expect(screen.getByText(denied)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: settings }));
  expect(actions.onSettings).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: next }));
  expect(actions.onContinue).toHaveBeenCalledTimes(1);
  expect(actions.onEnable).not.toHaveBeenCalled();
  expect(actions.onRetryPermission).not.toHaveBeenCalled();
});

test('only explicit controls request permission; busy disables choice and quiet access does not prompt again', async () => {
  const actions = callbacks();
  const fixture = (preference: NotificationViewProps['preference'], state: NotificationViewProps['state']) =>
    <LocalizationProvider initialLocale="en"><NotificationView {...actions} preference={preference} state={state} /></LocalizationProvider>;
  const initial = { permission: { kind: 'not_determined' as const, canAskAgain: true }, busy: false, continued: false };
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
  expect(screen.getByRole('button', { name: 'Continue', disabled: false })).toBeOnTheScreen();
});
