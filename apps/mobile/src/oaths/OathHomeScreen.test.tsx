import { Profiler } from 'react';
import { AccessibilityInfo, AppState, Dimensions, StyleSheet } from 'react-native';
import { createServerClock } from './serverClock';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OathHomeScreen } from './OathHomeScreen';
import { tokens } from '../ui/tokens';
import { DETAIL_DROP, LIST_DROP } from '../ui/SceneSurface';
import type { OathController, OathControllerState } from './controller';
import type { Oath } from '../api/oathSchema';
import type { ProofController, ProofControllerError, ProofControllerState } from '../proof/proofController';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('expo-image-picker', () => ({ requestCameraPermissionsAsync: jest.fn(), launchCameraAsync: jest.fn(), launchImageLibraryAsync: jest.fn() }));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: { manipulate: jest.fn() }, SaveFormat: { JPEG: 'jpeg' } }));
const id = '20000000-0000-4000-8000-000000000001';
const serverTime = '2026-10-26T00:00:00Z';
const characterId = '30000000-0000-4000-8000-000000000001';
function oath(patch: Partial<Oath> = {}): Oath {
  const snapshot = JSON.parse(JSON.stringify(catalog)); snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { id, characterId, snapshot, state: 'review_pending', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: 'service_availability_unknown', review: { enteredAt: '2026-10-25T00:45:01Z', closesAt: '2026-10-28T00:45:01Z' }, proof: null, ...patch };
}
function setup(items = [oath()]) {
  let state: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
  const listeners = new Set<() => void>();
  const controller = { clock: createServerClock(), getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, list: jest.fn().mockResolvedValue({ kind: 'success', value: { items, nextCursor: null, total: items.length, serverTime, paused: false, characterId } }), detail: jest.fn().mockResolvedValue({ kind: 'success', value: { oath: items[0], serverTime } }), getPause: jest.fn(), pause: jest.fn(), resetCreation: jest.fn(), recover: jest.fn() } as unknown as OathController;
  return { controller, state, change(next: OathControllerState) { state = next; listeners.forEach(fn => fn()); } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const page = (items: Oath[], nextCursor: string | null = null, paused = false, total = items.length + (nextCursor ? 1 : 0)) => ({ kind: 'success' as const, value: { items, nextCursor, total, serverTime, paused, characterId } });
// Each test starts from Jest's default window (simple layout), so a room-layout test never leaks its size into the next one.
const initialWindow = { window: Dimensions.get('window'), screen: Dimensions.get('screen') };
beforeEach(() => Dimensions.set(initialWindow));
/** Polish P8: in room layout, with every Oath on the seal wall, the full list is folded. Opens it once the list has loaded. */
async function unfold() {
  const fold = await screen.findByRole('button', { name: /^(All your Oaths|Wszystkie Twoje Przysięgi)$/ });
  if (!fold.props.accessibilityState?.expanded) await fireEvent.press(fold);
}
const pauseSummary = (revision = 'a'.repeat(64), paused = false) => ({ paused, revision, withdraw: paused ? [] : [id], preserve: [], serverTime, characterId });
test('Today retains overdue review-pending Oaths and opens their authoritative stored detail', async () => {
  const f = setup(); await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText('Under review')).toBeOnTheScreen();
  expect(screen.queryByText('Missed')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath: Running/ }));
  expect(await screen.findByLabelText('Status: Under review')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Oath rules' }));
  expect(await screen.findByText(oath().snapshot.copy.en.sections.appeal)).toBeOnTheScreen();
});
test('empty Today has loading, failed retry and explicit creation states', async () => {
  const f = setup([]); const response = deferred<Awaited<ReturnType<OathController['list']>>>();
  jest.mocked(f.controller.list).mockReturnValueOnce(response.promise);
  jest.mocked(f.controller.resetCreation).mockReturnValue(true);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(screen.getByText('Loading Oaths…')).toBeOnTheScreen();
  await act(async () => response.resolve({ kind: 'unavailable', retry: 'request' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No current Oaths. Choose a workout when you are ready.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Create an Oath' }));
  expect(f.controller.resetCreation).toHaveBeenCalledTimes(1);
  expect(await screen.findByLabelText('Completion date')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  expect(await screen.findByText('No current Oaths. Choose a workout when you are ready.')).toBeOnTheScreen();
  expect(jest.mocked(f.controller.list).mock.calls[2][0]).toEqual({ view: 'today' });
});
test('history paginates withdrawals and refresh begins with the first page', async () => {
  const first = oath({ state: 'withdrawn', reason: 'character_paused', terminalAt: serverTime, review: null });
  const second = oath({ ...first, id: '20000000-0000-4000-8000-000000000002' });
  const f = setup([]); jest.mocked(f.controller.list).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([first], 'cursor1')).mockResolvedValueOnce(page([second])).mockResolvedValueOnce(page([first]));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('No current Oaths. Choose a workout when you are ready.');
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findAllByTestId('state-seal-withdrawn', { includeHiddenElements: true })).toHaveLength(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Load more' }));
  expect(await screen.findAllByTestId('state-seal-withdrawn', { includeHiddenElements: true })).toHaveLength(2);
  expect(jest.mocked(f.controller.list).mock.calls[2][0]).toEqual({ view: 'history', cursor: 'cursor1' });
  expect(screen.queryByRole('button', { name: 'Refresh' })).toBeNull();
  await act(async () => { await screen.getByTestId('oath-list-scroll').props.refreshControl.props.onRefresh(); });
  expect(jest.mocked(f.controller.list).mock.calls[3][0]).toEqual({ view: 'history' });
  await waitFor(() => expect(screen.getAllByTestId('state-seal-withdrawn', { includeHiddenElements: true })).toHaveLength(1));
});
test('Today preserves server order across future, current and overdue pending commitments in different zones', async () => {
  const scheduled = oath({ state: 'scheduled', activatedAt: null, reason: null, review: null, id: '20000000-0000-4000-8000-000000000002' });
  scheduled.snapshot = { ...scheduled.snapshot, activation: { mode: 'scheduled', time: { local: '2026-10-27T00:00:00', utc: '2026-10-27T00:00:00Z', timezone: 'UTC', offset: '+00:00', explicitOffset: false } }, deadline: { ...scheduled.snapshot.deadline, local: '2026-10-28T14:00:00', timezone: 'Pacific/Auckland', offset: '+13:00', utc: '2026-10-28T01:00:00Z', receiptCutoff: '2026-10-28T01:15:00Z' } };
  const active = oath({ state: 'active', reason: null, review: null, id: '20000000-0000-4000-8000-000000000003' });
  active.snapshot = { ...active.snapshot, deadline: { ...active.snapshot.deadline, local: '2026-10-29T02:30:00', offset: '+01:00', utc: '2026-10-29T01:30:00Z', receiptCutoff: '2026-10-29T01:45:00Z' } };
  const items = [oath(), scheduled, active]; const f = setup(items);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  const buttons = await screen.findAllByRole('button', { name: /Open Oath:/ });
  expect(buttons.map(button => button.props.accessibilityLabel)).toEqual([
    expect.stringContaining('October 25'), expect.stringContaining('Pacific/Auckland'), expect.stringContaining('October 29'),
  ]);
  expect(screen.getByRole('header', { name: 'Awaiting result' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Scheduled' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Active' })).toBeOnTheScreen();
});
test('Today, History and detail render no pause control and no sign-out, which live in Settings', async () => {
  const f = setup(); await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('Under review');
  const absent = () => { for (const name of ['Pause and resume', 'Sign out']) expect(screen.queryByRole('button', { name })).toBeNull(); expect(screen.queryByText('Ⅱ')).toBeNull(); };
  absent();
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  await screen.findByTestId('history-header'); absent();
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath: Running/ }));
  await screen.findByLabelText('Status: Under review'); absent();
  expect(f.controller.getPause).not.toHaveBeenCalled();
});
test('a character pause withdrawal explains that resuming does not restore it', async () => {
  const withdrawn = oath({ state: 'withdrawn', reason: 'character_paused', terminalAt: serverTime, review: null });
  const f = setup([withdrawn]);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Full description' }));
  expect(await screen.findByText('Withdrawn when the pause began, and resuming does not restore it. After resuming you can make a new Oath.')).toBeOnTheScreen();
});
test('unresolved acceptance remains reachable from Today and cannot be reset into a new creation', async () => {
  const f = setup([]); f.change({ kind: 'ready', busy: false, pending: { version: 2, accountId: id, characterId, previewId: id, requestId: id }, preview: null, oath: null, needsReview: false });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByRole('button', { name: 'Check confirmation' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Create an Oath' })).toBeNull();
  // MVP-22-A8c: while an acceptance may have arrived, Today does not claim it is empty.
  expect(screen.queryByText('No current Oaths. Choose a workout when you are ready.')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Check confirmation' }));
  expect(f.controller.resetCreation).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Completion date')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Check confirmation' })); expect(f.controller.recover).toHaveBeenCalledTimes(1);
});
test('session invalidation hides detail content and ignores pending read completion', async () => {
  const f = setup(); const incoming = deferred<Awaited<ReturnType<OathController['detail']>>>(); jest.mocked(f.controller.detail).mockReturnValueOnce(incoming.promise);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath:/ }));
  await act(async () => f.change({ kind: 'idle' }));
  await act(async () => incoming.resolve({ kind: 'success', value: { oath: oath(), serverTime } }));
  expect(screen.queryByLabelText('Status: Under review')).toBeNull(); expect(screen.queryByText(oath().snapshot.copy.en.sections.appeal)).toBeNull();
});
test('Polish history uses localized copy and offers neither pause nor sign-out', async () => {
  const f = setup([]);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText('Brak bieżących Przysiąg. Wybierz trening, gdy zechcesz zacząć.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Historia' }));
  expect(await screen.findByText('Kronika czeka na pierwszy wpis.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Pauza i wznowienie' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Wyloguj się' })).toBeNull();
});
test('late list and detail responses cannot replace the newly selected screen', async () => {
  const f = setup(); const late = deferred<Awaited<ReturnType<OathController['list']>>>();
  jest.mocked(f.controller.list).mockReturnValueOnce(late.promise).mockResolvedValueOnce(page([]));
  // The detail has no tabs (MVP-22-T09c), so the room's request is what leaves it while its answer is late.
  const screenWith = (request: { id: number; target: 'history' } | null) => <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request, onReturn: jest.fn() }} /></LocalizationProvider>;
  const view = await render(screenWith(null));
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findByText('The chronicle is waiting for its first entry.')).toBeOnTheScreen();
  await act(async () => late.resolve(page([oath()])));
  expect(screen.queryByText('Under review')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Today' })); await screen.findByText('Under review');
  const detail = deferred<Awaited<ReturnType<OathController['detail']>>>(); jest.mocked(f.controller.detail).mockReturnValueOnce(detail.promise);
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath:/ }));
  await view.rerender(screenWith({ id: 1, target: 'history' }));
  await act(async () => detail.resolve({ kind: 'success', value: { oath: oath(), serverTime } }));
  expect(screen.queryByLabelText('Status: Under review')).toBeNull(); expect(screen.getByRole('header', { name: 'History' })).toBeOnTheScreen();
});

test('Forge features at most three server-ordered seals while every Oath stays reachable in the full list', async () => {
  Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } });
  const items = [1, 2, 3, 4].map(n => oath({ id: `20000000-0000-4000-8000-${String(n).padStart(12, '0')}` }));
  const f = setup(items);
  jest.mocked(f.controller.detail).mockImplementation(async selectedId => ({ kind: 'success', value: { oath: items.find(item => item.id === selectedId)!, serverTime } }));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  const seals = await screen.findAllByRole('button', { name: /Oath seal:/ });
  expect(seals).toHaveLength(3);
  expect(screen.getAllByRole('button', { name: /Open Oath:/ })).toHaveLength(4);
  await fireEvent.press(seals[1]);
  expect(f.controller.detail).toHaveBeenCalledWith(items[1].id);
  expect(await screen.findByLabelText('Status: Under review')).toBeOnTheScreen();
});


test('large system text retains every Oath action through the ordered list', async () => {
  Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 2 }, screen: { width: 390, height: 844, scale: 3, fontScale: 2 } });
  const f = setup();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByRole('button', { name: /Open Oath:/ })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: /Oath seal:/ })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath:/ }));
  expect(f.controller.detail).toHaveBeenCalledWith(id);
});

