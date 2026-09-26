import { useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { CharacterCreationScreen, emptyCreationDraft, type CharacterCreationDraft } from './CharacterCreationScreen';
import type { CharacterControllerState } from './controller';
import type { PendingCreation } from './creationStorage';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const accountId = '10000000-0000-4000-8000-00000000000a';
const presets = ['dummy_braid', 'dummy_cropped', 'dummy_curly', 'dummy_tied'];
type Ready = Extract<CharacterControllerState, { kind: 'ready' }>;
const ready = (patch: Partial<Ready> = {}): Ready => ({ kind: 'ready', characters: [], activeCharacterId: null, presets, limit: 3, busy: false, pendingCreation: null, activeRevision: 1, ...patch });
const pending: PendingCreation = { version: 1, accountId, requestId: '40000000-0000-4000-8000-00000000000a', name: 'Zoya', presetId: 'dummy_curly', form: 'neutral' };

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
  const f = await setup(ready({ presets: ['owner_final_01', 'dummy_tied', 'dummy_braid'] })); await act(async () => {});
  expect(screen.getAllByRole('radio', { name: /^Look / })).toHaveLength(2);
  expect(screen.getByRole('radio', { name: 'Look 1 of 2', selected: true })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('radio', { name: 'Look 2 of 2' }));
  expect(screen.getByRole('radio', { name: 'Look 2 of 2', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'Look 1 of 2', selected: false })).toBeOnTheScreen();
  await fireEvent.changeText(nameField(), 'Mira');
  await fireEvent.press(screen.getByRole('radio', { name: 'Oathkeeper, they / them' }));
  await fireEvent.press(create()); await fireEvent.press(create());
  expect(f.onCreate).toHaveBeenCalledTimes(1);
  expect(f.onCreate).toHaveBeenCalledWith({ name: 'Mira', presetId: 'dummy_braid', form: 'neutral' });
});

test('shows the name and chosen title on the preview card with a DUMMY marker', async () => {
  await setup(); await act(async () => {});
  expect(screen.getByText('DUMMY')).toBeOnTheScreen();
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
  expect(screen.getByText('The connection dropped before the Forge answered. Zoya is saved on this device. Try again to finish.')).toBeOnTheScreen();
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
  await f.change(ready({ characters: [1, 2, 3].map(index => ({ id: `30000000-0000-4000-8000-00000000000${index}`, name: 'Mira', presetId: 'dummy_braid', form: 'feminine' as const, createdAt: '2026-09-26T12:00:00Z' })), activeCharacterId: '30000000-0000-4000-8000-000000000001' }));
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
  expect(screen.getByText('The connection dropped before the Forge answered. Zoya is saved on this device. Try again to finish.')).toBeOnTheScreen();
});

test('a rate limit disables Retry until the server wait has elapsed', async () => {
  jest.useFakeTimers();
  try {
    const f = await setup(ready({ pendingCreation: pending, error: { kind: 'rate_limited', retry: 'request', retryAfterSeconds: 2 } })); await act(async () => {});
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDisabled();
    expect(screen.getAllByText('The Forge asks for a short pause. Zoya is saved on this device. Try again in 2 seconds.').length).toBeGreaterThan(0);
    await act(async () => { jest.advanceTimersByTime(1000); });
    expect(screen.getAllByText('The Forge asks for a short pause. Zoya is saved on this device. Try again in 1 second.').length).toBeGreaterThan(0);
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
  expect(screen.queryByText('DUMMY')).toBeNull();
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
