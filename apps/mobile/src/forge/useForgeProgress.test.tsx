import { act, renderHook } from '@testing-library/react-native';
import type { OathListEnvelope } from '../api/oathSchema';
import type { OathController } from '../oaths/controller';
import { useForgeProgress } from './useForgeProgress';

type ListResult = Awaited<ReturnType<OathController['list']>>;
const characterId = '30000000-0000-4000-8000-00000000000c';
const other = '30000000-0000-4000-8000-00000000000d';
const page = (total: number, paused = false, owner = characterId): ListResult => ({ kind: 'success', value: { items: [], nextCursor: null, total, serverTime: '2026-10-24T00:00:00Z', paused, characterId: owner } as OathListEnvelope });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function controller() { return { list: jest.fn<Promise<ListResult>, Parameters<OathController['list']>>() }; }
const answers = (api: ReturnType<typeof controller>, today: ListResult, history: ListResult) =>
  api.list.mockImplementation(async ({ view }) => view === 'today' ? today : history);

test('a refresh loads the Today and history totals with limit 1', async () => {
  const api = controller(); answers(api, page(2, false), page(5));
  const hook = await renderHook(() => useForgeProgress(api as unknown as OathController, characterId));
  expect(api.list).not.toHaveBeenCalled();
  await act(async () => { hook.result.current.refresh(); });
  expect(api.list).toHaveBeenCalledWith({ view: 'today', limit: 1 });
  expect(api.list).toHaveBeenCalledWith({ view: 'history', limit: 1 });
  expect(hook.result.current.progress).toEqual({ today: { total: 2, paused: false }, history: { total: 5 }, loading: false });
});

test('an answer for another character is ignored', async () => {
  const api = controller(); answers(api, page(2, false, other), page(5, false, other));
  const hook = await renderHook(() => useForgeProgress(api as unknown as OathController, characterId));
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.progress).toEqual({ today: null, history: null, loading: false });
});

test('a failed Today request leaves its count unknown and keeps the history', async () => {
  const api = controller(); answers(api, { kind: 'unavailable', retry: 'request' }, page(5));
  const hook = await renderHook(() => useForgeProgress(api as unknown as OathController, characterId));
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.progress).toEqual({ today: null, history: { total: 5 }, loading: false });
});

test('a thrown request counts as unavailable', async () => {
  const api = controller(); api.list.mockRejectedValue(new Error('offline'));
  const hook = await renderHook(() => useForgeProgress(api as unknown as OathController, characterId));
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.progress).toEqual({ today: null, history: null, loading: false });
});

test('while loading the last answers stay and only the newest refresh applies', async () => {
  const api = controller();
  const slow = deferred<ListResult>();
  api.list.mockResolvedValueOnce(page(1)).mockResolvedValueOnce(page(3))
    .mockReturnValueOnce(slow.promise).mockResolvedValueOnce(page(3))
    .mockResolvedValueOnce(page(4)).mockResolvedValueOnce(page(6));
  const hook = await renderHook(() => useForgeProgress(api as unknown as OathController, characterId));
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.progress.today).toEqual({ total: 1, paused: false });
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.progress).toEqual({ today: { total: 1, paused: false }, history: { total: 3 }, loading: true });
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.progress).toEqual({ today: { total: 4, paused: false }, history: { total: 6 }, loading: false });
  await act(async () => { slow.resolve(page(9)); });
  expect(hook.result.current.progress.today).toEqual({ total: 4, paused: false });
});

// Review finding: after a character switch the previous character's counts stayed until the new answer arrived.
test('a new active character never sees the previous character\'s counts', async () => {
  const api = controller(); answers(api, page(7, false), page(9));
  const hook = await renderHook(({ id }: { id: string }) => useForgeProgress(api as unknown as OathController, id), { initialProps: { id: characterId } });
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.progress.today).toEqual({ total: 7, paused: false });
  api.list.mockReturnValue(new Promise(() => undefined));
  await hook.rerender({ id: other });
  expect(hook.result.current.progress).toEqual({ today: null, history: null, loading: false });
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.progress).toEqual({ today: null, history: null, loading: true });
});
