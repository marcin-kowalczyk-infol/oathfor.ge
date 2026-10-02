import { useState } from 'react';
import { AccessibilityInfo, AppState, Dimensions, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { CharacterCreationScreen, emptyCreationDraft, type CharacterCreationDraft } from './CharacterCreationScreen';
import type { CharacterControllerState } from './controller';
import type { PendingCreation } from './creationStorage';
import { currentArt } from '../art/current';
import { presetArt } from './presetArt';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const accountId = '10000000-0000-4000-8000-00000000000a';
const presets = ['starter_01', 'starter_02', 'starter_03', 'starter_04'];
type Ready = Extract<CharacterControllerState, { kind: 'ready' }>;
const ready = (patch: Partial<Ready> = {}): Ready => ({ kind: 'ready', characters: [], activeCharacterId: null, presets, limit: 3, busy: false, pendingCreation: null, activeRevision: 1, ...patch });
const pending: PendingCreation = { version: 2, accountId, requestId: '40000000-0000-4000-8000-00000000000a', name: 'Zoya', presetId: 'starter_03', build: 'heavy', form: 'neutral' };

async function setup(state: CharacterControllerState = ready(), locale: 'en' | 'pl' = 'en') {
  const handlers = { onCreate: jest.fn(), onRetry: jest.fn(), onReload: jest.fn() };
  let setState: (next: CharacterControllerState) => void = () => {};
  function Harness() {
    const [draft, setDraft] = useState<CharacterCreationDraft>(emptyCreationDraft);
    const [current, update] = useState(state); setState = update;
    return <CharacterCreationScreen state={current} draft={draft} onDraft={patch => setDraft(value => ({ ...value, ...patch }))} {...handlers} />;
  }
  const view = await render(<LocalizationProvider initialLocale={locale}><Harness /></LocalizationProvider>);
  return { ...handlers, view, change: (next: CharacterControllerState) => act(async () => setState(next)) };
}
afterEach(() => jest.restoreAllMocks());
const create = () => screen.getByRole('button', { name: 'Create character' });
const nameField = () => screen.getByLabelText('Name');

test('keeps submit disabled until name and form are valid', async () => {
  const f = await setup(); await act(async () => {});
  expect(create()).toBeDisabled();
  expect(screen.getByText('Enter a name and choose a title to continue.')).toBeOnTheScreen();
  await fireEvent.changeText(nameField(), 'Mira');
  expect(create()).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'Oathkeeper, she / her' }));
  expect(create()).toBeEnabled();
  await fireEvent.changeText(nameField(), 'A');
  expect(create()).toBeDisabled();
  expect(f.onCreate).not.toHaveBeenCalled();
});

test('shows a specific live message for each name problem and clears it for a valid name', async () => {
  await setup(); await act(async () => {});
  const messages = {
    A: 'Use at least 2 letters.',
    ['a'.repeat(21)]: 'Use at most 20 characters.',
    R2D2: 'Use letters only. A space, hyphen or apostrophe may sit between them.',
    'Anna--Maria': 'Put a single space, hyphen or apostrophe only between two letters.',
  };
  for (const [value, message] of Object.entries(messages)) {
    await fireEvent.changeText(nameField(), value);
    expect(screen.getByText(message)).toBeOnTheScreen();
  }
  await fireEvent.changeText(nameField(), '  Mira ');
  for (const message of Object.values(messages)) expect(screen.queryByText(message)).toBeNull();
});

