import { AccessibilityInfo, AppState } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { ChangeCharacterScreen } from './ChangeCharacterScreen';
import type { CharacterControllerState } from './controller';
import type { Character } from '../api/characters';
import { currentArt } from '../art/current';
import { presetArt } from './presetArt';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
type Ready = Extract<CharacterControllerState, { kind: 'ready' }>;
const at = '2026-09-26T12:00:00Z';
const mira: Character = { id: '30000000-0000-4000-8000-00000000000a', name: 'Mira', presetId: 'starter_01', build: 'heavy', form: 'feminine', createdAt: at };
const bor: Character = { id: '30000000-0000-4000-8000-00000000000b', name: 'Bor', presetId: 'owner_final_01', build: 'thin', form: 'masculine', createdAt: at };
const wit: Character = { id: '30000000-0000-4000-8000-00000000000c', name: 'Wit', presetId: 'starter_04', build: 'thin', form: 'neutral', createdAt: at };
const ready = (patch: Partial<Ready> = {}): Ready => ({ kind: 'ready', characters: [mira, bor], activeCharacterId: mira.id, presets: ['starter_01'], limit: 3, busy: false, pendingCreation: null, activeRevision: 1, ...patch });
afterEach(() => jest.restoreAllMocks());

async function setup(state: Ready = ready(), locale: 'en' | 'pl' = 'en') {
  const handlers = { onChoose: jest.fn(), onNew: jest.fn(), onBack: jest.fn() };
  const view = await render(<LocalizationProvider initialLocale={locale}><ChangeCharacterScreen state={state} {...handlers} /></LocalizationProvider>);
  await act(async () => {});
  const rerender = async (next: Ready) => { await view.rerender(<LocalizationProvider initialLocale={locale}><ChangeCharacterScreen state={next} {...handlers} /></LocalizationProvider>); await act(async () => {}); };
  return { ...handlers, rerender };
}

test('shows a new-character slot below the limit', async () => {
  const f = await setup();
  expect(screen.getByRole('button', { name: 'Mira, Oathkeeper, active character' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Bor, Oathkeeper' })).toBeOnTheScreen();
  expect(screen.getByText('Active')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'New character' }));
  expect(f.onNew).toHaveBeenCalledTimes(1);
});

test('three characters leave no new-character slot', async () => {
  await setup(ready({ characters: [mira, bor, wit] }));
  expect(screen.queryByRole('button', { name: 'New character' })).toBeNull();
  expect(screen.getByText('All three places are taken.')).toBeOnTheScreen();
});

test('choosing another character switches once and choosing the active one only returns', async () => {
  const f = await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Bor, Oathkeeper' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Bor, Oathkeeper' }));
  expect(f.onChoose).toHaveBeenCalledTimes(1);
  expect(f.onChoose).toHaveBeenCalledWith(bor.id);
  await fireEvent.press(screen.getByRole('button', { name: 'Mira, Oathkeeper, active character' }));
  expect(f.onBack).toHaveBeenCalledTimes(1);
  expect(f.onChoose).toHaveBeenCalledTimes(1);
});

test('busy disables every card and the back action, and announces the change', async () => {
  const f = await setup(ready({ busy: true }));
  for (const name of ['Mira, Oathkeeper, active character', 'Bor, Oathkeeper', 'New character', 'Back to menu']) expect(screen.getByRole('button', { name })).toBeDisabled();
  expect(screen.getByText('Changing character…')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Bor, Oathkeeper' }));
  expect(f.onChoose).not.toHaveBeenCalled();
});

test('a failed switch keeps the current character and shows a localized error', async () => {
  const f = await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Bor, Oathkeeper' }));
  await f.rerender(ready({ error: { kind: 'character_error', code: 'not_found' } }));
  expect(screen.getByText('This character is no longer available. Choose another one.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Mira, Oathkeeper, active character' })).toBeOnTheScreen();
  await f.rerender(ready({ error: { kind: 'unavailable', retry: 'request' } }));
  expect(screen.getByText('The Forge cannot be reached right now. Check your connection and try again.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Bor, Oathkeeper' }));
  expect(f.onChoose).toHaveBeenCalledTimes(2);
});

test('an error from before opening the screen is not shown', async () => {
  await setup(ready({ error: { kind: 'character_error', code: 'invalid_preset' } }));
  expect(screen.queryByText('We could not change the character. Try again.')).toBeNull();
});

test('Polish uses the grammatical title of each character and a placeholder for undrawable looks', async () => {
  await setup(ready(), 'pl');
  expect(screen.getByRole('header', { name: 'Zmień postać' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Mira, Obrończyni Przysięgi, aktywna postać' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Bor, Obrońca Przysięgi' })).toBeOnTheScreen();
  expect(screen.getByText('Aktywna postać')).toBeOnTheScreen();
  expect(screen.getByTestId(`portrait-placeholder-${bor.id}`, { includeHiddenElements: true })).toBeTruthy();
});

test('back returns without a request', async () => {
  const f = await setup();
  await fireEvent.press(screen.getByRole('button', { name: 'Back to menu' }));
  expect(f.onBack).toHaveBeenCalledTimes(1); expect(f.onChoose).not.toHaveBeenCalled();
});

test('Reduce Motion shows the cards without an entrance offset', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  await setup();
  expect(screen.getByTestId('character-cards')).toHaveStyle({ opacity: 1, transform: [{ translateY: 0 }] });
});

test('an unresolved creation is shown as a card that returns to creation, and other characters wait', async () => {
  const pending = { version: 2 as const, accountId: '10000000-0000-4000-8000-00000000000a', requestId: '40000000-0000-4000-8000-00000000000a', name: 'Zoya', presetId: 'starter_03', build: 'heavy' as const, form: 'neutral' as const };
  const f = await setup(ready({ pendingCreation: pending }));
  expect(screen.queryByRole('button', { name: 'New character' })).toBeNull();
  expect(screen.getByText('Finish creating Zoya before changing character.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Bor, Oathkeeper' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Finish creating Zoya' }));
  expect(f.onNew).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Bor, Oathkeeper' }));
  expect(f.onChoose).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Mira, Oathkeeper, active character' }));
  expect(f.onBack).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId(`portrait-${pending.requestId}`, { includeHiddenElements: true }).props.source).toBe(presetArt(currentArt.presets, 'starter_03', 'heavy')!.portrait);
});

test('card names stay on one line and display text is capped for the largest text', async () => {
  const long = { ...wit, name: 'Bogumiłaprzemysława' };
  await setup(ready({ characters: [mira, long] }), 'pl');
  const name = screen.getByText('Bogumiłaprzemysława');
  expect(name.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
  expect(name.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.5);
  expect(screen.getByText('Straż Przysięgi').props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
  expect(screen.getByRole('header', { name: 'Zmień postać' }).props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
  expect(screen.getByText('Wybierz, kto niesie Twoje Przysięgi. Każda postać ma własne.').props.maxFontSizeMultiplier).toBeUndefined();
});

test('each card draws its preset in the saved build', async () => {
  await setup(ready({ characters: [mira, wit] }));
  const portrait = (id: string) => screen.getByTestId(`portrait-${id}`, { includeHiddenElements: true }).props.source;
  expect(portrait(mira.id)).toBe(presetArt(currentArt.presets, 'starter_01', 'heavy')!.portrait);
  expect(portrait(wit.id)).toBe(presetArt(currentArt.presets, 'starter_04', 'thin')!.portrait);
  expect(portrait(mira.id)).not.toBe(presetArt(currentArt.presets, 'starter_01', 'thin')!.portrait);
});
