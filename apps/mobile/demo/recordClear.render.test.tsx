import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { LocalizationProvider } from '../src/localization/LocalizationProvider';
import { OathScreen } from '../src/oaths/OathScreen';
import { createOathController, type OathController } from '../src/oaths/controller';
import type { SessionController } from '../src/auth/session';
import messages from '../src/localization/locales/pl/messages.json';
import { createDummy } from './runtime';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
const token = 'A'.repeat(43);
const accountId = '10000000-0000-4000-8000-000000000001';
const characterId = '30000000-0000-4000-8000-000000000001';
const controllers: OathController[] = [];
// Fake timers keep the countdown renders inside acts, as in the OathScreen tests. The DUMMY clock starts at the same instant.
beforeEach(() => { jest.useFakeTimers(); jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-24T12:00:00Z')); });
afterEach(() => { controllers.splice(0).forEach(controller => controller.dispose()); jest.restoreAllMocks(); jest.useRealTimers(); });
const diamond = (button: ReturnType<typeof screen.getByRole>) => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0;
const filled = () => screen.queryAllByRole('button').filter(diamond);
// MVP-22 G30/G32 through the demo: the real controller and OathScreen use the DUMMY Oath API and acceptance storage,
// so the armed control produces the same state the simulator shows.
test('the lost record clear control shows the confirmed Oath with its kept record and the outline check', async () => {
  const dummy = createDummy('pl', true);
  const runtime = dummy.runtime();
  const session = { subscribe: () => () => {}, getToken: () => token, getState: () => ({ kind: 'authenticated', account: { id: accountId, onboardingStatus: 'complete' } }), reauthenticate: jest.fn() } as unknown as SessionController;
  const controller = createOathController({ session, api: runtime.oathApi, storage: runtime.acceptanceStorage });
  controller.setCharacter({ accountId, characterId }); controllers.push(controller); controller.start();
  await render(<LocalizationProvider initialLocale="pl"><OathScreen controller={controller} timezone="Europe/Warsaw" onViewOath={jest.fn()} /></LocalizationProvider>);
  // 18:30 on 25 October is a single Warsaw instant. The 02:30 of that night repeats when clocks go back.
  await fireEvent.press(await screen.findByRole('button', { name: 'Data ukończenia' }));
  await fireEvent.press(screen.getByRole('button', { name: '25 października 2026' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Godzina ukończenia' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Godzina 18' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Minuta 30' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Ustaw godzinę' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Zobacz zasady' }));
  dummy.state.loseNextRecordClear = true;
  const oathsBefore = dummy.state.oaths.length;
  await fireEvent.press(await screen.findByRole('button', { name: 'Złóż Przysięgę' }));
  // The server holds the Oath, the device keeps its record, and the flag is spent on the one clear the confirm makes.
  expect(await screen.findByRole('header', { name: 'Przysięga złożona' })).toBeOnTheScreen();
  expect(dummy.state.oaths).toHaveLength(oathsBefore + 1);
  expect(dummy.state.pending.get(`${accountId}.${characterId}`)).toMatchObject({ accountId, characterId });
  expect(dummy.state.loseNextRecordClear).toBe(false);
  expect(screen.getByText(messages.oath.pendingConfirmed)).toBeOnTheScreen();
  expect(screen.queryByText(messages.oath.pending)).toBeNull();
  expect(filled()).toHaveLength(1);
  expect(diamond(screen.getByRole('button', { name: 'Zobacz Przysięgę' }))).toBe(true);
  expect(diamond(screen.getByRole('button', { name: messages.oath.recover }))).toBe(false);
  // The check replays the same identity, the DUMMY server returns the same Oath and the second clear succeeds.
  await fireEvent.press(screen.getByRole('button', { name: messages.oath.recover }));
  expect(dummy.state.pending.get(`${accountId}.${characterId}`)).toBeNull();
  expect(dummy.state.oaths).toHaveLength(oathsBefore + 1);
  expect(screen.queryByRole('button', { name: messages.oath.recover })).toBeNull();
  expect(screen.queryByText(messages.oath.pendingConfirmed)).toBeNull();
  expect(screen.getByRole('header', { name: 'Przysięga złożona' })).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
});
