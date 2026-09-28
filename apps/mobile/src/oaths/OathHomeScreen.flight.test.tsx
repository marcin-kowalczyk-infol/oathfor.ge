import { act, render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OathHomeScreen } from './OathHomeScreen';
import type { OathController, OathControllerState } from './controller';

jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
// The decorative hearth flame owns its own loop.
jest.mock('../ui/HearthFire', () => ({ HearthFire: () => null }));
jest.mock('../ui/useMotion', () => ({ ...jest.requireActual('../ui/useMotion'), useMotionAllowed: () => true }));
const characterId = '30000000-0000-4000-8000-000000000001';

function controller() {
  const state: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
  return { getState: () => state, subscribe: () => () => undefined, detail: jest.fn(), getPause: jest.fn(), pause: jest.fn(), resetCreation: jest.fn().mockReturnValue(true), recover: jest.fn(),
    list: jest.fn().mockResolvedValue({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-10-26T00:00:00Z', paused: false, characterId } }) } as unknown as OathController;
}
const screenFor = (request: { id: number; target: 'create' | 'today' | 'history'; flown?: boolean }) =>
  <LocalizationProvider initialLocale="en"><OathHomeScreen controller={controller()} timezone="UTC" forgeNavigation={{ request, onReturn: jest.fn() }} /></LocalizationProvider>;
const hidden = { includeHiddenElements: true };
// The approach starts after the request is handled, so the checks wait for the screen to settle.
const settle = () => act(async () => { await new Promise(done => setTimeout(done, 0)); });

// The screen's own zoom into the close-up runs 760 ms (SceneSurface).
const zooms = () => jest.mocked(Animated.timing).mock.calls.filter(([, config]) => config.duration === 760).length;
beforeEach(() => { jest.spyOn(Animated, 'timing').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() })); });
afterEach(() => jest.restoreAllMocks());

test.each([['history', 'chronicle'], ['today', 'seals'], ['create', 'hearth']] as const)('after the room flight %s opens without zooming again', async (target, place) => {
  await render(screenFor({ id: 1, target, flown: true }));
  expect(await screen.findByTestId(`forge-place-${place}`, hidden)).toBeTruthy();
  await settle();
  expect(zooms()).toBe(0);
});

test('a request without a flight still zooms into the place', async () => {
  await render(screenFor({ id: 1, target: 'history' }));
  expect(await screen.findByTestId('forge-place-chronicle', hidden)).toBeTruthy();
  await settle();
  expect(zooms()).toBe(1);
});
