import * as Apple from 'expo-apple-authentication';

// Caller supplies fresh correlation values; the backend must verify/consume the nonce.
export type AppleRequest = { nonce: string; state: string };
export type AppleCredentialResult =
  | { kind: 'unverified'; identityToken: string }
  | { kind: 'cancelled' | 'unavailable' | 'failed' | 'invalid' };

export async function requestAppleCredential({ nonce, state }: AppleRequest): Promise<AppleCredentialResult> {
  if (!nonce.trim() || !state.trim()) return { kind: 'invalid' };
  try {
    if (!await Apple.isAvailableAsync()) return { kind: 'unavailable' };
    const credential = await Apple.signInAsync({ nonce, state, requestedScopes: [] });
    if (credential.state !== state || !credential.identityToken?.trim()) return { kind: 'invalid' };
    return { kind: 'unverified', identityToken: credential.identityToken };
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      return { kind: 'cancelled' };
    }
    return { kind: 'failed' };
  }
}
