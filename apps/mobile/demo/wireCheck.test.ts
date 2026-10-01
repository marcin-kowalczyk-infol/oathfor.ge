import { fetch as expoFetch } from 'expo/fetch';
import { isSecret } from '../src/api/request';
import { createDummy } from './runtime';
import { WIRE_CHECK_BASE_URL, WIRE_CHECK_BEARER, WIRE_CHECK_PORT } from './wireCheck';
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const transport = expoFetch as unknown as jest.Mock;
const token = 'A'.repeat(43);
const submissionId = '40000000-0000-4000-8000-0000000000aa';
const submission = { submissionId, mode: 'photo' as const, file: { uri: `file:///cache/proofs/${submissionId}.jpg` } as never };
// What the capture server answers by default, so the app keeps its copy.
const unavailableReply = () => ({ status: 503, url: '', redirected: false,
  headers: { get: (name: string) => name === 'content-type' ? 'application/json' : null },
  body: { getReader: () => { let done = false; return { read: async () => done ? { done: true } : (done = true, { done: false, value: new TextEncoder().encode('{"error":{"code":"service_unavailable"}}') }), cancel: async () => {}, releaseLock: () => {} }; } } });
beforeEach(() => transport.mockReset());

test('the wire check targets plain HTTP on the IPv4 loopback with a DUMMY bearer in the session token format', () => {
  const url = new URL(WIRE_CHECK_BASE_URL);
  expect(url.protocol).toBe('http:');
  expect(url.hostname).toBe('127.0.0.1');
  expect(url.port).toBe(String(WIRE_CHECK_PORT));
  expect(url.origin).toBe(WIRE_CHECK_BASE_URL);
  expect(WIRE_CHECK_BEARER.startsWith('DUMMY')).toBe(true);
  expect(isSecret(WIRE_CHECK_BEARER)).toBe(true);
  expect(WIRE_CHECK_BEARER).not.toBe(token);
});

test('the switch moves proof from the DUMMY receipt to the real client and back, with every other adapter unchanged', async () => {
  const dummy = createDummy('en', true);
  const runtime = dummy.runtime();
  const active = dummy.state.oaths.find(oath => oath.state === 'active')!;
  expect(dummy.state.wireCheck).toBe(false);

  dummy.state.wireCheck = true;
  transport.mockResolvedValueOnce(unavailableReply());
  // The same runtime object reads the switch on each send, so the memoized proof controller follows it.
  expect(await runtime.proofApi.submit(token, active.id, submission)).toEqual({ kind: 'unavailable', retry: 'request' });
  expect(transport).toHaveBeenCalledTimes(1);
  const [url, init] = transport.mock.calls[0];
  // Reaching the transport at all proves the development loopback rule accepted the origin.
  expect(url).toBe(`http://127.0.0.1:${WIRE_CHECK_PORT}/api/oaths/${active.id}/proofs`);
  expect(init).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit' });
  expect(init.headers).toEqual({ Accept: 'application/json', Authorization: `Bearer ${WIRE_CHECK_BEARER}` });
  expect([...(init.body as FormData).keys()]).toEqual(['submissionId', 'mode', 'declaration', 'image']);
  // The capture server never commits anything, so the DUMMY Oath is untouched.
  expect(active).toMatchObject({ state: 'active', proof: null });

  // Offline still stops the send before the wire.
  dummy.setOffline(true);
  expect(await runtime.proofApi.submit(token, active.id, submission)).toEqual({ kind: 'unavailable', retry: 'request' });
  expect(transport).toHaveBeenCalledTimes(1);
  dummy.setOffline(false);

  dummy.state.wireCheck = false;
  expect(await runtime.proofApi.submit(token, active.id, submission)).toMatchObject({ kind: 'success', value: { created: true, proof: { submissionId } } });
  expect(transport).toHaveBeenCalledTimes(1);
});
