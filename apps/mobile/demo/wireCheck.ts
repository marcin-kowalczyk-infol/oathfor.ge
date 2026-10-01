// DUMMY wire check (MVP-07-T11): the real proof client and upload path, sent to a local capture server instead of an API.
// The capture server is a developer script outside the repository. No API, account or secret is involved.
import type { AuthTransport } from '../src/api/auth';
import { createProofClient, type ProofClient } from '../src/proof/proofClient';

export const WIRE_CHECK_PORT = 18099;
// Plain HTTP passes the request guard only in a development bundle and only for a loopback host.
export const WIRE_CHECK_BASE_URL = `http://127.0.0.1:${WIRE_CHECK_PORT}`;
// DUMMY bearer in the 43-character session token format. It is not a credential and no server accepts it.
export const WIRE_CHECK_BEARER = 'DUMMY_wire_check_bearer_not_a_real_secret00';

/** Sends with the DUMMY bearer in place of the demo session token, so nothing from the session reaches the wire. */
export function createWireCheckProofClient(transport?: AuthTransport): ProofClient {
  const real = createProofClient({ baseUrl: WIRE_CHECK_BASE_URL, development: __DEV__, ...(transport ? { transport } : {}) });
  return { submit: (_bearer, oathId, submission, signal) => real.submit(WIRE_CHECK_BEARER, oathId, submission, signal) };
}
