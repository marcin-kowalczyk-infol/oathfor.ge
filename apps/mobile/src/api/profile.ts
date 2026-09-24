import type { AuthFailure } from './auth';
import { createBoundedRequest, exact, type ClientOptions } from './request';

export type Profile = {
  locale: null | 'pl' | 'en';
  timezone: null | string;
  intention: null | 'regular_activity';
  companionIntroduced: boolean;
  notificationPreference: null | 'enabled' | 'disabled';
};
export type ProfileEnvelope = { profile: Profile; onboardingStatus: 'pending' | 'complete' };
export type ProfilePatch = {
  locale?: 'pl' | 'en'; timezone?: string; intention?: 'regular_activity';
  companionIntroduced?: true; notificationPreference?: 'enabled' | 'disabled';
};
type ProfileFailure = { kind: 'invalid_value'; field: 'locale' | 'timezone' | 'intention' | 'notificationPreference' }
  | { kind: 'onboarding_incomplete' };
export type ProfileResult<T> = { kind: 'success'; value: T } | AuthFailure | ProfileFailure;

function isTimezoneIdentifier(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 128
    && (value === 'UTC' || /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+)+$/.test(value));
}

// The server owns its timezone catalog; device support gates new confirmation only.
export function isSupportedTimezone(value: unknown): value is string {
  if (!isTimezoneIdentifier(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; }
  catch { return false; }
}

const fields = ['locale', 'timezone', 'intention', 'companionIntroduced', 'notificationPreference'];
function validField(key: string, value: unknown, nativeTimezone = true): boolean {
  switch (key) {
    case 'locale': return value === 'pl' || value === 'en';
    case 'timezone': return nativeTimezone ? isSupportedTimezone(value) : isTimezoneIdentifier(value);
    case 'intention': return value === 'regular_activity';
    case 'companionIntroduced': return value === true;
    case 'notificationPreference': return value === 'enabled' || value === 'disabled';
    default: return false;
  }
}
function isProfileEnvelope(value: unknown): value is ProfileEnvelope {
  if (!exact(value, ['profile', 'onboardingStatus']) || !exact(value.profile, fields)
    || (value.onboardingStatus !== 'pending' && value.onboardingStatus !== 'complete')) return false;
  const profile = value.profile;
  const valid = fields.every(key => key === 'companionIntroduced' ? typeof profile[key] === 'boolean'
    : profile[key] === null || validField(key, profile[key], false));
  return valid && (value.onboardingStatus !== 'complete' || fields.every(key => validField(key, profile[key], false)));
}

export function createProfileClient(options: ClientOptions) {
  const request = createBoundedRequest<ProfileFailure>(options, (path, status, code) => {
    if (path === '/api/onboarding/complete' && status === 409 && code === 'onboarding_incomplete') return { kind: 'onboarding_incomplete' };
    if (path === '/api/profile' && status === 400) {
      const invalidFields = { invalid_locale: 'locale', invalid_timezone: 'timezone', invalid_intention: 'intention', invalid_notification_preference: 'notificationPreference' } as const;
      if (typeof code === 'string' && Object.hasOwn(invalidFields, code)) return { kind: 'invalid_value', field: invalidFields[code as keyof typeof invalidFields] };
    }
    return undefined;
  });
  return {
    get: (token: string, signal?: AbortSignal): Promise<ProfileResult<ProfileEnvelope>> => request('/api/profile', 'GET', 200, isProfileEnvelope, undefined, token, signal),
    patch: (token: string, patch: ProfilePatch, signal?: AbortSignal): Promise<ProfileResult<ProfileEnvelope>> => {
      if (!patch || typeof patch !== 'object' || Array.isArray(patch) || Object.keys(patch).length === 0
        || !Object.entries(patch).every(([key, value]) => validField(key, value))) return Promise.resolve({ kind: 'invalid_request' });
      return request('/api/profile', 'PATCH', 200, isProfileEnvelope, JSON.stringify(patch), token, signal);
    },
    complete: (token: string, signal?: AbortSignal): Promise<ProfileResult<ProfileEnvelope>> => request('/api/onboarding/complete', 'POST', 200,
      (value): value is ProfileEnvelope => isProfileEnvelope(value) && value.onboardingStatus === 'complete', '{}', token, signal),
  };
}
export type ProfileClient = ReturnType<typeof createProfileClient>;
