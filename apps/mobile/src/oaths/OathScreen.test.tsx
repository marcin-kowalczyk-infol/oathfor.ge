import { act, fireEvent, render, screen } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OathScreen } from './OathScreen';
import { createOathController, type OathController } from './controller';
import type { SessionController } from '../auth/session';
import type { OathClient } from '../api/oaths';
import type { PendingStorage } from './pendingStorage';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
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
  return { controller, api, storage, envelope, onLogout: jest.fn() };
}
test('chosen running deadline previews all rules before explicit acceptance can commit', async () => {
  const f = setup(); f.controller.start();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await selectDate('Completion date', 'October 25, 2026');
  await selectTime('Completion time', '02', '30');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(f.api.preview).toHaveBeenCalledWith(token, { activity: 'running', activation: { mode: 'now' }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw' } }, expect.any(AbortSignal));
  expect(await screen.findByText(f.envelope.preview.snapshot.copy.en.sections.appeal)).toBeOnTheScreen();
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
  await selectDate('Start date', 'October 24, 2026');
  await selectTime('Start time', '10', '00');
  await fireEvent.press(screen.getByRole('button', { name: 'Start timezone' }));
  await fireEvent.changeText(screen.getByLabelText('Search by city or timezone'), 'London');
  await fireEvent.press(screen.getByRole('radio', { name: 'London · Europe/London' }));
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(jest.mocked(f.api.preview).mock.calls[0][1]).toEqual({ activity: 'strength_training', activation: { mode: 'scheduled', time: { local: '2026-10-24T10:00:00', timezone: 'Europe/London' } }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw' } });
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
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'success', value: { oath: { id, characterId, snapshot, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null }, serverTime: '2026-10-24T00:00:00Z' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Check confirmation' }));
  expect(await screen.findByText('Status: Active')).toBeOnTheScreen();
  expect(jest.mocked(f.api.confirm).mock.calls[1][1]).toEqual(jest.mocked(f.api.confirm).mock.calls[0][1]);
  expect(screen.queryByRole('button', { name: 'Submit evidence' })).toBeNull();
});
test('Polish form and stored rules support recovery after restart without new consent', async () => {
  const f = setup(); jest.mocked(f.storage.read).mockResolvedValueOnce({ kind: 'success', value: { version: 2, accountId, characterId, previewId: id, requestId: id } });
  f.controller.start(); await render(<LocalizationProvider initialLocale="pl"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByRole('button', { name: 'Sprawdź potwierdzenie' })).toBeOnTheScreen();
  expect(await screen.findByText(f.envelope.preview.snapshot.copy.pl.sections.appeal)).toBeOnTheScreen();
  expect(f.api.confirm).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sprawdź potwierdzenie' }));
  expect(jest.mocked(f.api.confirm).mock.calls[0][1].requestId).toBe(id);
  await fireEvent.press(screen.getByRole('button', { name: 'Wyloguj się' })); expect(f.onLogout).toHaveBeenCalledTimes(1);
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
async function selectTime(label: string, hour: string, minute: string) {
  await fireEvent.press(screen.getByRole('button', { name: label }));
  await fireEvent.press(screen.getByRole('radio', { name: `Hour ${hour}` }));
  await fireEvent.press(screen.getByRole('radio', { name: `Minute ${minute}` }));
  await fireEvent.press(screen.getByRole('button', { name: 'Use this time' }));
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
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'success', value: { oath: { id, characterId, snapshot: f.envelope.preview.snapshot, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null }, serverTime: '2026-10-24T00:00:00Z' } });
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" onDraftChange={onDraftChange} /></LocalizationProvider>);
  await fillDeadline();
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Commit to the Oath' }));
  expect(await screen.findByText('Status: Active')).toBeOnTheScreen();
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
