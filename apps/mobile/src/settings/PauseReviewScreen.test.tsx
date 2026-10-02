import { Dimensions } from 'react-native';
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import type { Locale } from '../localization/locale';
import { PauseReviewScreen } from './PauseReviewScreen';
import type { OathController, OathControllerState } from '../oaths/controller';
import type { Oath } from '../api/oathSchema';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const id = '20000000-0000-4000-8000-000000000001';
const serverTime = '2026-10-26T00:00:00Z';
const characterId = '30000000-0000-4000-8000-000000000001';
const character = { id: characterId, name: 'Mira', presetId: 'starter_01', build: 'thin' as const, form: 'feminine' as const, createdAt: '2026-09-24T12:00:00Z' };
function oath(patch: Partial<Oath> = {}): Oath {
  const snapshot = JSON.parse(JSON.stringify(catalog)); snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { id, characterId, snapshot, state: 'review_pending', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: 'service_availability_unknown', review: { enteredAt: '2026-10-25T00:45:01Z', closesAt: '2026-10-28T00:45:01Z' }, proof: null, ...patch };
}
function setup() {
  const ready: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
  let state: OathControllerState = ready;
  const listeners = new Set<() => void>();
  const controller = { getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, detail: jest.fn().mockResolvedValue({ kind: 'success', value: { oath: oath(), serverTime } }), getPause: jest.fn(), pause: jest.fn(), refresh: jest.fn() } as unknown as OathController;
  return { controller, ready, onBack: jest.fn(), onChanged: jest.fn(), change(next: OathControllerState) { state = next; listeners.forEach(fn => fn()); } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const pauseSummary = (revision = 'a'.repeat(64), paused = false) => ({ paused, revision, withdraw: paused ? [] : [id], preserve: [], serverTime, characterId });
async function show(f: ReturnType<typeof setup>, locale: Locale = 'en') {
  await render(<LocalizationProvider initialLocale={locale}><PauseReviewScreen controller={f.controller} character={character} onBack={f.onBack} onChanged={f.onChanged} /></LocalizationProvider>);
}

test('partial pause-detail failure never exposes confirmation', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  jest.mocked(f.controller.detail).mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  await show(f);
  expect(await screen.findByRole('button', { name: 'Reload pause review' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Confirm pause' })).toBeNull(); expect(f.controller.pause).not.toHaveBeenCalled();
});
test('the review loads on entry and names the character it applies to', async () => {
  const f = setup(); const response = deferred<Awaited<ReturnType<OathController['getPause']>>>();
  jest.mocked(f.controller.getPause).mockReturnValueOnce(response.promise);
  await show(f);
  expect(screen.getByRole('header', { name: 'Review pause' })).toBeOnTheScreen();
  expect(screen.getByText('Mira')).toBeOnTheScreen();
  expect(screen.getByText('Loading Oaths…')).toBeOnTheScreen();
  await act(async () => response.resolve({ kind: 'success', value: pauseSummary() }));
  expect(await screen.findByRole('button', { name: 'Confirm pause' })).toBeOnTheScreen();
  expect(screen.getByText('Pause does not extend deadlines.')).toBeOnTheScreen();
  expect(screen.queryByText('Loading Oaths…')).toBeNull();
});
test('pause shows meaningful complete-set summaries and a changed revision requires a new confirmation', async () => {
  const f = setup(); const extraId = '20000000-0000-4000-8000-000000000002';
  const preserved = oath({ id: extraId });
  jest.mocked(f.controller.getPause).mockResolvedValueOnce({ kind: 'success', value: { ...pauseSummary(), preserve: [extraId] } }).mockResolvedValueOnce({ kind: 'success', value: pauseSummary('b'.repeat(64)) });
  jest.mocked(f.controller.detail).mockImplementation(async selectedId => ({ kind: 'success', value: { oath: selectedId === id ? oath() : preserved, serverTime } }));
  jest.mocked(f.controller.pause).mockResolvedValueOnce({ kind: 'oath_error', code: 'pause_preview_changed' }).mockResolvedValueOnce({ kind: 'success', value: pauseSummary('c'.repeat(64), true) });
  await show(f);
  expect(await screen.findByRole('button', { name: 'Confirm pause' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Will be withdrawn' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Will continue' })).toBeOnTheScreen();
  // MVP-22-B1 (G10): the short path time and the zone label. The fixture deadline falls in the repeated hour, so the offset stays.
  expect(screen.getAllByText('Running · Sun, Oct 25, 02:30 (UTC+02:00) · Warsaw')).toHaveLength(2);
  expect(screen.queryByText(/Europe\/Warsaw/)).toBeNull();
  expect(screen.queryByText(id)).toBeNull(); expect(f.controller.pause).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm pause' }));
  expect(await screen.findByText('Your Oaths have changed. Review them again, since pause does not extend deadlines.')).toBeOnTheScreen();
  expect(f.controller.pause).toHaveBeenCalledTimes(1); expect(f.onChanged).not.toHaveBeenCalled();
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm pause' }));
  expect(jest.mocked(f.controller.pause).mock.calls.map(call => call[0])).toEqual([{ paused: true, revision: 'a'.repeat(64) }, { paused: true, revision: 'b'.repeat(64) }]);
  expect(f.onChanged).toHaveBeenCalledTimes(1);
  // The confirmed change stays locked until the parent returns to Settings, so it is never sent twice.
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm pause' }));
  expect(f.controller.pause).toHaveBeenCalledTimes(2); expect(f.onChanged).toHaveBeenCalledTimes(1);
});
test('a character switch during pause review stops and waits for the app to rebind instead of pausing another character', async () => {
  const f = setup();
  jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  jest.mocked(f.controller.pause).mockResolvedValueOnce({ kind: 'oath_error', code: 'character_changed' });
  await show(f);
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm pause' }));
  expect(await screen.findByText('Your active character changed. Review the current Oaths again.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Confirm pause' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Reload pause review' })).toBeOnTheScreen();
  expect(f.controller.getPause).toHaveBeenCalledTimes(1);
  expect(jest.mocked(f.controller.pause).mock.calls.map(call => call[0])).toEqual([{ paused: true, revision: 'a'.repeat(64) }]);
  expect(f.onChanged).not.toHaveBeenCalled();
});
test('resume only sends the flag, and a failed change requires current-state reload', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary('a'.repeat(64), true) });
  jest.mocked(f.controller.pause).mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' }).mockResolvedValueOnce({ kind: 'success', value: pauseSummary() });
  await show(f);
  expect(await screen.findByText('Oaths awaiting a result continue. Withdrawn ones do not come back.')).toBeOnTheScreen();
  await fireEvent.press(await screen.findByRole('button', { name: 'Resume play' }));
  expect(jest.mocked(f.controller.pause).mock.calls[0][0]).toEqual({ paused: false });
  expect(screen.queryByRole('button', { name: 'Resume play' })).toBeNull();
  expect(screen.getByText('We could not confirm the pause change. Reload its current status before trying again.')).toBeOnTheScreen();
  expect(f.onChanged).not.toHaveBeenCalled();
  await fireEvent.press(await screen.findByRole('button', { name: 'Reload pause review' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Resume play' }));
  expect(f.onChanged).toHaveBeenCalledTimes(1);
});
test('a failed review load offers a reload', async () => {
  const f = setup();
  jest.mocked(f.controller.getPause).mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' }).mockResolvedValueOnce({ kind: 'success', value: pauseSummary() });
  await show(f);
  expect(await screen.findByText('We could not load your Oaths. Try again.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Reload pause review' }));
  expect(await screen.findByRole('button', { name: 'Confirm pause' })).toBeOnTheScreen();
});
test('controller revalidation clears old pause busy state without an old response unlocking a newer mutation', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary('a'.repeat(64), true) });
  const old = deferred<Awaited<ReturnType<OathController['pause']>>>(); const newer = deferred<Awaited<ReturnType<OathController['pause']>>>();
  jest.mocked(f.controller.pause).mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
  await show(f);
  await fireEvent.press(await screen.findByRole('button', { name: 'Resume play' }));
  expect(screen.getByRole('button', { name: 'Back to Settings', disabled: true })).toBeOnTheScreen();
  await act(async () => f.change({ kind: 'loading' }));
  await act(async () => f.change(f.ready));
  expect(await screen.findByRole('button', { name: 'Back to Settings', disabled: false })).toBeOnTheScreen();
  expect(f.controller.getPause).toHaveBeenCalledTimes(2);
  await fireEvent.press(await screen.findByRole('button', { name: 'Resume play' }));
  await act(async () => old.resolve({ kind: 'success', value: pauseSummary() }));
  expect(f.onChanged).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Back to Settings', disabled: true })).toBeOnTheScreen();
  await act(async () => newer.resolve({ kind: 'success', value: pauseSummary() }));
  expect(f.onChanged).toHaveBeenCalledTimes(1);
});
test('back returns without sending a change', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  await show(f);
  await screen.findByRole('button', { name: 'Confirm pause' });
  await fireEvent.press(screen.getByRole('button', { name: 'Back to Settings' }));
  expect(f.onBack).toHaveBeenCalledTimes(1);
  expect(f.controller.pause).not.toHaveBeenCalled(); expect(f.onChanged).not.toHaveBeenCalled();
});
test('Polish review uses localized copy without exposing IDs', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  await show(f, 'pl');
  expect(await screen.findByRole('button', { name: 'Potwierdź pauzę' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Sprawdź skutki pauzy' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Zostaną wycofane' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Wróć do ustawień' })).toBeOnTheScreen();
  expect(screen.queryByText(id)).toBeNull();
});

test('text inside the review cards is capped so long Polish words never break mid-word at the largest text', async () => {
  // Native MVP-18 check on iPhone SE 3 at the largest size: card entries grew to one word per line inside the narrow cards.
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  await show(f, 'pl');
  await screen.findByRole('button', { name: 'Potwierdź pauzę' });
  expect(screen.getByText('Brak').props.maxFontSizeMultiplier).toBeLessThanOrEqual(2.5);
  expect(screen.getByText(/^Bieganie · /).props.maxFontSizeMultiplier).toBeLessThanOrEqual(2.5);
});

// MVP-22-A1 (clarity.md decision 14): facts are plain lines, one at a time, Żaromir never speaks here, at most one filled button.
const size = (fontScale: number) => Dimensions.set({ window: { width: 402, height: 874, scale: 3, fontScale }, screen: { width: 402, height: 874, scale: 3, fontScale } });
afterEach(() => size(1));
const filled = () => screen.queryAllByRole('button').filter(button => within(button).queryAllByText('◆', { includeHiddenElements: true }).length > 0);
const intro = 'Pause does not extend deadlines.';
function plain(text: string) {
  expect(screen.getByText(text)).toBeOnTheScreen();
  expect(screen.queryByTestId('companion-avatar', { includeHiddenElements: true })).toBeNull();
  expect(screen.queryByTestId('zaromir-bust', { includeHiddenElements: true })).toBeNull();
  expect(filled().length).toBeLessThanOrEqual(1);
}

test('the loaded review shows the intro as a plain line, the In play mark and one filled button', async () => {
  const f = setup(); const response = deferred<Awaited<ReturnType<OathController['getPause']>>>();
  jest.mocked(f.controller.getPause).mockReturnValueOnce(response.promise);
  await show(f);
  // MVP-22-A4b: no mark while the review loads. "Unknown" is a state the player can act on, not a loading placeholder.
  expect(screen.queryByTestId('pause-mark')).toBeNull();
  await act(async () => response.resolve({ kind: 'success', value: pauseSummary() }));
  await screen.findByRole('button', { name: 'Confirm pause' });
  plain(intro);
  expect(filled()).toHaveLength(1);
  expect(screen.getByTestId('pause-mark')).toHaveProp('accessibilityLabel', 'In play');
});

test('a paused character shows the Paused mark and the pause fact as a plain line', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary('a'.repeat(64), true) });
  await show(f);
  await screen.findByRole('button', { name: 'Resume play' });
  plain('Oaths awaiting a result continue. Withdrawn ones do not come back.');
  expect(screen.getByTestId('pause-mark')).toHaveProp('accessibilityLabel', 'Paused');
});

