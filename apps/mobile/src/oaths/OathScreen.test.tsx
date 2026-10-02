import { Profiler } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo, Dimensions, ScrollView, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OathScreen } from './OathScreen';
import { SealStamp } from './SealStamp';
import { createOathController, type OathController } from './controller';
import type { SessionController } from '../auth/session';
import type { OathClient } from '../api/oaths';
import type { PendingStorage } from './pendingStorage';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('./SealStamp', () => { const actual = jest.requireActual('./SealStamp'); return { ...actual, SealStamp: jest.fn(actual.SealStamp) }; });
const id = '20000000-0000-4000-8000-000000000001';
const accountId = '10000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-000000000001';
const token = 'A'.repeat(43);
function fixture() {
  const snapshot = JSON.parse(JSON.stringify(catalog));
  snapshot.activity = 'running'; snapshot.activation = { mode: 'now', time: null };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { preview: { id, snapshot }, characterId, serverTime: '2026-10-24T00:00:00Z' };
}
const controllers: OathController[] = [];
beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T12:00:00Z')));
afterEach(() => { controllers.splice(0).forEach(controller => controller.dispose()); jest.restoreAllMocks(); });
function setup() {
  const envelope = fixture();
  const session = { subscribe: () => () => {}, getToken: () => token, getState: () => ({ kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' } }), reauthenticate: jest.fn() } as unknown as SessionController;
  const storage: PendingStorage = { read: jest.fn().mockResolvedValue({ kind: 'success', value: null }), write: jest.fn().mockResolvedValue({ kind: 'success' }) };
  const api = { preview: jest.fn().mockResolvedValue({ kind: 'success', value: envelope }), getPreview: jest.fn().mockResolvedValue({ kind: 'success', value: { preview: envelope.preview, characterId, oathId: null } }), confirm: jest.fn().mockResolvedValue({ kind: 'unavailable', retry: 'request' }) } as unknown as OathClient;
  const controller = createOathController({ session, api, storage }); controller.setCharacter({ accountId, characterId }); controllers.push(controller);
  return { controller, api, storage, envelope };
}
test('chosen running deadline previews all rules before explicit acceptance can commit', async () => {
  const f = setup(); f.controller.start();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await selectDate('Completion date', 'October 25, 2026');
  await selectTime('Completion time', '02', '30');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(f.api.preview).toHaveBeenCalledWith(token, { activity: 'running', activation: { mode: 'now' }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw' } }, expect.any(AbortSignal));
  expect(await screen.findByText(f.envelope.preview.snapshot.copy.en.declaration)).toBeOnTheScreen();
  expect(screen.getAllByTestId(/^rule-card-/).map(card => card.props.testID)).toEqual(['start', 'deadline', 'cutoff', 'proof', 'review', 'reward', 'consequence', 'fixed', 'pause'].map(id => `rule-card-${id}`));
  expect(screen.getByText('By choosing “Commit to the Oath”, I accept the rules on the cards and the full rules.')).toBeOnTheScreen();
  expect(screen.queryByText(f.envelope.preview.snapshot.copy.en.sections.appeal)).toBeNull();
  const fold = screen.getByRole('button', { name: 'Full rules' });
  expect(fold).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  await fireEvent.press(fold);
  for (const text of Object.values(f.envelope.preview.snapshot.copy.en.sections) as string[]) expect(screen.getByText(text)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Full rules' })).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
  expect(f.api.confirm).not.toHaveBeenCalled(); expect(f.storage.write).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Commit to the Oath' }));
  expect(f.api.confirm).toHaveBeenCalledWith(token, { previewId: id, requestId: id, accepted: true }, expect.any(AbortSignal));
});
async function fillDeadline() {
  await selectDate('Completion date', 'October 25, 2026');
  await selectTime('Completion time', '02', '30');
}
test('repeated local time requires an explicit server choice and editing invalidates that choice', async () => {
  const f = setup(); jest.mocked(f.api.preview).mockResolvedValueOnce({ kind: 'time_error', code: 'ambiguous_local_time', field: 'deadline', validOffsets: ['+02:00', '+01:00'] });
  f.controller.start(); await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(await screen.findByRole('button', { name: 'View rules', disabled: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'UTC +02:00', selected: false })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'UTC +01:00', selected: false })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'UTC +01:00' }));
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(jest.mocked(f.api.preview).mock.calls[1][1].deadline.offset).toBe('+01:00');
  await fireEvent.press(await screen.findByRole('button', { name: 'Change choices' }));
  expect(screen.queryByRole('button', { name: 'Commit to the Oath' })).toBeNull();
  expect(screen.getByText('October 25, 2026')).toBeOnTheScreen();
  expect(screen.getByText('02:30')).toBeOnTheScreen();
  await selectTime('Completion time', '03', '30');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(jest.mocked(f.api.preview).mock.calls[2][1].deadline).toEqual({ local: '2026-10-25T03:30:00', timezone: 'Europe/Warsaw' });
  expect(f.api.confirm).not.toHaveBeenCalled();
});
test('gap error keeps the chosen date and timezone and lets the player correct the time', async () => {
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-03-28T12:00:00Z'));
  const f = setup(); jest.mocked(f.api.preview).mockResolvedValueOnce({ kind: 'time_error', code: 'nonexistent_local_time', field: 'deadline' });
  f.controller.start(); await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await selectDate('Completion date', 'March 29, 2026'); await selectTime('Completion time', '02', '30'); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(await screen.findByText('This local time does not exist because the clocks change. Choose another time.')).toBeOnTheScreen();
  expect(jest.mocked(f.api.preview).mock.calls[0][1].deadline).toEqual({ local: '2026-03-29T02:30:00', timezone: 'Europe/Warsaw' });
  expect(screen.getByText('March 29, 2026')).toBeOnTheScreen(); expect(screen.getByText('02:30')).toBeOnTheScreen();
  await selectTime('Completion time', '03', '30');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(await screen.findByRole('button', { name: 'Commit to the Oath' })).toBeOnTheScreen();
});
test('scheduled start and deadline retain independently chosen zones, with all activity choices', async () => {
  const f = setup(); f.controller.start(); await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('radio', { name: 'Strength training' }));
  expect(screen.getByRole('radio', { name: 'Mobility' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'At a future time' }));
  await selectDate('Start date', 'October 24, 2026, Today');
  await selectTime('Start time', '20', '00');
  await fireEvent.press(screen.getByRole('button', { name: 'Start timezone' }));
  await fireEvent.changeText(screen.getByLabelText('Search by city or timezone'), 'London');
  await fireEvent.press(screen.getByRole('radio', { name: 'London · Europe/London' }));
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(jest.mocked(f.api.preview).mock.calls[0][1]).toEqual({ activity: 'strength_training', activation: { mode: 'scheduled', time: { local: '2026-10-24T20:00:00', timezone: 'Europe/London' } }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw' } });
});
test('a paused character explains the refusal', async () => {
  const f = setup(); jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'oath_error', code: 'character_paused' });
  f.controller.start(); await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByText('This character is paused. Resume gameplay before creating a new Oath.')).toBeOnTheScreen();
});
test.each(['preview_superseded', 'activation_elapsed'] as const)('%s removes confirmation until a new review', async code => {
  const f = setup(); jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'oath_error', code });
  f.controller.start(); await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByText('Choose and review the times again before committing.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Commit to the Oath' })).toBeNull();
  expect(screen.getByRole('button', { name: 'View rules' })).toBeOnTheScreen();
  expect(f.api.confirm).toHaveBeenCalledTimes(1);
});
test('ambiguous confirmation exposes only same-identity retry and renders authoritative result', async () => {
  const f = setup(); f.controller.start(); await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByRole('button', { name: 'Check confirmation' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Commit to the Oath' })).toBeNull(); expect(screen.queryByLabelText('Completion time')).toBeNull();
  const snapshot = { ...f.envelope.preview.snapshot, activation: { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } } };
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'success', value: { oath: { id, characterId, snapshot, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null, proof: null }, serverTime: '2026-10-24T00:00:00Z' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Check confirmation' }));
  expect(await screen.findByText(/^Active · deadline /)).toBeOnTheScreen();
  expect(jest.mocked(f.api.confirm).mock.calls[1][1]).toEqual(jest.mocked(f.api.confirm).mock.calls[0][1]);
  expect(screen.queryByRole('button', { name: 'Submit evidence' })).toBeNull();
});
test('Polish form and stored rules support recovery after restart without new consent', async () => {
  const f = setup(); jest.mocked(f.storage.read).mockResolvedValueOnce({ kind: 'success', value: { version: 2, accountId, characterId, previewId: id, requestId: id } });
  f.controller.start(); await render(<LocalizationProvider initialLocale="pl"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByRole('button', { name: 'Sprawdź potwierdzenie' })).toBeOnTheScreen();
  await fireEvent.press(await screen.findByRole('button', { name: 'Pełne zasady' }));
  expect(await screen.findByText(f.envelope.preview.snapshot.copy.pl.sections.appeal)).toBeOnTheScreen();
  expect(f.api.confirm).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sprawdź potwierdzenie' }));
  expect(jest.mocked(f.api.confirm).mock.calls[0][1].requestId).toBe(id);
  // Sign-out lives in Settings only.
  expect(screen.queryByRole('button', { name: 'Wyloguj się' })).toBeNull();
});

test('creation offers a calendar and time controls without raw date inputs', async () => {
  const f = setup(); f.controller.start();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByRole('button', { name: /Completion date/ })).toBeOnTheScreen();
  expect(screen.queryByRole('textbox', { name: 'Completion date' })).toBeNull();
});

async function selectDate(label: string, day: string) {
  await fireEvent.press(await screen.findByRole('button', { name: label }));
  await fireEvent.press(screen.getByRole('button', { name: day }));
}
async function selectTime(label: string, hour: string, minute: string, words = { hour: 'Hour', minute: 'Minute', done: 'Use this time' }) {
  await fireEvent.press(screen.getByRole('button', { name: label }));
  await fireEvent.press(screen.getByRole('radio', { name: `${words.hour} ${hour}` }));
  await fireEvent.press(screen.getByRole('radio', { name: `${words.minute} ${minute}` }));
  await fireEvent.press(screen.getByRole('button', { name: words.done }));
}

test('closing a time selection discards only unfinished picker changes', async () => {
  const f = setup(); f.controller.start();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline();
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Hour 04' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(screen.getByText('02:30')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(jest.mocked(f.api.preview).mock.calls[0][1].deadline.local).toBe('2026-10-25T02:30:00');
});

test('Polish city search selects a timezone without typing an identifier', async () => {
  const f = setup(); f.controller.start();
  await render(<LocalizationProvider initialLocale="pl"><OathScreen {...f} timezone="Europe/London" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Strefa ukończenia' }));
  await fireEvent.changeText(screen.getByLabelText('Szukaj miasta lub strefy czasowej'), 'Warszawa');
  await fireEvent.press(screen.getByRole('radio', { name: 'Warszawa · Europe/Warsaw' }));
  expect(screen.getByText('Warszawa')).toBeOnTheScreen();
  expect(screen.getByText('Europe/Warsaw')).toBeOnTheScreen();
});

test('date, time and zone controls announce their selected values', async () => {
  const f = setup(); f.controller.start();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline();
  expect(screen.getByRole('button', { name: 'Completion date' }).props.accessibilityValue).toEqual({ text: 'October 25, 2026' });
  expect(screen.getByRole('button', { name: 'Completion time' }).props.accessibilityValue).toEqual({ text: '02:30' });
  expect(screen.getByRole('button', { name: 'Completion timezone' }).props.accessibilityValue).toEqual({ text: 'Warsaw · Europe/Warsaw' });
});

test('confirmed creation clears the parent draft and explicit new Oath starts empty', async () => {
  const f = setup(); f.controller.start(); const onDraftChange = jest.fn();
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'success', value: { oath: { id, characterId, snapshot: f.envelope.preview.snapshot, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null, proof: null }, serverTime: '2026-10-24T00:00:00Z' } });
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" onDraftChange={onDraftChange} /></LocalizationProvider>);
  await fillDeadline();
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByText(/^Active · deadline /)).toBeOnTheScreen();
  expect(onDraftChange).toHaveBeenLastCalledWith(null);
  await fireEvent.press(screen.getByRole('button', { name: 'Create another Oath' }));
  expect(screen.getByText('Choose a date')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Commit to the Oath' })).toBeNull();
});

