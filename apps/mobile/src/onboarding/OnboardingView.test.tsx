import type { TestInstance } from 'test-renderer';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OnboardingView, type OnboardingViewProps } from './OnboardingView';
import type { OnboardingState } from './controller';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
function findImage(node: TestInstance): TestInstance | undefined {
  if (node.type === 'Image') return node;
  for (const child of node.children) {
    if (typeof child === 'string') continue;
    const found = findImage(child);
    if (found) return found;
  }
  return undefined;
}

const ready: Extract<OnboardingState, { kind: 'ready' }> = {
  kind: 'ready', busy: false,
  value: { profile: { locale: null, timezone: null, intention: null, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' },
  draft: { locale: 'en', timezone: 'Europe/Warsaw', intention: false },
};

test.each([
  ['en', 'Confirm choices', 'I want to be active regularly', 'Timezone', 'Confirm your intention to continue.'],
  ['pl', 'Potwierdź wybory', 'Chcę regularnie podejmować aktywność', 'Strefa czasowa', 'Potwierdź swoją intencję, aby kontynuować.'],
] as const)('%s requires explicit valid choices and retains unsaved drafts on failure', async (locale, save, intention, timezone, reason) => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
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
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const fixture = (state: OnboardingViewProps['state']) => <LocalizationProvider initialLocale="en"><OnboardingView state={state} {...callbacks} /></LocalizationProvider>;
  const view = await render(fixture({ kind: 'loading' }));
  expect(screen.getByText('Loading your confirmed choices…')).toBeOnTheScreen();
  expect(screen.queryByText('Your first Oath')).toBeNull();
  await view.rerender(fixture({ ...ready, value: { onboardingStatus: 'complete', profile: { locale: 'en', timezone: 'UTC', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' } } }));
  expect(screen.getByText('Creating your first Oath is not available yet. No Oath has started.')).toBeOnTheScreen();
  expect(screen.queryByRole('checkbox')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(callbacks.onLogout).toHaveBeenCalledTimes(1);
});

test.each([
  ['en', 'Continue', 'Try again', 'Language: English', 'Timezone: Europe/Warsaw', 'Intention: I want to be active regularly', 'You have met Zharomir.', 'Trial of the Spark'],
  ['pl', 'Dalej', 'Spróbuj ponownie', 'Język: Polski', 'Strefa czasowa: Europe/Warsaw', 'Intencja: Chcę regularnie podejmować aktywność', 'Żaromir już Ci się przedstawił.', 'Próba Iskry'],
] as const)('%s reviews saved choices and completes only by explicit action, with safe retries', async (locale, next, retry, language, timezone, intention, companion, trial) => {
  const callbacks = { onComplete: jest.fn(), onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const notifications = {
    state: { permission: { kind: 'denied' as const, canAskAgain: false }, busy: false },
    onEnable: jest.fn(), onSkip: jest.fn(), onRetryPermission: jest.fn(), onSettings: jest.fn(),
  };
  const review: Extract<OnboardingState, { kind: 'ready' }> = {
    ...ready, value: { onboardingStatus: 'pending', profile: { locale, timezone: 'Europe/Warsaw', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'enabled' } },
  };
  const fixture = (state = review, nativeBusy = false) => <LocalizationProvider initialLocale={locale}>
    <OnboardingView state={state} {...callbacks} notifications={{ ...notifications, state: { ...notifications.state, busy: nativeBusy } }} />
  </LocalizationProvider>;
  const view = await render(fixture());
  for (const text of [language, timezone, intention, companion]) expect(screen.getByText(text)).toBeOnTheScreen();
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  expect(notifications.onRetryPermission).not.toHaveBeenCalled();
  expect(screen.getAllByRole('button', { name: next })).toHaveLength(1);
  await view.rerender(fixture(review, true));
  await fireEvent.press(screen.getByRole('button', { name: next, disabled: true }));
  expect(callbacks.onComplete).not.toHaveBeenCalled();
  await view.rerender(fixture());
  await fireEvent.press(screen.getByRole('button', { name: next, disabled: false }));
  expect(callbacks.onComplete).toHaveBeenCalledTimes(1);
  await view.rerender(fixture({ ...review, error: 'complete' }));
  await fireEvent.press(screen.getByRole('button', { name: retry }));
  expect(callbacks.onComplete).toHaveBeenCalledTimes(2);
  await view.rerender(fixture({ ...review, error: 'load' }));
  await fireEvent.press(screen.getByRole('button', { name: retry }));
  expect(callbacks.onRetry).toHaveBeenCalledTimes(1);
  await view.rerender(fixture({ ...review, value: { ...review.value, onboardingStatus: 'complete' } }));
  expect(screen.getByRole('header', { name: trial })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: next })).toBeNull();
});


test.each([
  ['en', 'Continue', 'I am Zharomir, a guardian linked to Veles. I will accompany you on the path of your Oath. You choose the commitment; I help you remember its rules and the steps available to you.'],
  ['pl', 'Dalej', 'Jestem Żaromir, strażnik związany z Welesem. Będę ci towarzyszył na drodze Przysięgi. Ty wybierasz zobowiązanie; ja pomagam pamiętać jego zasady i dostępne kroki.'],
] as const)('%s companion introduction retains copy and continuation when decorative art fails', async (locale, next, introduction) => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const state: OnboardingViewProps['state'] = { ...ready, value: { profile: { ...ready.value.profile, locale, timezone: 'Europe/Warsaw', intention: 'regular_activity' }, onboardingStatus: 'pending' } };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} /></LocalizationProvider>);
  expect(screen.getAllByText(introduction)).toHaveLength(1);
  expect(screen.queryByRole('image')).toBeNull();
  await fireEvent(findImage(screen.container)!, 'error', { nativeEvent: { error: 'DUMMY unavailable art' } });
  expect(screen.getByText(introduction)).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: next }));
  expect(callbacks.onIntroduce).toHaveBeenCalledTimes(1);
});
