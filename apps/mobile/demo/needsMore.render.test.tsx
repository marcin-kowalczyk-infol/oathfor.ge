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
test.each([[1, 'room layout with the seal wall'], [2, 'simple layout at 200% text']] as const)('the needs-more-proof Oath renders on Today and its detail at font scale %s (%s)', async (fontScale, _layout) => {
  Dimensions.set({ window: phone(fontScale), screen: phone(fontScale) });
  // An empty Forge with one character, so the seeded record is the only Oath on Today.
  const dummy = createDummy('pl', true, false);
  await dummy.runtime().characterApi.create(token, { requestId: '40000000-0000-4000-8000-000000000001', name: 'Mira', presetId: 'starter_02', build: 'thin', form: 'feminine' });
  const seeded = dummy.addNeedsMore();
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen controller={controllerFor(dummy)} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  expect((await screen.findAllByText('Do uzupełnienia')).length).toBeGreaterThan(0);
  // The seal shows the short state, its spoken label the full one.
  if (fontScale === 1) expect(screen.getByRole('button', { name: /^Pieczęć Przysięgi: .* · Potrzebne uzupełnienie · / })).toBeOnTheScreen();
  const fold = screen.queryByRole('button', { name: 'Wszystkie Twoje Przysięgi' });
  if (fold && !fold.props.accessibilityState?.expanded) await fireEvent.press(fold);
  await fireEvent.press(screen.getByRole('button', { name: /^Otwórz Przysięgę: / }));
  expect(await screen.findByLabelText('Status: Potrzebne uzupełnienie')).toBeOnTheScreen();
  expect(seeded.state).toBe('needs_more_evidence');
});