// MVP-22-E1.3: Settings opens this review for a paused character. Resuming withdraws nothing, so only what continues is listed,
// and the fact that pause does not extend deadlines stays one touch away.
test.each([
  ['en', 'Resume play', 'Will be withdrawn', 'Will continue', 'Full description', 'Pause does not extend deadlines.'],
  ['pl', 'Wznów rozgrywkę', 'Zostaną wycofane', 'Będą kontynuowane', 'Pełny opis', 'Pauza nie przedłuża terminów.'],
] as const)('%s paused review keeps the deadline fact behind one link and lists only what continues', async (locale, resume, withdraw, preserve, more, fact) => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary('a'.repeat(64), true) });
  await show(f, locale);
  await screen.findByRole('button', { name: resume });
  expect(screen.queryByRole('header', { name: withdraw })).toBeNull();
  expect(screen.getByRole('header', { name: preserve })).toBeOnTheScreen();
  expect(screen.queryByText(fact)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: more }));
  expect(screen.getByText(fact)).toBeOnTheScreen();
});

test('an active character sees the deadline fact in the intro line and both lists', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  await show(f);
  await screen.findByRole('button', { name: 'Confirm pause' });
  expect(screen.getByTestId('pause-line')).toHaveTextContent('Pause does not extend deadlines.');
  expect(screen.getByRole('header', { name: 'Will be withdrawn' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Full description' })).toBeNull();
});

test('a changed Oath list replaces the intro instead of stacking under it', async () => {
  const f = setup();
  jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  jest.mocked(f.controller.pause).mockResolvedValueOnce({ kind: 'oath_error', code: 'pause_preview_changed' });
  await show(f);
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm pause' }));
  await screen.findByRole('button', { name: 'Confirm pause' });
  plain('Your Oaths have changed. Review them again, since pause does not extend deadlines.');
  expect(screen.queryByText(intro)).toBeNull();
});

test('a character switch shows only its own line, not the generic pause error too', async () => {
  const f = setup();
  jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  jest.mocked(f.controller.pause).mockResolvedValueOnce({ kind: 'oath_error', code: 'character_changed' });
  await show(f);
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm pause' }));
  plain('Your active character changed. Review the current Oaths again.');
  expect(screen.queryByText('We could not confirm the pause change. Reload its current status before trying again.')).toBeNull();
  expect(screen.getByText('Your active character changed. Review the current Oaths again.')).toHaveProp('accessibilityRole', 'alert');
});

test('a failed load shows its error as a plain alert line with one filled reload', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'unavailable', retry: 'request' });
  await show(f);
  await screen.findByRole('button', { name: 'Reload pause review' });
  plain('We could not load your Oaths. Try again.');
  expect(filled()).toHaveLength(1);
  expect(screen.getByText('We could not load your Oaths. Try again.')).toHaveProp('accessibilityLiveRegion', 'polite');
});

