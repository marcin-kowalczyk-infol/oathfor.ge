import { createProfileClient, type ProfilePatch } from './profile';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
const token = 'A'.repeat(43);
const empty = { profile: { locale: null, timezone: null, intention: null, companionIntroduced: false, notificationPreference: null }, onboardingStatus: 'pending' };
const filled = { profile: { locale: 'pl', timezone: 'Europe/Warsaw', intention: 'regular_activity', companionIntroduced: true, notificationPreference: 'disabled' }, onboardingStatus: 'complete' };
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
function setup(status = 200, value: unknown = empty) {
  const transport = jest.fn().mockResolvedValue(response(status, value));
  return { transport, client: createProfileClient({ baseUrl: 'https://api.example.test', transport }) };
}

test('reads null defaults, patches only chosen fields and completes with the exact protected contracts', async () => {
  const { client, transport } = setup();
  await expect(client.get(token)).resolves.toEqual({ kind: 'success', value: empty });
  transport.mockResolvedValueOnce(response(200, { ...filled, onboardingStatus: 'pending' }));
  await expect(client.patch(token, { locale: 'pl', timezone: 'Europe/Warsaw' })).resolves.toMatchObject({ kind: 'success' });
  transport.mockResolvedValueOnce(response(200, filled));
  await expect(client.complete(token)).resolves.toEqual({ kind: 'success', value: filled });
  expect(transport.mock.calls.map(([url, init]) => [url, init.method, init.body, init.headers.Authorization])).toEqual([
    ['https://api.example.test/api/profile', 'GET', undefined, `Bearer ${token}`],
    ['https://api.example.test/api/profile', 'PATCH', '{"locale":"pl","timezone":"Europe/Warsaw"}', `Bearer ${token}`],
    ['https://api.example.test/api/onboarding/complete', 'POST', '{}', `Bearer ${token}`],
  ]);
});

test('rejects malformed responses and complete status with missing required choices', async () => {
  const { client, transport } = setup();
  for (const invalid of [{ ...empty, extra: true }, { ...empty, onboardingStatus: 'complete' },
    { ...empty, profile: { ...empty.profile, timezone: 'Europe/Warsaw\n' } },
    { ...empty, profile: { ...empty.profile, notificationPreference: 'denied' } },
    { ...empty, profile: { ...empty.profile, accountId: 'DUMMY' } }]) {
    transport.mockResolvedValueOnce(response(200, invalid));
    await expect(client.get(token)).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
  }
});

test('rejects empty, unknown, null, false and invalid timezone patches before transport', async () => {
  const { client, transport } = setup();
  for (const invalid of [{}, null, { accountId: 'DUMMY' }, { locale: null }, { companionIntroduced: false },
    { timezone: 'Invalid/Zone' }, { timezone: 'Europe/Warsaw\n' }, { timezone: 'ą'.repeat(129) }]) {
    await expect(client.patch(token, invalid as ProfilePatch)).resolves.toEqual({ kind: 'invalid_request' });
  }
  expect(transport).not.toHaveBeenCalled();
});

test('maps only exact safe endpoint errors and retains reauthentication', async () => {
  const { client, transport } = setup();
  for (const [code, field] of [['invalid_locale', 'locale'], ['invalid_timezone', 'timezone'], ['invalid_intention', 'intention'], ['invalid_notification_preference', 'notificationPreference']]) {
    transport.mockResolvedValueOnce(response(400, { error: { code } }));
    await expect(client.patch(token, { locale: 'en' })).resolves.toEqual({ kind: 'invalid_value', field });
  }
  transport.mockResolvedValueOnce(response(409, { error: { code: 'onboarding_incomplete' } }));
  await expect(client.complete(token)).resolves.toEqual({ kind: 'onboarding_incomplete' });
  transport.mockResolvedValueOnce(response(401, { error: { code: 'unauthenticated' } }));
  await expect(client.get(token)).resolves.toEqual({ kind: 'reauthenticate' });
  transport.mockResolvedValueOnce(response(400, { error: { code: 'invalid_locale', input: 'DUMMY' } }));
  await expect(client.patch(token, { locale: 'en' })).resolves.toEqual({ kind: 'unavailable', retry: 'request' });
});

test.each(['pending', 'complete'])('reads a server-confirmed timezone unsupported by native Intl for %s accounts', async onboardingStatus => {
  const original = Intl.DateTimeFormat;
  const native = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locales, options) => {
    if (options?.timeZone === 'Europe/Warsaw') throw new RangeError('Unsupported on this device');
    return new original(locales, options);
  });
  try {
    const value = { ...filled, onboardingStatus };
    const { client, transport } = setup(200, value);
    await expect(client.get(token)).resolves.toEqual({ kind: 'success', value });
    await expect(client.patch(token, { timezone: 'Europe/Warsaw' })).resolves.toEqual({ kind: 'invalid_request' });
    expect(transport).toHaveBeenCalledTimes(1);
  } finally { native.mockRestore(); }
});
