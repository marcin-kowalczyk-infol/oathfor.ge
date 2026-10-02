import { Dimensions } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../src/localization/LocalizationProvider';
import { OathHomeScreen } from '../src/oaths/OathHomeScreen';
import { createServerClock } from '../src/oaths/serverClock';
import type { OathController, OathControllerState } from '../src/oaths/controller';
import { createDummy } from './runtime';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'pl' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
const token = 'A'.repeat(43);
const initialWindow = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
afterEach(() => Dimensions.set(initialWindow));
const phone = (fontScale: number) => ({ width: 390, height: 844, scale: 3, fontScale });
// The real Today and detail read the DUMMY list and detail, so the seeded record passes the same screens the simulator shows.
function controllerFor(dummy: ReturnType<typeof createDummy>) {
  const api = dummy.runtime().oathApi;
  const state: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
  return { clock: createServerClock(), getState: () => state, subscribe: () => () => {}, list: (query: Parameters<OathController['list']>[0]) => api.list(token, query), detail: (id: string) => api.detail(token, id), getPause: jest.fn(), pause: jest.fn(), resetCreation: jest.fn(), recover: jest.fn() } as unknown as OathController;
}
// The seal shows the short state, its spoken label the full one.
const seal = /^Pieczęć Przysięgi: .* · Potrzebne uzupełnienie · /;
const allOaths = 'Wszystkie Twoje Przysięgi';
// An empty Forge with one character, so the seeded record is the only Oath on Today.
async function seedAndRender(fontScale: number) {
  Dimensions.set({ window: phone(fontScale), screen: phone(fontScale) });
  const dummy = createDummy('pl', true, false);
  await dummy.runtime().characterApi.create(token, { requestId: '40000000-0000-4000-8000-000000000001', name: 'Mira', presetId: 'starter_02', build: 'thin', form: 'feminine' });
  const seeded = dummy.addNeedsMore();
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen controller={controllerFor(dummy)} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  expect((await screen.findAllByText('Do uzupełnienia')).length).toBeGreaterThan(0);
  return seeded;
}
async function openDetail(seeded: { state: string }) {
  await fireEvent.press(screen.getByRole('button', { name: /^Otwórz Przysięgę: / }));
  expect(await screen.findByLabelText('Status: Potrzebne uzupełnienie')).toBeOnTheScreen();
  expect(seeded.state).toBe('needs_more_evidence');
}
// Each layout states what it draws, so no assertion is skipped silently.
test('the needs-more-proof Oath renders on the seal wall, the folded list and its detail in the room layout at font scale 1', async () => {
  const seeded = await seedAndRender(1);
  expect(screen.getByRole('button', { name: seal })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: allOaths })).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  await fireEvent.press(screen.getByRole('button', { name: allOaths }));
  expect(screen.getByRole('button', { name: allOaths })).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
  await openDetail(seeded);
});
test('the needs-more-proof Oath renders in the open list and its detail in the simple layout at 200% text', async () => {
  const seeded = await seedAndRender(2);
  expect(screen.queryByRole('button', { name: seal })).toBeNull();
  expect(screen.queryByRole('button', { name: allOaths })).toBeNull();
  await openDetail(seeded);
});