test('returning through Today preserves uncommitted workout and deadline choices', async () => {
  const f = setup([]); jest.mocked(f.controller.resetCreation).mockReturnValue(true);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Create an Oath' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Mobility' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'At a future time' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Hour 21' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Minute 45' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Use this time' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Create an Oath' }));
  expect(screen.getByRole('radio', { name: 'Mobility', selected: true })).toBeOnTheScreen();
  expect(screen.getByRole('radio', { name: 'At a future time', selected: true })).toBeOnTheScreen();
  expect(screen.getByText('21:45')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Commit to the Oath' })).toBeNull();
});

test('confirmation arriving after returning to Today clears the committed draft', async () => {
  const f = setup([]);
  jest.mocked(f.controller.resetCreation).mockImplementation(() => { f.change({ ...f.state, kind: 'ready', oath: null }); return true; });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Create an Oath' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Mobility' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Completion time' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Hour 21' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Use this time' }));
  await act(async () => f.change({ kind: 'ready', busy: true, preview: null, oath: null, needsReview: false, pending: { version: 2, accountId: id, characterId, previewId: id, requestId: id } }));
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  expect(await screen.findByRole('button', { name: 'Check confirmation' })).toBeOnTheScreen();
  await act(async () => f.change({ kind: 'ready', busy: false, preview: null, oath: oath({ state: 'active', reason: null, review: null }), needsReview: false, pending: null }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Create an Oath' }));
  expect(screen.getByRole('radio', { name: 'Running', selected: true })).toBeOnTheScreen();
  expect(screen.getByText('Choose a time')).toBeOnTheScreen();
  expect(screen.queryByText('21:00')).toBeNull();
});

test('paused Forge makes the paused state visible without a creation affordance or a pause control', async () => {
  Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } });
  const f = setup([]);
  jest.mocked(f.controller.list).mockResolvedValue(page([], null, true));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText('Pause is on. Oaths awaiting a result continue, withdrawn ones do not return.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Create an Oath' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Pause and resume' })).toBeNull();
});

test('room navigation opens history and keeps full stored time in accessibility', async () => {
  const f = setup();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'history' }, onReturn: jest.fn() }} /></LocalizationProvider>);
  expect(await screen.findByText('Under review · Oct 25, 2026 at 02:30')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /Open Oath:.*Europe\/Warsaw/ })).toBeOnTheScreen();
  expect(f.controller.list).toHaveBeenLastCalledWith({ view: 'history' });
});
// Native check, 2026-09-30: the screen stays mounted under the room, so after the chronicle flight its first frame still showed Today.
test('a room request shows its view from the first commit, never the hidden previous view', async () => {
  const f = setup();
  const history = deferred<Awaited<ReturnType<OathController['list']>>>();
  const hidden = { includeHiddenElements: true };
  const frames: { title: boolean; today: boolean; chronicle: boolean }[] = [];
  const record = () => frames.push({ title: screen.queryAllByText('Your Oaths', hidden).length > 0, today: screen.queryAllByText('Under review', hidden).length > 0, chronicle: !!screen.queryByTestId('forge-place-chronicle', hidden) });
  let recording = false;
  const screenWith = (request: { id: number; target: 'history' } | null) => <Profiler id="home" onRender={() => { if (recording) record(); }}>
    <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request, onReturn: jest.fn() }} /></LocalizationProvider>
  </Profiler>;
  const view = await render(screenWith(null));
  expect((await screen.findAllByText('Under review')).length).toBeGreaterThan(0);
  jest.mocked(f.controller.list).mockReturnValueOnce(history.promise);
  recording = true;
  await view.rerender(screenWith({ id: 1, target: 'history' }));
  recording = false;
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.filter(frame => frame.title || frame.today || !frame.chronicle)).toEqual([]);
  await act(async () => history.resolve(page([oath()])));
  expect(f.controller.list).toHaveBeenLastCalledWith({ view: 'history' });
});

// Native check, 2026-09-30: after the hearth flight the hidden detail showed for two frames before creation opened.
test('a hearth request shows only the hearth while Today loads, never the hidden previous screen', async () => {
  const f = setup();
  const today = deferred<Awaited<ReturnType<OathController['list']>>>();
  const hidden = { includeHiddenElements: true };
  const frames: { detail: boolean; list: boolean; hearth: boolean }[] = [];
  let recording = false;
  const record = () => frames.push({ detail: !!screen.queryByTestId('detail-status', hidden), list: screen.queryAllByText('Your Oaths', hidden).length > 0, hearth: !!screen.queryByTestId('forge-place-hearth', hidden) });
  const screenWith = (request: { id: number; target: 'create' } | null) => <Profiler id="home" onRender={() => { if (recording) record(); }}>
    <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request, onReturn: jest.fn() }} /></LocalizationProvider>
  </Profiler>;
  const view = await render(screenWith(null));
  await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath: Running/ }))[0]);
  expect(await screen.findByTestId('detail-status')).toBeOnTheScreen();
  const closeUp = screen.getByTestId('forge-closeup-image', hidden);
  jest.mocked(f.controller.list).mockReturnValueOnce(today.promise);
  recording = true;
  await view.rerender(screenWith({ id: 1, target: 'create' }));
  recording = false;
  expect(frames.length).toBeGreaterThan(0);
  expect(frames.filter(frame => frame.detail || frame.list || !frame.hearth)).toEqual([]);
  // The mounted surface keeps its decoded close-ups (a new one showed two dark frames) and frames the hearth like creation.
  expect(screen.getByTestId('forge-closeup-image', hidden)).toBe(closeUp);
  expect(StyleSheet.flatten(closeUp.props.style)).toMatchObject({ top: 0 });
  // A slow answer still says what is happening and keeps the way back to the room. A fast one shows no text (native check).
  expect(screen.queryByText('Loading Oaths…')).toBeNull();
  expect(await screen.findByText('Loading Oaths…', {}, { timeout: 1500 })).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: /Return to the Forge|Back to menu/ }).length).toBeGreaterThan(0);
  jest.mocked(f.controller.resetCreation).mockReturnValue(true);
  await act(async () => today.resolve(page([oath()])));
  expect(await screen.findByLabelText('Completion date')).toBeOnTheScreen();
});

test('room return preserves pending acceptance without resetting it', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup([]); const onReturn = jest.fn();
  f.change({ kind: 'ready', busy: false, pending: { version: 2, accountId: id, characterId, previewId: id, requestId: id }, preview: null, oath: null, needsReview: false });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'create' }, onReturn }} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Return to the Forge' }));
  expect(onReturn).toHaveBeenCalledTimes(1);
  expect(f.controller.resetCreation).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Check confirmation' })).toBeOnTheScreen();
});

test('hearth navigation on a paused account shows the pause notice instead of new creation', async () => {
  const f = setup([]); jest.mocked(f.controller.list).mockResolvedValue(page([], null, true));
  jest.mocked(f.controller.resetCreation).mockReturnValue(true);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'create' }, onReturn: jest.fn() }} /></LocalizationProvider>);
  expect(await screen.findByText('Pause is on. Oaths awaiting a result continue, withdrawn ones do not return.')).toBeOnTheScreen();
  expect(f.controller.resetCreation).not.toHaveBeenCalled();
  expect(screen.queryByLabelText('Completion date')).toBeNull();
});

test('each Oath carries a state seal beside its short label in the list and in detail', async () => {
  const f = setup([oath(), oath({ id: '20000000-0000-4000-8000-000000000002', state: 'active', reason: null, review: null })]);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await screen.findAllByText('Under review');
  expect(screen.getAllByTestId('state-seal-review_pending', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  expect(screen.getAllByTestId('state-seal-active', { includeHiddenElements: true }).length).toBeGreaterThan(0);
  expect(screen.queryByTestId('state-seal-review_pending')).toBeNull();
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  expect(await screen.findByLabelText('Status: Under review')).toBeOnTheScreen();
  expect(screen.getByTestId('state-seal-review_pending', { includeHiddenElements: true })).toBeTruthy();
});

test('each functional screen stands in its own Forge place', async () => {
  const f = setup(); jest.mocked(f.controller.resetCreation).mockReturnValue(true);
  const place = (name: string) => screen.queryByTestId(`forge-place-${name}`, { includeHiddenElements: true });
  // The detail has no tabs (MVP-22-T09c), so the room's request brings Today back.
  const screenWith = (request: { id: number; target: 'today' } | null) => <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request, onReturn: jest.fn() }} /></LocalizationProvider>;
  const view = await render(screenWith(null));
  await screen.findAllByText('Under review');
  expect(place('seals')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  await screen.findByTestId('history-header');
  expect(place('chronicle')).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  await screen.findByLabelText('Status: Under review');
  expect(place('seals')).toBeTruthy();
  await view.rerender(screenWith({ id: 1, target: 'today' }));
  await screen.findAllByText('Under review');
  await fireEvent.press(screen.getAllByRole('button', { name: 'Create an Oath' })[0]);
  expect(await screen.findByLabelText('Completion date')).toBeOnTheScreen();
  expect(place('hearth')).toBeTruthy();
});

test('hearth navigation during a busy operation explains that creation must wait', async () => {
  const f = setup([]);
  f.change({ kind: 'ready', busy: true, pending: null, preview: null, oath: null, needsReview: false });
  jest.mocked(f.controller.resetCreation).mockReturnValue(false);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'create' }, onReturn: jest.fn() }} /></LocalizationProvider>);
  expect(await screen.findByText('The Forge is still finishing your last step. Return to the hearth in a moment.')).toBeOnTheScreen();
  expect(screen.queryByLabelText('Completion date')).toBeNull();
});

// MVP-22-B2 (G16): while the hearth request waits, its way back stood on the hearth art at the top of the room layout.
test('the waiting hearth keeps its way back on a solid band', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup(); const never = deferred<Awaited<ReturnType<OathController['list']>>>();
  jest.mocked(f.controller.list).mockResolvedValueOnce(page([oath()])).mockReturnValueOnce(never.promise);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'create' }, onReturn: jest.fn() }} /></LocalizationProvider>);
  const header = within(await screen.findByTestId('hearth-waiting')).getByTestId('screen-header');
  expect(StyleSheet.flatten(header.props.style)).toMatchObject({ backgroundColor: tokens.color.canvas, zIndex: 1 });
  expect(within(header).getByTestId('header-fade', { includeHiddenElements: true })).toBeTruthy();
  expect(within(header).getByRole('button', { name: 'Return to the Forge' })).toBeOnTheScreen();
});

test('a newer room request replaces an unfinished hearth request and its place', async () => {
  const f = setup(); const first = deferred<Awaited<ReturnType<OathController['list']>>>();
  // The mount loads Today first, then the hearth request waits on its own Today load.
  jest.mocked(f.controller.list).mockResolvedValueOnce(page([oath()])).mockReturnValueOnce(first.promise);
  const view = await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'create' }, onReturn: jest.fn() }} /></LocalizationProvider>);
  await view.rerender(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 2, target: 'history' }, onReturn: jest.fn() }} /></LocalizationProvider>);
  await act(async () => first.resolve(page([oath()])));
  await screen.findByTestId('history-header');
  expect(screen.getByTestId('forge-place-chronicle', { includeHiddenElements: true })).toBeTruthy();
});

