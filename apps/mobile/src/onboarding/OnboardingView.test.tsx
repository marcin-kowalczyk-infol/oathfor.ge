import type { TestInstance } from 'test-renderer';
import { Dimensions, StyleSheet } from 'react-native';
import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { bindShortWords } from '../localization/typography';
import { OnboardingView, type OnboardingViewProps } from './OnboardingView';
import { tokens } from '../ui/tokens';
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
  ['en', 'Continue', 'Try again', 'Language: English', 'Timezone: Warsaw', 'Intention: I want to be active regularly', 'Notifications: On', 'You have met Zharomir.', 'Trial of the Spark'],
  ['pl', 'Dalej', 'Spróbuj ponownie', 'Język: Polski', 'Strefa: Warszawa', 'Intencja: Chcę regularnie podejmować aktywność', 'Powiadomienia: Włączone', 'Żaromir już Ci się przedstawił.', 'Próba Iskry'],
] as const)('%s reviews saved choices in one summary card and completes only by explicit action, with safe retries', async (locale, next, retry, language, timezone, intention, notificationsRow, companion, trial) => {
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
  // MVP-22-B1 (G7): four rows in one card, the zone by its label, never the IANA id. The companion line is gone.
  const summary = screen.getByTestId('onboarding-summary');
  for (const row of [language, timezone, intention, notificationsRow]) expect(within(summary).getByLabelText(row)).toBeOnTheScreen();
  expect(screen.queryByText(companion)).toBeNull();
  expect(screen.queryByText(/Europe\/Warsaw/)).toBeNull();
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
  ['en', 'Continue', 'I am Zharomir, a guardian linked to Veles. I will help you remember the rules and steps.'],
  ['pl', 'Dalej', 'Jestem Żaromir, strażnik związany z Welesem. Pomogę Ci pamiętać zasady i kroki.'],
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
  ['pl', 'Wybierz język i strefę, potem potwierdź intencję. Wcześniej nic nie zapiszemy.', 'Nie udało się potwierdzić zapisu, zmiany zostały na ekranie. Spróbuj ponownie.'],
  ['en', 'Choose language and timezone, then confirm your intention. Nothing is saved before that.', 'Could not confirm the save, your changes stay on screen. Try again.'],
] as const)('%s basics say what to do in one short line and a failed save replaces it', async (locale, line, error) => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const fixture = (state: OnboardingViewProps['state']) => <LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} /></LocalizationProvider>;
  const view = await render(fixture({ ...ready, draft: { ...ready.draft, intention: true } }));
  expect(screen.getByText(line)).toBeOnTheScreen();
  // MVP-22-A4b: one plain line at a time. The error replaces the line as an alert (the pause review pattern).
  await view.rerender(fixture({ ...ready, draft: { ...ready.draft, intention: true }, error: 'save' }));
  expect(screen.queryByText(line)).toBeNull();
  expect(screen.getAllByText(error)).toHaveLength(1);
  expect(screen.getByText(error)).toHaveProp('accessibilityRole', 'alert');
});