test('a profile timezone missing from device data does not prevent choosing a date', async () => {
  const formatter = Intl.DateTimeFormat;
  jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locales, options) => {
    if (options?.timeZone === 'Europe/Warsaw') throw new RangeError('Device timezone unavailable');
    return new formatter(locales, options);
  });
  const f = setup(); f.controller.start();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await selectDate('Completion date', 'October 25, 2026');
  await selectTime('Completion time', '18', '00');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(jest.mocked(f.api.preview).mock.calls[0][1].deadline).toEqual({ local: '2026-10-25T18:00:00', timezone: 'Europe/Warsaw' });
});

test('the serif Oath creation title is capped for the largest text', async () => {
  const f = setup(); f.controller.start(); await render(<LocalizationProvider initialLocale="pl"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect((await screen.findByRole('header', { name: 'Próba Iskry' })).props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
});

function rulesGuide(seen: boolean | Promise<boolean>) {
  return { read: jest.fn(() => Promise.resolve(seen)), markSeen: jest.fn(async () => {}) };
}
async function openReview(f: ReturnType<typeof setup>, storage: ReturnType<typeof rulesGuide>, locale: 'pl' | 'en' = 'pl') {
  f.controller.start();
  await render(<LocalizationProvider initialLocale={locale}><OathScreen {...f} timezone="Europe/Warsaw" rulesGuideStorage={storage} /></LocalizationProvider>);
  await selectDate(locale === 'pl' ? 'Data ukończenia' : 'Completion date', locale === 'pl' ? '25 października 2026' : 'October 25, 2026');
  await selectTime(locale === 'pl' ? 'Godzina ukończenia' : 'Completion time', '02', '30', locale === 'pl' ? { hour: 'Godzina', minute: 'Minuta', done: 'Ustaw godzinę' } : undefined);
  await fireEvent.press(screen.getByRole('button', { name: locale === 'pl' ? 'Zobacz zasady' : 'View rules' }));
  await screen.findByTestId('rule-cards');
}
test('the first review lets Żaromir explain the cards once, lighting each card he names', async () => {
  const f = setup(); const storage = rulesGuide(false);
  await openReview(f, storage);
  expect(storage.read).toHaveBeenCalledWith(accountId);
  expect(await screen.findByTestId('dialogue-panel')).toBeOnTheScreen();
  const line = () => screen.getByTestId('dialogue-text').props.accessibilityLabel as string;
  expect(line()).toContain('Zanim złożysz Przysięgę, poznaj jej zasady.');
  const next = async () => { await fireEvent.press(screen.getByRole('button', { name: 'Dalej' })); };
  await next();
  expect(line()).toContain('Klepsydra to termin.');
  expect(screen.getByTestId('rule-card-deadline')).toHaveStyle({ borderColor: '#e0a84f' });
  await next();
  expect(line()).toContain('Świeca to ostatni moment na dowód');
  expect(screen.getByTestId('rule-card-cutoff')).toHaveStyle({ borderColor: '#e0a84f' });
  expect(screen.getByTestId('rule-card-deadline')).not.toHaveStyle({ borderColor: '#e0a84f' });
  await next();
  expect(line()).toContain('Kowadło z\u00a0kłódką');
  expect(screen.getByTestId('rule-card-fixed')).toHaveStyle({ borderColor: '#e0a84f' });
  expect(storage.markSeen).not.toHaveBeenCalled();
  // Native check, 2026-09-30: the last step still offered "Dalej" although it closes the guide.
  expect(screen.queryByRole('button', { name: 'Dalej' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Zakończ' }));
  expect(screen.queryByTestId('dialogue-panel')).toBeNull();
  expect(storage.markSeen).toHaveBeenCalledTimes(1);
});
test('skipping marks the explanation seen, and the Żaromir button replays it without writing again', async () => {
  const f = setup(); const storage = rulesGuide(false);
  await openReview(f, storage, 'en');
  await screen.findByTestId('dialogue-panel');
  await fireEvent.press(screen.getByRole('button', { name: 'Skip introduction' }));
  expect(screen.queryByTestId('dialogue-panel')).toBeNull();
  expect(storage.markSeen).toHaveBeenCalledWith(accountId);
  await fireEvent.press(screen.getByRole('button', { name: 'Zharomir explains the rules' }));
  expect(screen.getByTestId('dialogue-text').props.accessibilityLabel).toContain('Before you make the Oath, meet its rules.');
  await fireEvent.press(screen.getByRole('button', { name: 'Skip introduction' }));
  expect(storage.markSeen).toHaveBeenCalledTimes(1);
});
test('a seen flag shows no explanation but offers the replay', async () => {
  await openReview(setup(), rulesGuide(true), 'en');
  expect(screen.queryByTestId('dialogue-panel')).toBeNull();
  expect(screen.getByRole('button', { name: 'Zharomir explains the rules' })).toBeOnTheScreen();
});
test('a flag still being read shows nothing', async () => {
  await openReview(setup(), rulesGuide(new Promise<boolean>(() => {})), 'en');
  expect(screen.queryByTestId('dialogue-panel')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Zharomir explains the rules' })).toBeNull();
});

// MVP-22-B2 (G21): the open guide covered the bottom cards ("M… z podjąć"). While it is open the review gains a bottom inset
// as tall as the panel with its rising bust, so every card can scroll above it.
test.each([[180], [300]])('while the guide is open the review scrolls %i points of panel clear of the cards', async height => {
  await openReview(setup(), rulesGuide(false));
  const panel = await screen.findByTestId('dialogue-panel');
  const inset = () => (StyleSheet.flatten(screen.getByTestId('oath-scroll').props.contentContainerStyle) as ViewStyle).paddingBottom as number;
  const closed = 36;
  await fireEvent(panel, 'layout', { nativeEvent: { layout: { x: 12, y: 500, width: 378, height } } });
  // The panel stands 24 pt above the bottom and Żaromir's bust rises 48 pt above its frame.
  expect(inset()).toBe(height + 24 + 48);
  expect(screen.queryByTestId('guide-spacer')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Pomiń wprowadzenie' }));
  expect(inset()).toBe(closed);
});

// Native check, 2026-09-30, iPhone 18 Pro at the largest accessibility size in Polish: the 280 pt panel cut the fourth line of
// the first guide line, and the cards Żaromir named sat far below the one-column grid top, hidden while he spoke about them.
describe('the rules guide at the largest text size', () => {
  const initial = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
  afterEach(() => Dimensions.set(initial));
  const phone = (fontScale: number) => ({ width: 402, height: 874, scale: 3, fontScale });
  const next = async () => { await fireEvent.press(screen.getByRole('button', { name: 'Dalej' })); };
  test.each([[3.12, 344], [1, 280]])('at text scale %d the panel may grow to %i points', async (fontScale, height) => {
    Dimensions.set({ window: phone(fontScale), screen: phone(fontScale) });
    await openReview(setup(), rulesGuide(false));
    const panel = await screen.findByTestId('dialogue-panel');
    expect((StyleSheet.flatten(panel.props.style) as ViewStyle).maxHeight).toBe(height);
  });
  test.each([3.12, 1])('at text scale %d each step scrolls the named card into view above the panel', async fontScale => {
    Dimensions.set({ window: phone(fontScale), screen: phone(fontScale) });
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo');
    let show!: (seen: boolean) => void;
    await openReview(setup(), rulesGuide(new Promise<boolean>(resolve => { show = resolve; })));
    const layout = (testId: string, y: number) => fireEvent(screen.getByTestId(testId), 'layout', { nativeEvent: { layout: { x: 0, y, width: 370, height: 300 } } });
    await layout('oath-rules-block', 400); await layout('rule-cards', 900);
    await layout('rule-card-deadline', 320); await layout('rule-card-cutoff', 640); await layout('rule-card-fixed', 2240);
    await act(async () => { show(false); });
    await screen.findByTestId('dialogue-panel');
    const last = () => scrollTo.mock.calls.at(-1)?.[0] as { y: number; animated?: boolean } | undefined;
    expect(last()).toEqual(expect.objectContaining({ y: 400 + 900 - 12 }));
    await next();
    expect(last()).toEqual(expect.objectContaining({ y: 400 + 900 + 320 - 12 }));
    await next();
    expect(last()).toEqual(expect.objectContaining({ y: 400 + 900 + 640 - 12 }));
    await next();
    expect(last()).toEqual(expect.objectContaining({ y: 400 + 900 + 2240 - 12 }));
    // A card measured again while Żaromir names it, for example after the text above it wrapped, is followed.
    await layout('rule-card-fixed', 2300);
    expect(last()).toEqual(expect.objectContaining({ y: 400 + 900 + 2300 - 12 }));
    if (fontScale > 1.3) expect(last()?.animated).toBe(false);
  });
});

// Native check, 2026-09-30, iPhone 18 Pro at the largest accessibility size in Polish: the Żaromir button ran past the right
// screen edge while its label wrapped to three lines, and long words broke mid-word in the text under the cards.
describe('the review at the largest text size', () => {
  const initial = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
  afterEach(() => Dimensions.set(initial));
  const phone = (width: number) => ({ width, height: 874, scale: 3, fontScale: 3.571 });
  const flat = (node: unknown) => StyleSheet.flatten((node as { props: { style?: StyleProp<ViewStyle & TextStyle> } }).props.style) ?? {};
  test.each([402, 375])('at %s points the Żaromir button stays inside the column and its label wraps within it', async width => {
    Dimensions.set({ window: phone(width), screen: phone(width) });
    await openReview(setup(), rulesGuide(true));
    const button = screen.getByRole('button', { name: 'Żaromir objaśnia zasady' });
    expect(flat(button).maxWidth).toBe('100%');
    const label = within(button).getByText('Żaromir objaśnia zasady');
    expect(flat(label).flexShrink).toBe(1);
    expect(label).toHaveProp('maxFontSizeMultiplier', 2.5);
    expect(label).toHaveProp('accessible', false);
  });
  test.each([402, 375])('at %s points the consent and the pending notice keep whole words', async width => {
    Dimensions.set({ window: phone(width), screen: phone(width) });
    const f = setup();
    await openReview(f, rulesGuide(true));
    expect(screen.getByText('Wybierając „Złóż Przysięgę”, akceptuję zasady z kart i pełne zasady.')).toHaveProp('maxFontSizeMultiplier', 2.5);
    await fireEvent.press(screen.getByRole('button', { name: 'Złóż Przysięgę' }));
    expect(await screen.findByText(/Twoje potwierdzenie mogło już dotrzeć/)).toHaveProp('maxFontSizeMultiplier', 2);
  });
  test.each([402, 375])('at %s points an error line keeps whole words while the review-again line stays uncapped', async width => {
    Dimensions.set({ window: phone(width), screen: phone(width) });
    const f = setup(); jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'oath_error', code: 'preview_superseded' });
    await openReview(f, rulesGuide(true));
    await fireEvent.press(screen.getByRole('button', { name: 'Złóż Przysięgę' }));
    expect(await screen.findByText(/potwierdzeniem\./)).toHaveProp('maxFontSizeMultiplier', 2);
    expect(screen.getByText('Ponownie wybierz i sprawdź terminy przed złożeniem Przysięgi.')).not.toHaveProp('maxFontSizeMultiplier');
  });
  test('the merged state and deadline line stays uncapped', async () => {
    Dimensions.set({ window: phone(375), screen: phone(375) });
    const f = setup(); jest.mocked(f.api.confirm).mockResolvedValueOnce(confirmed('20000000-0000-4000-8000-0000000000c1', f.envelope.preview.snapshot));
    await openReview(f, rulesGuide(true));
    await fireEvent.press(screen.getByRole('button', { name: 'Złóż Przysięgę' }));
    expect(await screen.findByText(/^Aktywna · termin /)).not.toHaveProp('maxFontSizeMultiplier');
  });
  test('in the bench the repeated-hour question keeps whole words and the occurrence choices stay uncapped', async () => {
    Dimensions.set({ window: phone(375), screen: phone(375) });
    const f = setup(); jest.mocked(f.api.preview).mockResolvedValueOnce({ kind: 'time_error', code: 'ambiguous_local_time', field: 'deadline', validOffsets: ['+02:00', '+01:00'] });
    f.controller.start(); await render(<LocalizationProvider initialLocale="pl"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await selectDate('Data ukończenia', '25 października 2026');
    await selectTime('Godzina ukończenia', '02', '30', { hour: 'Godzina', minute: 'Minuta', done: 'Ustaw godzinę' });
    await fireEvent.press(screen.getByRole('button', { name: 'Zobacz zasady' }));
    expect(await screen.findByText(/Ta godzina występuje dwukrotnie/)).toHaveProp('maxFontSizeMultiplier', 2);
    expect(screen.getByText('UTC +02:00')).not.toHaveProp('maxFontSizeMultiplier');
  });
});

const confirmed = (oathId: string, snapshot: unknown): Awaited<ReturnType<OathClient['confirm']>> => ({ kind: 'success' as const, value: { oath: { id: oathId, characterId, snapshot: snapshot as never, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null, proof: null }, serverTime: '2026-10-24T00:00:00Z' } });
test('the seal is stamped only after the server confirms, once, also after a lost reply', async () => {
  const f = setup(); f.controller.start();
  const oathId = '20000000-0000-4000-8000-0000000000a1';
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByRole('button', { name: 'Check confirmation' })).toBeOnTheScreen();
  expect(screen.queryByTestId('seal-stamp', { includeHiddenElements: true })).toBeNull();
  let answer!: (value: Awaited<ReturnType<OathClient['confirm']>>) => void;
  jest.mocked(f.api.confirm).mockReturnValueOnce(new Promise(done => { answer = done; }) as never);
  await fireEvent.press(screen.getByRole('button', { name: 'Check confirmation' }));
  expect(screen.queryByTestId('seal-stamp', { includeHiddenElements: true })).toBeNull();
  await act(async () => { answer(confirmed(oathId, f.envelope.preview.snapshot)); });
  expect(await screen.findByTestId('seal-sealed', { includeHiddenElements: true })).toBeOnTheScreen();
  expect(screen.getByText(/^Active · deadline /)).toBeOnTheScreen();
  expect(new Set(jest.mocked(SealStamp).mock.calls.map(call => call[0].width)).size).toBe(1);
  expect(screen.queryByTestId('seal-stamp', { includeHiddenElements: true })).toBeNull();
});
// Native check, 2026-09-30: the detail mode was set one render late, so the creation form showed for a frame after acceptance.
test('acceptance goes from the rules straight to the seal without a frame of the creation form', async () => {
  const f = setup(); f.controller.start();
  const oathId = '20000000-0000-4000-8000-0000000000a3';
  const frames: boolean[] = [];
  let recording = false;
  await render(<Profiler id="oath" onRender={() => { if (recording) frames.push(screen.queryAllByText('View rules', { includeHiddenElements: true }).length > 0); }}>
    <LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>
  </Profiler>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  const commit = await screen.findByRole('button', { name: 'Commit to the Oath' });
  jest.mocked(f.api.confirm).mockResolvedValueOnce(confirmed(oathId, f.envelope.preview.snapshot));
  recording = true;
  await fireEvent.press(commit);
  await screen.findByTestId('seal-stamp', { includeHiddenElements: true });
  recording = false;
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.filter(Boolean)).toEqual([]);
  // Native check: the sealed scroll replaced a 300 point stamp at 260 points, so the scroll jumped when the press ended.
  const stamp = screen.getByTestId('seal-stamp', { includeHiddenElements: true });
  const image = (node: { children: unknown[] }): unknown => node.children.length ? image(node.children[0] as { children: unknown[] }) : node;
  const pressed = image(stamp as never);
  const sealed = await screen.findByTestId('seal-sealed', { includeHiddenElements: true }, { timeout: 3000 });
  expect(sealed.props.style.width).toBe(stamp.props.style.width);
  // Native check under Reduce Motion: a new sealed image had to load, so the scroll vanished for a frame. The same image stays.
  expect(image(sealed as never)).toBe(pressed);
});

test('a remount showing the same confirmed Oath does not stamp again', async () => {
  const f = setup(); f.controller.start();
  const oathId = '20000000-0000-4000-8000-0000000000a2';
  jest.mocked(f.api.confirm).mockResolvedValueOnce(confirmed(oathId, f.envelope.preview.snapshot));
  const view = await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByTestId('seal-sealed', { includeHiddenElements: true })).toBeOnTheScreen();
  await view.unmount();
  jest.mocked(SealStamp).mockClear();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText(/^Active · deadline /)).toBeOnTheScreen();
  expect(screen.getByTestId('seal-sealed', { includeHiddenElements: true })).toBeOnTheScreen();
  // The scroll is drawn sealed from its first render, it never presses again.
  expect(jest.mocked(SealStamp).mock.calls.every(call => call[0].sealed)).toBe(true);
});
test('a definitive rejection stamps nothing', async () => {
  const f = setup(); f.controller.start();
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'oath_error', code: 'preview_superseded' });
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByText('Choose and review the times again before committing.')).toBeOnTheScreen();
  expect(screen.queryByTestId('seal-stamp', { includeHiddenElements: true })).toBeNull();
});

