# Initial API contract

Implemented in MVP-02-T03. Local contract decision, 2026-09-23.

`GET /api/health` is public and returns HTTP **200**, `Content-Type: application/json`, and exactly:

```json
{"status":"ok"}
```

This endpoint reports process liveness. It does not query PostgreSQL, Redis, workers or external providers and does not report dependency readiness. It returns no environment, version, credentials or diagnostic fields. No authentication or product behavior is implied by this synthetic connectivity endpoint.

Consumers must check the HTTP status and validate the JSON object before displaying success. Network errors, unsuccessful responses or invalid payloads are recoverable connectivity errors, not player outcomes. The Expo diagnostic shell implements this validation; native-device acceptance remains pending. Local boundary rule: [architecture](architecture.md).

Producer verification: `composer test -- --filter HealthEndpointTest` from `apps/api`, using a real Symfony test kernel without database/queue adapters. A local HTTP server check is documented in [development](development.md) when verified.

## Planned authentication contract

**Status: challenge issuance and transactional one-use storage implemented in MVP-04-T04; internal signature/claims and trusted-key verification implemented in T05. Exchange, identity read and session deletion remain planned. Local decisions, 2026-09-24, under [ADR 0003](../decisions/0003-apple-sign-in.md).** The anonymous challenge does not authenticate a user. Remaining sections fix the target contract and do not enable login.

### Transport and limits

Production uses HTTPS and JSON objects with exactly the documented request fields. Authentication responses use `Cache-Control: no-store`; errors have exactly `{"error":{"code":"reason_code"}}` without provider text or credentials. All timestamps are UTC RFC3339 whole seconds (`YYYY-MM-DDTHH:mm:ssZ`), derived from an injected server clock. Expiry comparisons use integer Unix seconds with zero grace. Public health remains independent of auth configuration and dependencies.

Reject wrong content type with 415 `unsupported_media_type`, malformed/wrong-shaped/unknown-field input with 400 `invalid_request`, and bodies over 16 KiB with 413 `request_too_large`. `identityToken` is a nonblank string at most 12 KiB; `authorizationCode` is a nonblank string at most 2048 bytes. Reject oversized requests before JSON/token parsing. Authentication never accepts credentials from query parameters or logs request bodies/Authorization headers. The later session slice uses only `Authorization: Bearer <token>` for protected routes. These bounds are local abuse controls under [security rules](../../.agents/rules/security.md).

Challenge issuance and exchange each allow 10 requests per source IP per UTC minute and 1000 globally per UTC minute (separate counters per route, all attempts count). Use atomic PostgreSQL counters, hashed IP buckets and expiry cleanup; only configured trusted proxies may supply forwarding addresses, otherwise use the direct peer. Saturation returns 429 `rate_limited` with integer `Retry-After` seconds to the next minute. Dependency outage returns 503 `temporarily_unavailable`, never bypasses a limit. These local initial limits bound database/provider work; they are not capacity claims. Cleanup removes minute buckets older than one hour and challenge rows expired more than one day ago, in batches of at most 1000 per issuance; expired rows never become valid while awaiting cleanup.

### Challenge and exchange

| Request | Success | Failure specific to the route |
| --- | --- | --- |
| `POST /api/auth/apple/challenges`, body `{}` | 201 with `challengeId`, `nonce`, `state`, `expiresAt` | 503 dependency failure; 429 limits |
| `POST /api/auth/apple/exchange`, body `{challengeId, identityToken, authorizationCode}` | 200 with `account` and `session` below | 401 `invalid_credential`; 409 `challenge_unavailable`; 503 `temporarily_unavailable`; 429 limits |
| `GET /api/me`, bearer required | 200 with `account` below | 401 `unauthenticated`; 503 `temporarily_unavailable` |
| `DELETE /api/auth/session`, bearer required, no body | 204, no body | 401 `unauthenticated` for missing/malformed bearer; 503 `temporarily_unavailable` |

