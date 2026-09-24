import { createProfileClient } from '../api/profile';
import { createAuthClient } from '../api/auth';
import { createAppleAuthentication } from './appleLogin';
import { createSessionController } from './session';
import { secureSessionStorage } from './sessionStorage';

function createRuntime() {
  const api = createAuthClient({ baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '', development: __DEV__ });
  const profileApi = createProfileClient({ baseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? '', development: __DEV__ });
  return { profileApi, controller: createSessionController({ api, storage: secureSessionStorage }), authenticate: createAppleAuthentication(api) };
}
let runtime: ReturnType<typeof createRuntime> | undefined;

export function getSessionRuntime() {
  // One app-lifetime owner, retained across localization/account subtree changes.
  runtime ??= createRuntime();
  return runtime;
}
