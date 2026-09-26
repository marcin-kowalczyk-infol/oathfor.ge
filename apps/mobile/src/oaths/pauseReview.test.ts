import type { Oath, OathEnvelope, PauseEnvelope } from '../api/oathSchema';
import type { OathResult } from '../api/oaths';
import { loadPauseReview } from './pauseReview';

const id = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const summary = (withdraw: string[], preserve: string[] = []): PauseEnvelope => ({ paused: false, revision: 'a'.repeat(64), withdraw, preserve, serverTime: '2026-09-25T00:00:00Z', characterId: '30000000-0000-4000-8000-000000000001' });
// Transport validation owns the full snapshot; these detail fixtures isolate complete-set loading.
const oath = (value: string) => ({ id: value, state: 'scheduled' }) as Oath;
const success = <T,>(value: T): OathResult<T> => ({ kind: 'success', value });

test('loads every ID in a pause summary larger than a Today page, preserving both group orders', async () => {
  const withdraw = Array.from({ length: 125 }, (_, index) => id(index + 1));
  const preserve = Array.from({ length: 25 }, (_, index) => id(index + 126));
  const value = summary(withdraw, preserve);
  const client = { getPause: jest.fn(async () => success(value)), detail: jest.fn(async (value: string) => success({ oath: oath(value), serverTime: '2026-09-25T00:00:00Z' })) };
  expect(await loadPauseReview(client)).toEqual(success({ summary: value, withdraw: withdraw.map(oath), preserve: preserve.map(oath) }));
  expect(client.detail).toHaveBeenCalledTimes(150);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

test('bounds in-flight details to four and retains summary order despite out-of-order completion', async () => {
  const ids = [id(1), id(2), id(3), id(4), id(5)];
  const value = summary(ids);
  const pending = ids.map(() => deferred<OathResult<OathEnvelope>>());
  const client = { getPause: jest.fn(async () => success(value)), detail: jest.fn((value: string) => pending[ids.indexOf(value)].promise) };
  const result = loadPauseReview(client); await flush();
  expect(client.detail).toHaveBeenCalledTimes(4);
  pending[3].resolve(success({ oath: oath(ids[3]), serverTime: value.serverTime })); await flush();
  expect(client.detail).toHaveBeenCalledTimes(5);
  for (const index of [4, 2, 1, 0]) pending[index].resolve(success({ oath: oath(ids[index]), serverTime: value.serverTime }));
  expect(await result).toEqual(success({ summary: value, withdraw: ids.map(oath), preserve: [] }));
});

test.each([{ kind: 'cancelled' }, { kind: 'reauthenticate' }, { kind: 'unavailable', retry: 'request' }] as const)('propagates $kind without partial success or scheduling more details', async failure => {
  const ids = [id(1), id(2), id(3), id(4), id(5)];
  const value = summary(ids);
  const pending = ids.map(() => deferred<OathResult<OathEnvelope>>());
  const client = { getPause: jest.fn(async () => success(value)), detail: jest.fn((value: string) => pending[ids.indexOf(value)].promise) };
  const result = loadPauseReview(client); await flush();
  pending[0].resolve(failure); await flush();
  for (const index of [1, 2, 3]) pending[index].resolve(success({ oath: oath(ids[index]), serverTime: value.serverTime }));
  expect(await result).toEqual(failure);
  expect(client.detail).toHaveBeenCalledTimes(4);
});

test('rejects a mismatched detail ID and never publishes the remaining partial review', async () => {
  const client = { getPause: jest.fn(async () => success(summary([id(1)]))), detail: jest.fn(async () => success({ oath: oath(id(2)), serverTime: '2026-09-25T00:00:00Z' })) };
  expect(await loadPauseReview(client)).toEqual({ kind: 'unavailable', retry: 'request' });
});

test('already-paused review still loads preserved commitments and empty summaries need no details', async () => {
  const value = { ...summary([], [id(2)]), paused: true };
  const detail = jest.fn(async (value: string) => success({ oath: oath(value), serverTime: '2026-09-25T00:00:00Z' }));
  expect(await loadPauseReview({ getPause: async () => success(value), detail })).toEqual(success({ summary: value, withdraw: [], preserve: [oath(id(2))] }));
  detail.mockClear();
  const empty = summary([]);
  expect(await loadPauseReview({ getPause: async () => success(empty), detail })).toEqual(success({ summary: empty, withdraw: [], preserve: [] }));
  expect(detail).not.toHaveBeenCalled();
});

test('failed summary and unexpected rejected detail promises become safe failures', async () => {
  const detail = jest.fn(async () => { throw new Error('DUMMY transport error'); });
  expect(await loadPauseReview({ getPause: async () => ({ kind: 'reauthenticate' }), detail })).toEqual({ kind: 'reauthenticate' });
  expect(detail).not.toHaveBeenCalled();
  expect(await loadPauseReview({ getPause: async () => success(summary([id(1)])), detail })).toEqual({ kind: 'unavailable', retry: 'request' });
});
