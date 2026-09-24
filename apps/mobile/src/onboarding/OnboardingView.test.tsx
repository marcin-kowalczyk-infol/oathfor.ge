import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OnboardingView, type OnboardingViewProps } from './OnboardingView';
import type { OnboardingState } from './controller';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const ready: Extract<OnboardingState, { kind: 'ready' }> = {
  kind: 'ready', busy: false,
  value: { profile: { locale: null, timezone: null, intention: null, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' },
  draft: { locale: 'en', timezone: 'Europe/Warsaw', intention: false },
};

test.each([
  ['en', 'Confirm choices', 'I want to be active regularly', 'Timezone', 'Confirm your intention to continue.'],
  ['pl', 'Potwierdź wybory', 'Chcę regularnie podejmować aktywność', 'Strefa czasowa', 'Potwierdź swoją intencję, aby kontynuować.'],
] as const)('%s requires explicit valid choices and retains unsaved drafts on failure', async (locale, save, intention, timezone, reason) => {
  const callbacks = { onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const fixture = (state: OnboardingViewProps['state']) => <LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} /></LocalizationProvider>;
  const view = await render(fixture(ready));
  expect(callbacks.onSave).not.toHaveBeenCalled();
  expect(screen.getByText(reason)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: save, disabled: true }));
  expect(callbacks.onSave).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('checkbox', { name: intention, checked: false }));
  expect(callbacks.onDraft).toHaveBeenCalledWith({ intention: true });
  await fireEvent.changeText(screen.getByLabelText(timezone), 'UTC');
  expect(callbacks.onDraft).toHaveBeenCalledWith({ timezone: 'UTC' });
  await view.rerender(fixture({ ...ready, draft: { ...ready.draft, timezone: 'UTC', intention: true }, error: 'save' }));
  expect(screen.getByDisplayValue('UTC')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: save, disabled: false }));
  expect(callbacks.onSave).toHaveBeenCalledTimes(1);
});

test('waits for profile hydration and exposes only the server-confirmed destination', async () => {
  const callbacks = { onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const fixture = (state: OnboardingViewProps['state']) => <LocalizationProvider initialLocale="en"><OnboardingView state={state} {...callbacks} /></LocalizationProvider>;
  const view = await render(fixture({ kind: 'loading' }));
  expect(screen.getByText('Loading your confirmed choices…')).toBeOnTheScreen();
  expect(screen.queryByText('Your first Oath')).toBeNull();
  await view.rerender(fixture({ ...ready, value: { onboardingStatus: 'complete', profile: { locale: 'en', timezone: 'UTC', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' } } }));
  expect(screen.getByText('Your first Oath will be available here. No Oath has started.')).toBeOnTheScreen();
  expect(screen.queryByRole('checkbox')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(callbacks.onLogout).toHaveBeenCalledTimes(1);
});
