import { useState } from 'react';
import { createServerClock } from '../oaths/serverClock';
import { Dimensions } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { Oath } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { OathController, OathControllerState } from '../oaths/controller';
import type { HomeState } from './homeRoute';
import { HomeRoutes, type HomeRoutesProps } from './HomeRoutes';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const accountId = '01997aed-8950-7f7a-bda4-36b64697b562';
const mira = { id: '30000000-0000-4000-8000-00000000000a', name: 'Mira', presetId: 'starter_01', build: 'thin' as const, form: 'feminine' as const, createdAt: '2026-09-24T12:00:00Z' };
const phone = { width: 390, height: 844, scale: 3, fontScale: 1 };
beforeEach(() => Dimensions.set({ window: phone, screen: phone }));

function Harness({ initial, oaths, guideStorage = { read: jest.fn().mockResolvedValue(true), markSeen: jest.fn() }, route }: {
  initial: HomeState; oaths: OathController; guideStorage?: HomeRoutesProps['guideStorage'];
  /** Route state held by a parent that outlives these screens, as in AuthScreen. */
  route?: [HomeState | null, HomeRoutesProps['onHome']];
}) {
  const own = useState<HomeState | null>(initial);
  const [home, setHome] = route ?? own;
  const props: HomeRoutesProps = {
    accountId, character: mira, characterState: { kind: 'ready', characters: [mira], activeCharacterId: mira.id } as unknown as HomeRoutesProps['characterState'],
    characters: { switch: jest.fn(), clearError: jest.fn() }, oaths,
    profile: { locale: 'en', timezone: 'UTC', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' }, timezone: 'UTC',
    guideStorage,
    notifications: { state: { permission: { kind: 'checking', canAskAgain: false }, busy: false }, enable: jest.fn(), skip: jest.fn(), retryPermission: jest.fn(), settings: jest.fn() },
    home, onHome: setHome, language: { saving: false, error: false }, onLocale: jest.fn(), onSettingsOpened: jest.fn(),
    renderCreation: () => null, onSignOut: jest.fn(),
  };
  return <LocalizationProvider initialLocale="en"><HomeRoutes {...props} /></LocalizationProvider>;
}

test('a pause route whose Oath controller serves another character goes back to Settings instead of a dead end', async () => {
  const idle = { kind: 'idle' as const };
  const oaths = {
    clock: createServerClock(), getState: () => idle, subscribe: () => () => {},
    list: jest.fn().mockResolvedValue({ kind: 'cancelled' }), getPause: jest.fn(), detail: jest.fn(),
    boundCharacter: () => ({ accountId, characterId: '30000000-0000-4000-8000-00000000000b' }),
  } as unknown as OathController;
  await render(<Harness oaths={oaths} initial={{ accountId, characterId: mira.id, route: { kind: 'pause' }, sequence: 0 }} />);
  expect(await screen.findByRole('header', { name: 'Settings' })).toBeOnTheScreen();
  expect(screen.queryByRole('header', { name: 'Review pause' })).toBeNull();
  expect(oaths.getPause).not.toHaveBeenCalled();
});

test('a newly confirmed Oath refreshes the menu summary', async () => {
  let state: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
  const listeners = new Set<() => void>();
  let total = 2;
  const summaryLoads = () => jest.mocked(oaths.list).mock.calls.filter(([query]) => query.limit === 1).length;
  const oaths = {
    clock: createServerClock(), getState: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
    list: jest.fn(async () => ({ kind: 'success', value: { items: [], nextCursor: null, total, serverTime: '2026-09-26T12:00:00Z', paused: false, characterId: mira.id } })),
    detail: jest.fn(), getPause: jest.fn(), resetCreation: jest.fn(), recover: jest.fn(),
    boundCharacter: () => ({ accountId, characterId: mira.id }),
  } as unknown as OathController;
  await render(<Harness oaths={oaths} initial={{ accountId, characterId: mira.id, route: { kind: 'menu' }, sequence: 0 }} />);
  expect(await screen.findByLabelText('2 current Oaths')).toBeOnTheScreen();
  expect(summaryLoads()).toBe(1);
  total = 3;
  state = { ...state, oath: { id: '20000000-0000-4000-8000-000000000009' } as unknown as Oath };
  await act(async () => listeners.forEach(listener => listener()));
  expect(await screen.findByLabelText('3 current Oaths')).toBeOnTheScreen();
  expect(summaryLoads()).toBe(2);
});

/** Leaving the room: the door visit, Żaromir's line, then the action, which opens the menu within 700 ms. */
async function leaveRoom() {
  await fireEvent.press(await screen.findByRole('button', { name: 'Door' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Leave the Forge' }));
}
const menu: HomeState = { accountId, characterId: mira.id, route: { kind: 'menu' }, sequence: 0 };
const readyState: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
const readyOaths = () => ({
  clock: createServerClock(), getState: () => readyState, subscribe: () => () => {},
  list: jest.fn(async () => ({ kind: 'success', value: { items: [], nextCursor: null, total: 0, serverTime: '2026-09-26T12:00:00Z', paused: false, characterId: mira.id } })),
  detail: jest.fn(), getPause: jest.fn(), resetCreation: jest.fn(), recover: jest.fn(),
  boundCharacter: () => ({ accountId, characterId: mira.id }),
}) as unknown as OathController;
const unseenGuide = () => ({ read: jest.fn().mockResolvedValue(false), markSeen: jest.fn().mockResolvedValue(undefined) });
const tutorialTile = { name: 'Tutorial, Learn the rules from Zharomir' };
const forgeTile = { name: 'Enter the Forge, Hearth, seals and chronicle' };

test('the Tutorial tile opens the room tutorial instead of the first-visit guide and counts the guide as seen', async () => {
  const guideStorage = unseenGuide();
  await render(<Harness oaths={readyOaths()} initial={menu} guideStorage={guideStorage} />);
  await fireEvent.press(await screen.findByRole('button', tutorialTile));
  expect(await screen.findByText('I will tell you how the Forge works. Touch the place you want to hear about.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Skip introduction' })).toBeNull();
  expect(guideStorage.markSeen).toHaveBeenCalledTimes(1);
  expect(guideStorage.markSeen).toHaveBeenCalledWith(accountId);
  await fireEvent.press(screen.getByRole('button', { name: 'Close the tutorial' }));
  await leaveRoom();
  await fireEvent.press(await screen.findByRole('button', forgeTile));
  expect(await screen.findByRole('button', { name: 'Door' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Skip introduction' })).toBeNull();
});

test('the Forge tile still starts the guide on the first visit', async () => {
  await render(<Harness oaths={readyOaths()} initial={menu} guideStorage={unseenGuide()} />);
  await fireEvent.press(await screen.findByRole('button', forgeTile));
  expect(await screen.findByRole('button', { name: 'Skip introduction' })).toBeOnTheScreen();
});

test('in simple layout the Tutorial tile opens the rules screen and back returns to the menu', async () => {
  const large = { ...phone, fontScale: 2 };
  Dimensions.set({ window: large, screen: large });
  await render(<Harness oaths={readyOaths()} initial={menu} />);
  await fireEvent.press(await screen.findByRole('button', tutorialTile));
  expect(await screen.findByRole('header', { name: 'Forge rules' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to menu' }));
  expect(await screen.findByRole('button', tutorialTile)).toBeOnTheScreen();
});

test('the room menu plate returns to the menu', async () => {
  await render(<Harness oaths={readyOaths()} initial={menu} />);
  await fireEvent.press(await screen.findByRole('button', forgeTile));
  await fireEvent.press(await screen.findByRole('button', { name: 'Back to menu' }));
  expect(await screen.findByRole('button', forgeTile)).toBeOnTheScreen();
});

test('in simple layout the Forge keeps its own back link and has no room plate', async () => {
  const large = { ...phone, fontScale: 2 };
  Dimensions.set({ window: large, screen: large });
  await render(<Harness oaths={readyOaths()} initial={menu} />);
  await fireEvent.press(await screen.findByRole('button', forgeTile));
  expect(await screen.findAllByRole('button', { name: 'Back to menu' })).toHaveLength(1);
  expect(screen.queryByTestId('room-menu-plate')).toBeNull();
});

test('a seen guide is not stored again when the tutorial starts', async () => {
  const guideStorage = { read: jest.fn().mockResolvedValue(true), markSeen: jest.fn() };
  await render(<Harness oaths={readyOaths()} initial={menu} guideStorage={guideStorage} />);
  await fireEvent.press(await screen.findByRole('button', tutorialTile));
  expect(await screen.findByText('I will tell you how the Forge works. Touch the place you want to hear about.')).toBeOnTheScreen();
  expect(guideStorage.markSeen).not.toHaveBeenCalled();
});

test('the tutorial as the first room entry waits for the guide flag and then replaces the guide', async () => {
  let answer!: (seen: boolean) => void;
  const guideStorage = { read: jest.fn(() => new Promise<boolean>(resolve => { answer = resolve; })), markSeen: jest.fn().mockResolvedValue(undefined) };
  await render(<Harness oaths={readyOaths()} initial={menu} guideStorage={guideStorage} />);
  await fireEvent.press(await screen.findByRole('button', tutorialTile));
  expect(screen.getByTestId('forge-room-waiting')).toBeOnTheScreen();
  expect(guideStorage.markSeen).not.toHaveBeenCalled();
  await act(async () => answer(false));
  expect(await screen.findByText('I will tell you how the Forge works. Touch the place you want to hear about.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Skip introduction' })).toBeNull();
  expect(guideStorage.markSeen).toHaveBeenCalledTimes(1);
});

// Review of MVP-19-T05: a foreground session check remounts the routes, and a closed tutorial must not start again.
test('a closed tutorial stays closed when the routes remount', async () => {
  const oaths = readyOaths();
  function Remountable({ mounted }: { mounted: boolean }) {
    const route = useState<HomeState | null>(menu);
    return mounted ? <Harness oaths={oaths} initial={menu} route={route} /> : null;
  }
  const view = await render(<Remountable mounted />);
  await fireEvent.press(await screen.findByRole('button', tutorialTile));
  await fireEvent.press(await screen.findByRole('button', { name: 'Close the tutorial' }));
  await view.rerender(<Remountable mounted={false} />);
  await view.rerender(<Remountable mounted />);
  expect(await screen.findByRole('button', { name: 'Door' })).toBeOnTheScreen();
  expect(screen.queryByText('I will tell you how the Forge works. Touch the place you want to hear about.')).toBeNull();
});

test('entering the room and touching Żaromir load the Today and history totals for his statistics', async () => {
  const oaths = readyOaths();
  const loads = (view: 'today' | 'history') => jest.mocked(oaths.list).mock.calls.filter(([query]) => query.view === view && query.limit === 1).length;
  await render(<Harness oaths={oaths} initial={menu} />);
  await screen.findByRole('button', forgeTile);
  expect(loads('history')).toBe(0);
  await fireEvent.press(screen.getByRole('button', forgeTile));
  await screen.findByRole('button', { name: 'Zharomir, your progress' });
  expect(loads('history')).toBe(1);
  const today = loads('today');
  await fireEvent.press(screen.getByRole('button', { name: 'Zharomir, your progress' }));
  expect(loads('history')).toBe(2);
  expect(loads('today')).toBe(today + 1);
});

test('a return from a place the room flew into starts the room on that close-up', async () => {
  await render(<Harness oaths={readyOaths()} initial={{ ...menu, route: { kind: 'forge', tutorial: null, from: 'seals' } }} />);
  expect(await screen.findByTestId('flight-closeup', { includeHiddenElements: true })).toBeTruthy();
});

test('a place action in the room asks for a flown request', async () => {
  const route = jest.fn();
  let home: HomeState | null = { ...menu, route: { kind: 'forge', tutorial: null } };
  const onHome: HomeRoutesProps['onHome'] = update => { home = typeof update === 'function' ? update(home) : update; route(home); };
  await render(<Harness oaths={readyOaths()} initial={home!} route={[home, onHome]} />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Seals' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
  await fireEvent.press(screen.getByRole('button', { name: 'View current Oaths' }));
  await waitFor(() => expect(route).toHaveBeenLastCalledWith(expect.objectContaining({ route: { kind: 'oaths', request: expect.objectContaining({ target: 'today', flown: true }) } })));
});
