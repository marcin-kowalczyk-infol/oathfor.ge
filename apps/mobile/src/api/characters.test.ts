import { createCharacterClient, type CharacterCreationInput } from './characters';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const token = 'A'.repeat(43);
const first = '30000000-0000-4000-8000-00000000000a';
const second = '30000000-0000-4000-8000-00000000000b';
const requestId = '40000000-0000-4000-8000-00000000000a';
const serverTime = '2026-09-26T12:00:00Z';
const mira = { id: first, name: 'Mira', presetId: 'dummy_braid', form: 'feminine', createdAt: '2026-09-26T11:00:00Z' };
const zoe = { id: second, name: 'Zo\u00E9', presetId: 'retired_look', form: 'neutral', createdAt: serverTime };
const presets = ['dummy_braid', 'dummy_cropped', 'dummy_curly', 'dummy_tied'];
const listing = { characters: [mira, zoe], activeCharacterId: second, limit: 3, presets, serverTime };
const input: CharacterCreationInput = { requestId, name: 'Mira', presetId: 'dummy_braid', form: 'feminine' };
function response(status: number, value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let read = false;
  return {
    status, url: '', redirected: false,
    headers: { get: (key: string) => key === 'content-type' ? 'application/json' : null },
    body: { getReader: () => ({
      read: async () => { if (read) return { done: true }; read = true; return { done: false, value: bytes }; },
      cancel: jest.fn().mockResolvedValue(undefined), releaseLock: jest.fn(),
    }) },
  };
}
function setup() {
  const transport = jest.fn();
  return { transport, client: createCharacterClient({ baseUrl: 'https://api.example.test', transport }) };
}

test('lists, creates and switches with the exact protected requests', async () => {
  const { client, transport } = setup();
  transport.mockResolvedValueOnce(response(200, listing))
    .mockResolvedValueOnce(response(201, { character: mira, activeCharacterId: first, serverTime }))
    .mockResolvedValueOnce(response(200, { ...listing, activeCharacterId: first }));
  await expect(client.list(token)).resolves.toEqual({ kind: 'success', value: listing });
  await expect(client.create(token, { ...input, name: '  Mira\u0085' })).resolves.toEqual({ kind: 'success', created: true, value: { character: mira, activeCharacterId: first, serverTime } });
  await expect(client.activate(token, first)).resolves.toEqual({ kind: 'success', value: { ...listing, activeCharacterId: first } });
  expect(transport.mock.calls.map(([url, init]) => [url, init.method, init.body, init.headers.Authorization])).toEqual([
    ['https://api.example.test/api/characters', 'GET', undefined, `Bearer ${token}`],
    ['https://api.example.test/api/characters', 'POST', JSON.stringify(input), `Bearer ${token}`],
    ['https://api.example.test/api/characters/active', 'PUT', JSON.stringify({ characterId: first }), `Bearer ${token}`],
  ]);
});

test('a replayed creation succeeds with the current active character and reports it as not created', async () => {
  const { client, transport } = setup();
  transport.mockResolvedValueOnce(response(200, { character: mira, activeCharacterId: second, serverTime }));
  await expect(client.create(token, input)).resolves.toEqual({ kind: 'success', created: false, value: { character: mira, activeCharacterId: second, serverTime } });
});

test('returned names are parsed structurally, so a letter unknown to the client regex still loads', async () => {
  const { client, transport } = setup();
  const newer = { ...listing, characters: [{ ...mira, name: 'Mira\u{3F000}' }, { ...zoe, name: 'R2D2' }] };
  transport.mockResolvedValueOnce(response(200, newer));
  await expect(client.list(token)).resolves.toEqual({ kind: 'success', value: newer });
});