const phone = (fontScale: number) => ({ width: 390, height: 844, scale: 3, fontScale });
test('in room layout the header door returns to the Forge', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup(); const onReturn = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn }} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Return to the Forge' }));
  expect(onReturn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull();
  expect(screen.queryByRole('button', { name: /Change character/ })).toBeNull();
});
test('in simple layout the header and creation return to the menu instead of the room', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const f = setup(); const onReturn = jest.fn();
  jest.mocked(f.controller.resetCreation).mockReturnValue(true);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn }} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Wróć do menu' }));
  expect(onReturn).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: 'Wróć do Kuźni' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Złóż Przysięgę' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Wróć do menu' }));
  expect(onReturn).toHaveBeenCalledTimes(2);
});
test.each([[1, 'Return to the Forge', 1], [2, 'Back to menu', 0]] as const)('at font scale %s the creation back control reads "%s" with %s door pictures', async (fontScale, label, doors) => {
  // Native MVP-18 check: the simple layout creation screen still showed the room door picture beside "Back to menu".
  Dimensions.set({ window: phone(fontScale), screen: phone(fontScale) });
  const f = setup(); const onReturn = jest.fn();
  jest.mocked(f.controller.resetCreation).mockReturnValue(true);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: { id: 1, target: 'create' }, onReturn }} /></LocalizationProvider>);
  expect(await screen.findByLabelText('Completion date')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: label })).toBeOnTheScreen();
  expect(screen.queryAllByTestId('scene-door-picture', { includeHiddenElements: true })).toHaveLength(doors);
});
test('without Forge navigation the header offers no way back', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await unfold();
  await screen.findByRole('button', { name: /Open Oath: Running/ });
  expect(screen.queryByRole('button', { name: 'Return to the Forge' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull();
});
test('a new reload value reloads the visible list and leaves an open detail alone', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup();
  const view = (reload: number) => <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" reload={reload} /></LocalizationProvider>;
  const rendered = await render(view(0));
  await unfold();
  await screen.findByRole('button', { name: /Open Oath: Running/ });
  expect(f.controller.list).toHaveBeenCalledTimes(1);
  await rendered.rerender(view(1));
  await act(async () => {});
  expect(f.controller.list).toHaveBeenCalledTimes(2);
  expect(jest.mocked(f.controller.list).mock.calls[1][0]).toEqual({ view: 'today' });
  await unfold();
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await screen.findByLabelText('Status: Under review');
  await rendered.rerender(view(2));
  await act(async () => {});
  expect(f.controller.list).toHaveBeenCalledTimes(2);
  expect(screen.getByLabelText('Status: Under review')).toBeOnTheScreen();
});

test('the serif screen title, the tab labels and the detail state label are capped for the largest text, body copy is not', async () => {
  const f = setup();
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  const title = await screen.findByRole('header', { name: 'Twoje Przysięgi' });
  expect(title.props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
  for (const tab of ['Dzisiaj', 'Historia']) expect(screen.getByText(tab).props.maxFontSizeMultiplier).toBeLessThanOrEqual(2);
  await fireEvent.press(screen.getByRole('button', { name: /Otwórz Przysięgę/ }));
  expect((await screen.findAllByText('Pod rozwagą')).some(text => (text.props.maxFontSizeMultiplier ?? 99) <= 2)).toBe(true);
});

test('Today rows count down by state with a short deadline, the zone stays in the group header', async () => {
  const scheduled = oath({ state: 'scheduled', activatedAt: null, reason: null, review: null, id: '20000000-0000-4000-8000-000000000002' });
  scheduled.snapshot = { ...scheduled.snapshot, activation: { mode: 'scheduled', time: { local: '2026-10-27T00:00:00', utc: '2026-10-27T00:00:00Z', timezone: 'UTC', offset: '+00:00', explicitOffset: false } } };
  const active = oath({ state: 'active', reason: null, review: null, id: '20000000-0000-4000-8000-000000000003' });
  active.snapshot = { ...active.snapshot, deadline: { ...active.snapshot.deadline, local: '2026-10-29T02:30:00', offset: '+01:00', utc: '2026-10-29T01:30:00Z', receiptCutoff: '2026-10-29T01:45:00Z' } };
  const proof = oath({ state: 'proof_pending', reason: null, review: null, id: '20000000-0000-4000-8000-000000000004' });
  const f = setup([oath(), scheduled, active, proof]);
  // A second before midnight, so milliseconds spent rendering never drop a whole unit.
  f.controller.clock.observe('2026-10-25T23:59:59Z');
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  const rows = await screen.findAllByRole('button', { name: /Open Oath:/ });
  const chip = (row: number) => within(rows[row]).queryByTestId('countdown-chip')?.props.accessibilityLabel ?? null;
  expect([chip(0), chip(1), chip(2), chip(3)]).toEqual(['Ends in 2 days', 'Starts in 1 day', 'Until the deadline 3 days 1 hour', null]);
  expect(within(rows[2]).getByText('Thu 02:30')).toBeOnTheScreen();
  expect(within(rows[2]).queryByText(/Europe\/Warsaw/)).toBeNull();
  // The group header names the zone like the detail, never the IANA id (MVP-22-T12c, P7).
  expect(screen.getAllByRole('header', { name: /· Warsaw$/ }).length).toBeGreaterThan(0);
  expect(screen.queryAllByRole('header', { name: /Europe\/Warsaw/ })).toHaveLength(0);
});

test('each Today state section labels its own date and zone, even on the same day', async () => {
  const scheduled = oath({ state: 'scheduled', activatedAt: null, reason: null, review: null, id: '20000000-0000-4000-8000-000000000002' });
  const active = oath({ state: 'active', reason: null, review: null, id: '20000000-0000-4000-8000-000000000003' });
  const f = setup([scheduled, active]);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findAllByRole('button', { name: /Open Oath:/ });
  expect(screen.getAllByRole('header', { name: 'October 25, 2026 · Warsaw' })).toHaveLength(2);
});

test('a countdown reaching zero on Today shows time is up and asks the server once, the state stays', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-25T00:29:30Z'));
  try {
    const active = oath({ state: 'active', reason: null, review: null });
    Dimensions.set({ window: phone(1), screen: phone(1) });
    const f = setup([active]);
    f.controller.clock.observe('2026-10-25T00:29:30Z');
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
    await unfold();
    expect((await screen.findAllByText('< 1 min')).length).toBe(2);
    const calls = jest.mocked(f.controller.list).mock.calls.length;
    await act(async () => { jest.advanceTimersByTime(31000); });
    expect(screen.getAllByText('Time is up')).toHaveLength(2);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(jest.mocked(f.controller.list).mock.calls.length).toBe(calls + 1);
    await act(async () => { jest.advanceTimersByTime(180000); });
    expect(jest.mocked(f.controller.list).mock.calls.length).toBe(calls + 1);
  } finally { jest.useRealTimers(); }
});

test('the featured Forge seals carry the same countdown', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup([oath()]); f.controller.clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  const seals = await screen.findAllByTestId('forge-seal');
  expect(within(seals[0]).getByTestId('countdown-chip')).toHaveProp('accessibilityLabel', 'Ends in 2 days');
});

test('History opens with the chronicle total from the server and short rows', async () => {
  const fulfilled = oath({ state: 'fulfilled', reason: null, review: null, terminalAt: '2026-10-25T21:30:00Z' });
  const f = setup([]); jest.mocked(f.controller.list).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([fulfilled], 'cursor1', false, 22));
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Historia' }));
  const header = await screen.findByTestId('history-header');
  expect(within(header).getByText('22')).toBeOnTheScreen();
  expect(within(header).getByText('Każdy wpis to Twoja historia w Kuźni.')).toBeOnTheScreen();
  const row = screen.getByRole('button', { name: /Otwórz Przysięgę/ });
  expect(within(row).getByTestId('state-seal-fulfilled', { includeHiddenElements: true })).toBeTruthy();
  // The short state label stands before the date (clarity.md decision 10).
  expect(within(row).getByText('Spełniona · 25 paź 2026, 22:30')).toBeOnTheScreen();
  expect(row.props.accessibilityValue).toEqual({ text: 'Spełniona' });
});

test('an empty chronicle says it waits for its first entry, once', async () => {
  const f = setup([]); jest.mocked(f.controller.list).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([]));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'History' }));
  expect(await screen.findByText('The chronicle is waiting for its first entry.')).toBeOnTheScreen();
  expect(within(screen.getByTestId('history-header')).getByText('0')).toBeOnTheScreen();
  expect(screen.queryByText('No completed or withdrawn Oaths yet.')).toBeNull();
});

test('an active Oath detail shows its countdown, the rule cards and folded full rules', async () => {
  const active = oath({ state: 'active', reason: null, review: null });
  const f = setup([active]); f.controller.clock.observe('2026-10-24T00:29:59Z');
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath:/ }))[0]);
  await screen.findByLabelText('Status: Active');
  expect(screen.getAllByTestId('countdown-chip').map(chip => chip.props.accessibilityLabel)).toEqual(['Until the deadline 1 day']);
  // The promise, the cards and the stored rules open together from one link, with no third level.
  expect(screen.queryByTestId(/^rule-card-/)).toBeNull();
  expect(screen.queryByText(active.snapshot.copy.en.sections.appeal)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Oath rules' }));
  expect(screen.getAllByTestId(/^rule-card-/)).toHaveLength(9);
  expect(screen.getByText(active.snapshot.copy.en.sections.appeal)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Full rules' })).toBeNull();
});

test('a closed Oath detail shows when it closed instead of a countdown', async () => {
  const done = oath({ state: 'fulfilled', reason: null, review: null, terminalAt: '2026-10-25T21:30:00Z' });
  const f = setup([done]); f.controller.clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press((await screen.findAllByRole('button', { name: /Otwórz Przysięgę/ }))[0]);
  await screen.findByLabelText('Status: Spełniona');
  expect(screen.queryByTestId('countdown-chip')).toBeNull();
  expect(screen.getByText('Przysięga spełniona niedz 25 paź 22:30. Wpis zostaje w kronice.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Pełny opis' }));
  expect(screen.getByText('Zamknięta 25 paź 2026, 22:30')).toBeOnTheScreen();
});

test('a detail countdown reaching zero asks the server once, only its answer changes the state', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-25T00:29:30Z'));
  try {
    const active = oath({ state: 'active', reason: null, review: null });
    const f = setup([active]); f.controller.clock.observe('2026-10-25T00:29:30Z');
    jest.mocked(f.controller.detail).mockResolvedValueOnce({ kind: 'success', value: { oath: active, serverTime } }).mockResolvedValueOnce({ kind: 'success', value: { oath: { ...active, state: 'review_pending', reason: 'service_availability_unknown', review: { enteredAt: '2026-10-25T00:45:01Z', closesAt: '2026-10-28T00:45:01Z' } }, serverTime } });
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath:/ }))[0]);
    expect(await screen.findByLabelText('Status: Active')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(31000); });
    expect(f.controller.detail).toHaveBeenCalledTimes(2);
    expect(await screen.findByLabelText('Status: Under review')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(180000); });
    expect(f.controller.detail).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});

test('a review detail keeps its state, countdown, closing time in the Oath zone and reason in one status panel', async () => {
  const f = setup(); f.controller.clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath:/ }))[0]);
  const panel = await screen.findByTestId('detail-status');
  expect(within(panel).getByLabelText('Status: Under review')).toBeOnTheScreen();
  expect(within(panel).getByTestId('countdown-chip')).toBeOnTheScreen();
  expect(within(panel).getByText('This is not a miss. Under review until Wed, Oct 28, 01:45.')).toBeOnTheScreen();
  expect(within(panel).queryByText(/The service may have been unavailable then/)).toBeNull();
  await fireEvent.press(within(panel).getByRole('button', { name: 'Full description' }));
  expect(within(panel).getByText('Review closes Oct 28, 2026 at 01:45')).toBeOnTheScreen();
  expect(within(panel).getByText(/The service may have been unavailable then/)).toBeOnTheScreen();
  expect(screen.queryByText(/GMT/)).toBeNull();
  expect(screen.getAllByRole('header', { name: oath().snapshot.copy.en.title })).toHaveLength(1);
});

test('the Polish review closing time uses the same short date as a closed Oath', async () => {
  const f = setup(); f.controller.clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press((await screen.findAllByRole('button', { name: /Otwórz Przysięgę/ }))[0]);
  await fireEvent.press(await screen.findByRole('button', { name: 'Pełny opis' }));
  expect(screen.getByText('Pod rozwagą do 28 paź 2026, 01:45')).toBeOnTheScreen();
});

test('the list refreshes quietly when the app returns to the foreground, a detail stays as it is', async () => {
  const listeners: ((state: string) => void)[] = [];
  // The preset's AppState.addEventListener is already a jest.fn, so mockRestore would leave it returning undefined for later tests.
  const original = jest.mocked(AppState.addEventListener).getMockImplementation();
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (state: string) => void) => { listeners.push(listener); return { remove: jest.fn() }; }) as never);
  try {
    const f = setup();
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await screen.findAllByText('Under review');
    const late = deferred<Awaited<ReturnType<OathController['list']>>>(); jest.mocked(f.controller.list).mockReturnValueOnce(late.promise);
    await act(async () => { listeners.forEach(listener => listener('active')); });
    expect(f.controller.list).toHaveBeenCalledTimes(2);
    expect(screen.getAllByRole('button', { name: /Open Oath: Running/ }).length).toBeGreaterThan(0);
    expect(screen.queryByText('Loading Oaths…')).toBeNull();
    await act(async () => late.resolve(page([oath()])));
    await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
    await screen.findByTestId('detail-status');
    await act(async () => { listeners.forEach(listener => listener('active')); });
    expect(f.controller.list).toHaveBeenCalledTimes(2);
  } finally { subscription.mockImplementation(original); }
});

