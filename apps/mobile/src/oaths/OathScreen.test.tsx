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
const token = 'A'.repeat(43);
function fixture() {
  const snapshot = JSON.parse(JSON.stringify(catalog));
  snapshot.activity = 'running'; snapshot.activation = { mode: 'now', time: null };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { preview: { id, snapshot }, serverTime: '2026-10-24T00:00:00Z' };
}
const controllers: OathController[] = [];
afterEach(() => controllers.splice(0).forEach(controller => controller.dispose()));
function setup() {
  const envelope = fixture();
  const session = { subscribe: () => () => {}, getToken: () => token, getState: () => ({ kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' } }), reauthenticate: jest.fn() } as unknown as SessionController;
  const storage: PendingStorage = { read: jest.fn().mockResolvedValue({ kind: 'success', value: null }), write: jest.fn().mockResolvedValue({ kind: 'success' }) };
  const api = { preview: jest.fn().mockResolvedValue({ kind: 'success', value: envelope }), getPreview: jest.fn().mockResolvedValue({ kind: 'success', value: { preview: envelope.preview, oathId: null } }), confirm: jest.fn().mockResolvedValue({ kind: 'unavailable', retry: 'request' }) } as unknown as OathClient;
  const controller = createOathController({ session, api, storage }); controllers.push(controller);
  return { controller, api, storage, envelope, onLogout: jest.fn() };
}
test('chosen running deadline previews all rules before explicit acceptance can commit', async () => {
  const f = setup(); f.controller.start();
  await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.changeText(await screen.findByLabelText('Completion date'), '2026-10-25');
  await fireEvent.changeText(screen.getByLabelText('Completion time'), '02:30:00');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(f.api.preview).toHaveBeenCalledWith(token, { activity: 'running', activation: { mode: 'now' }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw' } }, expect.any(AbortSignal));
  expect(await screen.findByText(f.envelope.preview.snapshot.copy.en.sections.appeal)).toBeOnTheScreen();
  expect(f.api.confirm).not.toHaveBeenCalled(); expect(f.storage.write).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Commit to the Oath' }));
  expect(f.api.confirm).toHaveBeenCalledWith(token, { previewId: id, requestId: id, accepted: true }, expect.any(AbortSignal));
});
async function fillDeadline() {
  await fireEvent.changeText(await screen.findByLabelText('Completion date'), '2026-10-25');
  await fireEvent.changeText(screen.getByLabelText('Completion time'), '02:30:00');
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
  await fireEvent.changeText(screen.getByLabelText('Completion time'), '03:30:00');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(jest.mocked(f.api.preview).mock.calls[2][1].deadline).toEqual({ local: '2026-10-25T03:30:00', timezone: 'Europe/Warsaw' });
  expect(f.api.confirm).not.toHaveBeenCalled();
});
test('gap error keeps the chosen date and timezone and lets the player correct the time', async () => {
  const f = setup(); jest.mocked(f.api.preview).mockResolvedValueOnce({ kind: 'time_error', code: 'nonexistent_local_time', field: 'deadline' });
  f.controller.start(); await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(await screen.findByText('This local time does not exist because the clocks change. Choose another time.')).toBeOnTheScreen();
  expect(screen.getByDisplayValue('2026-10-25')).toBeOnTheScreen(); expect(screen.getByDisplayValue('02:30:00')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByLabelText('Completion time'), '03:30:00');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(await screen.findByRole('button', { name: 'Commit to the Oath' })).toBeOnTheScreen();
});
test('scheduled start and deadline retain independently chosen zones, with all activity choices', async () => {
  const f = setup(); f.controller.start(); await render(<LocalizationProvider initialLocale="en"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fillDeadline(); await fireEvent.press(screen.getByRole('radio', { name: 'Strength training' }));
  expect(screen.getByRole('radio', { name: 'Mobility' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'At a future time' }));
  await fireEvent.changeText(screen.getByLabelText('Start date'), '2026-10-24');
  await fireEvent.changeText(screen.getByLabelText('Start time'), '10:00:00');
  await fireEvent.changeText(screen.getByLabelText('Start timezone'), 'Europe/London');
  await fireEvent.press(screen.getByRole('button', { name: 'View rules' }));
  expect(jest.mocked(f.api.preview).mock.calls[0][1]).toEqual({ activity: 'strength_training', activation: { mode: 'scheduled', time: { local: '2026-10-24T10:00:00', timezone: 'Europe/London' } }, deadline: { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw' } });
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
  jest.mocked(f.api.confirm).mockResolvedValueOnce({ kind: 'success', value: { oath: { id, snapshot, state: 'active', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: null, review: null }, serverTime: '2026-10-24T00:00:00Z' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Check confirmation' }));
  expect(await screen.findByText('Status: Active')).toBeOnTheScreen();
  expect(jest.mocked(f.api.confirm).mock.calls[1][1]).toEqual(jest.mocked(f.api.confirm).mock.calls[0][1]);
  expect(screen.queryByRole('button', { name: 'Submit evidence' })).toBeNull();
});
test('Polish form and stored rules support recovery after restart without new consent', async () => {
  const f = setup(); jest.mocked(f.storage.read).mockResolvedValueOnce({ kind: 'success', value: { version: 1, accountId, previewId: id, requestId: id } });
  f.controller.start(); await render(<LocalizationProvider initialLocale="pl"><OathScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByRole('button', { name: 'Sprawdź potwierdzenie' })).toBeOnTheScreen();
  expect(await screen.findByText(f.envelope.preview.snapshot.copy.pl.sections.appeal)).toBeOnTheScreen();
  expect(f.api.confirm).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sprawdź potwierdzenie' }));
  expect(jest.mocked(f.api.confirm).mock.calls[0][1].requestId).toBe(id);
  await fireEvent.press(screen.getByRole('button', { name: 'Wyloguj się' })); expect(f.onLogout).toHaveBeenCalledTimes(1);
});
