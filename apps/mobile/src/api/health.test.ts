import { checkHealth } from './health';

afterEach(() => jest.restoreAllMocks());

function response(status: number, body: unknown, contentType = 'application/json'): Response {
  return { status, headers: { get: () => contentType }, json: async () => body } as unknown as Response;
}

test.each([
  ['HTTP error', response(503, { status: 'ok' })],
  ['wrong content type', response(200, { status: 'ok' }, 'text/html')],
  ['wrong status', response(200, { status: 'failed' })],
  ['extra fields', response(200, { status: 'ok', extra: true })],
  ['null', response(200, null)],
  ['array', response(200, ['ok'])],
])('rejects %s instead of confirming health', async (_name, value) => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(value);
  await expect(checkHealth('http://localhost:18082', new AbortController().signal)).rejects.toThrow();
});

test('rejects invalid JSON', async () => {
  jest.spyOn(globalThis, 'fetch').mockResolvedValue({ ...response(200, null), json: async () => { throw new SyntaxError('invalid'); } });
  await expect(checkHealth('http://localhost:18082', new AbortController().signal)).rejects.toThrow();
});