test('the list refreshes quietly when the network comes back, a detail stays as it is', async () => {
  const listeners: (() => void)[] = [];
  const stop = jest.fn();
  const network = { onReconnect: (listener: () => void) => { listeners.push(listener); return stop; } };
  const f = setup();
  const view = await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" network={network} /></LocalizationProvider>);
  await screen.findAllByText('Under review');
  await act(async () => { listeners.forEach(listener => listener()); });
  expect(f.controller.list).toHaveBeenCalledTimes(2);
  expect(screen.queryByText('Loading Oaths…')).toBeNull();
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  await screen.findByTestId('detail-status');
  await act(async () => { listeners.forEach(listener => listener()); });
  expect(f.controller.list).toHaveBeenCalledTimes(2);
  await view.unmount();
  expect(stop).toHaveBeenCalledTimes(1);
});

function proofController() {
  let state: ProofControllerState = { kind: 'ready', busy: false, pending: null, oath: null };
  const listeners = new Set<() => void>();
  const controller = { getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, submit: jest.fn(), recover: jest.fn(), discard: jest.fn(), dismissRefusal: jest.fn() } as unknown as ProofController;
  return { controller, change(next: ProofControllerState) { state = next; listeners.forEach(fn => fn()); } };
}
test('an active detail opens the proof screen, and the server receipt returns to the detail in assessment', async () => {
  const active = oath({ state: 'active', reason: null, review: null });
  const f = setup([active]); const proof = proofController();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Submit proof' }));
  expect(await screen.findByRole('radio', { name: /Context photo/ })).toBeOnTheScreen();
  expect(screen.getByText(active.snapshot.copy.en.declaration)).toBeOnTheScreen();
  const received = oath({ state: 'proof_pending', reason: null, review: null, proof: { submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo', revision: 1, receivedAt: '2026-10-24T18:14:00Z', assessment: 'queued' } });
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: null, oath: received }));
  expect(await screen.findByLabelText('Status: Assessment pending')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Submit proof' })).toBeNull();
});
test('back from the proof screen reloads the same detail', async () => {
  const active = oath({ state: 'active', reason: null, review: null });
  const f = setup([active]); const proof = proofController();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Submit proof' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Back to the Oath' }));
  expect(await screen.findByLabelText('Status: Active')).toBeOnTheScreen();
  expect(f.controller.detail).toHaveBeenCalledTimes(2);
});
test.each([
  ['scheduled', { state: 'scheduled', activatedAt: null, reason: null, review: null }],
  ['proof_pending', { state: 'proof_pending', reason: null, review: null, proof: { submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo', revision: 1, receivedAt: '2026-10-24T18:14:00Z', assessment: 'queued' } }],
  ['review_pending', {}],
  ['fulfilled', { state: 'fulfilled', reason: null, review: null, terminalAt: serverTime }],
  ['withdrawn', { state: 'withdrawn', reason: 'character_paused', review: null, terminalAt: serverTime }],
] as const)('a %s detail offers no send action', async (_, patch) => {
  const f = setup([oath(patch as Partial<Oath>)]); const proof = proofController();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await screen.findByLabelText(/^Status: /);
  expect(screen.queryByRole('button', { name: 'Submit proof' })).toBeNull();
});

const receipt = { submissionId: '40000000-0000-4000-8000-000000000001', mode: 'photo' as const, revision: 1, receivedAt: '2026-09-24T18:14:00Z', assessment: 'queued' as const };
test.each([
  ['en', 'Proof received. The result will appear here.', 'Full description', 'Proof received, assessment in progress. The receipt time stays recorded even if the assessment takes longer.', 'Receipt time: Sep 24, 2026 at 20:14 · Warsaw'],
  ['pl', 'Dowód odebrany. Wynik pojawi się tutaj.', 'Pełny opis', 'Dowód odebrany, ocena trwa. Czas odebrania zostaje zapisany, nawet gdy ocena się przeciąga.', 'Czas odebrania: 24 wrz 2026, 20:14 · Warszawa'],
] as const)('a %s proof_pending detail keeps the receipt explanation and time in the Oath zone behind the full description', async (locale, next, more, pending, line) => {
  const f = setup([oath({ state: 'proof_pending', reason: null, review: null, proof: receipt })]);
  await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /^(Open Oath|Otwórz Przysięgę): / }));
  expect(await screen.findByText(next)).toBeOnTheScreen();
  expect(screen.queryByText(pending)).toBeNull();
  expect(screen.queryByText(line)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: more }));
  expect(screen.getByText(pending)).toBeOnTheScreen();
  expect(screen.getByText(line)).toBeOnTheScreen();
});

const interrupted = 'The proof upload was interrupted. A copy is waiting on this device. The server has not confirmed receipt yet.';
// A Today row says it in one line. The long explanation sits behind the detail's full description (MVP-22-T10).
const rowLine = 'Proof not received. The copy is here, ready to send again.';
const record = (oathId = id) => ({ version: 1 as const, accountId: '10000000-0000-4000-8000-000000000001', characterId, oathId, submissionId: receipt.submissionId, mode: 'photo' as const, fileName: `${receipt.submissionId}.jpg` });
test('Today keeps cards of one heading close, and spaces a new heading or a card under an upload line', async () => {
  const pending = (n: number) => oath({ id: `20000000-0000-4000-8000-00000000001${n}`, state: 'proof_pending', reason: null, review: null, proof: { ...receipt, submissionId: `40000000-0000-4000-8000-00000000001${n}` } });
  const active = (n: number) => oath({ id: `20000000-0000-4000-8000-00000000002${n}`, state: 'active', reason: null, review: null });
  const items = [pending(1), pending(2), active(1), active(2)];
  const f = setup(items); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(items[2].id), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText(rowLine);
  const entry = (item: Oath) => screen.getByTestId(`oath-entry-${item.id}`);
  // Only the Oath with a waiting copy carries an upload line. The other rows render none.
  expect(screen.getAllByTestId('upload-interrupted')).toHaveLength(1);
  expect(within(entry(items[2])).getByTestId('upload-interrupted')).toBeOnTheScreen();
  expect(StyleSheet.flatten(entry(items[0]).props.style).marginTop).toBeUndefined();
  expect(entry(items[1])).toHaveStyle({ marginTop: tokens.space.item });
  expect(entry(items[2])).toHaveStyle({ marginTop: tokens.space.section });
  expect(entry(items[3])).toHaveStyle({ marginTop: tokens.space.section });
});
test('Today without a waiting copy renders no upload line and keeps same-heading cards close', async () => {
  const items = [1, 2].map(n => oath({ id: `20000000-0000-4000-8000-00000000003${n}`, state: 'active', reason: null, review: null }));
  const f = setup(items);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proofController().controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findAllByRole('button', { name: /Open Oath: Running/ })).toHaveLength(2);
  expect(screen.queryByTestId('upload-interrupted')).toBeNull();
  expect(screen.getByTestId(`oath-entry-${items[1].id}`)).toHaveStyle({ marginTop: tokens.space.item });
});
test('a pending local record shows the interrupted upload on its Today row, and a resend receipt updates the row', async () => {
  const active = oath({ state: 'active', reason: null, review: null });
  const f = setup([active]); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText(rowLine)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Delete the copy on this device' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Send again' }));
  expect(proof.controller.recover).toHaveBeenCalledTimes(1);
  await act(async () => proof.change({ kind: 'ready', busy: true, pending: record(), oath: null }));
  expect(screen.getByText('Proof on its way. The Oath changes only when the server answers.')).toBeOnTheScreen();
  const row = () => screen.getByRole('button', { name: /Open Oath: Running/ });
  expect(row().props.accessibilityValue).toEqual({ text: 'Active' });
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: null, oath: oath({ state: 'proof_pending', reason: null, review: null, proof: receipt }) }));
  await waitFor(() => expect(row().props.accessibilityValue).toEqual({ text: 'Assessment pending' }));
  expect(screen.queryByText(rowLine)).toBeNull();
});
test('a pending local record shows the interrupted upload on its detail, and only the server receipt shows assessment', async () => {
  const f = setup([oath({ state: 'active', reason: null, review: null })]); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  expect(await screen.findByText('Proof not received. The copy is here, ready to send again.')).toBeOnTheScreen();
  expect(screen.queryByText(interrupted)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Full description' }));
  expect(screen.getByText(interrupted)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Submit proof' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Delete the copy on this device' })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Send again' }));
  expect(proof.controller.recover).toHaveBeenCalledTimes(1);
  // While the upload runs nothing claims a receipt.
  await act(async () => proof.change({ kind: 'ready', busy: true, pending: record(), oath: null }));
  expect(screen.getByText('Proof on its way. The Oath changes only when the server answers.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Send again' })).toBeNull();
  expect(screen.getByLabelText('Status: Active')).toBeOnTheScreen();
  expect(screen.queryByText(/^Evidence received/)).toBeNull();
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: null, oath: oath({ state: 'proof_pending', reason: null, review: null, proof: receipt }) }));
  expect(await screen.findByLabelText('Status: Assessment pending')).toBeOnTheScreen();
  expect(screen.getByText('Proof received. The result will appear here.')).toBeOnTheScreen();
  expect(screen.queryByText(interrupted)).toBeNull();
});
test('a lost reply leaves a received Oath with its record, which is replayed once quietly and never shown as interrupted', async () => {
  const f = setup([oath({ state: 'proof_pending', reason: null, review: null, proof: receipt })]); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  const interruptedPl = 'Wysyłanie dowodu zostało przerwane. Kopia czeka na tym urządzeniu. Serwer jeszcze nie potwierdził odbioru.';
  await screen.findByRole('button', { name: /Otwórz Przysięgę/ });
  // The server already holds this submissionId, so a replay only returns the original receipt and clears the record.
  await waitFor(() => expect(proof.controller.recover).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(interruptedPl)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Otwórz Przysięgę/ }));
  expect(await screen.findByText('Dowód odebrany. Wynik pojawi się tutaj.')).toBeOnTheScreen();
  // The interrupted explanation would sit behind "Pełny opis", so the check opens it first.
  await fireEvent.press(screen.getByRole('button', { name: 'Pełny opis' }));
  expect(screen.getByText(/20:14/)).toBeOnTheScreen();
  expect(screen.queryByText(interruptedPl)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Usuń kopię z tego urządzenia' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Wyślij ponownie' })).toBeNull();
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: record(), oath: null, error: { kind: 'unavailable', retry: 'request' } }));
  expect(proof.controller.recover).toHaveBeenCalledTimes(1);
});
test('a record for another Oath shows nothing on this detail and keeps its send action', async () => {
  const f = setup([oath({ state: 'active', reason: null, review: null })]); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record('20000000-0000-4000-8000-000000000009'), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  expect(await screen.findByRole('button', { name: 'Submit proof' })).toBeOnTheScreen();
  expect(screen.queryByText(interrupted)).toBeNull();
});
test.each([
  ['oath_not_active', { kind: 'proof_refused', code: 'oath_not_active', state: 'review_pending' }, 'This Oath is no longer waiting for proof. Check its current status.'],
  ['receipt_cutoff_passed', { kind: 'proof_refused', code: 'receipt_cutoff_passed' }, 'The time for proof has passed and the server did not accept it. Go back to the Oath to see its state.'],
] as const)('resuming a stale record refused with %s shows the server reason once the record is cleared', async (_, error, reason) => {
  const f = setup([activeThursday()]); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Send again' }));
  const { code, state } = error as { code: 'oath_not_active' | 'receipt_cutoff_passed'; state?: 'review_pending' };
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: null, oath: null, error, lastRefusal: { oathId: id, submissionId: receipt.submissionId, code, ...(state ? { state } : {}) } }));
  expect(await screen.findByText(reason)).toBeOnTheScreen();
  expect(screen.queryByText(interrupted)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Send again' })).toBeNull();
  // The detail asks the server again, so the shown state is its own.
  await waitFor(() => expect(f.controller.detail).toHaveBeenCalledTimes(2));
});

