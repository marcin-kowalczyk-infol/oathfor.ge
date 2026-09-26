import { useState } from 'react';
import { Dimensions } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import type { Oath } from '../api/oathSchema';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { OathController, OathControllerState } from '../oaths/controller';
import type { HomeState } from './homeRoute';
import { HomeRoutes, type HomeRoutesProps } from './HomeRoutes';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const accountId = '01997aed-8950-7f7a-bda4-36b64697b562';
const mira = { id: '30000000-0000-4000-8000-00000000000a', name: 'Mira', presetId: 'dummy_braid', form: 'feminine' as const, createdAt: '2026-09-24T12:00:00Z' };
const phone = { width: 390, height: 844, scale: 3, fontScale: 1 };
beforeEach(() => Dimensions.set({ window: phone, screen: phone }));

function Harness({ initial, oaths }: { initial: HomeState; oaths: OathController }) {
  const [home, setHome] = useState<HomeState | null>(initial);
  const props: HomeRoutesProps = {
    accountId, character: mira, characterState: { kind: 'ready', characters: [mira], activeCharacterId: mira.id } as unknown as HomeRoutesProps['characterState'],
    characters: { switch: jest.fn(), clearError: jest.fn() }, oaths,
    profile: { locale: 'en', timezone: 'UTC', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' }, timezone: 'UTC',
    guideStorage: { read: jest.fn().mockResolvedValue(true), markSeen: jest.fn() },
    notifications: { state: { permission: { kind: 'checking', canAskAgain: false }, busy: false }, enable: jest.fn(), skip: jest.fn(), retryPermission: jest.fn(), settings: jest.fn() },
    home, onHome: setHome, language: { saving: false, error: false }, onLocale: jest.fn(), onSettingsOpened: jest.fn(),
    renderCreation: () => null, onSignOut: jest.fn(),
  };
  return <LocalizationProvider initialLocale="en"><HomeRoutes {...props} /></LocalizationProvider>;
}

test('a pause route whose Oath controller serves another character goes back to Settings instead of a dead end', async () => {
  const idle = { kind: 'idle' as const };
  const oaths = {
    getState: () => idle, subscribe: () => () => {},
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
    getState: () => state, subscribe: (listener: () => void) => { listeners.add(listener); return () => listeners.delete(listener); },
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
