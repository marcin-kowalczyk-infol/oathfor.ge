import { AccessibilityInfo, Animated, AppState, Dimensions } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Character } from '../api/characters';
import { presetArt } from '../characters/presetArt';
import { MainMenuScreen, type MainMenuScreenProps } from './MainMenuScreen';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const hidden = { includeHiddenElements: true };
const mira: Character = { id: '30000000-0000-4000-8000-00000000000a', name: 'Mira', presetId: 'dummy_braid', form: 'feminine', createdAt: '2026-09-26T12:00:00Z' };

const ready = (total: number, patch: { paused?: boolean; characterId?: string } = {}) => ({ kind: 'ready' as const, total, paused: false, characterId: mira.id, ...patch });
const phone = (fontScale: number) => ({ width: 390, height: 844, scale: 3, fontScale });
// The Jest window defaults to 750 pt at fontScale 2, which would only ever render the stacked menu.
beforeEach(() => Dimensions.set({ window: phone(1), screen: phone(1) }));
afterEach(() => jest.restoreAllMocks());

async function setup(patch: Partial<MainMenuScreenProps> = {}, locale: 'en' | 'pl' = 'en') {
  const handlers = { onForge: jest.fn(), onTutorial: jest.fn(), onSettings: jest.fn(), onChangeCharacter: jest.fn() };
  const props: MainMenuScreenProps = { character: mira, summary: ready(2), pending: false, layout: 'room', ...handlers, ...patch };
  await render(<LocalizationProvider initialLocale={locale}><MainMenuScreen {...props} /></LocalizationProvider>);
  await act(async () => {});
  return handlers;
}

test('shows the name, the form title and the preset figure', async () => {
  await setup({}, 'pl');
  expect(screen.getByText('Mira')).toBeOnTheScreen();
  expect(screen.getByText('Obrończyni Przysięgi')).toBeOnTheScreen();
  expect(screen.getByTestId('menu-figure', hidden).props.source).toBe(presetArt('dummy_braid')?.figure);
});

test('a preset the app cannot draw shows the placeholder figure', async () => {
  await setup({ character: { ...mira, presetId: 'owner_final_01', form: 'masculine' } });
  expect(screen.getByText('Oathkeeper')).toBeOnTheScreen();
  expect(screen.getByTestId('menu-figure-placeholder', hidden)).toBeOnTheScreen();
  expect(screen.queryByTestId('menu-figure', hidden)).toBeNull();
});

test.each([[1, 'bieżąca Przysięga'], [2, 'bieżące Przysięgi'], [5, 'bieżących Przysiąg'], [22, 'bieżące Przysięgi']])('Polish count %i reads %s', async (total, label) => {
  await setup({ summary: ready(total) }, 'pl');
  expect(screen.getByLabelText(`${total} ${label}`)).toBeOnTheScreen();
  expect(screen.getByText(String(total))).toBeOnTheScreen();
  expect(screen.getByText(label)).toBeOnTheScreen();
});

test.each([[1, 'current Oath'], [2, 'current Oaths']])('English count %i reads %s', async (total, label) => {
  await setup({ summary: ready(total) });
  expect(screen.getByLabelText(`${total} ${label}`)).toBeOnTheScreen();
});

test.each([['loading', { kind: 'loading' as const }], ['failed', { kind: 'failed' as const }], ['ready for another character', ready(4, { characterId: '30000000-0000-4000-8000-00000000000b' })]])('%s shows a dash', async (_, summary) => {
  await setup({ summary });
  expect(screen.getByText('–')).toBeOnTheScreen();
  expect(screen.queryByText('4')).toBeNull();
  expect(screen.getByLabelText('Number of current Oaths unknown')).toBeOnTheScreen();
});

test('a paused character adds the paused line', async () => {
  await setup({ summary: ready(0, { paused: true }) });
  expect(screen.getByText('Character paused')).toBeOnTheScreen();
});

test('an active character has no paused line', async () => {
  await setup({ summary: ready(2, { paused: false }) });
  expect(screen.queryByText('Character paused')).toBeNull();
});

test('a paused summary of another character adds no paused line', async () => {
  await setup({ summary: ready(2, { paused: true, characterId: '30000000-0000-4000-8000-00000000000b' }) });
  expect(screen.queryByText('Character paused')).toBeNull();
});

function spyOnLoop() {
  return jest.spyOn(Animated, 'loop').mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() }));
}

test('the Forge glow stays still with Reduce Motion', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  const loop = spyOnLoop();
  await setup();
  expect(loop).not.toHaveBeenCalled();
});

test('the Forge glow breathes when motion is allowed', async () => {
  const state = Object.getOwnPropertyDescriptor(AppState, 'currentState');
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  const loop = spyOnLoop();
  try {
    await setup();
    expect(loop).toHaveBeenCalledTimes(1);
    expect(loop.mock.results[0].value.start).toHaveBeenCalledTimes(1);
  } finally { if (state) Object.defineProperty(AppState, 'currentState', state); }
});

test('a pending acceptance replaces the Forge subtitle', async () => {
  await setup({ pending: true });
  expect(screen.getByRole('button', { name: 'Enter the Forge, An Oath awaits confirmation' })).toBeOnTheScreen();
  expect(screen.queryByText('Hearth, seals and chronicle')).toBeNull();
});

test('the simple layout hides the Tutorial tile', async () => {
  await setup({ layout: 'simple' });
  expect(screen.queryByRole('button', { name: 'Tutorial, Żaromir shows the way' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Settings, Language, pause, account' })).toBeOnTheScreen();
});

test('the room layout shows the side-by-side card, half-width tiles and a one-line pill', async () => {
  await setup();
  expect(screen.getByTestId('menu-card')).toBeOnTheScreen();
  expect(screen.getByTestId('menu-tile-pair')).toHaveStyle({ flexDirection: 'row' });
  for (const id of ['menu-tutorial', 'menu-settings']) expect(screen.getByTestId(id)).toHaveStyle({ flex: 1 });
  expect(screen.getByText('Change character').props.numberOfLines).toBe(1);
});

test('large text stacks the card', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  await setup({ layout: 'simple' });
  expect(screen.getByTestId('menu-card-stacked')).toBeOnTheScreen();
  expect(screen.queryByTestId('menu-card')).toBeNull();
  expect(screen.getByTestId('menu-tile-pair')).toHaveStyle({ flexDirection: 'column' });
  expect(screen.getByTestId('menu-settings')).toHaveStyle({ flex: 0 });
});

test('each tile and the pill call their handler once', async () => {
  const f = await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Enter the Forge, Hearth, seals and chronicle' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Tutorial, Żaromir shows the way' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Settings, Language, pause, account' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Change character' }));
  for (const handler of [f.onForge, f.onTutorial, f.onSettings, f.onChangeCharacter]) expect(handler).toHaveBeenCalledTimes(1);
});

test('Polish plurals hold without Intl.PluralRules, as on Hermes for iOS', async () => {
  const original = Object.getOwnPropertyDescriptor(Intl, 'PluralRules')!;
  Object.defineProperty(Intl, 'PluralRules', { value: undefined, configurable: true, writable: true });
  try {
    await setup({ summary: ready(22) }, 'pl');
    expect(screen.getByLabelText('22 bieżące Przysięgi')).toBeOnTheScreen();
  } finally { Object.defineProperty(Intl, 'PluralRules', original); }
});