test('an automatic resend refused for good shows its reason on the Today row and the detail until the player dismisses it', async () => {
  const f = setup([oath()]); const proof = proofController();
  const cutoff = 'The time for proof has passed and the server did not accept it. Go back to the Oath to see its state.';
  // resumeOnLoad sent the record before this screen existed. Only the controller's lastRefusal remembers the Oath.
  proof.change({ kind: 'ready', busy: false, pending: null, oath: null, error: { kind: 'proof_refused', code: 'receipt_cutoff_passed' }, lastRefusal: { oathId: id, submissionId: receipt.submissionId, code: 'receipt_cutoff_passed' } });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText(cutoff)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath: Running/ }));
  expect(await screen.findByText(cutoff)).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Send again' })).toBeNull();
  expect(within(screen.getByRole('button', { name: 'Got it' })).queryByText('◆')).toBeNull();
  expect(filled().length).toBeLessThanOrEqual(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Got it' }));
  expect(proof.controller.dismissRefusal).toHaveBeenCalledTimes(1);
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: null, oath: null, error: { kind: 'proof_refused', code: 'receipt_cutoff_passed' } }));
  expect(screen.queryByText(cutoff)).toBeNull();
});
test('deleting the waiting copy from the detail reads as deleting, never as sending', async () => {
  const f = setup([oath({ state: 'active', reason: null, review: null })]); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Otwórz Przysięgę/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Usuń kopię z tego urządzenia' }));
  await act(async () => proof.change({ kind: 'ready', busy: true, pending: record(), oath: null, deleting: true }));
  expect(screen.getAllByText('Usuwanie kopii dowodu…').length).toBeGreaterThan(0);
  expect(screen.queryByText(/^Wysyłanie dowodu\./)).toBeNull();
});
test('a refusal already known when Today opens does not hold the list in loading', async () => {
  const f = setup([oath()]); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: null, oath: null, lastRefusal: { oathId: id, submissionId: receipt.submissionId, code: 'receipt_cutoff_passed' } });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText('The time for proof has passed and the server did not accept it. Go back to the Oath to see its state.')).toBeOnTheScreen();
  expect(screen.queryByText('Loading Oaths…')).toBeNull();
  expect(f.controller.list).toHaveBeenCalledTimes(1);
});
test('a refusal for one Oath stays off another Oath row and detail', async () => {
  const other = oath({ state: 'active', reason: null, review: null, id: '20000000-0000-4000-8000-000000000002' });
  other.snapshot = { ...other.snapshot, activity: 'mobility', copy: { ...other.snapshot.copy, en: { ...other.snapshot.copy.en, activity: 'Mobility' }, pl: { ...other.snapshot.copy.pl, activity: 'Mobilność' } } };
  const f = setup([other]);
  const proof = proofController(); const cutoff = 'The time for proof has passed and the server did not accept it. Go back to the Oath to see its state.';
  proof.change({ kind: 'ready', busy: false, pending: null, oath: null, lastRefusal: { oathId: id, submissionId: receipt.submissionId, code: 'receipt_cutoff_passed' } });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
  const otherRow = await screen.findByRole('button', { name: /Open Oath: Mobility/ });
  expect(screen.queryByText(cutoff)).toBeNull();
  await fireEvent.press(otherRow);
  await screen.findByLabelText('Status: Active');
  expect(screen.queryByText(cutoff)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Got it' })).toBeNull();
});

// MVP-22-T09c native check on a 402 x 874 pt phone: the screen title, the tabs and the tall wall band pushed the card's action below the fold.
test('the room detail drops the screen title and tabs, its door returns to Today and it stands on a shorter wall band', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup(); const onReturn = jest.fn();
  const hidden = { includeHiddenElements: true };
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn }} /></LocalizationProvider>);
  await unfold();
  await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath: Running/ }))[0]);
  await screen.findByTestId('detail-status');
  expect(screen.queryByRole('header', { name: 'Oath details' })).toBeNull();
  // No tabs: the only "Today" control is the door back, the History tab is gone.
  expect(within(screen.getByRole('button', { name: 'Today' })).getByTestId('scene-door-picture', { includeHiddenElements: true })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
  // The lowered seal wall is shorter than the list's 262 pt band, and the close-up rises with it so the emblem keeps its plinth.
  expect(StyleSheet.flatten(screen.getByTestId('detail-wall', hidden).props.style).height).toBeLessThan(262);
  expect(DETAIL_DROP).toBeLessThan(LIST_DROP);
  expect(StyleSheet.flatten(screen.getByTestId('forge-closeup-image', hidden).props.style).top).toBeCloseTo(844 * DETAIL_DROP);
  // The door now stands where the artwork begins, so its band is solid.
  expect(StyleSheet.flatten(screen.getByTestId('screen-header').props.style)).toMatchObject({ backgroundColor: tokens.color.canvas });
  // MVP-22-T09e: the door goes back to the list it came from, under that tab's name. Only the list's own door returns to the room.
  expect(screen.queryByRole('button', { name: 'Return to the Forge' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  expect(await screen.findByRole('header', { name: 'Your Oaths' })).toBeOnTheScreen();
  expect(onReturn).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Return to the Forge' })).toBeOnTheScreen();
});
test('the room list keeps its title and tabs above the lowered artwork without a solid band', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await unfold();
  await screen.findAllByRole('button', { name: /Open Oath: Running/ });
  const header = screen.getByTestId('screen-header');
  expect(within(header).getByRole('header', { name: 'Your Oaths' })).toBeOnTheScreen();
  expect(StyleSheet.flatten(header.props.style).backgroundColor).toBeUndefined();
});
// MVP-22-T09e: the detail returns to the list it was opened from, keeping that list's rows, under the tab's own name.
test.each([
  ['History', 'History', 'History'],
  ['Today', 'Your Oaths', 'Today'],
] as const)('a detail opened from %s goes back to it with its rows', async (tab, heading, back) => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const f = setup(); const onReturn = jest.fn();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn }} /></LocalizationProvider>);
  await screen.findAllByRole('button', { name: /Open Oath: Running/ });
  if (tab === 'History') { await fireEvent.press(screen.getByRole('button', { name: 'History' })); await screen.findByTestId('history-header'); }
  const calls = jest.mocked(f.controller.list).mock.calls.length;
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  await screen.findByTestId('detail-status');
  expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: back }));
  // The kept rows show at once. The list asks the server again only quietly.
  expect(screen.getByRole('header', { name: heading })).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: /Open Oath: Running/ }).length).toBeGreaterThan(0);
  expect(screen.queryByText('Loading Oaths…')).toBeNull();
  if (tab === 'History') expect(screen.getByTestId('history-header')).toBeOnTheScreen();
  await act(async () => {});
  expect(jest.mocked(f.controller.list).mock.calls.slice(calls).map(call => call[0])).toEqual([{ view: tab === 'History' ? 'history' : 'today' }]);
  expect(onReturn).not.toHaveBeenCalled();
});
test('a detail opened from the proof screen goes back to Today', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const active = oath({ state: 'active', reason: null, review: null });
  const f = setup([active]);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proofController().controller} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'History' }));
  await screen.findByTestId('history-header');
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  await fireEvent.press(await screen.findByRole('button', { name: 'Submit proof' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Back to the Oath' }));
  await screen.findByTestId('detail-status');
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  expect(await screen.findByRole('header', { name: 'Your Oaths' })).toBeOnTheScreen();
});
test('going back from a detail restores the list scroll position', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const f = setup();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await screen.findAllByRole('button', { name: /Open Oath: Running/ });
  await fireEvent.scroll(screen.getByTestId('oath-list-scroll'), { nativeEvent: { contentOffset: { x: 0, y: 240 }, contentSize: { width: 390, height: 2000 }, layoutMeasurement: { width: 390, height: 700 } } });
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  await screen.findByTestId('detail-status');
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  expect(screen.getByRole('header', { name: 'Your Oaths' })).toBeOnTheScreen();
  // The remounted list starts at the kept offset. Another list starts at the top.
  expect(screen.getByTestId('oath-list-scroll').props.contentOffset).toEqual({ x: 0, y: 240 });
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  await screen.findByTestId('history-header');
  expect(screen.getByTestId('oath-list-scroll').props.contentOffset).toBeUndefined();
  // A later visit through the tab is a fresh list, so it starts at the top too.
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  await screen.findByRole('header', { name: 'Your Oaths' });
  expect(screen.getByTestId('oath-list-scroll').props.contentOffset).toBeUndefined();
});
// MVP-22-T09c native check at the largest standard text: the back link, the title and the tabs sat on the busy room image.
test('in the simple layout the list and the detail headers stand on a solid band, never on the artwork', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const f = setup();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await screen.findAllByRole('button', { name: /Open Oath: Running/ });
  let header = screen.getByTestId('screen-header');
  expect(StyleSheet.flatten(header.props.style)).toMatchObject({ backgroundColor: tokens.color.canvas });
  for (const name of ['Back to menu', 'Today', 'History']) expect(within(header).getByRole('button', { name })).toBeOnTheScreen();
  expect(within(header).getByRole('header', { name: 'Your Oaths' })).toBeOnTheScreen();
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  await screen.findByTestId('detail-status');
  header = screen.getByTestId('screen-header');
  expect(StyleSheet.flatten(header.props.style)).toMatchObject({ backgroundColor: tokens.color.canvas });
  // The detail's back link names the list it returns to (MVP-22-T09e). No tabs.
  expect(within(header).getByRole('button', { name: 'Today' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'History' })).toBeNull();
});
// MVP-22-T09: the detail on the shared pieces (docs/product/clarity.md decisions 11 and 14).
// A Thursday deadline outside the repeated autumn hour, so the line shows no offset.
function activeThursday(patch: Partial<Oath> = {}) {
  const item = oath({ state: 'active', reason: null, review: null, ...patch });
  item.snapshot = { ...item.snapshot, deadline: { ...item.snapshot.deadline, local: '2026-10-29T02:30:00', offset: '+01:00', utc: '2026-10-29T01:30:00Z', receiptCutoff: '2026-10-29T01:45:00Z' } };
  return item;
}
const filled = () => screen.queryAllByText('◆', { includeHiddenElements: true });
test.each([
  ['pl', /^Etap 2 z 4, Trening/, 'Trening i dowód do czw 29 paź 02:30.', 'Prześlij dowód'],
  ['en', /^Step 2 of 4, Workout/, 'Workout and proof by Thu, Oct 29, 02:30.', 'Submit proof'],
] as const)('a %s active detail shows the track, one line and exactly one filled action, then Żaromir', async (locale, track, line, submit) => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup([activeThursday()]); f.controller.clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} proof={proofController().controller} timezone="UTC" /></LocalizationProvider>);
  await unfold();
  await fireEvent.press(await screen.findByRole('button', { name: /^(Open Oath|Otwórz Przysięgę): / }));
  expect(await screen.findByLabelText(track)).toBeOnTheScreen();
  expect(within(screen.getByTestId('detail-status')).getByText(line)).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: submit })).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
  expect(screen.getByTestId('zaromir-bust', { includeHiddenElements: true })).toBeOnTheScreen();
});
test('the repeated autumn hour carries its offset in the line', async () => {
  const f = setup([oath({ state: 'active', reason: null, review: null })]); f.controller.clock.observe('2026-10-24T00:00:00Z');
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  expect(await screen.findByText('Workout and proof by Sun, Oct 25, 02:30 (UTC+02:00).')).toBeOnTheScreen();
});
test('an interrupted upload shows its badge words, one filled "Send again" and the delete as an outline action', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup([activeThursday()]); f.controller.clock.observe(serverTime); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Otwórz Przysięgę/ }));
  expect(await screen.findByLabelText('Etap 2 z 4, Trening, Nie dotarł')).toBeOnTheScreen();
  expect(screen.getByText('Dowód nie dotarł. Kopia czeka tu na ponowne wysłanie.')).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Wyślij ponownie' })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Usuń kopię z tego urządzenia' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Prześlij dowód' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Usuń kopię z tego urządzenia' }));
  expect(proof.controller.discard).toHaveBeenCalledTimes(1);
});
// Review of T09 and T09b: a press must have visible feedback, so an error that follows it replaces the line (clarity.md decision 3).
test.each([
  [{ kind: 'unavailable', retry: 'request' }, 'Could not reach the server. The proof has not been received yet. A copy is waiting on this device.'],
  [{ kind: 'rate_limited', retry: 'request' }, 'Too many attempts. Wait a moment and try again. A copy is waiting on this device.'],
  [{ kind: 'storage' }, 'We could not safely save the proof copy on this device. Try again.'],
] as const)('an error after the player sends again (%o) replaces the card line', async (error, message) => {
  const f = setup([activeThursday()]); f.controller.clock.observe(serverTime); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Send again' }));
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: record(), oath: null, error: error as ProofControllerError }));
  expect(within(screen.getByTestId('detail-status')).getByText(message)).toBeOnTheScreen();
  expect(screen.queryByText('Proof not received. The copy is here, ready to send again.')).toBeNull();
  // The explanation of the waiting copy stays behind the full description.
  await fireEvent.press(screen.getByRole('button', { name: 'Full description' }));
  expect(screen.getByText(interrupted)).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
});
test('an error after the player deletes the copy replaces the card line too', async () => {
  const f = setup([activeThursday()]); f.controller.clock.observe(serverTime); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Delete the copy on this device' }));
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: record(), oath: null, error: { kind: 'storage' } }));
  expect(within(screen.getByTestId('detail-status')).getByText('We could not safely save the proof copy on this device. Try again.')).toBeOnTheScreen();
});
test('a required refusal replaces the line', async () => {
  const f = setup([activeThursday()]); f.controller.clock.observe(serverTime); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Send again' }));
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: record(), oath: null, error: { kind: 'reauthenticate' } }));
  expect(screen.getByText('Sign in again. The proof copy is waiting on this device.')).toBeOnTheScreen();
  expect(screen.queryByText('Proof not received. The copy is here, ready to send again.')).toBeNull();
});
test.each([
  ['paused', true],
  ['not paused', false],
] as const)('a proof_pending detail on a %s list shows Żaromir only when the pause is off', async (_, paused) => {
  const pending = oath({ state: 'proof_pending', reason: null, review: null, proof: receipt });
  const f = setup([pending]); jest.mocked(f.controller.list).mockResolvedValue(page([pending], null, paused));
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Otwórz Przysięgę/ }));
  await screen.findByText('Dowód odebrany. Wynik pojawi się tutaj.');
  expect(screen.queryAllByTestId('zaromir-bust', { includeHiddenElements: true })).toHaveLength(paused ? 0 : 1);
  expect(screen.queryAllByLabelText(/^Żaromir: /)).toHaveLength(paused ? 0 : 1);
});
test('an active detail asks the server again when the window for proof closes, and the line says it closed', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-29T01:44:50Z'));
  try {
    const active = activeThursday();
    const f = setup([active]); f.controller.clock.observe('2026-10-29T01:44:50Z');
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proofController().controller} timezone="UTC" /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath:/ }))[0]);
    expect(await screen.findByText('Workout finished by the deadline? Submit proof by Thu, Oct 29, 02:45.')).toBeOnTheScreen();
    expect(f.controller.detail).toHaveBeenCalledTimes(1);
    // At S the window is still open. One millisecond later it is closed.
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(f.controller.detail).toHaveBeenCalledTimes(1);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(f.controller.detail).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('The proof window has closed. The Forge is settling the state.')).toBeOnTheScreen();
    expect(filled()).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(600000); });
    expect(f.controller.detail).toHaveBeenCalledTimes(2);
  } finally { jest.useRealTimers(); }
});
test('an active detail moves to the last-hour line an hour before the deadline without asking the server', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-29T00:29:00Z'));
  try {
    const f = setup([activeThursday()]); f.controller.clock.observe('2026-10-29T00:29:00Z');
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath:/ }))[0]);
    expect(await screen.findByText('Workout and proof by Thu, Oct 29, 02:30.')).toBeOnTheScreen();
    // Exactly an hour before D is not yet "under an hour". One millisecond later it is.
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(screen.getByText('Workout and proof by Thu, Oct 29, 02:30.')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(screen.getByText('Under an hour left. Workout and proof by Thu, Oct 29, 02:30.')).toBeOnTheScreen();
    expect(f.controller.detail).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
test('an active detail moves to the cutoff line just after the deadline, also when the server cannot answer', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-29T01:29:50Z'));
  try {
    const f = setup([activeThursday()]); f.controller.clock.observe('2026-10-29T01:29:50Z');
    // The chip reaching D asks the server. Offline that answer never comes, and the line still changes.
    jest.mocked(f.controller.detail).mockResolvedValueOnce({ kind: 'success', value: { oath: activeThursday(), serverTime } }).mockResolvedValue({ kind: 'unavailable', retry: 'request' });
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath:/ }))[0]);
    expect(await screen.findByText('Under an hour left. Workout and proof by Thu, Oct 29, 02:30.')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(screen.getByText('Under an hour left. Workout and proof by Thu, Oct 29, 02:30.')).toBeOnTheScreen();
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(screen.getByText('Workout finished by the deadline? Submit proof by Thu, Oct 29, 02:45.')).toBeOnTheScreen();
  } finally { jest.useRealTimers(); }
});
test.each(['the proof screen', 'unmount'] as const)('the detail timer stops after leaving for %s', async (leave) => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-29T01:44:50Z'));
  try {
    const f = setup([activeThursday()]); f.controller.clock.observe('2026-10-29T01:44:50Z');
    const view = await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proofController().controller} timezone="UTC" /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath:/ }))[0]);
    await screen.findByTestId('detail-status');
    expect(f.controller.detail).toHaveBeenCalledTimes(1);
    if (leave === 'unmount') await view.unmount();
    else await fireEvent.press(screen.getByRole('button', { name: 'Submit proof' }));
    await act(async () => { jest.advanceTimersByTime(20000); });
    expect(f.controller.detail).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