test('offers only presets the app can draw, preselects the first and submits the chosen one once', async () => {
  const f = await setup(ready({ presets: ['owner_final_01', 'starter_04', 'starter_01'] })); await act(async () => {});
  expect(screen.getAllByRole('radio', { name: /^Look / })).toHaveLength(2);
  expect(screen.getByRole('radio', { name: 'Look 1 of 2', selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Look 2 of 2' }));
  expect(screen.getByRole('radio', { name: 'Look 2 of 2', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Look 1 of 2', selected: false })).toBeOnTheScreen();
  await fireEvent.changeText(nameField(), 'Mira');
  await fireEvent.press(screen.getByRole('radio', { name: 'Oathkeeper, they / them' }));
  await fireEvent.press(create()); await fireEvent.press(create());
  expect(f.onCreate).toHaveBeenCalledTimes(1);
  expect(f.onCreate).toHaveBeenCalledWith({ name: 'Mira', presetId: 'starter_01', build: 'thin', form: 'neutral' });
});

test('the build starts slight and draws the figure and every look in the chosen build', async () => {
  await setup(); await act(async () => {});
  expect(screen.getByLabelText('Build').props.accessibilityRole).toBe('radiogroup');
  expect(screen.getByRole('radio', { name: 'Slight build', selected: true })).toBeEnabled();
  expect(screen.getByRole('radio', { name: 'Stout build', selected: false })).toBeEnabled();
  const figure = () => screen.getByTestId('character-figure').props.source;
  const look = (id: string) => screen.getByTestId(`look-${id}`).props.source;
  expect(figure()).toBe(presetArt(currentArt.presets, 'starter_01', 'thin')!.figure);
  for (const id of presets) expect(look(id)).toBe(presetArt(currentArt.presets, id, 'thin')!.portrait);
  await fireEvent.press(screen.getByRole('radio', { name: 'Stout build' }));
  expect(screen.getByRole('radio', { name: 'Stout build', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Slight build', selected: false })).toBeOnTheScreen();
  expect(figure()).toBe(presetArt(currentArt.presets, 'starter_01', 'heavy')!.figure);
  for (const id of presets) expect(look(id)).toBe(presetArt(currentArt.presets, id, 'heavy')!.portrait);
  await fireEvent.press(screen.getByRole('radio', { name: 'Look 2 of 4' }));
  expect(figure()).toBe(presetArt(currentArt.presets, 'starter_02', 'heavy')!.figure);
});

test('submits the chosen build with the look, name and title', async () => {
  const f = await setup(); await act(async () => {});
  await fireEvent.press(screen.getByRole('radio', { name: 'Stout build' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Look 4 of 4' }));
  await fireEvent.changeText(nameField(), 'Bor');
  await fireEvent.press(screen.getByRole('radio', { name: 'Oathkeeper, he / him' }));
  await fireEvent.press(create());
  expect(f.onCreate).toHaveBeenCalledWith({ name: 'Bor', presetId: 'starter_04', build: 'heavy', form: 'masculine' });
});

test('Polish names the build choice naturally', async () => {
  await setup(ready(), 'pl'); await act(async () => {});
  expect(screen.getByLabelText('Budowa').props.accessibilityRole).toBe('radiogroup');
  expect(screen.getByText('Budowa')).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Budowa wątła', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Budowa tęga', selected: false })).toBeOnTheScreen();
  expect(screen.getByText('Wątła')).toBeOnTheScreen();
  expect(screen.getByText('Tęga')).toBeOnTheScreen();
});

test('shows the name and chosen title on the preview card without a placeholder marker', async () => {
  await setup(); await act(async () => {});
  expect(screen.queryByText('DUMMY')).toBeNull();
  expect(screen.queryByLabelText('Placeholder art')).toBeNull();
  await fireEvent.changeText(nameField(), 'Mira');
  await fireEvent.press(screen.getByRole('radio', { name: 'Oathkeeper, she / her' }));
  expect(screen.getByLabelText('Preview: Mira, Oathkeeper')).toBeOnTheScreen();
});

test('busy disables every control', async () => {
  await setup(ready({ busy: true })); await act(async () => {});
  expect(nameField().props.editable).toBe(false);
  for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled();
  expect(create()).toBeDisabled();
});

test('a stored creation prefills its values and retries it instead of creating a new one', async () => {
  const f = await setup(ready({ pendingCreation: pending, error: { kind: 'unavailable', retry: 'request' } })); await act(async () => {});
  expect(nameField().props.value).toBe('Zoya');
  expect(nameField().props.editable).toBe(false);
  expect(screen.getByRole('radio', { name: 'Oathkeeper, they / them', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Look 3 of 4', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Stout build', selected: true })).toBeDisabled();
  expect(screen.getByTestId('character-figure').props.source).toBe(presetArt(currentArt.presets, 'starter_03', 'heavy')!.figure);
  expect(screen.getByText('The connection dropped before the Forge answered. Zoya is saved on this device, so you can try again.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Create character' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(f.onRetry).toHaveBeenCalledTimes(1); expect(f.onCreate).not.toHaveBeenCalled();
});

test.each([
  [{ kind: 'character_error', code: 'invalid_character_name' }, 'The Forge did not accept this name. Choose another one.'],
  [{ kind: 'character_error', code: 'character_limit_reached' }, 'This account already has three characters, the most it can hold.'],
  [{ kind: 'character_error', code: 'onboarding_incomplete' }, 'Finish setting up your account before creating a character.'],
  [{ kind: 'character_error', code: 'idempotency_conflict' }, 'We could not create this character. Check your choices and try again.'],
  [{ kind: 'unavailable', retry: 'request' }, 'The Forge cannot be reached right now. Check your connection and try again.'],
  [{ kind: 'storage' }, 'This device could not save your choices. Try again.'],
] as const)('shows a localized message for %o', async (error, message) => {
  await setup(ready({ error })); await act(async () => {});
  expect(screen.getByText(message)).toBeOnTheScreen();
});

test('a rejected look offers to reload the looks and the full roster blocks creation', async () => {
  const f = await setup(ready({ error: { kind: 'character_error', code: 'invalid_preset' } })); await act(async () => {});
  expect(screen.getByText('That look is no longer available. Reload the looks and choose again.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Reload looks' }));
  expect(f.onReload).toHaveBeenCalledTimes(1);
  await f.change(ready({ characters: [1, 2, 3].map(index => ({ id: `30000000-0000-4000-8000-00000000000${index}`, name: 'Mira', presetId: 'starter_01', build: 'thin' as const, form: 'feminine' as const, createdAt: '2026-09-26T12:00:00Z' })), activeCharacterId: '30000000-0000-4000-8000-000000000001' }));
  await fireEvent.changeText(nameField(), 'Mira');
  await fireEvent.press(screen.getByRole('radio', { name: 'Oathkeeper, she / her' }));
  expect(create()).toBeDisabled();
  expect(screen.getByText('This account already has three characters, the most it can hold.')).toBeOnTheScreen();
});

test('loading, unavailable and storage states never show a form, and offer reload where useful', async () => {
  const f = await setup({ kind: 'loading' }); await act(async () => {});
  expect(screen.getByText('Gathering your characters…')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Name')).toBeNull();
  await f.change({ kind: 'unavailable', error: { kind: 'unavailable', retry: 'request' } });
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await f.change({ kind: 'storage_unavailable' });
  expect(screen.getByText('This device could not read your saved choices. Try again.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(f.onReload).toHaveBeenCalledTimes(2);
});

test('Polish shows the three titles as main labels with their grammatical form', async () => {
  await setup(ready(), 'pl'); await act(async () => {});
  expect(screen.getByRole('header', { name: 'Wykuj swoją postać' })).toBeOnTheScreen();
  for (const name of ['Obrońca Przysięgi, forma męska', 'Obrończyni Przysięgi, forma żeńska', 'Straż Przysięgi, forma neutralna']) expect(screen.getByRole('radio', { name })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Stwórz postać' })).toBeDisabled();
});

test('Reduce Motion shows the preview card without an entrance offset', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
  await setup(); await act(async () => {});
  expect(screen.getByTestId('character-preview')).toHaveStyle({ opacity: 1, transform: [{ translateY: 0 }] });
});

test('a stored creation copies its choices into the draft so a later rejection keeps them', async () => {
  const f = await setup(ready({ pendingCreation: pending, error: { kind: 'unavailable', retry: 'request' } })); await act(async () => {});
  await f.change(ready({ error: { kind: 'character_error', code: 'invalid_character_name' } }));
  expect(nameField().props.value).toBe('Zoya');
  expect(nameField().props.editable).toBe(true);
  expect(screen.getByRole('radio', { name: 'Oathkeeper, they / them', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Look 3 of 4', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Stout build', selected: true })).toBeEnabled();
  expect(screen.getByText('The Forge did not accept this name. Choose another one.')).toBeOnTheScreen();
  expect(nameField().props.accessibilityHint).toBe('The Forge did not accept this name. Choose another one.');
});

test('the name field announces the current name problem as its hint', async () => {
  await setup(); await act(async () => {});
  expect(nameField().props.accessibilityHint).toBe('2 to 20 letters. A space, hyphen or apostrophe may sit between them.');
  await fireEvent.changeText(nameField(), 'R2D2');
  expect(nameField().props.accessibilityHint).toBe('Use letters only. A space, hyphen or apostrophe may sit between them.');
});

test('a pending creation keeps the pending message for non-storage errors', async () => {
  await setup(ready({ pendingCreation: pending, error: { kind: 'configuration' } })); await act(async () => {});
  expect(screen.getByText('The connection dropped before the Forge answered. Zoya is saved on this device, so you can try again.')).toBeOnTheScreen();
});

test('a rate limit disables Retry until the server wait has elapsed', async () => {
  jest.useFakeTimers();
  try {
    const f = await setup(ready({ pendingCreation: pending, error: { kind: 'rate_limited', retry: 'request', retryAfterSeconds: 2 } })); await act(async () => {});
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
    expect(screen.getAllByText('The Forge asks for a short break. Zoya is saved on this device, and you can try again in 2 seconds.').length).toBeGreaterThan(0);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(screen.getAllByText('The Forge asks for a short break. Zoya is saved on this device, and you can try again in 1 second.').length).toBeGreaterThan(0);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(f.onRetry).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});

test('busy with a pending creation disables Retry', async () => {
  const f = await setup(ready({ pendingCreation: pending, busy: true })); await act(async () => {});
  expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
  expect(screen.getByText('Finishing Zoya…')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(f.onRetry).not.toHaveBeenCalled();
});

test('a stored preset the app cannot draw shows a neutral figure and still retries', async () => {
  const f = await setup(ready({ pendingCreation: { ...pending, presetId: 'owner_final_01' }, error: { kind: 'unavailable', retry: 'request' } })); await act(async () => {});
  expect(screen.queryByTestId('character-figure')).toBeNull();
  expect(screen.getByTestId('character-placeholder')).toBeOnTheScreen();
  expect(screen.getAllByRole('radio', { name: /^Look / })).toHaveLength(4);
  expect(screen.queryAllByRole('radio', { name: /^Look /, selected: true })).toHaveLength(0);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(f.onRetry).toHaveBeenCalledTimes(1);
});

test('the name field suppresses iOS AutoFill suggestions', async () => {
  await setup(); await act(async () => {});
  expect(nameField().props).toMatchObject({ textContentType: 'none', autoComplete: 'off' });
});

test('the portrait row centres when it fits and still scrolls when it overflows', async () => {
  await setup(); await act(async () => {});
  const row = screen.getByTestId('character-looks');
  expect(row.props.accessibilityRole).toBe('radiogroup');
  expect(row.props.horizontal).toBe(true);
  expect(StyleSheet.flatten(row.props.contentContainerStyle)).toMatchObject({ flexGrow: 1, justifyContent: 'center' });
});

test('the warm light is a card-wide overlay, not a layer clipped by the figure stage', async () => {
  await setup(); await act(async () => {});
  const stage = screen.getByTestId('character-stage');
  for (const id of ['character-glow', 'character-pool']) {
    const layer = screen.getByTestId(id);
    let parent = layer.parent; let insideStage = false;
    while (parent) { if (parent === stage) insideStage = true; parent = parent.parent; }
    expect(insideStage).toBe(false);
  }
});

test('an unresolved creation hides the way back and still explains itself without an error', async () => {
  const onCancel = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><CharacterCreationScreen state={ready({ pendingCreation: pending })} draft={emptyCreationDraft} onDraft={jest.fn()} onCreate={jest.fn()} onRetry={jest.fn()} onReload={jest.fn()} onCancel={onCancel} /></LocalizationProvider>);
  await act(async () => {});
  expect(screen.queryByRole('button', { name: 'Back to characters' })).toBeNull();
  expect(screen.getByText('The connection dropped before the Forge answered. Zoya is saved on this device, so you can try again.')).toBeOnTheScreen();
});

test('creation opened from the change screen offers a way back when nothing is pending', async () => {
  const onCancel = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><CharacterCreationScreen state={ready()} draft={emptyCreationDraft} onDraft={jest.fn()} onCreate={jest.fn()} onRetry={jest.fn()} onReload={jest.fn()} onCancel={onCancel} /></LocalizationProvider>);
  await act(async () => {});
  await fireEvent.press(screen.getByRole('button', { name: 'Back to characters' }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

async function atFontScale<T>(fontScale: number, run: () => Promise<T>) {
  const original = { ...Dimensions.get('window') };
  await act(async () => { Dimensions.set({ window: { ...original, fontScale }, screen: Dimensions.get('screen') }); });
  try { return await run(); } finally { await act(async () => { Dimensions.set({ window: original, screen: Dimensions.get('screen') }); }); }
}

test('at the largest text display words never break mid-word: capped display text, one-line names and stacked title choices', async () => {
  await atFontScale(3.1, async () => {
    await setup(ready(), 'pl'); await act(async () => {});
    const unnamed = screen.getByText('Bez imienia');
    expect(unnamed.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    expect(unnamed.props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.5);
    const untitled = screen.getByText('Tytuł niewybrany');
    expect(untitled.props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
    expect(StyleSheet.flatten(untitled.props.style).letterSpacing).toBeLessThanOrEqual(1);
    expect(screen.getByRole('header', { name: 'Wykuj swoją postać' }).props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
    const choice = screen.getByRole('radio', { name: 'Obrończyni Przysięgi, forma żeńska' });
    expect(StyleSheet.flatten(choice.props.style)).toMatchObject({ flexDirection: 'column' });
    expect(screen.getByText('Obrończyni Przysięgi').props.maxFontSizeMultiplier).toBeLessThanOrEqual(2.5);
    expect(screen.getByText('forma żeńska').props.maxFontSizeMultiplier).toBeUndefined();
    expect(screen.getByText('Od 2 do 20 liter. Między nimi może stać spacja, łącznik lub apostrof.').props.maxFontSizeMultiplier).toBeUndefined();
    const build = screen.getByRole('radio', { name: 'Budowa tęga' });
    expect(StyleSheet.flatten(build.props.style)).toMatchObject({ flexDirection: 'column' });
    expect(screen.getByText('Tęga').props.maxFontSizeMultiplier).toBeLessThanOrEqual(2.5);
  });
});

test('at normal text size title choices keep the radio beside the text', async () => {
  await atFontScale(1, async () => {
    await setup(); await act(async () => {});
    expect(StyleSheet.flatten(screen.getByRole('radio', { name: 'Oathkeeper, she / her' }).props.style)).toMatchObject({ flexDirection: 'row' });
    expect(StyleSheet.flatten(screen.getByRole('radio', { name: 'Slight build' }).props.style)).toMatchObject({ flexDirection: 'row' });
  });
});

test.each([[1, 'row'], [1.5, 'row'], [1.6, 'column'], [3.1, 'column']] as const)('at font scale %d the build cards sit in a %s', async (fontScale, direction) => {
  await atFontScale(fontScale, async () => {
    await setup(ready(), 'pl'); await act(async () => {});
    expect(StyleSheet.flatten(screen.getByTestId('character-builds').props.style)).toMatchObject({ flexDirection: direction });
    for (const name of ['Budowa wątła', 'Budowa tęga']) {
      const card = StyleSheet.flatten(screen.getByRole('radio', { name }).props.style);
      expect(card.minHeight).toBeGreaterThanOrEqual(48);
      if (direction === 'row') expect(card).toMatchObject({ flex: 1, flexDirection: 'row' });
      else { expect(card.flex).toBeUndefined(); expect(card.flexDirection).toBe('column'); }
    }
    for (const word of ['Wątła', 'Tęga']) {
      const label = screen.getByText(word);
      // Side by side a long word shrinks to fit its half of a 375pt screen instead of clipping or ellipsizing.
      if (direction === 'row') expect(label.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, maxFontSizeMultiplier: 1.5 });
      else expect(label.props.numberOfLines).toBeUndefined();
    }
  });
});

test('locked controls look disabled while the words around them stay readable', async () => {
  await setup(ready({ pendingCreation: pending, error: { kind: 'unavailable', retry: 'request' } })); await act(async () => {});
  const opacity = (element: ReturnType<typeof screen.getByText>) => StyleSheet.flatten(element.props.style)?.opacity;
  expect(opacity(nameField())).toBe(0.55);
  for (const radio of screen.getAllByRole('radio')) { expect(radio).toBeDisabled(); expect(opacity(radio)).toBe(0.55); }
  expect(opacity(screen.getByText('Name'))).toBeUndefined();
  expect(opacity(screen.getByRole('button', { name: 'Try again' }))).not.toBe(0.55);
});

test('open controls keep full opacity', async () => {
  await setup(); await act(async () => {});
  expect(StyleSheet.flatten(nameField().props.style).opacity).toBeUndefined();
  for (const radio of screen.getAllByRole('radio')) expect(StyleSheet.flatten(radio.props.style).opacity).toBeUndefined();
});

// MVP-22-A4 (clarity.md rules 1, 3 and 9): short intro and hints, two-sentence pending lines in every Polish plural form,
// at most one filled button in every state, PL and EN at 200% text.
const filled = () => screen.queryAllByRole('button').filter(button => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0);

test.each([
  ['pl', 'Wybierz wygląd, budowę, imię i tytuł.', 'Tytuł ustala, jak Kuźnia się do Ciebie zwraca.'],
  ['en', 'Choose a look, build, name and title.', 'In English every form reads Oathkeeper. The form sets how Polish text addresses you.'],
] as const)('%s intro is one short line and the title hint says what the title does', async (locale, intro, hint) => {
  await setup(ready(), locale); await act(async () => {});
  expect(screen.getByText(intro)).toBeOnTheScreen();
  expect(screen.getByText(hint)).toBeOnTheScreen();
});

test('Polish pending creation waits on the device in two sentences', async () => {
  await setup(ready({ pendingCreation: pending, error: { kind: 'unavailable', retry: 'request' } }), 'pl'); await act(async () => {});
  expect(screen.getByText('Połączenie zerwało się przed odpowiedzią Kuźni. Postać Zoya czeka na tym urządzeniu, spróbuj ponownie.')).toBeOnTheScreen();
});

test.each([[1, 'sekundę'], [2, 'sekundy'], [5, 'sekund'], [12, 'sekund'], [22, 'sekundy']] as const)('Polish rate limit of %i uses "%s"', async (seconds, word) => {
  jest.useFakeTimers();
  try {
    await setup(ready({ pendingCreation: pending, error: { kind: 'rate_limited', retry: 'request', retryAfterSeconds: seconds } }), 'pl'); await act(async () => {});
    expect(screen.getAllByText(`Kuźnia prosi o krótką przerwę. Postać Zoya czeka zapisana na tym urządzeniu, spróbuj ponownie za ${seconds} ${word}.`).length).toBeGreaterThan(0);
  } finally { jest.useRealTimers(); }
});

const states: [string, CharacterControllerState][] = [
  ['loading', { kind: 'loading' } as CharacterControllerState],
  ['fresh', ready()],
  ['pending', ready({ pendingCreation: pending, error: { kind: 'unavailable', retry: 'request' } })],
  ['rate limited', ready({ pendingCreation: pending, error: { kind: 'rate_limited', retry: 'request', retryAfterSeconds: 5 } })],
  ['busy finishing', ready({ pendingCreation: pending, busy: true })],
  ['invalid look', ready({ error: { kind: 'character_error', code: 'invalid_preset' } })],
];
test.each((['pl', 'en'] as const).flatMap(locale => states.map(([name, state]) => [locale, name, state] as const)))('%s %s at text scale 2 shows one filled button at most', async (locale, _name, state) => {
  jest.useFakeTimers();
  try {
    await atFontScale(2, async () => {
      await setup(state, locale); await act(async () => {});
      expect(screen.getByRole('header')).toBeOnTheScreen();
      expect(filled().length).toBeLessThanOrEqual(1);
    });
  } finally { jest.useRealTimers(); }
});

// MVP-22-G24: at the largest text size the intro broke as "imię i" | "tytuł.". Drawn Polish prose keeps a single-letter word with the next one.
const raw = { normalizer: (text: string) => text };
test('Polish drawn prose keeps single-letter words with the next word', async () => {
  await setup(ready(), 'pl'); await act(async () => {});
  expect(screen.getByText('Wybierz wygląd, budowę, imię i tytuł.', raw)).toBeOnTheScreen();
  expect(screen.getByText('Wpisz imię i wybierz tytuł, aby przejść dalej.', raw)).toBeOnTheScreen();
  // The spoken hint keeps the plain form.
  expect(screen.getByRole('button', { name: 'Stwórz postać' }).props.accessibilityHint).toBe('Wpisz imię i wybierz tytuł, aby przejść dalej.');
});

test('the Polish wait line keeps single-letter words with the next word', async () => {
  jest.useFakeTimers();
  try {
    await setup(ready({ pendingCreation: pending, error: { kind: 'rate_limited', retry: 'request', retryAfterSeconds: 5 } }), 'pl'); await act(async () => {});
    expect(screen.getByText('Kuźnia prosi o krótką przerwę. Postać Zoya czeka zapisana na tym urządzeniu, spróbuj ponownie za 5 sekund.', raw)).toBeOnTheScreen();
  } finally { jest.useRealTimers(); }
});

test('the Polish unavailable message keeps single-letter words with the next word', async () => {
  await setup({ kind: 'unavailable', error: { kind: 'unavailable', retry: 'request' } } as CharacterControllerState, 'pl');
  expect(screen.getByText('Kuźnia jest teraz nieosiągalna. Sprawdź połączenie i spróbuj ponownie.', raw)).toBeOnTheScreen();
});

test('English drawn prose keeps ordinary spaces', async () => {
  await setup(); await act(async () => {});
  expect(screen.getByText('Choose a look, build, name and title.', raw)).toBeOnTheScreen();
  expect(screen.getByText('Enter a name and choose a title to continue.', raw)).toBeOnTheScreen();
});