test.each([
  ['pl', false, 'Potwierdź pauzę', 'Pauza nie przedłuża terminów.', 'W grze'],
  ['en', true, 'Resume play', 'Oaths awaiting a result continue. Withdrawn ones do not come back.', 'Paused'],
] as const)('%s at text scale 2 keeps the line, the mark and one filled button', async (locale, paused, button, line, mark) => {
  size(2);
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary('a'.repeat(64), paused) });
  await show(f, locale);
  await screen.findByRole('button', { name: button });
  plain(line);
  expect(screen.getByText(mark)).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
});

test('the Polish changed list keeps the deadline fact in two sentences', async () => {
  const f = setup();
  jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  jest.mocked(f.controller.pause).mockResolvedValueOnce({ kind: 'oath_error', code: 'pause_preview_changed' });
  await show(f, 'pl');
  await fireEvent.press(await screen.findByRole('button', { name: 'Potwierdź pauzę' }));
  await screen.findByRole('button', { name: 'Potwierdź pauzę' });
  plain('Twoje Przysięgi się zmieniły. Sprawdź je ponownie, pauza nie przedłuża terminów.');
});

test('a failed load shows the Unknown mark', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'unavailable', retry: 'request' });
  await show(f);
  await screen.findByRole('button', { name: 'Reload pause review' });
  expect(screen.getByTestId('pause-mark')).toHaveProp('accessibilityLabel', 'Unknown');
});