test('past S a waiting copy shows the interrupted badge, one filled "Wyślij ponownie", an outline delete and no Żaromir', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup([activeThursday()]); f.controller.clock.observe('2026-10-29T01:46:00Z'); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Otwórz Przysięgę/ }));
  expect(await screen.findByTestId('step-words')).toHaveTextContent('Nie dotarł');
  expect(within(screen.getByTestId('detail-status')).getByText('Dowód nie dotarł. Kopia czeka tu na ponowne wysłanie.')).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
  expect(within(screen.getByRole('button', { name: 'Wyślij ponownie' })).getByText('◆', { includeHiddenElements: true })).toBeTruthy();
  expect(within(screen.getByRole('button', { name: 'Usuń kopię z tego urządzenia' })).queryByText('◆', { includeHiddenElements: true })).toBeNull();
  expect(screen.queryAllByTestId('zaromir-bust', { includeHiddenElements: true })).toHaveLength(0);
});
test('a deadline beyond the longest timeout waits in steps instead of firing at once', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-09-01T00:00:00Z'));
  try {
    const f = setup([activeThursday()]); f.controller.clock.observe('2026-09-01T00:00:00Z');
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
    await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath:/ }))[0]);
    const timeouts = jest.spyOn(globalThis, 'setTimeout');
    await screen.findByText('Workout and proof by Thu, Oct 29, 02:30.');
    // A longer native timeout overflows and fires at once, so the detail never asks for more than 2^31 − 1 ms.
    await act(async () => { jest.advanceTimersByTime(60000); });
    expect(Math.max(...timeouts.mock.calls.map(call => call[1] ?? 0))).toBeLessThanOrEqual(2 ** 31 - 1);
    expect(f.controller.detail).toHaveBeenCalledTimes(1);
    timeouts.mockRestore();
  } finally { jest.useRealTimers(); }
});
// MVP-22-T10: Today, History and ForgeHub rows (docs/product/clarity.md decisions 9, 10 and 14).
test('a Today row shows four pips with the short state label, the short deadline and the chip', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const scheduled = oath({ state: 'scheduled', activatedAt: null, reason: null, review: null, id: '20000000-0000-4000-8000-000000000002' });
  const f = setup([activeThursday(), scheduled]); f.controller.clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await unfold();
  const rows = await screen.findAllByRole('button', { name: /Otwórz Przysięgę/ });
  expect(within(rows[0]).getByLabelText('Etap 2 z 4, Trening, Aktywna')).toBeOnTheScreen();
  expect(within(rows[0]).getAllByTestId(/^step-pip-/, { includeHiddenElements: true })).toHaveLength(4);
  expect(within(rows[0]).getByText('czw 02:30')).toBeOnTheScreen();
  expect(within(rows[0]).getByTestId('countdown-chip')).toBeOnTheScreen();
  // The row names the state the seal wall uses, also before the start.
  expect(within(rows[1]).getByLabelText('Etap 1 z 4, Przysięga, Zaplanowana')).toBeOnTheScreen();
  expect(within(rows[1]).queryByText('Czeka na start')).toBeNull();
});
test('an interrupted Today row carries the amber badge, one line and the only filled "Wyślij ponownie"', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const other = activeThursday({ id: '20000000-0000-4000-8000-000000000002' });
  const f = setup([activeThursday(), other]); f.controller.clock.observe(serverTime); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  const rows = await screen.findAllByRole('button', { name: /Otwórz Przysięgę/ });
  expect(within(rows[0]).getByLabelText('Etap 2 z 4, Trening, Nie dotarł')).toBeOnTheScreen();
  expect(within(rows[0]).getByTestId('row-badge-interrupted', { includeHiddenElements: true })).toBeTruthy();
  expect(within(rows[1]).queryByTestId('row-badge-interrupted', { includeHiddenElements: true })).toBeNull();
  const line = within(screen.getByTestId(`oath-entry-${id}`)).getByTestId('upload-interrupted');
  expect(within(line).getByText('Dowód nie dotarł. Kopia czeka tu na ponowne wysłanie.')).toBeOnTheScreen();
  expect(screen.getAllByRole('button', { name: 'Wyślij ponownie' })).toHaveLength(1);
  // The simple layout's creation steps back to an outline, so the resend is the only filled button.
  expect(screen.getByRole('button', { name: 'Złóż Przysięgę' })).toBeOnTheScreen();
  expect(filled()).toHaveLength(1);
  expect(within(screen.getByRole('button', { name: 'Wyślij ponownie' })).getByText('◆', { includeHiddenElements: true })).toBeTruthy();
});
test('without an interrupted row the simple layout keeps its filled creation action', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const f = setup([activeThursday()]);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proofController().controller} timezone="UTC" /></LocalizationProvider>);
  await screen.findAllByRole('button', { name: /Otwórz Przysięgę/ });
  expect(within(screen.getByRole('button', { name: 'Złóż Przysięgę' })).getByText('◆', { includeHiddenElements: true })).toBeTruthy();
});
test('a History row names its state before the compact date', async () => {
  const fulfilled = oath({ state: 'fulfilled', reason: null, review: null, terminalAt: '2026-10-25T21:30:00Z' });
  const f = setup([]); jest.mocked(f.controller.list).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([fulfilled]));
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Historia' }));
  const row = await screen.findByRole('button', { name: /Otwórz Przysięgę/ });
  expect(within(row).getByText('Spełniona · 25 paź 2026, 22:30')).toBeOnTheScreen();
});
test('the pause note is a plain card line without Żaromir', async () => {
  const f = setup([]); jest.mocked(f.controller.list).mockResolvedValue(page([], null, true));
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  const note = await screen.findByText('Pauza jest włączona. Przysięgi czekające na wynik trwają dalej, wycofane nie wrócą.');
  expect(screen.getByTestId('pause-note')).toContainElement(note);
  expect(screen.queryByTestId('companion-avatar', { includeHiddenElements: true })).toBeNull();
});
test('the seal wall marks an interrupted upload on its seal with a label and no pips', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup([activeThursday()]); f.controller.clock.observe(serverTime); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  const seal = (await screen.findAllByTestId('forge-seal'))[0];
  expect(within(seal).getByTestId('seal-badge-interrupted', { includeHiddenElements: true })).toBeTruthy();
  expect(within(seal).getByText('Nie dotarł')).toBeOnTheScreen();
  expect(seal.props.accessibilityLabel).toContain('Nie dotarł');
  expect(within(seal).queryAllByTestId(/^step-pip-/, { includeHiddenElements: true })).toHaveLength(0);
});
test('the solid header fades into the artwork instead of ending on a hard edge', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup([activeThursday()]);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  expect(screen.queryByTestId('header-fade', { includeHiddenElements: true })).toBeNull();
  await unfold();
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await screen.findByTestId('detail-status');
  const header = screen.getByTestId('screen-header');
  const fade = within(header).getByTestId('header-fade', { includeHiddenElements: true });
  expect(StyleSheet.flatten(fade.props.style)).toMatchObject({ position: 'absolute', top: '100%', height: 24 });
  expect(fade.props.pointerEvents).toBe('none');
  // MVP-22-T12c (P5): solid strips of the band colour that thin out, so the fade never depends on gradient support,
  // and the band draws above the content that follows it.
  const strips = within(fade).getAllByTestId('header-fade-strip', { includeHiddenElements: true }).map(strip => StyleSheet.flatten(strip.props.style));
  expect(strips.length).toBeGreaterThanOrEqual(6);
  expect(strips.every(strip => strip.backgroundColor === tokens.color.canvas)).toBe(true);
  const opacities = strips.map(strip => strip.opacity as number);
  expect(opacities[0]).toBeGreaterThan(0.8);
  expect(opacities[opacities.length - 1]).toBeLessThan(0.15);
  expect(opacities.every((value, index) => index === 0 || value < opacities[index - 1])).toBe(true);
  expect(StyleSheet.flatten(header.props.style)).toMatchObject({ zIndex: 1 });
});
// MVP-22-T12b: review of T09c to T09e.
const scrollTo = async (y: number) => fireEvent.scroll(screen.getByTestId('oath-list-scroll'), { nativeEvent: { contentOffset: { x: 0, y }, contentSize: { width: 390, height: 3000 }, layoutMeasurement: { width: 390, height: 700 } } });
test('a detail opened from creation goes back to Today at the top, even after a History row restored its scroll', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const f = setup(); jest.mocked(f.controller.resetCreation).mockReturnValue(true);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'History' }));
  await screen.findByTestId('history-header');
  await scrollTo(800);
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  await fireEvent.press(await screen.findByRole('button', { name: 'History' }));
  await screen.findByTestId('history-header');
  expect(screen.getByTestId('oath-list-scroll').props.contentOffset).toEqual({ x: 0, y: 800 });
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Create an Oath' }));
  await act(async () => f.change({ kind: 'ready', busy: false, preview: null, oath: oath(), needsReview: false, pending: null }));
  await fireEvent.press(await screen.findByRole('button', { name: 'View the Oath' }));
  await screen.findByTestId('detail-status');
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  await screen.findByRole('header', { name: 'Your Oaths' });
  expect(screen.getByTestId('oath-list-scroll').props.contentOffset).toBeUndefined();
});
test('going back to a list with a second page keeps both pages and the scroll', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const first = oath(), second = oath({ id: '20000000-0000-4000-8000-000000000002' });
  second.snapshot = { ...second.snapshot, copy: { ...second.snapshot.copy, en: { ...second.snapshot.copy.en, activity: 'Mobility' } } };
  const f = setup([first]);
  jest.mocked(f.controller.list).mockResolvedValueOnce(page([first], 'cursor1')).mockResolvedValueOnce(page([second])).mockResolvedValueOnce(page([first], 'cursor1'));
  jest.mocked(f.controller.detail).mockResolvedValue({ kind: 'success', value: { oath: second, serverTime } });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  await screen.findByRole('button', { name: /Open Oath: Mobility/ });
  await scrollTo(300);
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath: Mobility/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Today' }));
  await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(3));
  expect(jest.mocked(f.controller.list).mock.calls[2][0]).toEqual({ view: 'today' });
  expect(screen.getByRole('button', { name: /Open Oath: Running/ })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /Open Oath: Mobility/ })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
  expect(screen.getByTestId('oath-list-scroll').props.contentOffset).toEqual({ x: 0, y: 300 });
});
test('a changed line is read out after the player sends again, but not a later change nobody pressed for', async () => {
  const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibilityWithOptions'); announce.mockClear();
  const f = setup([activeThursday()]); f.controller.clock.observe(serverTime); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Send again' }));
  await act(async () => proof.change({ kind: 'ready', busy: true, pending: record(), oath: null }));
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: record(), oath: null, error: { kind: 'unavailable', retry: 'request' } }));
  const spoken = (text: string) => announce.mock.calls.filter(call => call[0].includes(text)).length;
  expect(spoken('Could not reach the server')).toBe(1);
  await act(async () => proof.change({ kind: 'ready', busy: false, pending: record(), oath: null, error: { kind: 'rate_limited', retry: 'request' } as ProofControllerError }));
  expect(screen.getByText('Too many attempts. Wait a moment and try again. A copy is waiting on this device.')).toBeOnTheScreen();
  expect(spoken('Too many attempts')).toBe(0);
  announce.mockRestore();
});
test.each([['en', 'Today', 'Goes back to the list'], ['pl', 'Dzisiaj', 'Wraca do listy']] as const)('the %s detail back control says it goes back to the list', async (locale, label, hint) => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const f = setup();
  await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await fireEvent.press((await screen.findAllByRole('button', { name: /^(Open Oath|Otwórz Przysięgę): / }))[0]);
  await screen.findByTestId('detail-status');
  expect(screen.getByRole('button', { name: label })).toHaveProp('accessibilityHint', hint);
});
test('going back after the server closed a first-page row drops that row and keeps the second page', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const first = oath(), second = oath({ id: '20000000-0000-4000-8000-000000000002' }), third = oath({ id: '20000000-0000-4000-8000-000000000003' });
  second.snapshot = { ...second.snapshot, copy: { ...second.snapshot.copy, en: { ...second.snapshot.copy.en, activity: 'Mobility' } } };
  third.snapshot = { ...third.snapshot, copy: { ...third.snapshot.copy, en: { ...third.snapshot.copy.en, activity: 'Strength training' } } };
  const f = setup([first]);
  // Page 1 held Running and Strength training. Strength training closed meanwhile, so the fresh page 1 holds Running only.
  jest.mocked(f.controller.list).mockResolvedValueOnce(page([first, third], 'cursor1')).mockResolvedValueOnce(page([second])).mockResolvedValueOnce(page([first], 'cursor1'));
  jest.mocked(f.controller.detail).mockResolvedValue({ kind: 'success', value: { oath: second, serverTime } });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Mobility/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Today' }));
  await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(3));
  await waitFor(() => expect(screen.queryByRole('button', { name: /Open Oath: Strength training/ })).toBeNull());
  expect(screen.getByRole('button', { name: /Open Oath: Running/ })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /Open Oath: Mobility/ })).toBeOnTheScreen();
});
// MVP-22-T12c: review findings on T10 to T12b.
test('an interrupted Today row speaks its compact label in its value', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup([activeThursday()]); f.controller.clock.observe(serverTime); const proof = proofController();
  proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
  const row = await screen.findByRole('button', { name: /Otwórz Przysięgę/ });
  expect(row).toHaveProp('accessibilityValue', { text: 'Aktywna, Nie dotarł' });
});
test('a refused kept cursor after the return from a detail loads the first page again', async () => {
  Dimensions.set({ window: phone(2), screen: phone(2) });
  const first = oath(), second = oath({ id: '20000000-0000-4000-8000-000000000002' });
  second.snapshot = { ...second.snapshot, copy: { ...second.snapshot.copy, en: { ...second.snapshot.copy.en, activity: 'Mobility' } } };
  const f = setup([first]);
  jest.mocked(f.controller.list).mockResolvedValueOnce(page([first], 'cursor1')).mockResolvedValueOnce(page([second], 'cursor2')).mockResolvedValueOnce(page([first], 'cursor1'))
    .mockResolvedValueOnce({ kind: 'oath_error', code: 'invalid_request' } as never).mockResolvedValueOnce(page([first, second]));
  jest.mocked(f.controller.detail).mockResolvedValue({ kind: 'success', value: { oath: second, serverTime } });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" forgeNavigation={{ request: null, onReturn: jest.fn() }} /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Mobility/ }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Today' }));
  await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(3));
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  expect(jest.mocked(f.controller.list).mock.calls[3][0]).toEqual({ view: 'today', cursor: 'cursor2' });
  await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(5));
  expect(jest.mocked(f.controller.list).mock.calls[4][0]).toEqual({ view: 'today' });
  expect(await screen.findByRole('button', { name: /Open Oath: Mobility/ })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
});
test('the list Retry steps back to an outline while a row offers "Wyślij ponownie"', async () => {
  const listeners: ((state: string) => void)[] = [];
  const original = jest.mocked(AppState.addEventListener).getMockImplementation();
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (state: string) => void) => { listeners.push(listener); return { remove: jest.fn() }; }) as never);
  try {
    Dimensions.set({ window: phone(1), screen: phone(1) });
    const f = setup([activeThursday()]); f.controller.clock.observe(serverTime); const proof = proofController();
    proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
    await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} proof={proof.controller} timezone="UTC" /></LocalizationProvider>);
    await screen.findByRole('button', { name: /Otwórz Przysięgę/ });
    jest.mocked(f.controller.list).mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' } as never);
    await act(async () => { listeners.forEach(listener => listener('active')); });
    const retry = await screen.findByRole('button', { name: 'Spróbuj ponownie' });
    expect(within(retry).queryByText('◆', { includeHiddenElements: true })).toBeNull();
    expect(filled()).toHaveLength(1);
    expect(within(screen.getByRole('button', { name: 'Wyślij ponownie' })).getByText('◆', { includeHiddenElements: true })).toBeTruthy();
  } finally { subscription.mockImplementation(original); }
});