test('after the seal a short card shows the countdown, the deadline and the next steps instead of the full rules', async () => {
  const f = setup(); f.controller.start();
  const oathId = '20000000-0000-4000-8000-0000000000b1';
  jest.mocked(f.api.confirm).mockResolvedValueOnce(confirmed(oathId, f.envelope.preview.snapshot));
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility'); announce.mockClear();
  const onBack = jest.fn(); const onViewOath = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" onBack={onBack} backLabel="Return to the Forge" onViewOath={onViewOath} /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByRole('header', { name: 'Oath made' })).toBeOnTheScreen();
  expect(screen.getByTestId('countdown-chip')).toHaveProp('accessibilityLabel', 'Until the deadline 1 day');
  // MVP-22-T12 (clarity.md decision 13): the track with the Oath step done, one merged line, Żaromir and one filled action.
  expect(screen.getByText('Active · deadline Sun, Oct 25, 02:30 (UTC+02:00) · Warsaw')).toBeOnTheScreen();
  expect(screen.queryByText(/^Status: /)).toBeNull();
  expect(screen.getByLabelText(/^Step 2 of 4, Workout/)).toBeOnTheScreen();
  expect(screen.getByTestId('step-node-1-done', { includeHiddenElements: true })).toBeTruthy();
  const zaromir = screen.getByLabelText(/^Zharomir: /).props.accessibilityLabel.replace('Zharomir: ', '');
  expect(['The Oath is made and already under way. Think about when and where you will train.', 'Your word is forged. Now the workout, at your own pace, then the proof.',
    'The seal is set. Pick a time and place that fit your day.']).toContain(zaromir);
  expect(screen.queryAllByText('◆', { includeHiddenElements: true })).toHaveLength(1);
  expect(within(screen.getByRole('button', { name: 'View the Oath' })).getByText('◆', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByText(f.envelope.preview.snapshot.copy.en.sections.appeal)).toBeNull();
  expect(announce).toHaveBeenCalledTimes(1);
  expect(announce).toHaveBeenCalledWith('Oath made. Until the deadline 1 day');
  await fireEvent.press(screen.getByRole('button', { name: 'View the Oath' }));
  expect(onViewOath).toHaveBeenCalledWith(oathId);
  expect(screen.getAllByRole('button', { name: 'Return to the Forge' }).length).toBeGreaterThan(0);
  expect(screen.getByRole('button', { name: 'Create another Oath' })).toBeOnTheScreen();
});
test('Polish card and a scheduled Oath counting down to its start', async () => {
  const f = setup(); f.controller.start();
  const snapshot = { ...f.envelope.preview.snapshot, activation: { mode: 'scheduled', time: { local: '2026-10-24T22:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T20:00:00Z' } } };
  const value = confirmed('20000000-0000-4000-8000-0000000000b2', snapshot);
  if (value.kind === 'success') value.value.oath.state = 'scheduled';
  jest.mocked(f.api.confirm).mockResolvedValueOnce(value);
  await render(<LocalizationProvider initialLocale="pl"><OathScreen {...f} timezone="Europe/Warsaw" onViewOath={jest.fn()} /></LocalizationProvider>);
  await selectDate('Data ukończenia', '25 października 2026');
  await selectTime('Godzina ukończenia', '02', '30', { hour: 'Godzina', minute: 'Minuta', done: 'Ustaw godzinę' });
  await fireEvent.press(screen.getByRole('button', { name: 'Zobacz zasady' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Złóż Przysięgę' }));
  expect(await screen.findByRole('header', { name: 'Przysięga złożona' })).toBeOnTheScreen();
  expect(screen.getByTestId('countdown-chip')).toHaveProp('accessibilityLabel', 'Start za 20 godzin');
  expect(screen.getByRole('button', { name: 'Zobacz Przysięgę' })).toBeOnTheScreen();
  expect(screen.getByLabelText('Etap 1 z 4, Przysięga, Czeka na start')).toBeOnTheScreen();
  expect(screen.getByText(/^Zaplanowana · termin /)).toBeOnTheScreen();
  const zaromir = screen.getByLabelText(/^Żaromir: /).props.accessibilityLabel.replace('Żaromir: ', '');
  expect(['Przysięga złożona, start już ustalony. Do tego czasu możesz spokojnie się przygotować.', 'Słowo wykute, czeka na swój start. Dobrze wiedzieć, gdzie wtedy zrobisz trening.']).toContain(zaromir);
});
// MVP-22-T12c: a replayed acceptance can return an Oath that has already moved on. Żaromir greets only a scheduled or active one.
test('a replayed acceptance that returns a withdrawn Oath shows no Żaromir greeting', async () => {
  const f = setup(); f.controller.start();
  const value = confirmed('20000000-0000-4000-8000-0000000000b3', f.envelope.preview.snapshot);
  if (value.kind === 'success') Object.assign(value.value.oath, { state: 'withdrawn', reason: 'character_paused', terminalAt: '2026-10-24T06:00:00Z' });
  jest.mocked(f.api.confirm).mockResolvedValueOnce(value);
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" onViewOath={jest.fn()} /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByRole('header', { name: 'Oath made' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'View the Oath' })).toBeOnTheScreen();
  expect(screen.queryByLabelText(/^Zharomir: /)).toBeNull();
  expect(screen.queryAllByTestId('zaromir-bust', { includeHiddenElements: true })).toHaveLength(0);
});

// Native check, 2026-09-30, iPhone 18 Pro at the largest accessibility size in Polish: beside the picture and the marker
// "Bieganie", "Trening siłowy" and "W przyszłym terminie" broke mid-word. In the simple layout the label gets its own full-width line.
describe('creation choices at the largest text size', () => {
  const initial = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
  afterEach(() => Dimensions.set(initial));
  const phone = (width: number, fontScale: number) => ({ width, height: 874, scale: 3, fontScale });
  type Node = { type: unknown; parent: Node | null; props: { style?: unknown } };
  const hostParent = (node: Node) => { let parent = node.parent; while (parent && typeof parent.type !== 'string') parent = parent.parent; return parent!; };
  const flat = (node: Node): TextStyle => StyleSheet.flatten(node.props.style as StyleProp<TextStyle>) ?? {};
  async function renderForm(width: number, fontScale: number) {
    Dimensions.set({ window: phone(width, fontScale), screen: phone(width, fontScale) });
    const f = setup(); f.controller.start();
    await render(<LocalizationProvider initialLocale="pl"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await screen.findByRole('radio', { name: 'Bieganie' });
  }
  test.each([402, 375])('at %s points each activity label takes a full-width line under the picture and the marker', async width => {
    await renderForm(width, 3.12);
    for (const [name, marker] of [['Bieganie', '✓'], ['Trening siłowy', '○'], ['Mobilność', '○']] as const) {
      const radio = screen.getByRole('radio', { name }) as unknown as Node;
      const label = within(radio as never).getByText(name) as unknown as Node;
      expect(hostParent(label)).toBe(radio);
      expect(flat(label)).toEqual(expect.objectContaining({ alignSelf: 'stretch', textAlign: 'left' }));
      expect(flat(radio).flexDirection).not.toBe('row');
      const top = hostParent(within(radio as never).getByText(marker, { includeHiddenElements: true }) as unknown as Node);
      expect(top).not.toBe(radio);
      expect(flat(top).flexDirection).toBe('row');
      expect(radio).toHaveProp('accessibilityState', { selected: name === 'Bieganie', disabled: false });
    }
  });
  test.each([402, 375])('at %s points each start label takes a full-width line under the medallion and the marker', async width => {
    await renderForm(width, 3.12);
    for (const [name, marker] of [['Teraz', '◆'], ['W przyszłym terminie', '◇']] as const) {
      const radio = screen.getByRole('radio', { name }) as unknown as Node;
      const label = within(radio as never).getByText(name) as unknown as Node;
      expect(hostParent(label)).toBe(radio);
      expect(flat(label).alignSelf).toBe('stretch');
      expect(flat(radio).flexDirection).not.toBe('row');
      const top = hostParent(within(radio as never).getByText(marker, { includeHiddenElements: true }) as unknown as Node);
      expect(top).not.toBe(radio);
      expect(flat(top).flexDirection).toBe('row');
      expect(radio).toHaveProp('accessibilityState', { selected: name === 'Teraz', disabled: false });
    }
    const bench = screen.getByRole('header', { name: 'Kiedy Przysięga ma się rozpocząć?' }) as unknown as Node;
    expect(StyleSheet.flatten(hostParent(bench).props.style as StyleProp<ViewStyle>).paddingHorizontal).toBe(10);
  });
  test('at the default text size the activities stay tiles and the start choices stay single rows', async () => {
    await renderForm(402, 1);
    for (const [name, marker] of [['Bieganie', '✓'], ['Trening siłowy', '○'], ['Mobilność', '○']] as const) {
      const radio = screen.getByRole('radio', { name }) as unknown as Node;
      const label = within(radio as never).getByText(name) as unknown as Node;
      expect(hostParent(label)).toBe(radio);
      expect(flat(label).textAlign).toBe('center');
      expect(flat(radio).flexDirection).not.toBe('row');
      expect(hostParent(within(radio as never).getByText(marker, { includeHiddenElements: true }) as unknown as Node)).toBe(radio);
    }
    for (const [name, marker] of [['Teraz', '◆'], ['W przyszłym terminie', '◇']] as const) {
      const radio = screen.getByRole('radio', { name }) as unknown as Node;
      const label = within(radio as never).getByText(name) as unknown as Node;
      expect(hostParent(label)).toBe(radio);
      expect(flat(label).flex).toBe(1);
      expect(flat(radio).flexDirection).toBe('row');
      expect(hostParent(within(radio as never).getByText(marker, { includeHiddenElements: true }) as unknown as Node)).toBe(radio);
    }
    const bench = screen.getByRole('header', { name: 'Kiedy Przysięga ma się rozpocząć?' }) as unknown as Node;
    expect(StyleSheet.flatten(hostParent(bench).props.style as StyleProp<ViewStyle>)).toEqual(expect.objectContaining({ padding: 18 }));
    expect(StyleSheet.flatten(hostParent(bench).props.style as StyleProp<ViewStyle>).paddingHorizontal).toBeUndefined();
  });
});

// MVP-22-A6 (clarity.md rules 1, 3 and 14): the form and the review open with one plain line, never Żaromir's bubble,
// the form names what is missing in one short line, the minute note lives only in the time sheet, and each state has one filled button.
describe('form and review lines', () => {
  const initial = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
  afterEach(() => Dimensions.set(initial));
  const filled = () => screen.queryAllByRole('button').filter(button => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0);
  const copy = {
    pl: { intro: 'Wybierz trening i termin ukończenia.', required: 'Wybierz trening i termin, aby zobaczyć zasady.', review: 'Przeczytaj zasady i złóż Przysięgę.', seconds: 'Czas wybierasz z dokładnością do minuty (sekundy: 00).',
      date: ['Data ukończenia', '25 października 2026'], time: ['Godzina ukończenia', { hour: 'Godzina', minute: 'Minuta', done: 'Ustaw godzinę' }], view: 'Zobacz zasady', confirm: 'Złóż Przysięgę' },
    en: { intro: 'Choose a workout and its deadline.', required: 'Choose a workout and deadline to see the rules.', review: 'Read the rules, then make the Oath.', seconds: 'Times are selected to the minute (seconds: 00).',
      date: ['Completion date', 'October 25, 2026'], time: ['Completion time', { hour: 'Hour', minute: 'Minute', done: 'Use this time' }], view: 'View rules', confirm: 'Commit to the Oath' },
  } as const;
  test.each(['pl', 'en'] as const)('%s at text scale 2 keeps one plain line and one filled button on the form and the review', async locale => {
    const words = copy[locale];
    const phone = { width: 402, height: 874, scale: 3, fontScale: 2 };
    Dimensions.set({ window: phone, screen: phone });
    const f = setup(); f.controller.start();
    await render(<LocalizationProvider initialLocale={locale}><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    expect(await screen.findByText(words.intro)).toBeOnTheScreen();
    expect(screen.queryByTestId('companion-avatar', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByText(words.required)).toBeOnTheScreen();
    expect(screen.queryByText(words.seconds)).toBeNull();
    expect(filled()).toHaveLength(1);
    await selectDate(words.date[0], words.date[1]);
    await fireEvent.press(screen.getByRole('button', { name: words.time[0] }));
    expect(screen.getByText(words.seconds)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: `${words.time[1].hour} 02` }));
    await fireEvent.press(screen.getByRole('radio', { name: `${words.time[1].minute} 30` }));
    await fireEvent.press(screen.getByRole('button', { name: words.time[1].done }));
    expect(screen.queryByText(words.seconds)).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: words.view }));
    expect(await screen.findByText(words.review)).toBeOnTheScreen();
    expect(screen.queryByTestId('companion-avatar', { includeHiddenElements: true })).toBeNull();
    expect(filled()).toHaveLength(1);
    expect(within(screen.getByRole('button', { name: words.confirm })).getByText('◆', { includeHiddenElements: true })).toBeTruthy();
  });
  // MVP-22-A8c: a scheduled start is one more field, so the missing line names it. A start "now" needs none.
  test.each([
    ['pl', 'W przyszłym terminie', 'Wybierz trening, start i termin, aby zobaczyć zasady.'],
    ['en', 'At a future time', 'Choose a workout, start and deadline to see the rules.'],
  ] as const)('%s a scheduled start names the start in the missing line', async (locale, later, required) => {
    const f = setup(); f.controller.start();
    await render(<LocalizationProvider initialLocale={locale}><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    expect(await screen.findByText(copy[locale].required)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: later }));
    expect(screen.getByText(required)).toBeOnTheScreen();
    expect(screen.queryByText(copy[locale].required)).toBeNull();
  });
});