// MVP-22-B1 (G10, G4): an unambiguous wall time has no offset. Polish rows and the intro keep single-letter words with the next word.
test.each([
  ['en', 'Running · Fri, Oct 2, 06:29 · Warsaw', 'Confirm pause'],
  ['pl', 'Bieganie · pt 2 paź 06:29 · Warszawa', 'Potwierdź pauzę'],
] as const)('%s rows show the short time and the zone label without the offset', async (locale, row, confirm) => {
  const f = setup();
  const plain = oath();
  plain.snapshot.deadline = { ...plain.snapshot.deadline, local: '2026-10-02T06:29:20', utc: '2026-10-02T04:29:20Z', receiptCutoff: '2026-10-02T04:44:20Z' };
  jest.mocked(f.controller.detail).mockResolvedValue({ kind: 'success', value: { oath: plain, serverTime } });
  jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  await show(f, locale);
  expect(await screen.findByRole('button', { name: confirm })).toBeOnTheScreen();
  expect(screen.getByText(row)).toBeOnTheScreen();
  expect(screen.queryByText(/UTC/)).toBeNull();
});
test('a Polish row binds a single-letter word in the activity name', async () => {
  const f = setup();
  const walk = oath();
  walk.snapshot.copy.pl.activity = 'Spacer z psem';
  jest.mocked(f.controller.detail).mockResolvedValue({ kind: 'success', value: { oath: walk, serverTime } });
  jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  await show(f, 'pl');
  expect(await screen.findByRole('button', { name: 'Potwierdź pauzę' })).toBeOnTheScreen();
  expect(screen.getByText(/^Spacer z\u00a0psem ·\u00a0/, { normalizer: text => text })).toBeOnTheScreen();
});
// MVP-22-G24b, native check at the largest text: "Running · Fri, Oct 2, 15:32 ·" | "Warsaw" left the dot at a line end.
// The space after each dot is a no-break space, so a wrap moves the dot with the next segment. English keeps "a walk" unbound.
test.each([
  ['en', 'Take a walk', /^Take a walk · [^ ]+ · Warsaw$/, 'Confirm pause'],
  ['pl', 'Spacer w parku', /^Spacer w parku · [^ ]+ · Warszawa$/, 'Potwierdź pauzę'],
] as const)('%s rows keep each separator with the segment after it', async (locale, activity, row, confirm) => {
  const f = setup();
  const walk = oath();
  walk.snapshot.copy[locale].activity = activity;
  jest.mocked(f.controller.detail).mockResolvedValue({ kind: 'success', value: { oath: walk, serverTime } });
  jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  await show(f, locale);
  expect(await screen.findByRole('button', { name: confirm })).toBeOnTheScreen();
  expect(screen.getByText(row, { normalizer: text => text })).toBeOnTheScreen();
});