// MVP-22-A8 (clarity.md rules 3 and 14): list facts are plain lines, never Żaromir's bubble, "Wczytaj więcej" is outlined,
// and the pause line carries the pause mark. History keeps its own line in Żaromir's compact line (MVP-22-B2).
describe('list lines', () => {
  const avatar = () => screen.queryByTestId('companion-avatar', { includeHiddenElements: true });
  test.each(['pl', 'en'] as const)('%s at text scale 2: paused list with more pages shows the marked plain line and no filled button', async locale => {
    Dimensions.set({ window: phone(2), screen: phone(2) });
    const f = setup(); jest.mocked(f.controller.list).mockResolvedValue(page([oath()], 'cursor1', true));
    await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    const note = await screen.findByTestId('pause-note');
    expect(within(note).getByTestId('pause-mark')).toHaveProp('accessibilityLabel', locale === 'pl' ? 'W pauzie' : 'Paused');
    expect(within(note).getByText(locale === 'pl' ? 'Pauza jest włączona. Przysięgi czekające na wynik trwają dalej, wycofane nie wrócą.' : 'Pause is on. Oaths awaiting a result continue, withdrawn ones do not return.')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: locale === 'pl' ? 'Wczytaj więcej' : 'Load more' })).toBeOnTheScreen();
    expect(filled()).toHaveLength(0);
    expect(avatar()).toBeNull();
  });
  test.each(['pl', 'en'] as const)('%s at text scale 2: a failed list shows a plain alert line and one filled Retry', async locale => {
    Dimensions.set({ window: phone(2), screen: phone(2) });
    const f = setup(); jest.mocked(f.controller.list).mockResolvedValue({ kind: 'unavailable', retry: 'request' } as never);
    await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    const line = await screen.findByTestId('list-error');
    expect(line).toHaveTextContent(locale === 'pl' ? 'Nie udało się wczytać Przysiąg. Spróbuj ponownie.' : 'We could not load your Oaths. Try again.');
    expect(line).toHaveProp('accessibilityRole', 'alert');
    expect(avatar()).toBeNull();
    expect(filled()).toHaveLength(1);
  });
  test.each(['pl', 'en'] as const)('%s at text scale 2: an unresolved acceptance is a plain line with one filled check', async locale => {
    Dimensions.set({ window: phone(2), screen: phone(2) });
    const f = setup([]); f.change({ kind: 'ready', busy: false, pending: { version: 2, accountId: id, characterId, previewId: id, requestId: id }, preview: null, oath: null, needsReview: false });
    await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    expect(await screen.findByTestId('pending-line')).toHaveTextContent(locale === 'pl' ? 'Twoje potwierdzenie mogło już dotrzeć. Sprawdź tę samą Przysięgę, zanim rozpoczniesz kolejną.' : 'Your confirmation may already have arrived. Check the same Oath before starting another.');
    // MVP-22-A8c: the empty-Today line waits until the acceptance is checked, so no bubble is left.
    expect(screen.queryByText(locale === 'pl' ? 'Brak bieżących Przysiąg. Wybierz trening, gdy zechcesz zacząć.' : 'No current Oaths. Choose a workout when you are ready.')).toBeNull();
    expect(avatar()).toBeNull();
    expect(filled()).toHaveLength(1);
  });
  // MVP-22-A8c: while the list failed, "Spróbuj ponownie" is the one filled action and the check steps back to the outline style.
  test.each(['pl', 'en'] as const)('%s an unresolved acceptance with a failed list keeps one filled button', async locale => {
    const f = setup([]); f.change({ kind: 'ready', busy: false, pending: { version: 2, accountId: id, characterId, previewId: id, requestId: id }, preview: null, oath: null, needsReview: false });
    jest.mocked(f.controller.list).mockResolvedValue({ kind: 'unavailable', retry: 'request' } as never);
    await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await screen.findByTestId('list-error');
    expect(filled()).toHaveLength(1);
    const check = screen.getByRole('button', { name: locale === 'pl' ? 'Sprawdź potwierdzenie' : 'Check confirmation' });
    expect(within(check).queryByText('◆', { includeHiddenElements: true })).toBeNull();
    expect(within(screen.getByRole('button', { name: locale === 'pl' ? 'Spróbuj ponownie' : 'Try again' })).getByText('◆', { includeHiddenElements: true })).toBeTruthy();
  });
  test('the busy notice is a plain line', async () => {
    const f = setup([]);
    f.change({ kind: 'ready', busy: true, pending: null, preview: null, oath: null, needsReview: false });
    jest.mocked(f.controller.resetCreation).mockReturnValue(false);
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'create' }, onReturn: jest.fn() }} /></LocalizationProvider>);
    expect(await screen.findByTestId('busy-line')).toHaveTextContent('The Forge is still finishing your last step. Return to the hearth in a moment.');
  });
  // MVP-22-B2 (G15): the History line uses the compact line of the Oath path, with its text unchanged.
  test.each([
    ['pl', 'Historia', 'Każdy wpis to Twoja historia w Kuźni.', 'Żaromir'],
    ['en', 'History', 'Every entry is part of your story in the Forge.', 'Zharomir'],
  ] as const)('%s History speaks its line in Żaromir\'s compact line, not the big bubble', async (locale, tab, text, speaker) => {
    const f = setup(); await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await screen.findByText(locale === 'pl' ? 'Pod rozwagą' : 'Under review');
    await fireEvent.press(screen.getByRole('button', { name: tab }));
    const header = await screen.findByTestId('history-header');
    expect(within(header).getByTestId('zaromir-bust', { includeHiddenElements: true })).toBeTruthy();
    expect(within(header).queryByTestId('companion-avatar', { includeHiddenElements: true })).toBeNull();
    expect(within(header).getByLabelText(`${speaker}: ${text}`)).toBeOnTheScreen();
  });
  test('an empty History speaks its own line in the compact style', async () => {
    const f = setup([]); await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await fireEvent.press(await screen.findByRole('button', { name: 'History' }));
    expect(await screen.findByText('The chronicle is waiting for its first entry.')).toBeOnTheScreen();
    expect(within(screen.getByTestId('history-header')).getByTestId('zaromir-bust', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('companion-avatar', { includeHiddenElements: true })).toBeNull();
  });
});