test.each([
  ['pl', 'Jestem Żaromir, strażnik związany z Welesem. Pomogę Ci pamiętać zasady i kroki.', 'Dalej'],
  ['en', 'I am Zharomir, a guardian linked to Veles. I will help you remember the rules and steps.', 'Continue'],
] as const)('%s introduction is Żaromir speaking in his bubble above the continue button', async (locale, line, next) => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const state: OnboardingViewProps['state'] = { ...ready, value: { profile: { ...profile, locale, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' } };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} /></LocalizationProvider>);
  expect(screen.getByTestId('companion-avatar', { includeHiddenElements: true })).toBeTruthy();
  const tree = JSON.stringify(screen.toJSON());
  const drawn = bindShortWords(line, locale);
  expect(tree.indexOf(drawn)).toBeGreaterThan(-1);
  expect(tree.indexOf(drawn)).toBeLessThan(tree.indexOf(`"${next}"`));
});

test.each([
  ['pl', 'Powiadomienia są opcjonalne. Możesz przejść dalej bez nich.', 'Przejście dalej nie tworzy jeszcze Przysięgi.', 'Nie udało się zakończyć przygotowań, zapisane wybory zostają. Spróbuj ponownie.'],
  ['en', 'Notifications are optional. You can continue without them.', 'Continuing does not create an Oath yet.', 'Could not finish setup, your saved choices stay. Try again.'],
] as const)('%s notification and review steps use the short lines', async (locale, pending, review, error) => {
  const callbacks = { onComplete: jest.fn(), onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const fixture = (state: OnboardingViewProps['state']) => <LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} notifications={notificationProps} /></LocalizationProvider>;
  const view = await render(fixture({ ...ready, value: { profile: { ...profile, notificationPreference: null }, onboardingStatus: 'pending' } }));
  expect(screen.getByText(pending)).toBeOnTheScreen();
  await view.rerender(fixture({ ...ready, value: { profile, onboardingStatus: 'pending' } }));
  expect(screen.getByText(review)).toBeOnTheScreen();
  await view.rerender(fixture({ ...ready, value: { profile, onboardingStatus: 'pending' }, error: 'complete' }));
  expect(screen.getAllByText(error)).toHaveLength(1);
  expect(screen.getByText(error)).toHaveProp('accessibilityRole', 'alert');
  expect(screen.queryByText(review)).toBeNull();
});

// MVP-22-A4b: errors replace the step's line instead of stacking under it.
test.each([
  ['pl', 'Jestem Żaromir, strażnik związany z Welesem. Pomogę Ci pamiętać zasady i kroki.', 'Nie udało się potwierdzić tego kroku. Spróbuj ponownie.'],
  ['en', 'I am Zharomir, a guardian linked to Veles. I will help you remember the rules and steps.', 'We could not confirm this step. Please try again.'],
] as const)('%s a failed introduction shows its error in place of the introduction', async (locale, introduction, error) => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const state: OnboardingViewProps['state'] = { ...ready, value: { profile: { ...profile, locale, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' }, error: 'save' };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={state} {...callbacks} /></LocalizationProvider>);
  expect(screen.getAllByText(error)).toHaveLength(1);
  expect(screen.getByText(error)).toHaveProp('accessibilityRole', 'alert');
  expect(screen.queryByText(introduction)).toBeNull();
});

test.each([
  ['pl', 'Powiadomienia są opcjonalne. Możesz przejść dalej bez nich.', 'Nie udało się potwierdzić zapisu wyboru, więc nie pytaliśmy o zgodę. Spróbuj ponownie lub wybierz Nie teraz.'],
  ['en', 'Notifications are optional. You can continue without them.', 'Could not confirm the choice was saved, so no permission prompt opened. Try again or choose Not now.'],
] as const)('%s a failed notification save replaces the notification step line', async (locale, pending, error) => {
  const callbacks = { onComplete: jest.fn(), onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const failing = { ...notificationProps, state: { permission: { kind: 'not_determined' as const, canAskAgain: true }, busy: false, error: 'save' as const } };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={{ ...ready, value: { profile: { ...profile, notificationPreference: null }, onboardingStatus: 'pending' } }} {...callbacks} notifications={failing} /></LocalizationProvider>);
  expect(screen.getAllByText(error)).toHaveLength(1);
  expect(screen.getByText(error)).toHaveProp('accessibilityRole', 'alert');
  expect(screen.queryByText(pending)).toBeNull();
});

// MVP-22-B1 (G1): the IANA example never breaks after its slash. The word joiner is only in the drawn text, VoiceOver hears the plain hint.
test.each([
  ['pl', 'Strefa czasowa', 'Wpisz strefę czasową, na przykład Europe/Warsaw. Możesz zmienić proponowaną wartość.'],
  ['en', 'Timezone', 'Enter a timezone such as Europe/Warsaw. You can change the suggested value.'],
] as const)('%s keeps the timezone example whole on one line', async (locale, label, hint) => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  await render(<LocalizationProvider initialLocale={locale}><OnboardingView state={{ ...ready, draft: { ...ready.draft, locale } }} {...callbacks} /></LocalizationProvider>);
  expect(screen.getByText(hint.replace('Europe/', 'Europe/\u2060'), { normalizer: text => text })).toBeOnTheScreen();
  expect(screen.getByLabelText(label)).toHaveProp('accessibilityHint', hint);
});

// MVP-22-B1 (G4): Polish single-letter words stay with the next word in Żaromir's introduction.
test('the Polish introduction keeps "z" with "Welesem"', async () => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const state: OnboardingViewProps['state'] = { ...ready, value: { profile: { ...profile, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' } };
  await render(<LocalizationProvider initialLocale="pl"><OnboardingView state={state} {...callbacks} /></LocalizationProvider>);
  expect(screen.getByText(/związany z\u00a0Welesem/, { normalizer: text => text })).toBeOnTheScreen();
});

// MVP-22-B1 (G6, G7): the notification step keeps the optional line and the honesty line. The review keeps one line and the
// summary card. Every other explanation, the saved preference sentence and a device line that blocks nothing open behind the link.
test.each([
  ['pl', 'Przypomnienia nie są jeszcze wysyłane. Zapamiętamy Twój wybór na później.', 'To urządzenie nie zezwala na powiadomienia. Możesz kontynuować bez zmiany tego ustawienia.',
    'Wybierz, czy chcesz otrzymywać powiadomienia. Nic nie zostanie zapisane, dopóki nie wybierzesz.', 'Zapisany wybór: powiadomienia wyłączone.', 'Jak działają powiadomienia'],
  ['en', 'Reminders are not sent yet. Your choice is kept for later.', 'This device does not allow notifications. You can continue without changing this.',
    'Choose whether you want notifications. Nothing is saved until you choose.', 'Saved preference: notifications disabled.', 'How notifications work'],
] as const)('%s a denied device that blocks nothing folds on the notification step and the review', async (locale, honesty, denied, undecided, disabled, link) => {
  const callbacks = { onComplete: jest.fn(), onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const deniedProps = { ...notificationProps, state: { permission: { kind: 'denied' as const, canAskAgain: false }, busy: false } };
  const fixture = (preference: 'disabled' | null) => <LocalizationProvider initialLocale={locale}>
    <OnboardingView state={{ ...ready, value: { profile: { ...profile, locale, notificationPreference: preference }, onboardingStatus: 'pending' } }} {...callbacks} notifications={deniedProps} />
  </LocalizationProvider>;
  const view = await render(fixture(null));
  expect(screen.getByText(honesty)).toBeOnTheScreen();
  expect(screen.queryByText(undecided)).toBeNull();
  expect(screen.queryByText(denied)).toBeNull();
  expect(filled()).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: link }));
  expect(screen.getByText(undecided)).toBeOnTheScreen();
  expect(screen.getByText(denied)).toBeOnTheScreen();
  await view.rerender(fixture('disabled'));
  // A fresh review: the fold of the previous step does not carry over, because the step remounts it.
  for (const text of [honesty, denied, disabled]) expect(screen.queryByText(text)).toBeNull();
  expect(screen.getByTestId('onboarding-summary')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: link }));
  for (const text of [honesty, denied, disabled]) expect(screen.getByText(text)).toBeOnTheScreen();
});

// MVP-22-B2b (review finding): "Włączone" on the summary card needs the honesty fact beside it, so with notifications on
// the line that reminders are not sent yet stays visible under the card. With notifications off it stays in the fold.
test.each([
  ['pl', 'enabled', 'Przypomnienia nie są jeszcze wysyłane. Zapamiętamy Twój wybór na później.', 'Jak działają powiadomienia'],
  ['en', 'enabled', 'Reminders are not sent yet. Your choice is kept for later.', 'How notifications work'],
  ['pl', 'disabled', 'Przypomnienia nie są jeszcze wysyłane. Zapamiętamy Twój wybór na później.', 'Jak działają powiadomienia'],
  ['en', 'disabled', 'Reminders are not sent yet. Your choice is kept for later.', 'How notifications work'],
] as const)('%s review with notifications %s shows the honesty line only beside an on state', async (locale, preference, honesty, link) => {
  const callbacks = { onComplete: jest.fn(), onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const granted = { ...notificationProps, state: { permission: { kind: 'granted' as const, canAskAgain: true }, busy: false } };
  await render(<LocalizationProvider initialLocale={locale}>
    <OnboardingView state={{ ...ready, value: { profile: { ...profile, locale, notificationPreference: preference }, onboardingStatus: 'pending' } }} {...callbacks} notifications={granted} />
  </LocalizationProvider>);
  expect(screen.getByTestId('onboarding-summary')).toBeOnTheScreen();
  if (preference === 'enabled') {
    expect(screen.getByText(honesty)).toBeOnTheScreen();
    const texts = screen.getAllByText(/./).map(text => text.props.children);
    expect(texts.indexOf(honesty)).toBeGreaterThan(texts.indexOf(locale === 'pl' ? 'Włączone' : 'On'));
  } else {
    expect(screen.queryByText(honesty)).toBeNull();
  }
  await fireEvent.press(screen.getByRole('button', { name: link }));
  expect(screen.getAllByText(honesty)).toHaveLength(1);
});

// MVP-22-B1 (G2): onboarding uses the display font and the warm tokens of Settings and character creation, never slate.
test('onboarding titles use the display font and choices and the input use warm tokens', async () => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  await render(<LocalizationProvider initialLocale="pl"><OnboardingView state={{ ...ready, draft: { ...ready.draft, locale: 'pl', intention: true } }} {...callbacks} /></LocalizationProvider>);
  expect(StyleSheet.flatten(screen.getByRole('header', { name: 'Twoje pierwsze kroki' }).props.style)).toMatchObject({ fontFamily: tokens.font.display, color: tokens.warm.name });
  expect(StyleSheet.flatten(screen.getByRole('radio', { name: 'English' }).props.style)).toMatchObject({ borderColor: tokens.warm.faint, backgroundColor: tokens.warm.well });
  expect(StyleSheet.flatten(screen.getByRole('checkbox', { name: 'Chcę regularnie podejmować aktywność' }).props.style)).toMatchObject({ borderColor: tokens.warm.bright, backgroundColor: tokens.warm.chosen });
  expect(StyleSheet.flatten(screen.getByLabelText('Strefa czasowa').props.style)).toMatchObject({ borderColor: tokens.warm.field, backgroundColor: tokens.warm.well });
  const tree = JSON.stringify(screen.toJSON());
  for (const slate of [tokens.color.neutral, tokens.color.surface]) expect(tree).not.toContain(slate);
});

test('the review summary card is a warm panel', async () => {
  const callbacks = { onComplete: jest.fn(), onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  await render(<LocalizationProvider initialLocale="pl"><OnboardingView state={{ ...ready, value: { profile, onboardingStatus: 'pending' } }} {...callbacks} notifications={notificationProps} /></LocalizationProvider>);
  expect(StyleSheet.flatten(screen.getByTestId('onboarding-summary').props.style)).toMatchObject({ backgroundColor: tokens.warm.panel, borderColor: tokens.warm.line });
  expect(StyleSheet.flatten(screen.getByRole('header', { name: 'Twoje wybory są zapisane' }).props.style)).toMatchObject({ fontFamily: tokens.font.display });
});

// MVP-22-B1 (G3, G5): Żaromir's smaller figure on a warm panel first, then his bubble with the tail up at him, then Dalej.
test('the introduction shows the figure, then the bubble pointing up at it, then Dalej', async () => {
  const callbacks = { onIntroduce: jest.fn(), onDraft: jest.fn(), onSave: jest.fn(), onRetry: jest.fn(), onLogout: jest.fn() };
  const state: OnboardingViewProps['state'] = { ...ready, value: { profile: { ...profile, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' } };
  await render(<LocalizationProvider initialLocale="pl"><OnboardingView state={state} {...callbacks} /></LocalizationProvider>);
  const tree = JSON.stringify(screen.toJSON());
  const [figure, bubble, next] = ['"companion-art-frame"', '"companion-avatar"', '"Dalej"'].map(mark => tree.indexOf(mark));
  expect(figure).toBeGreaterThan(-1);
  expect(figure).toBeLessThan(bubble);
  expect(bubble).toBeLessThan(next);
  const frame = StyleSheet.flatten(screen.getByTestId('companion-art-frame', { includeHiddenElements: true }).props.style);
  expect(frame.width).toBeLessThan(180);
  expect(frame.height).toBeLessThan(270);
  expect(StyleSheet.flatten(screen.getByTestId('companion-art-panel', { includeHiddenElements: true }).props.style)).toMatchObject({ backgroundColor: tokens.warm.panel });
  expect(StyleSheet.flatten(screen.getByTestId('companion-bubble-tail', { includeHiddenElements: true }).props.style)).toMatchObject({ left: '50%', top: -7 });
});
