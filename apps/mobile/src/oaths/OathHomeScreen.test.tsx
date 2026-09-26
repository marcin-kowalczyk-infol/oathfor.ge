import { Dimensions } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import catalog from '../../../api/resources/oath/workout_oath_v1.json';
import { LocalizationProvider } from '../localization/LocalizationProvider';
import { OathHomeScreen } from './OathHomeScreen';
import type { OathController, OathControllerState } from './controller';
import type { Oath } from '../api/oathSchema';
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en' }] }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const id = '20000000-0000-4000-8000-000000000001';
const serverTime = '2026-10-26T00:00:00Z';
function oath(patch: Partial<Oath> = {}): Oath {
  const snapshot = JSON.parse(JSON.stringify(catalog)); snapshot.activity = 'running';
  snapshot.activation = { mode: 'now', time: { local: '2026-10-24T02:00:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: false, utc: '2026-10-24T00:00:00Z' } };
  snapshot.deadline = { local: '2026-10-25T02:30:00', timezone: 'Europe/Warsaw', offset: '+02:00', explicitOffset: true, utc: '2026-10-25T00:30:00Z', receiptCutoff: '2026-10-25T00:45:00Z' };
  for (const locale of ['pl', 'en']) { snapshot.copy[locale].activity = snapshot.copy[locale].activities.running; delete snapshot.copy[locale].activities; }
  return { id, snapshot, state: 'review_pending', createdAt: '2026-10-24T00:00:00Z', activatedAt: '2026-10-24T00:00:00Z', terminalAt: null, reason: 'service_availability_unknown', review: { enteredAt: '2026-10-25T00:45:01Z', closesAt: '2026-10-28T00:45:01Z' }, ...patch };
}
function setup(items = [oath()]) {
  let state: OathControllerState = { kind: 'ready', busy: false, preview: null, pending: null, oath: null, needsReview: false };
  const listeners = new Set<() => void>();
  const controller = { getState: () => state, subscribe: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); }, list: jest.fn().mockResolvedValue({ kind: 'success', value: { items, nextCursor: null, serverTime, paused: false } }), detail: jest.fn().mockResolvedValue({ kind: 'success', value: { oath: items[0], serverTime } }), getPause: jest.fn(), pause: jest.fn(), resetCreation: jest.fn(), recover: jest.fn() } as unknown as OathController;
  return { controller, onLogout: jest.fn(), state, change(next: OathControllerState) { state = next; listeners.forEach(fn => fn()); } };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const page = (items: Oath[], nextCursor: string | null = null, paused = false) => ({ kind: 'success' as const, value: { items, nextCursor, serverTime, paused } });
const pauseSummary = (revision = 'a'.repeat(64), paused = false) => ({ paused, revision, withdraw: paused ? [] : [id], preserve: [], serverTime });
test('Today retains overdue review-pending Oaths and opens their authoritative stored detail', async () => {
  const f = setup(); await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText('Under review')).toBeOnTheScreen();
  expect(screen.queryByText('Missed')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /Open Oath: Running/ }));
  expect(await screen.findByLabelText('Status: Under review')).toBeOnTheScreen();
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
  const first = oath({ state: 'withdrawn', reason: 'account_paused', terminalAt: serverTime, review: null });
  const second = oath({ ...first, id: '20000000-0000-4000-8000-000000000002' });
  const f = setup([]); jest.mocked(f.controller.list).mockResolvedValueOnce(page([])).mockResolvedValueOnce(page([first], 'cursor1')).mockResolvedValueOnce(page([second])).mockResolvedValueOnce(page([first]));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('No current Oaths. Choose a workout when you are ready.');
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findByText('Withdrawn')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Load more' }));
  expect(await screen.findAllByText('Withdrawn')).toHaveLength(2);
  expect(jest.mocked(f.controller.list).mock.calls[2][0]).toEqual({ view: 'history', cursor: 'cursor1' });
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh' }));
  expect(jest.mocked(f.controller.list).mock.calls[3][0]).toEqual({ view: 'history' });
  expect(await screen.findAllByText('Withdrawn')).toHaveLength(1);
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
test('partial pause-detail failure never exposes confirmation', async () => {
  const f = setup(); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary() });
  jest.mocked(f.controller.detail).mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('Under review'); await fireEvent.press(screen.getByRole('button', { name: 'Pause and resume' }));
  expect(await screen.findByRole('button', { name: 'Reload pause review' })).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Confirm pause' })).toBeNull(); expect(f.controller.pause).not.toHaveBeenCalled();
});
test('unresolved acceptance remains reachable from Today and cannot be reset into a new creation', async () => {
  const f = setup([]); f.change({ kind: 'ready', busy: false, pending: { version: 1, accountId: id, previewId: id, requestId: id }, preview: null, oath: null, needsReview: false });
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
test('Polish history and pause controls use localized copy without exposing IDs', async () => {
  const f = setup([]);
  await render(<LocalizationProvider initialLocale="pl"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText('Brak bieżących Przysiąg. Wybierz trening, gdy zechcesz zacząć.')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Historia' }));
  expect(await screen.findByText('Nie ma jeszcze zakończonych ani wycofanych Przysiąg.')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Pauza i wznowienie' })).toBeOnTheScreen();
});
test('pause shows meaningful complete-set summaries and a changed revision requires a new confirmation', async () => {
  const f = setup(); const extraId = '20000000-0000-4000-8000-000000000002';
  const preserved = oath({ id: extraId });
  jest.mocked(f.controller.getPause).mockResolvedValueOnce({ kind: 'success', value: { ...pauseSummary(), preserve: [extraId] } }).mockResolvedValueOnce({ kind: 'success', value: pauseSummary('b'.repeat(64)) });
  jest.mocked(f.controller.detail).mockImplementation(async selectedId => ({ kind: 'success', value: { oath: selectedId === id ? oath() : preserved, serverTime } }));
  jest.mocked(f.controller.pause).mockResolvedValueOnce({ kind: 'oath_error', code: 'pause_preview_changed' }).mockResolvedValueOnce({ kind: 'success', value: pauseSummary('c'.repeat(64), true) });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('Under review'); await fireEvent.press(screen.getByRole('button', { name: 'Pause and resume' }));
  expect(await screen.findByRole('button', { name: 'Confirm pause' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Will be withdrawn' })).toBeOnTheScreen();
  expect(screen.getByRole('header', { name: 'Will continue' })).toBeOnTheScreen();
  expect(screen.getAllByText(/Running ·.*Europe\/Warsaw/)).toHaveLength(2);
  expect(screen.queryByText(id)).toBeNull(); expect(f.controller.pause).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm pause' }));
  expect(await screen.findByText('Your Oaths changed. Review this updated list before confirming pause.')).toBeOnTheScreen();
  expect(f.controller.pause).toHaveBeenCalledTimes(1);
  await fireEvent.press(await screen.findByRole('button', { name: 'Confirm pause' }));
  expect(jest.mocked(f.controller.pause).mock.calls.map(call => call[0])).toEqual([{ paused: true, revision: 'a'.repeat(64) }, { paused: true, revision: 'b'.repeat(64) }]);
  expect(jest.mocked(f.controller.list).mock.calls[1][0]).toEqual({ view: 'today' });
});
test('resume only sends the flag, and a failed change requires current-state reload', async () => {
  const f = setup([]); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary('a'.repeat(64), true) });
  jest.mocked(f.controller.pause).mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' }).mockResolvedValueOnce({ kind: 'success', value: pauseSummary() });
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('No current Oaths. Choose a workout when you are ready.'); await fireEvent.press(screen.getByRole('button', { name: 'Pause and resume' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Resume gameplay' }));
  expect(jest.mocked(f.controller.pause).mock.calls[0][0]).toEqual({ paused: false });
  expect(screen.queryByRole('button', { name: 'Resume gameplay' })).toBeNull();
  await fireEvent.press(await screen.findByRole('button', { name: 'Reload pause review' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Resume gameplay' }));
  expect(await screen.findByText('No current Oaths. Choose a workout when you are ready.')).toBeOnTheScreen();
});
test('controller revalidation clears old pause busy state without an old response unlocking a newer mutation', async () => {
  const f = setup([]); jest.mocked(f.controller.getPause).mockResolvedValue({ kind: 'success', value: pauseSummary('a'.repeat(64), true) });
  const old = deferred<Awaited<ReturnType<OathController['pause']>>>(); const newer = deferred<Awaited<ReturnType<OathController['pause']>>>();
  jest.mocked(f.controller.pause).mockReturnValueOnce(old.promise).mockReturnValueOnce(newer.promise);
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await screen.findByText('No current Oaths. Choose a workout when you are ready.'); await fireEvent.press(screen.getByRole('button', { name: 'Pause and resume' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Resume gameplay' }));
  expect(screen.getByRole('button', { name: 'Today', disabled: true })).toBeOnTheScreen();
  await act(async () => f.change({ kind: 'loading' }));
  await act(async () => f.change(f.state));
  expect(await screen.findByRole('button', { name: 'Today', disabled: false })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Pause and resume' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Resume gameplay' }));
  await act(async () => old.resolve({ kind: 'success', value: pauseSummary() }));
  expect(screen.getByRole('button', { name: 'Today', disabled: true })).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: 'Resume gameplay', disabled: true })).toBeOnTheScreen();
  await act(async () => newer.resolve({ kind: 'success', value: pauseSummary() }));
  expect(await screen.findByRole('button', { name: 'Today', disabled: false })).toBeOnTheScreen();
});
test('late list and detail responses cannot replace the newly selected screen', async () => {
  const f = setup(); const late = deferred<Awaited<ReturnType<OathController['list']>>>();
  jest.mocked(f.controller.list).mockReturnValueOnce(late.promise).mockResolvedValueOnce(page([]));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  await fireEvent.press(screen.getByRole('button', { name: 'History' }));
  expect(await screen.findByText('No completed or withdrawn Oaths yet.')).toBeOnTheScreen();
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
  await act(async () => f.change({ kind: 'ready', busy: true, preview: null, oath: null, needsReview: false, pending: { version: 1, accountId: id, previewId: id, requestId: id } }));
  await fireEvent.press(screen.getByRole('button', { name: 'Today' }));
  expect(await screen.findByRole('button', { name: 'Check confirmation' })).toBeOnTheScreen();
  await act(async () => f.change({ kind: 'ready', busy: false, preview: null, oath: oath({ state: 'active', reason: null, review: null }), needsReview: false, pending: null }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Create an Oath' }));
  expect(screen.getByRole('radio', { name: 'Running', selected: true })).toBeOnTheScreen();
  expect(screen.getByText('Choose a time')).toBeOnTheScreen();
  expect(screen.queryByText('21:00')).toBeNull();
});

test('paused Forge makes the paused state visible and offers review without a creation affordance', async () => {
  Dimensions.set({ window: { width: 390, height: 844, scale: 3, fontScale: 1 }, screen: { width: 390, height: 844, scale: 3, fontScale: 1 } });
  const f = setup([]);
  jest.mocked(f.controller.list).mockResolvedValue(page([], null, true));
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="Europe/Warsaw" /></LocalizationProvider>);
  expect(await screen.findByText('Gameplay is paused. Existing reviews continue. Withdrawn Oaths will not return.')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Create an Oath' })).toBeNull();
  expect(screen.getByRole('button', { name: 'Pause and resume' })).toBeOnTheScreen();
});

test('room navigation opens history and keeps full stored time in accessibility', async () => {
  const f = setup();
  await render(<LocalizationProvider initialLocale="en"><OathHomeScreen {...f} timezone="UTC" forgeNavigation={{ request: { id: 1, target: 'history' }, onReturn: jest.fn() }} /></LocalizationProvider>);
  expect(await screen.findByText('Oct 25, 2026 at 2:30am')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /Open Oath:.*Europe\/Warsaw/ })).toBeOnTheScreen();
  expect(f.controller.list).toHaveBeenLastCalledWith({ view: 'history' });
});
test('room return preserves pending acceptance without resetting it', async () => {
  const f = setup([]); const onReturn = jest.fn();
  f.change({ kind: 'ready', busy: false, pending: { version: 1, accountId: id, previewId: id, requestId: id }, preview: null, oath: null, needsReview: false });
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
  await screen.findAllByText('Under review');
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
  await screen.findAllByText('Under review');
  expect(screen.getByTestId('forge-place-chronicle', { includeHiddenElements: true })).toBeTruthy();
});