// Polish P8 (main-agent decision under the owner's delegation, 2026-10-02): when the seal wall already shows every Oath of Today,
// the full list folds behind "Wszystkie Twoje Przysięgi", so each Oath shows once. It stays open in simple layout, past three Oaths,
// with more pages, and while a row carries an upload line, because that row holds "Wyślij ponownie".
describe('Today full list fold', () => {
  const three = () => [1, 2, 3].map(n => oath({ id: `20000000-0000-4000-8000-00000000005${n}` }));
  const rows = () => screen.queryAllByRole('button', { name: /Open Oath:/ });
  test('folds when the wall shows every Oath, and opens in place', async () => {
    Dimensions.set({ window: phone(1), screen: phone(1) });
    const f = setup(three());
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    expect(await screen.findAllByRole('button', { name: /Oath seal:/ })).toHaveLength(3);
    const fold = screen.getByRole('button', { name: 'All your Oaths' });
    expect(fold).toHaveProp('accessibilityState', { expanded: false });
    expect(rows()).toHaveLength(0);
    await fireEvent.press(fold);
    expect(rows()).toHaveLength(3);
  });
  test.each([
    ['four Oaths', () => [...three(), oath({ id: '20000000-0000-4000-8000-000000000054' })], null, 1],
    ['more pages', three, 'cursor1', 1],
    ['simple layout', three, null, 2],
  ] as const)('stays open with %s', async (_name, items, cursor, scale) => {
    Dimensions.set({ window: phone(scale), screen: phone(scale) });
    const list = items(); const f = setup(list); jest.mocked(f.controller.list).mockResolvedValue(page(list, cursor));
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    expect(await screen.findByRole('header', { name: 'All your Oaths' })).toBeOnTheScreen();
    expect(rows()).toHaveLength(list.length);
  });
  test('stays open while a row offers "Send again"', async () => {
    Dimensions.set({ window: phone(1), screen: phone(1) });
    const active = oath({ state: 'active', reason: null, review: null });
    const f = setup([active]); const proof = proofController();
    proof.change({ kind: 'ready', busy: false, pending: record(), oath: null });
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} proof={proof.controller} timezone="Europe/Warsaw" /></LocalizationProvider>);
    expect(await screen.findByRole('button', { name: 'Send again' })).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'All your Oaths' })).toBeNull();
  });
  test('a detail opened from an open fold returns to the open fold', async () => {
    Dimensions.set({ window: phone(1), screen: phone(1) });
    const items = three(); const f = setup(items);
    jest.mocked(f.controller.detail).mockImplementation(async selectedId => ({ kind: 'success', value: { oath: items.find(item => item.id === selectedId)!, serverTime } }));
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await fireEvent.press(await screen.findByRole('button', { name: 'All your Oaths' }));
    await fireEvent.press(rows()[2]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Today' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'All your Oaths' })).toHaveProp('accessibilityState', { expanded: true }));
    expect(rows()).toHaveLength(3);
  });
  // MVP-22-A8c: the open fold is restored once. A later remount of the same list keeps the player's own choice.
  test('a fold closed after the return stays closed when the list reloads', async () => {
    Dimensions.set({ window: phone(1), screen: phone(1) });
    const items = three(); const f = setup(items);
    jest.mocked(f.controller.detail).mockImplementation(async selectedId => ({ kind: 'success', value: { oath: items.find(item => item.id === selectedId)!, serverTime } }));
    const view = (reload: number) => <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" reload={reload} /></LocalizationProvider>;
    const screenView = await render(view(0));
    await fireEvent.press(await screen.findByRole('button', { name: 'All your Oaths' }));
    await fireEvent.press(rows()[2]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Today' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'All your Oaths' })).toHaveProp('accessibilityState', { expanded: true }));
    await fireEvent.press(screen.getByRole('button', { name: 'All your Oaths' }));
    expect(rows()).toHaveLength(0);
    await screenView.rerender(view(1));
    await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(3));
    expect(await screen.findByRole('button', { name: 'All your Oaths' })).toHaveProp('accessibilityState', { expanded: false });
    expect(rows()).toHaveLength(0);
  });
  // MVP-22-B2b (review finding): the fold restored open and left open is the player's choice too, so a reload keeps it open.
  test('a fold left open after the return stays open when the list reloads', async () => {
    Dimensions.set({ window: phone(1), screen: phone(1) });
    const items = three(); const f = setup(items);
    jest.mocked(f.controller.detail).mockImplementation(async selectedId => ({ kind: 'success', value: { oath: items.find(item => item.id === selectedId)!, serverTime } }));
    const view = (reload: number) => <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" reload={reload} /></LocalizationProvider>;
    const screenView = await render(view(0));
    await fireEvent.press(await screen.findByRole('button', { name: 'All your Oaths' }));
    await fireEvent.press(rows()[2]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Today' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'All your Oaths' })).toHaveProp('accessibilityState', { expanded: true }));
    await screenView.rerender(view(1));
    await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(3));
    expect(await screen.findByRole('button', { name: 'All your Oaths' })).toHaveProp('accessibilityState', { expanded: true });
    expect(rows()).toHaveLength(3);
  });
  test('a detail opened from a seal returns to the closed fold', async () => {
    Dimensions.set({ window: phone(1), screen: phone(1) });
    const items = three(); const f = setup(items);
    jest.mocked(f.controller.detail).mockImplementation(async selectedId => ({ kind: 'success', value: { oath: items.find(item => item.id === selectedId)!, serverTime } }));
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await fireEvent.press((await screen.findAllByRole('button', { name: /Oath seal:/ }))[0]);
    await fireEvent.press(await screen.findByRole('button', { name: 'Today' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'All your Oaths' })).toHaveProp('accessibilityState', { expanded: false }));
  });
});

// MVP-22-A8b (review finding): any "Load more" the server refuses as invalid_request loads the first page again,
// not only a cursor kept from a detail return, so Retry can never resend a dead cursor.
test.each([
  ['an invalid request', { kind: 'invalid_request' }],
  ['an invalid_request Oath error', { kind: 'oath_error', code: 'invalid_request' }],
] as const)('a plain Load more refused with %s loads the first page again', async (_name, refusal) => {
  const first = oath({ state: 'withdrawn', reason: 'character_paused', terminalAt: serverTime, review: null });
  const f = setup([]);
  jest.mocked(f.controller.list).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([first], 'cursor1'))
    .mockResolvedValueOnce(refusal as never).mockResolvedValueOnce(page([first]));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('No current Oaths. Choose a workout when you are ready.');
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  expect(jest.mocked(f.controller.list).mock.calls[2][0]).toEqual({ view: 'history', cursor: 'cursor1' });
  await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(4));
  expect(jest.mocked(f.controller.list).mock.calls[3][0]).toEqual({ view: 'history' });
  expect(await screen.findAllByTestId('state-seal-withdrawn', { includeHiddenElements: true })).toHaveLength(1);
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Load more' })).toBeNull();
});

// MVP-22-A8c (review finding): Retry repeats the request that failed. A failed quiet refresh of page 1 asks for page 1 again,
// never for the next page of the stale list on screen.
test('Retry after a failed quiet refresh loads the first page, not the next one', async () => {
  const listeners: ((state: string) => void)[] = [];
  const original = jest.mocked(AppState.addEventListener).getMockImplementation();
  const subscription = jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (state: string) => void) => { listeners.push(listener); return { remove: jest.fn() }; }) as never);
  try {
    const first = oath({ state: 'withdrawn', reason: 'character_paused', terminalAt: serverTime, review: null });
    const f = setup([first]);
    jest.mocked(f.controller.list).mockResolvedValueOnce(page([first], 'cursor1')).mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' } as never).mockResolvedValueOnce(page([first], 'cursor1'));
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await screen.findByRole('button', { name: 'Load more' });
    await act(async () => { listeners.forEach(listener => listener('active')); });
    await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(3));
    expect(jest.mocked(f.controller.list).mock.calls[2][0]).toEqual({ view: 'today' });
  } finally { subscription.mockImplementation(original); }
});

test('Retry after a failed Load more asks for the same next page', async () => {
  const first = oath({ state: 'withdrawn', reason: 'character_paused', terminalAt: serverTime, review: null });
  const second = oath({ ...first, id: '20000000-0000-4000-8000-000000000002' });
  const f = setup([first]);
  jest.mocked(f.controller.list).mockResolvedValueOnce(page([first], 'cursor1')).mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' } as never).mockResolvedValueOnce(page([second]));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: 'Load more' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(f.controller.list).toHaveBeenCalledTimes(3));
  expect(jest.mocked(f.controller.list).mock.calls[2][0]).toEqual({ view: 'today', cursor: 'cursor1' });
});

// MVP-22-G24b: drawn Polish prose keeps a single-letter word with the next word, and a middle-dot separator never ends a line.
describe('drawn prose binding', () => {
  const raw = { normalizer: (text: string) => text };
  test.each([
    ['pl', '25 października 2026 · Warszawa'],
    ['en', 'October 25, 2026 · Warsaw'],
  ] as const)('the %s Today group header keeps the dot with the zone', async (locale, header) => {
    const f = setup([oath({ state: 'active', reason: null, review: null })]);
    await render(<LocalizationProvider initialLocale={locale}><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await screen.findAllByRole('button', { name: /^(Open Oath|Otwórz Przysięgę): / });
    expect(screen.getAllByText(header, raw).length).toBeGreaterThan(0);
  });
  test('a Polish History row keeps the dot with the closing time', async () => {
    const fulfilled = oath({ state: 'fulfilled', reason: null, review: null, terminalAt: '2026-10-25T21:30:00Z' });
    const f = setup([]); jest.mocked(f.controller.list).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([fulfilled]));
    await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
    await fireEvent.press(await screen.findByRole('button', { name: 'Historia' }));
    const row = await screen.findByRole('button', { name: /Otwórz Przysięgę/ });
    expect(within(row).getByText(/^Spełniona · 25/, raw)).toBeOnTheScreen();
  });
  test('the Polish detail binds single-letter words in its facts', async () => {
    const f = setup([oath()]);
    await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await fireEvent.press(await screen.findByRole('button', { name: /^Otwórz Przysięgę: / }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Pełny opis' }));
    expect(screen.getByText('Usługa mogła być wtedy niedostępna. Dlatego ta Przysięga jest pod rozwagą, a nie niewykonana.', raw)).toBeOnTheScreen();
  });
  test('the Polish receipt time keeps the dot with the zone', async () => {
    const f = setup([oath({ state: 'proof_pending', reason: null, review: null, proof: receipt })]);
    await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await fireEvent.press(await screen.findByRole('button', { name: /^Otwórz Przysięgę: / }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Pełny opis' }));
    expect(screen.getByText(/^Czas odebrania: .+ · Warszawa$/, raw)).toBeOnTheScreen();
  });
  test('English keeps single-letter words unbound in the pause note', async () => {
    const f = setup([]); jest.mocked(f.controller.list).mockResolvedValue(page([], null, true));
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    expect(await screen.findByText('Pause is on. Oaths awaiting a result continue, withdrawn ones do not return.', raw)).toBeOnTheScreen();
  });
});
