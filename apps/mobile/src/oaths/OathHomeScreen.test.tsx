import { Profiler } from 'react';
import { AppState, Dimensions, StyleSheet } from 'react-native';
import { createServerClock } from './serverClock';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OathHomeScreen } from './OathHomeScreen';
import type { OathController, OathControllerState } from './controller';
import type { Oath } from '../api/oathSchema';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const id = '20000000-0000-4000-8000-000000000001';
const serverTime = '2026-10-26T00:00:00Z';
const characterId = '30000000-0000-4000-8000-000000000001';
function oath(patch: Partial<Oath> = {}): Oath {
  const snapshot = JSON.parse(JSON.stringify(catalog)); snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { id, characterId, snapshot, state: 'review_pending', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: 'service_availability_unknown', review: { enteredAt: '2026-10-25T00:45:01Z', closesAt: '2026-10-28T00:45:01Z' }, ...patch };
}
function setup(items = [oath()]) {
  let state: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
  const listeners = new Set<() => void>();
  const controller = { clock: createServerClock(), getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, list: jest.fn().mockResolvedValue({ kind: 'success', value: { items, nextCursor: null, total: items.length, serverTime, paused: false, characterId } }), detail: jest.fn().mockResolvedValue({ kind: 'success', value: { oath: items[0], serverTime } }), getPause: jest.fn(), pause: jest.fn(), resetCreation: jest.fn(), recover: jest.fn() } as unknown as OathController;
  return { controller, state, change(next: OathControllerState) { state = next; listeners.forEach(fn => fn()); } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const page = (items: Oath[], nextCursor: string | null = null, paused = false, total = items.length + (nextCursor ? 1 : 0)) => ({ kind: 'success' as const, value: { items, nextCursor, total, serverTime, paused, characterId } });
const pauseSummary = (revision = 'a'.repeat(64), paused = false) => ({ paused, revision, withdraw: paused ? [] : [id], preserve: [], serverTime, characterId });
test('Today retains overdue review-pending Oaths and opens their authoritative stored detail', async () => {
  const f = setup(); await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText('Under review')).toBeOnTheScreen();
  expect(screen.queryByText('Missed')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath: Running/ }));
  expect(await screen.findByLabelText('Status: Under review')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Full rules' }));
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
  expect(screen.getByRole('header', { name: 'Cases in progress' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Scheduled' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Active commitments' })).toBeOnTheScreen();
});
test('Today, History and detail render no pause control and no sign-out, which live in Settings', async () => {
  const f = setup(); await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('Under review');
  const absent = () => { for (const name of ['Pause and resume', 'Sign out']) expect(screen.queryByRole('button', { name })).toBeNull(); expect(screen.queryByText('Ⅱ')).toBeNull(); };
  absent();
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath: Running/ }));
  await screen.findByLabelText('Status: Under review'); absent();
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  await screen.findByTestId('history-header'); absent();
  expect(f.controller.getPause).not.toHaveBeenCalled();
});
test('a character pause withdrawal explains that resuming does not restore it', async () => {
  const withdrawn = oath({ state: 'withdrawn', reason: 'character_paused', terminalAt: serverTime, review: null });
  const f = setup([withdrawn]);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(await screen.findByRole('button', { name: /Open Oath: Running/ }));
  expect(await screen.findByText('Withdrawn when gameplay was paused. Resuming does not restore this Oath.')).toBeOnTheScreen();
});
test('unresolved acceptance remains reachable from Today and cannot be reset into a new creation', async () => {
  const f = setup([]); f.change({ kind: 'ready', busy: false, pending: { version: 2, accountId: id, characterId, previewId: id, requestId: id }, preview: null, oath: null, needsReview: false });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByRole('button', { name: 'Check confirmation' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Create an Oath' })).toBeNull();
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
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findByText('The chronicle is waiting for its first entry.')).toBeOnTheScreen();
  await act(async () => late.resolve(page([oath()])));
  expect(screen.queryByText('Under review')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Today' })); await screen.findByText('Under review');
  const detail = deferred<Awaited<ReturnType<OathController['detail']>>>(); jest.mocked(f.controller.detail).mockReturnValueOnce(detail.promise);
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath:/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
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
  expect(await screen.findByText('Gameplay is paused. Existing reviews continue. Withdrawn Oaths will not return.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Create an Oath' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Pause and resume' })).toBeNull();
});

test('room navigation opens history and keeps full stored time in accessibility', async () => {
  const f = setup();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'history' }, onReturn: jest.fn() }} /></LocalizationProvider>);
  expect(await screen.findByText('Oct 25, 2026 at 02:30')).toBeOnTheScreen();
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
  const record = () => frames.push({ detail: screen.queryAllByText('Oath details', hidden).length > 0, list: screen.queryAllByText('Your Oaths', hidden).length > 0, hearth: !!screen.queryByTestId('forge-place-hearth', hidden) });
  const screenWith = (request: { id: number; target: 'create' } | null) => <Profiler id="home" onRender={() => { if (recording) record(); }}>
    <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request, onReturn: jest.fn() }} /></LocalizationProvider>
  </Profiler>;
  const view = await render(screenWith(null));
  await fireEvent.press((await screen.findAllByRole('button', { name: /Open Oath: Running/ }))[0]);
  expect(await screen.findByText('Oath details')).toBeOnTheScreen();
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
  expect(await screen.findByText('Gameplay is paused. Existing reviews continue. Withdrawn Oaths will not return.')).toBeOnTheScreen();
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
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await screen.findAllByText('Under review');
  expect(place('seals')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  await screen.findByTestId('history-header');
  expect(place('chronicle')).toBeTruthy();
  await fireEvent.press(screen.getAllByRole('button', { name: /Open Oath: Running/ })[0]);
  await screen.findByLabelText('Status: Under review');
  expect(place('seals')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
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
  await screen.findByRole('button', { name: /Open Oath: Running/ });
  expect(screen.queryByRole('button', { name: 'Return to the Forge' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Back to menu' })).toBeNull();
});
test('a new reload value reloads the visible list and leaves an open detail alone', async () => {
  Dimensions.set({ window: phone(1), screen: phone(1) });
  const f = setup();
  const view = (reload: number) => <LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" reload={reload} /></LocalizationProvider>;
  const rendered = await render(view(0));
  await screen.findByRole('button', { name: /Open Oath: Running/ });
  expect(f.controller.list).toHaveBeenCalledTimes(1);
  await rendered.rerender(view(1));
  await act(async () => {});
  expect(f.controller.list).toHaveBeenCalledTimes(2);
  expect(jest.mocked(f.controller.list).mock.calls[1][0]).toEqual({ view: 'today' });
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
  expect((await screen.findAllByText('W trakcie rozpatrywania')).some(text => (text.props.maxFontSizeMultiplier ?? 99) <= 2)).toBe(true);
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
  expect(screen.getAllByRole('header', { name: /Europe\/Warsaw/ }).length).toBeGreaterThan(0);
});

test('each Today state section labels its own date and zone, even on the same day', async () => {
  const scheduled = oath({ state: 'scheduled', activatedAt: null, reason: null, review: null, id: '20000000-0000-4000-8000-000000000002' });
  const active = oath({ state: 'active', reason: null, review: null, id: '20000000-0000-4000-8000-000000000003' });
  const f = setup([scheduled, active]);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findAllByRole('button', { name: /Open Oath:/ });
  expect(screen.getAllByRole('header', { name: 'October 25, 2026 · Europe/Warsaw' })).toHaveLength(2);
});

test('a countdown reaching zero on Today shows time is up and asks the server once, the state stays', async () => {
  jest.useFakeTimers(); jest.setSystemTime(Date.parse('2026-10-25T00:29:30Z'));
  try {
    const active = oath({ state: 'active', reason: null, review: null });
    const f = setup([active]);
    f.controller.clock.observe('2026-10-25T00:29:30Z');
    await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
    await act(async () => { await Promise.resolve(); });
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
  expect(within(row).getByText('25 paź 2026, 22:30')).toBeOnTheScreen();
  expect(within(row).queryByText('Spełniona')).toBeNull();
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
  expect(screen.getAllByTestId(/^rule-card-/)).toHaveLength(9);
  expect(screen.queryByText(active.snapshot.copy.en.sections.appeal)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Full rules' }));
  expect(screen.getByText(active.snapshot.copy.en.sections.appeal)).toBeOnTheScreen();
});

test('a closed Oath detail shows when it closed instead of a countdown', async () => {
  const done = oath({ state: 'fulfilled', reason: null, review: null, terminalAt: '2026-10-25T21:30:00Z' });
  const f = setup([done]); f.controller.clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press((await screen.findAllByRole('button', { name: /Otwórz Przysięgę/ }))[0]);
  await screen.findByLabelText('Status: Spełniona');
  expect(screen.queryByTestId('countdown-chip')).toBeNull();
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
  expect(within(panel).getByText('Review closes Oct 28, 2026 at 01:45')).toBeOnTheScreen();
  expect(within(panel).getByText(/Service availability is uncertain/)).toBeOnTheScreen();
  expect(screen.queryByText(/GMT/)).toBeNull();
  expect(screen.getAllByRole('header', { name: oath().snapshot.copy.en.title })).toHaveLength(1);
});

test('the Polish review closing time uses the same short date as a closed Oath', async () => {
  const f = setup(); f.controller.clock.observe(serverTime);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="UTC" /></LocalizationProvider>);
  await fireEvent.press((await screen.findAllByRole('button', { name: /Otwórz Przysięgę/ }))[0]);
  expect(await screen.findByText('Rozpatrzenie kończy się 28 paź 2026, 1:45')).toBeOnTheScreen();
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
