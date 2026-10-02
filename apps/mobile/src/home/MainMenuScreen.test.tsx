import { AccessibilityInfo, Animated, AppState, Dimensions } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Character } from '../api/characters';
import { StyleSheet } from 'react-native';
import { ArtProvider, resolveArt } from '../art/ArtProvider';
import { currentArt } from '../art/current';
import type { ArtStyle } from '../art/registry';
import { presetArt } from '../characters/presetArt';
import { MainMenuScreen, type MainMenuScreenProps } from './MainMenuScreen';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const hidden = { includeHiddenElements: true };
const mira: Character = { id: '30000000-0000-4000-8000-00000000000a', name: 'Mira', presetId: 'starter_02', build: 'thin', form: 'feminine', createdAt: '2026-09-26T12:00:00Z' };

const ready = (total: number, patch: { paused?: boolean; characterId?: string } = {}) => ({ kind: 'ready' as const, total, paused: false, characterId: mira.id, ...patch });
const phone = (fontScale: number) => ({ width: 390, height: 844, scale: 3, fontScale });
// The Jest window defaults to 750 pt at fontScale 2, which would only ever render the stacked menu.
beforeEach(() => Dimensions.set({ window: phone(1), screen: phone(1) }));
afterEach(() => jest.restoreAllMocks());

async function setup(patch: Partial<MainMenuScreenProps> = {}, locale: 'en' | 'pl' = 'en', style: ArtStyle = 'current') {
  const handlers = { onForge: jest.fn(), onTutorial: jest.fn(), onSettings: jest.fn(), onChangeCharacter: jest.fn() };
  const props: MainMenuScreenProps = { character: mira, summary: ready(2), pending: false, ...handlers, ...patch };
  await render(<ArtProvider style={style}><LocalizationProvider initialLocale={locale}><MainMenuScreen {...props} /></LocalizationProvider></ArtProvider>);
  await act(async () => {});
  return handlers;
}

test('shows the name, the form title and the preset figure', async () => {
  await setup({}, 'pl');
  expect(screen.getByText('Mira')).toBeOnTheScreen();
  expect(screen.getByText('Obrończyni Przysięgi')).toBeOnTheScreen();
  expect(screen.getByTestId('menu-figure', hidden).props.source).toBe(presetArt(currentArt.presets, 'starter_02', 'thin')!.figure);
});

test('the figure follows the character build', async () => {
  await setup({ character: { ...mira, build: 'heavy' } });
  expect(screen.getByTestId('menu-figure', hidden).props.source).toBe(presetArt(currentArt.presets, 'starter_02', 'heavy')!.figure);
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

// MVP-22-A7: the paused line is the shared pause mark, two bars with the word "Paused" (clarity.md "Pause mark").
test('a paused character shows the pause mark', async () => {
  await setup({ summary: ready(0, { paused: true }) });
  expect(screen.getByTestId('pause-mark')).toHaveProp('accessibilityLabel', 'Paused');
  expect(screen.getByTestId('pause-mark-bars', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.getByText('Paused')).toBeOnTheScreen();
  expect(screen.queryByText('Character paused')).toBeNull();
});

test('an active character has no pause mark', async () => {
  await setup({ summary: ready(2, { paused: false }) });
  expect(screen.queryByTestId('pause-mark')).toBeNull();
});

test('a paused summary of another character adds no pause mark', async () => {
  await setup({ summary: ready(2, { paused: true, characterId: '30000000-0000-4000-8000-00000000000b' }) });
  expect(screen.queryByTestId('pause-mark')).toBeNull();
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

test('the simple layout shows the Tutorial tile as a full-width row above Settings', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const f = await setup();
  expect(screen.getByTestId('menu-tile-pair')).toHaveStyle({ flexDirection: 'column' });
  for (const id of ['menu-tutorial', 'menu-settings']) expect(screen.getByTestId(id)).toHaveStyle({ flex: 0 });
  await fireEvent.press(screen.getByRole('button', { name: 'Tutorial, Zharomir explains the rules' }));
  expect(f.onTutorial).toHaveBeenCalledTimes(1);
});

test('the room layout shows the side-by-side card, half-width tiles and a one-line pill', async () => {
  await setup();
  expect(screen.getByTestId('menu-card')).toBeOnTheScreen();
  expect(screen.getByTestId('menu-tile-pair')).toHaveStyle({ flexDirection: 'row' });
  for (const id of ['menu-tutorial', 'menu-settings']) expect(screen.getByTestId(id)).toHaveStyle({ flex: 1 });
  expect(screen.getByText('Change character').props.numberOfLines).toBe(1);
  // Native MVP-18 check on iPhone SE 3: the English pill kept its full width and ran past the text column to the card frame.
  expect(screen.getByRole('button', { name: 'Change character' })).toHaveStyle({ maxWidth: '100%' });
});

test('large text stacks the card', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  await setup();
  expect(screen.getByTestId('menu-card-stacked')).toBeOnTheScreen();
  expect(screen.queryByTestId('menu-card')).toBeNull();
  expect(screen.getByTestId('menu-tile-pair')).toHaveStyle({ flexDirection: 'column' });
  expect(screen.getByTestId('menu-settings')).toHaveStyle({ flex: 0 });
});

test('each tile and the pill call their handler once', async () => {
  const f = await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Enter the Forge, Hearth, seals and chronicle' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Tutorial, Zharomir explains the rules' }));
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

test.each(['current', 'cinematic'] as const)('the Tutorial tile frames Żaromir for the %s art in both layouts', async (style: ArtStyle) => {
  const art = resolveArt(style);
  const { image, frames } = art.companion['zharomir-wanderer-v01'];
  const figure = () => StyleSheet.flatten(screen.getByTestId('menu-tutorial-figure', hidden).props.style);
  await setup({}, 'en', style);
  expect(screen.getByTestId('menu-tutorial-figure', hidden).props.source).toBe(image);
  expect(figure()).toMatchObject({ width: frames.tile.width, height: frames.tile.height, top: frames.tile.top, left: frames.tile.left });
  // The room tile and the menu backdrop draw the style's room.
  expect(screen.getByTestId('menu-forge-room', hidden).props.source).toBe(art.room.image);
  expect(screen.getByTestId('menu-backdrop-room', hidden).props.source).toBe(art.room.image);
  Dimensions.set({ window: phone(2), screen: phone(2) });
  await setup({}, 'en', style);
  // Stacked, the figure keeps its inset from the right edge of the full-width tile.
  await act(async () => { fireEvent(screen.getByTestId('menu-tutorial'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 120 } } }); });
  expect(figure().left + frames.tile.width + frames.tile.right).toBeCloseTo(350, 5);
});

// MVP-22-A7 (clarity.md rule 3): the menu has no filled button in any state, and both languages hold at 200% text.
test.each([['pl', 'W pauzie', 'Przysięga czeka na potwierdzenie'], ['en', 'Paused', 'An Oath awaits confirmation']] as const)('%s at text scale 2 keeps the mark, the tiles and no filled button', async (locale, mark, detail) => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  await setup({ summary: ready(1, { paused: true }), pending: true }, locale);
  expect(screen.getByText(mark)).toBeOnTheScreen();
  expect(screen.getByText(detail)).toBeOnTheScreen();
  expect(screen.queryAllByRole('button').filter(button => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0)).toHaveLength(0);
});
