import { createBoundedRequest } from './request';
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
function response(status: number, value: unknown) {
  let consumed = false;
  return { status, url: '', redirected: false, headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
    body: { getReader: () => ({ read: async () => consumed ? { done: true } : (consumed = true, { done: false, value: new TextEncoder().encode(JSON.stringify(value)) }), cancel: async () => {}, releaseLock: () => {} }) } };
}
test('accepts both creation and replay statuses for an Oath confirmation', async () => {
  const transport = jest.fn().mockResolvedValueOnce(response(201, { saved: true })).mockResolvedValueOnce(response(200, { saved: true }));
  const request = createBoundedRequest({ baseUrl: 'https://api.example.test', transport });
  for (let i = 0; i < 2; i++) await expect(request('/api/oaths', 'POST', [200, 201], (value): value is { saved: true } => !!value && typeof value === 'object' && 'saved' in value)).resolves.toEqual({ kind: 'success', value: { saved: true } });
});
