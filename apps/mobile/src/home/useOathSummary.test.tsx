import { act, renderHook } from '@testing-library/react-native';
import type { OathListEnvelope } from '../api/oathSchema';
import type { OathController } from '../oaths/controller';
import { useOathSummary } from './useOathSummary';

type ListResult = Awaited<ReturnType<OathController['list']>>;
const characterId = '30000000-0000-4000-8000-00000000000c';
const page = (total: number, paused = false): ListResult => ({ kind: 'success', value: { items: [], nextCursor: null, total, serverTime: '2026-10-24T00:00:00Z', paused, characterId } as OathListEnvelope });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function controller() { return { list: jest.fn<Promise<ListResult>, Parameters<OathController['list']>>() }; }
async function mount(api: ReturnType<typeof controller>) {
  const hook = await renderHook(() => useOathSummary(api as unknown as OathController));
  await act(async () => {});
  return hook;
}

test('loads the Today total and pause flag on mount', async () => {
  const api = controller(); api.list.mockResolvedValueOnce(page(3, true));
  const hook = await mount(api);
  expect(api.list).toHaveBeenCalledTimes(1);
  expect(api.list).toHaveBeenCalledWith({ view: 'today', limit: 1 });
  expect(hook.result.current.state).toEqual({ kind: 'ready', total: 3, paused: true, characterId });
});

test.each<[string, ListResult]>([
  ['unavailable', { kind: 'unavailable', retry: 'request' }],
  ['character_changed', { kind: 'oath_error', code: 'character_changed' }],
  ['cancelled', { kind: 'cancelled' }],
])('%s fails without an automatic retry', async (_label, result) => {
  const api = controller(); api.list.mockResolvedValueOnce(result);
  const hook = await mount(api);
  expect(hook.result.current.state).toEqual({ kind: 'failed' });
  await act(async () => {});
  expect(api.list).toHaveBeenCalledTimes(1);
});

test('a thrown request fails the summary', async () => {
  const api = controller(); api.list.mockRejectedValueOnce(new Error('offline'));
  const hook = await mount(api);
  expect(hook.result.current.state).toEqual({ kind: 'failed' });
});

test('refresh while loading applies only the newer answer', async () => {
  const api = controller(); const older = deferred<ListResult>(); const newer = deferred<ListResult>();
  api.list.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise);
  const hook = await mount(api);
  expect(hook.result.current.state).toEqual({ kind: 'loading' });
  await act(async () => { hook.result.current.refresh(); });
  await act(async () => { newer.resolve(page(2)); });
  expect(hook.result.current.state).toEqual({ kind: 'ready', total: 2, paused: false, characterId });
  await act(async () => { older.resolve(page(7, true)); });
  expect(hook.result.current.state).toEqual({ kind: 'ready', total: 2, paused: false, characterId });
});

test('refresh after a failure loads again and becomes ready', async () => {
  const api = controller(); const retry = deferred<ListResult>();
  api.list.mockResolvedValueOnce({ kind: 'unavailable', retry: 'request' }).mockReturnValueOnce(retry.promise);
  const hook = await mount(api);
  expect(hook.result.current.state).toEqual({ kind: 'failed' });
  await act(async () => { hook.result.current.refresh(); });
  expect(hook.result.current.state).toEqual({ kind: 'loading' });
  await act(async () => { retry.resolve(page(0)); });
  expect(hook.result.current.state).toEqual({ kind: 'ready', total: 0, paused: false, characterId });
});
