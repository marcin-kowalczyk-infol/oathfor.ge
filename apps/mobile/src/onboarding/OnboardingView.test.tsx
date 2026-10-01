import type { TestInstance } from 'test-renderer';
import { Dimensions } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OnboardingView, type OnboardingViewProps } from './OnboardingView';
import type { OnboardingState } from './controller';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
function findImage(node: TestInstance): TestInstance | undefined {
  if (node.type === 'Image' && node.props.testID !== 'companion-avatar-image') return node;
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
  ['en', 'Confirm choices', 'I want to be active regularly', 'Timezone', 'Confirm your goal to continue.'],
  ['pl', 'Potwierdź wybory', 'Chcę regularnie podejmować aktywność', 'Strefa czasowa', 'Potwierdź swój cel, aby kontynuować.'],
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
  ['en', 'Continue', 'Try again', 'Language: English', 'Timezone: Europe/Warsaw', 'Goal: I want to be active regularly', 'You have met Zharomir.', 'Trial of the Spark'],
  ['pl', 'Dalej', 'Spróbuj ponownie', 'Język: Polski', 'Strefa czasowa: Europe/Warsaw', 'Cel: Chcę regularnie podejmować aktywność', 'Żaromir już Ci się przedstawił.', 'Próba Iskry'],
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
  ['en', 'Continue', 'I am Zharomir, a guardian linked to Veles. I will help you remember the rules and your next steps.'],
  ['pl', 'Dalej', 'Jestem Żaromir, strażnik związany z Welesem. Pomogę Ci pamiętać zasady i kolejne kroki.'],
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

// MVP-22-A2 (clarity.md rules 1, 3 and 9): short lines, Żaromir introduces himself in his bubble above Dalej,
// at most one filled button in every state, PL and EN at 200% text.
const size = (fontScale: number) => Dimensions.set({ window: { width: 402, height: 874, scale: 3, fontScale }, screen: { width: 402, height: 874, scale: 3, fontScale } });
afterEach(() => size(1));
const filled = () => screen.queryAllByRole('button').filter(button => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0);
const profile = { locale: 'pl' as const, timezone: 'Europe/Warsaw', intention: 'regular_activity' as const, companionIntroduced: true, notificationPreference: 'enabled' as const };
const notificationProps = { state: { permission: { kind: 'granted' as const, canAskAgain: true }, busy: false }, onEnable: jest.fn(), onSkip: jest.fn(), onRetryPermission: jest.fn(), onSettings: jest.fn() };
const states: [string, OnboardingViewProps['state'], number][] = [
  ['loading', { kind: 'loading' }, 0],
  ['unavailable', { kind: 'unavailable' } as OnboardingViewProps['state'], 1],
  ['basics', ready, 1],
  ['basics after a failed save', { ...ready, draft: { ...ready.draft, intention: true }, error: 'save' }, 1],
  ['introduction', { ...ready, value: { profile: { ...profile, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' } }, 1],
  ['notifications', { ...ready, value: { profile: { ...profile, notificationPreference: null }, onboardingStatus: 'pending' } }, 1],
  ['review', { ...ready, value: { profile, onboardingStatus: 'pending' } }, 1],
  ['review after a failed completion', { ...ready, value: { profile, onboardingStatus: 'pending' }, error: 'complete' }, 1],
  ['complete', { ...ready, value: { profile, onboardingStatus: 'complete' } }, 0],
];
test.each((['pl', 'en'] as const).flatMap(locale => states.map(([name, state, count]) => [locale, name, state, count] as const)))('%s %s at text scale 2 keeps sign-out and at most one filled button', async (locale, _name, state, count) => {
  size(2);
  const callbacks = { onComplete: jest.fn(), onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} notifications={notificationProps} /></LocalizationProvider>);
  expect(filled()).toHaveLength(count);
  expect(screen.getByRole('button', { name: locale === 'pl' ? 'Wyloguj się' : 'Sign out' })).toBeOnTheScreen();
});

test.each([
  ['pl', 'Wybierz język i strefę, potem potwierdź. Wcześniej nic nie zapiszemy.', 'Nie udało się potwierdzić zapisu, zmiany zostały na ekranie. Spróbuj ponownie.'],
  ['en', 'Choose language and timezone, then confirm. Nothing is saved before that.', 'Could not confirm the save, your changes stay on screen. Try again.'],
] as const)('%s basics say what to do in one short line and a failed save in one more', async (locale, line, error) => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={{ ...ready, draft: { ...ready.draft, intention: true }, error: 'save' }} {...callbacks} /></LocalizationProvider>);
  expect(screen.getByText(line)).toBeOnTheScreen();
  expect(screen.getByText(error)).toBeOnTheScreen();
});

test.each([
  ['pl', 'Jestem Żaromir, strażnik związany z Welesem. Pomogę Ci pamiętać zasady i kolejne kroki.', 'Dalej'],
  ['en', 'I am Zharomir, a guardian linked to Veles. I will help you remember the rules and your next steps.', 'Continue'],
] as const)('%s introduction is Żaromir speaking in his bubble above the continue button', async (locale, line, next) => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const state: OnboardingViewProps['state'] = { ...ready, value: { profile: { ...profile, locale, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' } };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} /></LocalizationProvider>);
  expect(screen.getByTestId('companion-avatar', { includeHiddenElements: true })).toBeTruthy();
  const tree = JSON.stringify(screen.toJSON());
  expect(tree.indexOf(line)).toBeGreaterThan(-1);
  expect(tree.indexOf(line)).toBeLessThan(tree.indexOf(`"${next}"`));
});

test.each([
  ['pl', 'Powiadomienia są opcjonalne. Możesz przejść dalej bez nich.', 'Wszystko zapisane. Przejście dalej nie tworzy jeszcze Przysięgi.', 'Nie udało się zakończyć przygotowań, zapisane wybory zostają. Spróbuj ponownie.'],
  ['en', 'Notifications are optional. You can continue without them.', 'All saved. Continuing does not create an Oath yet.', 'Could not finish setup, your saved choices stay. Try again.'],
] as const)('%s notification and review steps use the short lines', async (locale, pending, review, error) => {
  const callbacks = { onComplete: jest.fn(), onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const fixture = (state: OnboardingViewProps['state']) => <LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} notifications={notificationProps} /></LocalizationProvider>;
  const view = await render(fixture({ ...ready, value: { profile: { ...profile, notificationPreference: null }, onboardingStatus: 'pending' } }));
  expect(screen.getByText(pending)).toBeOnTheScreen();
  await view.rerender(fixture({ ...ready, value: { profile, onboardingStatus: 'pending' } }));
  expect(screen.getByText(review)).toBeOnTheScreen();
  await view.rerender(fixture({ ...ready, value: { profile, onboardingStatus: 'pending' }, error: 'complete' }));
  expect(screen.getByText(error)).toBeOnTheScreen();
});
