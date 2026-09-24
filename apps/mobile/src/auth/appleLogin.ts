import type { AuthClient } from '../api/auth';
import { requestAppleCredential } from './appleCredential';
import type { Authentication } from './session';

export function createAppleAuthentication(api: AuthClient): Authentication {
  return async signal => {
    if (signal.aborted) return { kind: 'cancelled' };
    const challenge = await api.challenge(signal);
    if (signal.aborted) return { kind: 'cancelled' };
    if (challenge.kind !== 'success') return challenge;
    const credential = await requestAppleCredential(challenge.value);
    if (signal.aborted || credential.kind === 'cancelled') return { kind: 'cancelled' };
    if (credential.kind !== 'unverified') return { kind: 'unavailable', retry: 'fresh_login' };
    return api.exchange({ challengeId: challenge.value.challengeId, identityToken: credential.identityToken, authorizationCode: credential.authorizationCode }, signal);
  };
}