`challengeId`, `nonce` and `state` are independently generated from 32 cryptographically random bytes, encoded as 43-character unpadded base64url strings. A challenge expires at issuance + 300 seconds. Persist its ID, SHA-256 nonce digest, creation/expiry and nullable consumption time in PostgreSQL. State is a mobile/provider correlation value and need not be persisted. Collision inserts must not overwrite existing challenges; generate another set on collision, with at most three attempts then 503.

The client passes nonce and state unchanged to Expo. It checks returned state exactly and sends only the three exchange fields above; it never supplies account ID, Apple user ID, email or an expected nonce. The verifier reads the signed nonce and compares its SHA-256 digest to the server challenge, using constant-time comparison. The caller cannot choose the expected nonce. Unknown, consumed or `now >= expiresAt` challenges all yield `challenge_unavailable`; wrong signed nonce yields `invalid_credential`. Neither response reveals an account.

A valid exchange response has exactly:

```json
{
  "account": {"id":"server-uuid", "onboardingStatus":"pending"},
  "session": {"token":"opaque-base64url", "expiresAt":"2026-10-24T12:00:00Z"}
}
```

Values here are schematic, not usable fixtures. `account.id` is a server-generated UUID; `onboardingStatus` is `pending` or `complete`, stored on the account. `GET /api/me` returns exactly `{"account":{...}}`. A returning account preserves its ID and onboarding status; first sign-in creates `pending`. No email/name claims are required or stored for identity. The sole identity key is verified issuer `https://appleid.apple.com` plus nonblank subject (at most 255 bytes), protected by a unique database constraint.

### Verification and key availability

Use `firebase/php-jwt:^7.2` for RS256 signatures, with an application allowlist restricted to RSA signing keys from exactly `https://appleid.apple.com/auth/keys`. Ignore token-supplied URLs; reject unsupported algorithms, missing/blank `kid` (maximum 128 bytes), malformed tokens and unrecognized critical headers. The trusted configured audience is one exact native bundle identifier (`APPLE_CLIENT_ID`), never a client request value; no wildcard/Expo Go fallback. Missing/blank/DUMMY production configuration fails closed with 503.