test('a creation the server rejects as malformed is decisive, not retryable', async () => {
  const { client, transport } = setup();
  transport.mockResolvedValueOnce(response(400, { error: { code: 'invalid_request' } }));
  await expect(client.create(token, input)).resolves.toEqual({ kind: 'invalid_request' });
  transport.mockResolvedValueOnce(response(400, { error: { code: 'invalid_request', field: 'name' } }));
  await expect(client.create(token, input)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test('accepts an empty listing and a stored preset outside the current catalog', async () => {
  const { client, transport } = setup();
  const empty = { characters: [], activeCharacterId: null, limit: 3, presets, serverTime };
  transport.mockResolvedValueOnce(response(200, empty)).mockResolvedValueOnce(response(200, { ...listing, presets: [] }));
  await expect(client.list(token)).resolves.toEqual({ kind: 'success', value: empty });
  await expect(client.list(token)).resolves.toEqual({ kind: 'success', value: { ...listing, presets: [] } });
});

const third = { ...mira, id: '30000000-0000-4000-8000-000000000003' };
const fourth = { ...mira, id: '30000000-0000-4000-8000-000000000004' };
test.each([
  ['extra envelope key', { ...listing, extra: true }],
  ['missing envelope key', { characters: listing.characters, activeCharacterId: second, limit: 3, serverTime }],
  ['limit other than 3', { ...listing, limit: 4 }],
  ['limit as string', { ...listing, limit: '3' }],
  ['more characters than the limit', { ...listing, characters: [mira, zoe, third, fourth] }],
  ['duplicate character IDs', { ...listing, characters: [mira, { ...zoe, id: first }], activeCharacterId: first }],
  ['active ID outside the list', { ...listing, activeCharacterId: third.id }],
  ['active ID without characters', { ...listing, characters: [] }],
  ['uppercase character ID', { ...listing, characters: [{ ...mira, id: first.toUpperCase() }], activeCharacterId: first.toUpperCase() }],
  ['unknown form', { ...listing, characters: [{ ...mira, form: 'other' }, zoe] }],
  ['malformed preset ID', { ...listing, characters: [{ ...mira, presetId: 'Dummy-Braid' }, zoe] }],
  ['overlong preset ID', { ...listing, characters: [{ ...mira, presetId: 'a'.repeat(65) }, zoe] }],
  ['empty name', { ...listing, characters: [{ ...mira, name: '' }, zoe] }],
  ['control character in name', { ...listing, characters: [{ ...mira, name: 'Mi\u0000ra' }, zoe] }],
  ['name over 20 code points', { ...listing, characters: [{ ...mira, name: 'a'.repeat(21) }, zoe] }],
  ['non-string name', { ...listing, characters: [{ ...mira, name: 7 }, zoe] }],
  ['untrimmed name', { ...listing, characters: [{ ...mira, name: ' Mira' }, zoe] }],
  ['extra character key', { ...listing, characters: [{ ...mira, slot: 1 }, zoe] }],
  ['millisecond createdAt', { ...listing, characters: [{ ...mira, createdAt: '2026-09-26T11:00:00.000Z' }, zoe] }],
  ['offset serverTime', { ...listing, serverTime: '2026-09-26T12:00:00+00:00' }],
  ['duplicate presets', { ...listing, presets: ['dummy_braid', 'dummy_braid'] }],
  ['malformed preset in catalog', { ...listing, presets: ['dummy braid'] }],
  ['characters not an array', { ...listing, characters: {} }],
])('rejects a listing with %s', async (_label, value) => {
  const { client, transport } = setup();
  transport.mockResolvedValueOnce(response(200, value));
  await expect(client.list(token)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test.each([
  ['wrong created status', 202, { character: mira, activeCharacterId: first, serverTime }],
  ['created without activating it', 201, { character: mira, activeCharacterId: second, serverTime }],
  ['null active ID', 200, { character: mira, activeCharacterId: null, serverTime }],
  ['extra key', 201, { character: mira, activeCharacterId: first, serverTime, characters: [] }],
  ['different name than requested', 201, { character: { ...mira, name: 'Mara' }, activeCharacterId: first, serverTime }],
  ['different preset than requested', 200, { character: { ...mira, presetId: 'dummy_tied' }, activeCharacterId: first, serverTime }],
  ['different form than requested', 200, { character: { ...mira, form: 'neutral' }, activeCharacterId: first, serverTime }],
])('rejects a creation response with %s', async (_label, status, value) => {
  const { client, transport } = setup();
  transport.mockResolvedValueOnce(response(status, value));
  await expect(client.create(token, input)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test('switching rejects a listing that does not activate the chosen character', async () => {
  const { client, transport } = setup();
  transport.mockResolvedValueOnce(response(200, listing));
  await expect(client.activate(token, first)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test.each([
  ['missing request ID', { name: 'Mira', presetId: 'dummy_braid', form: 'feminine' }],
  ['uppercase request ID', { ...input, requestId: requestId.toUpperCase() }],
  ['invalid name', { ...input, name: 'A' }],
  ['byte order mark name', { ...input, name: '\uFEFFMira' }],
  ['non-string name', { ...input, name: 7 }],
  ['malformed preset ID', { ...input, presetId: 'dummy-braid' }],
  ['unknown form', { ...input, form: 'other' }],
  ['extra field', { ...input, accountId: first }],
  ['null input', null],
])('refuses to send a creation with %s', async (_label, value) => {
  const { client, transport } = setup();
  await expect(client.create(token, value as CharacterCreationInput)).resolves.toEqual({ kind: 'invalid_request' });
  expect(transport).not.toHaveBeenCalled();
});

test.each([['uppercase', first.toUpperCase()], ['malformed', 'not-a-uuid'], ['non-string', 42]])('refuses to switch to a %s character ID', async (_label, value) => {
  const { client, transport } = setup();
  await expect(client.activate(token, value as string)).resolves.toEqual({ kind: 'invalid_request' });
  expect(transport).not.toHaveBeenCalled();
});

test('maps exact creation and switch errors and retains reauthentication', async () => {
  const { client, transport } = setup();
  for (const [status, code] of [[400, 'invalid_character_name'], [400, 'invalid_preset'], [409, 'character_limit_reached'], [409, 'idempotency_conflict'], [409, 'onboarding_incomplete']] as const) {
    transport.mockResolvedValueOnce(response(status, { error: { code } }));
    await expect(client.create(token, input)).resolves.toEqual({ kind: 'character_error', code });
  }
  transport.mockResolvedValueOnce(response(404, { error: { code: 'not_found' } }));
  await expect(client.activate(token, first)).resolves.toEqual({ kind: 'character_error', code: 'not_found' });
  transport.mockResolvedValueOnce(response(401, { error: { code: 'unauthenticated' } }));
  await expect(client.list(token)).resolves.toEqual({ kind: 'reauthenticate' });
});

test('does not map codes on the wrong endpoint, wrong status or with extra metadata', async () => {
  const { client, transport } = setup();
  const cases: [() => Promise<unknown>, number, unknown][] = [
    [() => client.create(token, input), 409, { code: 'invalid_character_name' }],
    [() => client.create(token, input), 400, { code: 'character_limit_reached' }],
    [() => client.create(token, input), 404, { code: 'not_found' }],
    [() => client.create(token, input), 409, { code: 'account_paused' }],
    [() => client.create(token, input), 400, { code: 'invalid_character_name', input: 'R2D2' }],
    [() => client.activate(token, first), 409, { code: 'character_limit_reached' }],
    [() => client.list(token), 404, { code: 'not_found' }],
  ];
  for (const [call, status, error] of cases) {
    transport.mockResolvedValueOnce(response(status, { error }));
    await expect(call()).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  }
});
