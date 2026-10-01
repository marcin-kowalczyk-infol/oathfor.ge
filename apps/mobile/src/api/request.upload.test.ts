import { createBoundedRequest, UPLOAD_TIMEOUT_MS } from './request';
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const token = 'A'.repeat(43);
const any = (value: unknown): value is unknown => value !== undefined;
type Init = { headers: Record<string, string>; signal: AbortSignal; body?: unknown };

test('a JSON body keeps its Content-Type and a multipart body lets FormData set the boundary', async () => {
  const transport = jest.fn().mockRejectedValue(new TypeError('offline'));
  const request = createBoundedRequest({ baseUrl: 'https://api.example.test', transport });
  await request('/api/x', 'POST', 200, any, '{}', token);
  const form = new FormData(); form.append('mode', 'photo');
  await request('/api/x', 'POST', 200, any, form, token);
  const [json, multipart] = transport.mock.calls.map(call => call[1] as Init);
  expect(json.headers).toEqual({ Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` });
  expect(multipart.headers).toEqual({ Accept: 'application/json', Authorization: `Bearer ${token}` });
  expect(multipart.body).toBe(form);
});

test.each([[undefined, 10000], [UPLOAD_TIMEOUT_MS, 60000]])('timeout policy %p stops the request at %i ms', async (timeoutMs, limit) => {
  jest.useFakeTimers();
  try {
    const transport = jest.fn(() => new Promise<never>(() => {}));
    const request = createBoundedRequest({ baseUrl: 'https://api.example.test', transport });
    let settled: unknown;
    void request('/api/x', 'GET', 200, any, undefined, token, undefined, timeoutMs === undefined ? {} : { timeoutMs }).then(result => { settled = result; });
    await jest.advanceTimersByTimeAsync(limit - 1);
    const signal = (transport.mock.calls[0] as unknown as [string, Init])[1].signal;
    expect(settled).toBeUndefined(); expect(signal.aborted).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(settled).toEqual({ kind: 'unavailable', retry: 'request' }); expect(signal.aborted).toBe(true);
  } finally { jest.useRealTimers(); }
});