After signature verification require: exact issuer; string audience equal to configured client ID; nonblank string subject; 43-character base64url nonce matching the challenge digest; integer `iat` and `exp` with `0 <= iat <= now < exp` and `iat < exp`. If present, integer `nbf` must satisfy `0 <= nbf <= now`. No clock leeway or maximum token age beyond signed expiry and live challenge. Reject email-only identity, altered signatures, arrays in scalar claims, missing claims and token-selected trust sources. Fix the library clock to the injected time per verification and restore mutable library settings afterward. Verification returns a typed verified identity or safe invalid/unavailable result, never decoded-only identity. Technical basis and dependency compatibility are recorded in [ADR 0003](../decisions/0003-apple-sign-in.md#authentication-contract-selected-for-implementation).

Use a shared filesystem cache/lock on the initial single API host. A successful validated JWKS snapshot lives 6 hours; never use an expired snapshot. Limit the response to 64 KiB and 10 keys; require unique nonblank key IDs, `kty=RSA`, `use=sig`, `alg=RS256`, usable RSA modulus/exponent with at least 2048-bit keys. A malformed snapshot is unavailable and does not replace a valid cache. Fetch only the fixed HTTPS URL with TLS verification, zero redirects, a 2-second idle timeout and 5-second total deadline, no automatic retries. Cache read/write/lock failure yields unavailable.

A known key in a fresh cache requires no network. An unknown `kid` triggers at most one refresh, globally no more than once per 60 seconds (including failed fetches), under the shared lock. Other consumers re-read the snapshot; a fetch in progress or refresh cooldown that prevents resolution yields unavailable. A successful refresh that still lacks `kid` yields invalid credential. When that successful snapshot is already in cooldown, an absent key is likewise invalid; a cooldown following failure is unavailable. Failed refresh never invalidates still-fresh known keys. Zero/expired cache plus failed fetch is unavailable, not invalid identity. No key endpoint calls occur in ordinary tests; synthetic DUMMY keys and a fake HTTP transport exercise rotation/outages.

### Transactions, retry and provider exchange

Validate input, limits, challenge and native identity token before calling Apple. Require a nonempty authorization code and use backend-only credentials at `https://appleid.apple.com/auth/token`, never a client URL. Validate the exchanged ID token's signature/issuer/audience/time/nonce and require the same subject as the native token. Refresh token must be nonempty before issuing an app session. Use the same HTTP timeout/redirect bounds as JWKS, at most 64 KiB response, and no automatic retry of a one-use code. Invalid code/identity is 401; transport errors, malformed provider success, rate limits and server configuration/provider failures are 503. Provider credential material must not appear in logs or errors. See [Apple exchange and secret handling](../decisions/0003-apple-sign-in.md#provider-credentials-and-deletion).

After provider verification, execute one database transaction: atomically consume the still-live challenge, insert/reuse the unique identity/account, reject deleting/deleted accounts, persist encrypted provider credential, and create the app session. Concurrent first logins with different challenges reuse one account via the unique identity constraint; each successful login may create its own session. Concurrent exchange of the same challenge yields at most one session. Lock the account when checking deletion and issuing a session so deletion and issuance cannot cross. Challenge consumption and local writes roll back together on database failure. The challenge repository requires a caller-owned transaction and never commits it.

Apple's code consumption cannot roll back with PostgreSQL. If provider success is followed by database failure or an ambiguous network response, do not report login success or automatically replay the code. Return 503 if possible and request a fresh challenge/native login. Do not revoke Apple authorization as rollback cleanup because it could revoke another device's valid grant. An unpersisted provider credential is discarded; account deletion/revocation acceptance must exercise subsequent fresh authorization recovery. This is an explicit distributed-transaction limitation, not an atomicity claim about Apple.

A lost successful API response cannot recover the bearer token: replay encounters a consumed challenge and gets 409. The client starts a fresh native login. The unknown prior session expires at its original fixed deadline or is revoked by account deletion; no token receipt is stored for replay. Failed signature/input/challenge checks create no account/session/provider writes. A provider failure consumes no local challenge, but the client still starts a fresh attempt because code use may be uncertain. All session issuance paths recheck expiry at transaction time.

### App session and sign-out

The bearer is 32 random bytes as 43-character unpadded base64url; store only its SHA-256 digest, account, issued time, expiry and nullable revocation time. At issuance `expiresAt = now + 2592000` seconds (30 elapsed days). Access requires `now < expiresAt`, no revocation and an active account. Requests, provider refresh and onboarding never extend expiry. Missing/unknown/expired/revoked/deleted-account credentials all produce 401 `unauthenticated`; outages produce 503. Do not leak which denial occurred. UUIDs identify accounts, never authenticate them.

Session deletion marks only the presented session revoked, idempotently. Syntactically valid but unknown/expired/already-revoked bearer also returns 204, preventing logout retries from needing an active session. No cookie/query token transport. Other device sessions remain valid; logout does not call Apple's provider revoke endpoint. The mobile pending-revocation envelope and failed-storage behavior are specified in [ADR 0003](../decisions/0003-apple-sign-in.md#mobile-storage-and-recovery). A local UI transition or a timeout is not a server-revocation receipt.

### Configuration and test gates

Planned backend configuration: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH`, and a private versioned provider-encryption keyring/current key ID. The Apple client secret is an ES256 JWT signed with the private key, with team issuer, client-ID subject, Apple audience and a 5-minute lifetime. Obtain real values privately before enabling exchange; never put them in `EXPO_PUBLIC_*` or committed fixtures. Missing deployment values fail closed. T04 can issue anonymous challenges without Apple configuration; T05 can exercise a test-only audience and synthetic keys without enabling exchange.

Runtime acceptance must include replay/concurrent consumption/rollback, exact expiry, token tampering and key outages, concurrent account reuse/deletion, provider-code ambiguity, restart/failed persistence/offline sign-out, and real signed-device Apple compatibility. DUMMY tests establish local behavior only. Live provider calls and external console changes require separate authorization.
