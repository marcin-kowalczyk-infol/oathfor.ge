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

**Status: challenge issuance and transactional one-use storage implemented in MVP-04-T04; internal signature/claims and trusted-key verification implemented in T05. Internal code exchange implemented in T08. T09 implements account/session persistence, identity read and current-session deletion; T10 implements public login exchange with signed synthetic integration tests. Real provider/mobile acceptance remains pending. Local decisions, 2026-09-24, under [ADR 0003](../decisions/0003-apple-sign-in.md).** The anonymous challenge does not authenticate a user. The runtime requires valid private provider configuration; no production dummy authentication mode exists.

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

A lost successful API response cannot recover the bearer token: replay encounters a consumed challenge and gets 409. The client starts a fresh native login. The unknown prior session expires at its original fixed deadline or is revoked by account deletion; no token receipt is stored for replay. Failed signature/input/challenge checks create no account/session/provider writes. A provider failure consumes no local challenge, but the client still starts a fresh attempt because code use may be uncertain. All session issuance paths recheck expiry at transaction time, including after waiting for the account lock and immediately before inserting the session.

### App session and sign-out

The bearer is 32 random bytes as 43-character unpadded base64url; store only its SHA-256 digest, account, issued time, expiry and nullable revocation time. At issuance `expiresAt = now + 2592000` seconds (30 elapsed days). Access requires `now < expiresAt`, no revocation and an active account. Requests, provider refresh and onboarding never extend expiry. T11 maintenance checks active identities with live sessions at most once per24h; explicit provider invalid_grant revokes their sessions, while unavailable validation preserves only original expiry. Durable credential-generation/claim checks prevent stale provider results from changing a newer login. Missing/unknown/expired/revoked/deleted-account credentials all produce 401 `unauthenticated`; outages produce 503. Do not leak which denial occurred. UUIDs identify accounts, never authenticate them.

Session deletion marks only the presented session revoked, idempotently. Syntactically valid but unknown/expired/already-revoked bearer also returns 204, preventing logout retries from needing an active session. No cookie/query token transport. Other device sessions remain valid; logout does not call Apple's provider revoke endpoint. The mobile pending-revocation envelope and failed-storage behavior are specified in [ADR 0003](../decisions/0003-apple-sign-in.md#mobile-storage-and-recovery). A local UI transition or a timeout is not a server-revocation receipt.

### Configuration and test gates

Implemented internal verifier/exchange configuration: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH`, and a private versioned provider-encryption keyring/current key ID. The Apple client secret is an ES256 JWT signed with the private key, with team issuer, client-ID subject, Apple audience and a 5-minute lifetime. Obtain real values privately before enabling exchange; never put them in `EXPO_PUBLIC_*` or committed fixtures. Missing deployment values fail closed. T04 can issue anonymous challenges without Apple configuration; T05 can exercise a test-only audience and synthetic keys without enabling exchange.

Runtime acceptance must include replay/concurrent consumption/rollback, exact expiry, token tampering and key outages, concurrent account reuse/deletion, provider-code ambiguity, restart/failed persistence/offline sign-out, and real signed-device Apple compatibility. DUMMY tests establish local behavior only. Live provider calls and external console changes require separate authorization.


## Onboarding profile contract

Status: implemented in MVP-04-T16 with synthetic integration coverage, 2026-09-24; mobile onboarding is integrated through T20; real native acceptance remains pending. Product meaning and recovery follow [onboarding](../product/onboarding.md).

Local engineering choice: one account-owned profile row, defaults on account creation or deterministic absent-row defaults until first write. Account ID comes only from the authenticated session, never a request parameter. Reuse account lock when checking active state, mutating profile and completing onboarding; deletion cannot race past that check. Recheck session expiry/revocation after any account-lock wait before applying a mutation. No version/CAS subsystem. Partial updates merge only named fields under the row/account lock; different-field concurrent updates survive. For the same field the last serialized successful write wins, suitable for these preferences. Mobile serializes its own writes and refetches when resuming; no guarantee that another device cannot change the same preference.

`GET /api/profile`, authenticated, returns 200, exactly:

```json
{
  "profile": {
    "locale": null,
    "timezone": null,
    "intention": null,
    "companionIntroduced": false,
    "notificationPreference": null
  },
  "onboardingStatus": "pending"
}
```

Allowed values: locale `null | "pl" | "en"`; timezone `null | supported IANA identifier`; intention `null | "regular_activity"`; companionIntroduced boolean; notificationPreference `null | "enabled" | "disabled"`; onboardingStatus `pending | complete`. Null means no confirmed choice. Device suggestions never silently fill the persisted null values. No OS permission field, push token, nickname, health data, counters or numeric goal. The player's visible name belongs to a character, see the [player character contract](#player-character-contract), not to this profile.

`PATCH /api/profile` accepts a nonempty object containing any subset of `locale`, `timezone`, `intention`, `companionIntroduced`, `notificationPreference`; no wrapper/unknown keys. Each supplied value must be non-null and valid; companionIntroduced accepts only true (acknowledgment is monotonic), intention only regular_activity. Thus committed onboarding choices cannot be cleared through this endpoint. Locale/timezone/notificationPreference may subsequently change without reopening onboarding; no separate settings feature is added here. Apply all supplied fields atomically or none. Returns the same full 200 envelope as GET, including unchanged fields and current status.

Timezone validation is a local interoperability choice based on [PHP timezone identifiers](https://www.php.net/manual/en/datetimezone.listidentifiers.php) (checked 2026-09-24): use membership in PHP's `DateTimeZone::listIdentifiers(DateTimeZone::ALL)` (including UTC) plus constructibility; reject arbitrary offsets/abbreviations not in that list. Bound to 128 ASCII bytes. Preserve accepted identifier; do not silently replace a rejected device alias with a guessed zone. Mobile also verifies its own Intl.DateTimeFormat accepts a zone before confirmation; unsupported suggestions require explicit correction. UI offers device suggestion and manual IANA entry with visible example `Europe/Warsaw`; null/unsupported device suggestion requires explicit input. This is bounded functional selection, not a world timezone-search product. DST gap/duplicate scheduling resolution remains MVP-05 because onboarding chooses no local deadline.

`POST /api/onboarding/complete` accepts exactly `{}`. Under the same account/profile lock require non-null supported locale/timezone, regular_activity, companionIntroduced=true, and notificationPreference either enabled or disabled. OS permission is deliberately absent from the guard. If any requirement is missing: 409 `onboarding_incomplete`, no status mutation. Otherwise set account.onboarding_status to complete, keeping lifecycle account.status active, and return the full envelope, matching subsequent GET /api/me account status. Repeated completion returns 200 complete with no extra effects. Complete is monotonic and cannot activate an Oath or extend a session.

All endpoints reuse HTTPS/Bearer/no-store and safe error envelope `{"error":{"code":"..."}}`. Protected endpoints return 401 unauthenticated for invalid sessions/inactive accounts, 503 temporarily_unavailable for infrastructure failure. PATCH/complete apply the existing 16 KiB bound (413 request_too_large), JSON media type (415 unsupported_media_type), malformed/nonobject/unknown/empty PATCH/wrong-type input (400 invalid_request). Typed unsupported values return 400 invalid_locale, invalid_timezone, invalid_intention or invalid_notification_preference; false companionIntroduced is invalid_request. Only complete has 409 onboarding_incomplete. Never include raw invalid input, provider text, bearer or account details in errors. GET has no request body. No new rate-limiter design is needed beyond existing infrastructure controls.

## Player character contract

Status: `GET` and `POST /api/characters` implemented in MVP-17-T02, `PUT /api/characters/active` in MVP-17-T03 and character-owned Oaths with per-character pause in MVP-17-T04 and T05, with integration and race coverage, 2026-09-26. Owner starter presets and the `build` field implemented in the API and the mobile client in MVP-17-T13, 2026-09-27. The runtime image has no `ext-intl`, so NFC uses the declared `symfony/polyfill-intl-normalizer`. Local engineering contract, 2026-09-26, implementing the accepted [player character specification](../product/player-character.md) and [ADR 0005](../decisions/0005-character-owned-oaths.md). Existing Bearer, HTTPS, no-store, 16 KiB JSON bound, 415 media type check and safe error envelope apply. Unknown fields and wrong types return 400 `invalid_request`. Infrastructure failure returns 503 `temporarily_unavailable` with no partial write. Invalid, expired or revoked sessions return 401 `unauthenticated`. IDs use canonical lowercase UUID text, and a malformed ID in a body returns 400 `invalid_request`.

### Persistence and locking

A `player_character` row holds `id`, `account_id`, `slot`, `creation_request_id`, `name`, `preset_id`, `build`, `form`, `paused` and `created_at`. `build` is `thin` or `heavy`, enforced by a check constraint. Migration `Version20260927100000` made every existing character `thin`. `slot` is 1 to 3 and unique per account, a database backstop for the limit. `creation_request_id` is unique per account. `account.active_character_id` is nullable and references the account's own character through a composite key, so an account can never point at another account's character. Characters are listed in slot order. Deleting an account deletes its characters.

Every character request and every Oath read or write locks the account row first, then the session, then Oath rows in ID order where the operation needs them. Character rows are protected by the account lock and need no separate row lock. Authorization is rechecked at the fresh clock time after the locks. This keeps the [ADR 0004](../decisions/0004-oath-acceptance-and-reconciliation.md) order with no new lock hierarchy.

### Presets, builds, forms and names

The server owns the preset catalog in `apps/api/resources/character/presets_v2.json`, version `presets_v2`. IDs match `^[a-z0-9_]{1,64}$`. The catalog holds the owner's six starters, `starter_01` to `starter_06`, in that order. They replaced the four DUMMY presets of `presets_v1` in MVP-17-T13, 2026-09-27. A stored character keeps its preset ID, so a character's `presetId` may be absent from the current `presets` list, for example an old `dummy_braid`. Clients must accept that and draw a neutral placeholder.

`build` is `thin` or `heavy`. Each preset identity comes in both builds, and the player chooses the build separately at creation. Like `form`, the build set is fixed and the server does not list it. **Local decision: owner instruction, 2026-09-27.**

`form` is `masculine`, `feminine` or `neutral`. It selects Polish grammatical variants and is independent of the preset look and build.

Name rule, local decision 2026-09-26:

1. Trim Unicode whitespace at both ends, then normalize to NFC.
2. Require 2 to 20 code points.
3. Require letters (`\p{L}` with following `\p{M}` marks), with at most one separator between two letters. Separators are space U+0020, hyphen U+002D, apostrophe U+0027 and right single quotation mark U+2019. iOS smart punctuation types U+2019 for an apostrophe.

The normalized name is stored and returned. There is no uniqueness check and no word filter in MVP. Examples: `Mira`, `Żaneta`, `Anne-Marie`, `O'Brien`, `O’Brien` and `Jan Kowalski` are valid. `A`, `Anna  Maria`, `Anna-`, `R2D2`, 21 letters and emoji are invalid.

### Endpoints

`GET /api/characters` has no query or body and returns 200:

```json
{
  "characters": [
    {"id": "<UUID>", "name": "Mira", "presetId": "starter_01", "build": "thin", "form": "feminine", "createdAt": "<UTC>"}
  ],
  "activeCharacterId": "<UUID>",
  "limit": 3,
  "presets": ["starter_01", "starter_02", "starter_03", "starter_04", "starter_05", "starter_06"],
  "serverTime": "<UTC>"
}
```

`activeCharacterId` is null until the first character exists. Every character object in the create, list and switch answers is exactly `{id, name, presetId, build, form, createdAt}`.

`POST /api/characters` accepts exactly:

```json
{"requestId": "<UUID>", "name": "Mira", "presetId": "starter_01", "build": "heavy", "form": "feminine"}
```

The client creates and stores `requestId` before the first send and reuses it for every retry of that creation. Shape, build, form and the name rule are validated before the transaction. Order inside the locked transaction:

1. Look up the account's `requestId`. The same normalized name, preset, build and form return 200 `{"character":{...},"activeCharacterId":"<UUID>","serverTime":"<UTC>"}` with the original character and the current active ID. A replay never changes the active character. A different payload returns 409 `idempotency_conflict`.
2. Require a preset ID from the current catalog, otherwise 400 `invalid_preset`. A replay in step 1 skips this check, so a stored creation still resolves after the catalog changes.
3. Require completed onboarding, otherwise 409 `onboarding_incomplete`.
4. Require fewer than 3 characters, otherwise 409 `character_limit_reached`.
5. Insert the character in the next slot, make it active and return 201 in the same shape.

A name error returns 400 `invalid_character_name` with no write. A missing, extra or unknown `build` and an unknown form value are 400 `invalid_request`.

`PUT /api/characters/active` accepts exactly `{"characterId":"<UUID>"}` and returns 200 in the GET shape. An unknown ID or another account's character returns 404 `not_found`. Choosing the already active character returns 200 with no change.

Creating or switching characters grants no XP, reward or unlock and writes nothing outside the character rows and the account's active character.

### Character-owned Oaths

Status: implemented in MVP-17-T04 and T05, 2026-09-26. These rules replace the account-scoped wording in the [original Oath contract](#original-oath-contract).

- `oath_preview` and `oath` carry a required `character_id` of the same account. An Oath also references its preview together with that preview's character, so it cannot move to another character. Local test Oaths, previews and acceptance requests are deleted by the migration because no production data exists.
- Without an active character, `POST /api/oath-previews`, `GET /api/oaths`, `GET /api/oaths/{id}`, `GET /api/oath-pause` and `POST /api/oath-pause` return 409 `character_required` after authentication. Preview creation checks onboarding first.
- A new preview belongs to the active character. Preview envelopes carry the preview's character at the top level, for example `{"preview":{...},"characterId":"<UUID>","serverTime":"<UTC>"}` on create and `{"preview":{...},"characterId":"<UUID>","oathId":null}` on read. The Oath representation gains `"characterId":"<UUID>"`.
- `POST /api/oaths` creates the Oath for the preview's character, even if the active character changed after the preview. The preview character's pause state gates a new commitment. Replay rules are unchanged.
- `GET /api/oath-previews/{id}` stays account-scoped, so a pending acceptance can be recovered after a switch.
- The list envelope and the pause envelope gain `"characterId":"<UUID>"` of the active character, so a device with a stale active character can notice the difference.
- Lists and detail show only the active character's Oaths. Another character's Oath in the same account returns 404 `not_found`. The list cursor also binds the character, so a cursor from one character returns 400 `invalid_request` for another.
- Pause belongs to the active character. The revision binds the character, its pause state and its affected commitments. Pause withdraws only that character's scheduled and active Oaths. `POST /api/oath-pause` also requires `"characterId"`, for example `{"characterId":"<UUID>","paused":true,"revision":"<opaque>"}` or `{"characterId":"<UUID>","paused":false}`. If it differs from the active character, the answer is 409 `character_changed` with no effect. The migration drops `account.gameplay_paused`, and `player_character.paused` becomes the only pause source. Services read the character's pause flag in a separate query after the account lock, so a pause committed during a lock wait is never missed. The error code and withdrawal reason `account_paused` become `character_paused`.
- Due reconciliation still locks and reconciles all Oaths of the account, because the account remains the serialization unit.

Mobile storage choices, local decision 2026-09-26: a pending acceptance is stored per account and character as `{version:2, accountId, characterId, previewId, requestId}`. Older version 1 records are ignored. A pending character creation is stored per account as `{version:2, accountId, requestId, name, presetId, build, form}` before the first send and cleared after a decisive answer. Version 1 records use another key and are never read, local decision 2026-09-27.

## Original Oath contract

Status: immutable previews, explicit acceptance, owner-only reads and durable activation/unknown-availability cutoff reconciliation and revision-confirmed pause/resume are implemented. Since MVP-17 Oaths and pause belong to a character, see [character-owned Oaths](#character-owned-oaths), which overrides account-scoped wording in this section. Deployment scheduling and downstream receipt/review/outcome acceptance remain pending. Local engineering contract, 2026-09-25, implementing [accepted original-Oath choices](../product/oaths.md) and [first-loop policies](../product/first-loop.md). Existing Bearer/HTTPS/no-store, 16 KiB JSON request limit and safe error envelope apply. Never accept a client account ID, reward amount, state or authoritative timestamp. Unknown fields and wrong types return 400 `invalid_request`; infrastructure failure returns 503 `temporarily_unavailable`, with no partial writes.

### Local time representation

A local time is exactly `{"local":"2026-10-25T02:30:00","timezone":"Europe/Warsaw","offset":"+02:00"}`. `local` is a strict Gregorian `YYYY-MM-DDTHH:mm:ss`, year 0001–9999; no fractions, offset suffix, normalization, leap seconds or whitespace. `timezone` uses the existing profile identifier contract. `offset` may be omitted for an unambiguous time; when supplied it is exactly `+HH:MM` or `-HH:MM`, hours 00–23, minutes 00–59, and must match a real occurrence in that zone. UTC uses `+00:00`; reject `-00:00`. Resolve both activation and deadline independently; they may have different zones.

Validation order is shape/local syntax/calendar, zone, offset syntax, occurrence. Return 400 `invalid_local_time`, `invalid_timezone`, `invalid_offset`, `nonexistent_local_time`, `ambiguous_local_time` or `offset_mismatch`, with a safe `field` of `activation` or `deadline` for these errors. For `ambiguous_local_time` include `validOffsets` derived by the server; never select one automatically. PHP timezone history can contain second-based offsets: if the selected occurrence cannot be represented by this minute-offset contract, return `unsupported_time_offset` rather than rounding or silently excluding an occurrence. No client-supplied offset is trusted as a UTC conversion.

Resolved value: `{"local":"2026-10-25T02:30:00","timezone":"Europe/Warsaw","offset":"+02:00","utc":"2026-10-25T00:30:00Z"}`. Preserve whether an offset was explicitly supplied as `explicitOffset` (boolean). Deadline additionally has `receiptCutoff":"2026-10-25T00:45:00Z"`. S is exactly 900 elapsed seconds after D, including DST changes. These values are immutable. A resolver does not enforce a future deadline itself; creation compares resolved instants with authoritative transaction time. A derived instant outside the four-digit wire year range is `invalid_local_time`.

### Preview and confirmation

`POST /api/oath-previews` accepts exactly:

```json
{
  "activity": "running",
  "activation": {"mode": "scheduled", "time": {"local": "2026-10-25T01:00:00", "timezone": "Europe/Warsaw"}},
  "deadline": {"local": "2026-10-25T02:30:00", "timezone": "Europe/Warsaw", "offset": "+02:00"}
}
```

For now use exactly `"activation":{"mode":"now"}`. Activity is one of `running`, `strength_training`, `mobility`; unsupported activity is 400 `invalid_activity`. A scheduled start must be strictly after the server's locked check time; otherwise 409 `activation_elapsed`. D must be strictly after scheduled activation, or after check time for now; otherwise 409 `deadline_not_after_activation`. Preview requires active authentication, completed onboarding and unpaused gameplay. Missing onboarding returns 409 `onboarding_incomplete`; pause returns 409 `account_paused`.

Return 201 `{"preview":{"id":"<UUID>","snapshot":{...}},"serverTime":"<UTC>"}`. Persist an owner-owned immutable preview of resolved choices and complete versioned bilingual rules, not just a pointer to mutable catalog text. The snapshot's `activation` retains mode and resolved time (null for now until commitment). It includes `templateVersion`, `policyVersion`, `activity`, `deadline`, `evidence`, `rewards`, `consequences`, `pause`, `recovery`, `review`, `copy` (`pl`/`en`). The exact policy fields and bilingual text are defined by the versioned [catalog](../../apps/api/resources/oath/workout_oath_v1.json); the mobile transport validates this known version, its policy values and copy shape before exposing it to screens. First template version is `workout_oath_v1`; reward policy is `workout_rewards_v1`. The snapshot copies the catalog object, adds `activity` (stable ID), `activation` (`{mode,time}`), and the resolved `deadline`; each `copy.pl`/`copy.en` object has `title`, `subtitle`, `promise`, `declaration`, `activity` (localized label) and `sections` (stable string keys: activation, timing, evidence, photo, activityRecord, privacy, rewards, consequence, pause, recovery, review, appeal). The catalog-only `activities` lookup is omitted from snapshots. Promise placeholders are exactly `{activity}` and `{deadline}` in both languages; consumers format from the same snapshot. Policy objects contain JSON booleans, integer amounts/durations, stable strings and arrays as shown in the catalog.

Persisted previews have no arbitrary time-to-live; unaccepted previews become unusable when their chosen time is no longer valid or their policy is replaced. Account deletion owns cleanup. Creating several previews has no game effects.

`POST /api/oaths` accepts exactly `{"previewId":"<UUID>","requestId":"<UUID>","accepted":true}`. IDs use canonical lowercase UUID text. An account-scoped request ID identifies one acceptance attempt; the client persists it with preview ID before sending and retains it across retry/restart. In one transaction:

1. Lock account then session; recheck active account, nonrevoked unexpired session against fresh server time. Deleted/inactive account and invalid/expired session return 401 `unauthenticated` even for replay.
2. Look up the owner's request ID. Same preview/acceptance returns 200 with the original commitment's current state; different payload returns 409 `idempotency_conflict`. Replaying the same accepted preview under a new request ID returns that same commitment (200) and binds the new ID. Another owner's or absent preview returns indistinguishable 404 `not_found`.
3. For a new commitment require completed onboarding, unpaused gameplay and the current policy version. Superseded preview returns 409 `preview_superseded`; explicit fresh preview/acceptance is required. Recheck resolved future start and deadline after locks using the same errors as preview. No new write on these failures.
4. Persist one Oath, immutable copied snapshot and request mapping atomically, uniquely by owner/preview and owner/request ID. `now` activation is the transaction's fresh check time; derive its local representation in deadline.timezone. State is `active` for now, `scheduled` for future. Return 201 `{"oath":{...},"serverTime":"<UTC>"}`. No XP or evidence receipt is created.

Before a commitment success response, reconcile due state under the same locks. Replays do not revalidate old scheduling or current policy and may return a withdrawn or review-pending commitment. Concurrent confirmations cannot create duplicates. Conflicting payloads, database rollback and response loss cannot partially consume an acceptance. No PATCH/PUT rule endpoint exists; unsupported methods have framework 405 behavior.

`GET /api/oath-previews/{id}` returns the owner's persisted preview and nullable `oathId` (200). This supports retry reconciliation after restart, including paused accounts. Another owner/missing ID returns 404. `POST /api/oaths` with the persisted identity remains the decisive retry; failed/unknown networking must never lead the client to invent a new acceptance identity.

Mobile retry identity choice (local engineering decision, 2026-09-25): use the validated preview UUID as the request UUID. Persist its account/preview/request identifiers on explicit confirmation before the first acceptance request. This is not a consent shortcut: choosing or saving a preview alone must never accept it. Retain unresolved delivery across restart and same-account reauthentication; resolve it before replacing the pending identity with another confirmation.

### Protected reads and pause

`GET /api/oaths/{id}` returns 200 `{"oath":{"id":"<UUID>","state":"scheduled", "snapshot":{...},"createdAt":"<UTC>","activatedAt":null,"terminalAt":null,"reason":null,"review":null},"serverTime":"<UTC>"}` after due reconciliation. `review` is null until review entry, then `{"enteredAt":"<UTC>","closesAt":"<UTC>"}` with the fixed 72-hour clock. The clock is exposed for downstream review handling; T06 does not perform terminal review closure. `activatedAt` records effective committed activation; reconciliation execution time is separate internal metadata. Unknown/foreign IDs return the same 404. Account/session locks and post-lock authorization rechecks also apply to reads. Incomplete onboarding cannot create previews/Oaths but may read its own existing records. Paused accounts retain access. No private evidence or provider payload belongs in these representations.

`GET /api/oaths?view=today|history&limit=20&cursor=<opaque>` returns `{"items":[...],"nextCursor":null,"total":0,"serverTime":"<UTC>","paused":false,"characterId":"<UUID>"}`. `total` is a non-negative integer. It counts every row of the requested view for the active character after due-state reconciliation, in the same transaction as the page. Limit and cursor do not change it. Default view today; limit integer 1–100, default 20. Unknown query keys, repeated keys and malformed values/cursors return 400 `invalid_request`. Today selects the explicit nonterminal states; persistence constrains terminal states to a non-null terminal timestamp and nonterminal states to null. Today sorts `(deadline ASC,id ASC)`; history selects terminal rows by `(terminalAt DESC,id DESC)`. An opaque canonical cursor binds owner, view, ordering and last key, validated against its persisted anchor row; it is not an authorization token. A changed/deleted anchor invalidates it, requiring a first-page refresh. Pagination is a live view: refresh from the first page after a state mutation; no cross-page snapshot guarantee. Owner scoping and due reconciliation precede selection. No inferred reward or linked Recovery is emitted until those authoritative integrations exist.

`GET /api/oath-pause` returns `{"paused":false,"revision":"<opaque>","withdraw":["<UUID>"],"preserve":["<UUID>"],"serverTime":"<UTC>"}` after reconciliation. It previews all affected commitments, not only a list page. `withdraw` contains scheduled/active commitments still eligible for withdrawal; `preserve` contains pending proof/correction/review commitments. Unchanged terminal history is omitted from this affected set and remains untouched. `POST /api/oath-pause` accepts `{"paused":true,"revision":"<opaque>"}`. Revision binds account pause state plus affected commitments/states; recheck after locks and reconciliation. If an unpaused account's affected set changed, return 409 `pause_preview_changed` and require renewed review. Already-paused repetition returns the current preview with no further effects. Resume accepts exactly `{"paused":false}` and is idempotent. Both return the current pause envelope (200); neither shifts deadlines nor restores withdrawn Oaths. Concurrent accept/activation/pause/receipt operations serialize on the account before Oath rows. Complete implementation of receipt/review/Recovery races remains gated on MVP-07–10.

### Reconciliation ownership

Use the durable [reconciler design](../product/oaths.md#durable-reconciliation-and-acceptance-limits): persisted due times, a bounded command and shared transactional read/pause reconciliation, account lock before ordered Oath locks. At exactly activation, activate once. At exactly S, normal first receipt remains eligible; only now>S follows absent-proof resolution. Unknown availability routes to review with fixed V and V+72h, no assumed healthy-service miss. Reads must not return a fabricated terminal outcome. Review timer enforcement/closure, receipts, outcome settlement, Recovery and scheduling deployment remain explicitly owned downstream; a successful MVP-05 test is not their acceptance.

## Proof submission contract

Status: first submission implemented in MVP-07-T03, retry identity in MVP-07-T04 and serialization with pause and cutoff in MVP-07-T05, 2026-10-01, with integration tests. The owner read and the staging purge follow in T06 and T07. Local engineering contract under [ADR 0008](../decisions/0008-proof-storage-and-upload.md) and the [first-loop rules](../product/first-loop.md#committed-times). Bearer, no-store and the safe error envelope apply.

`POST /api/oaths/{id}/proofs` takes one `multipart/form-data` body with exactly these parts. `submissionId` is a client UUID in canonical lowercase text. `mode` is `photo` or `activity_record`. `declaration` is the literal string `true`. `image` is one JPEG file.

Request checks:
- A missing or invalid bearer returns 401 `unauthenticated` from the firewall, before any other check.
- Another media type returns 415 `unsupported_media_type`. A declared length above PHP `post_max_size` returns 413 `request_too_large`, because PHP then drops every part.
- A query string, an unknown part, a part sent as an array or several files return 400 `invalid_request`.
- Field errors return 422 `{"error":{"code","field"}}`. Codes are `invalid_submission_id`, `invalid_mode`, `declaration_required` and `image_required`. A file above the PHP upload limit or above 10 MiB is `too_large` with field `image`.
- A partial upload or another server-side upload fault returns 503 `temporarily_unavailable`, so the client keeps its copy and retries.
- After the session is confirmed and the Oath ID is well formed, the image is normalized. Its failures are 422 `too_large`, `unsupported_type`, `too_many_pixels` or `unreadable_image`, all with field `image`.

The API normalizes the image, hashes the received bytes with SHA-256 and stages the normalized bytes before it takes any lock. It then locks the account, the session and the owner's Oaths, samples receipt time `R`, rechecks the session and reconciles. Checks after the locks:
- An invalid session returns 401 `unauthenticated`. No active character returns 409 `character_required`.
- A `submissionId` this account already used is a retry. The lookup is scoped to the account and comes before the Oath lookup, the cutoff check and the state check. See retry identity below.
- An Oath of another account or of another character returns 404 `not_found`. A malformed Oath ID already returns 404 before staging and the locks, even for a reused `submissionId`.
- `R` after the receipt cutoff S with no proof row returns 409 `receipt_cutoff_passed`. The reconciliation that moved the Oath to `review_pending` still commits. This check comes before the state check.
- A `proof_pending` Oath returns 409 `proof_already_submitted`. Corrections belong to a later slice.
- Any other state than `active` returns 409 `{"error":{"code":"oath_not_active","state":"<state>"}}`.

Success stores revision 1 with `received_at = R` and assessment `queued`, and moves the Oath from `active` to `proof_pending`. It returns 201 `{"proof":{"submissionId","mode","receivedAt","revision":1,"assessment":"queued"},"oath":{...},"serverTime"}`. `oath` uses the Oath representation above. No message is dispatched yet. The assessment worker of MVP-08 reads queued rows.

Retry identity follows [T02-04](../product/first-loop.md#committed-times). A request whose `submissionId` this account already used is compared with that row:
- The same Oath ID, the same SHA-256 of the received image bytes and the same `mode` return 200 with the body shape of 201. `proof` holds the original `receivedAt`, revision and assessment. `oath` is the current Oath after reconciliation, and `serverTime` is the time of the retry. This holds at any later time, even after S, so a retry is never reclassified as late. The declaration needs no comparison, because only `true` passes the request checks.
- A different image, a different `mode` or a different Oath ID returns 409 `idempotency_conflict`. The first row stays unchanged and nothing is written for the other Oath. The answer depends only on the caller's own row, so it reveals nothing about the requested Oath or another account, as in Oath acceptance.
- The same request for an Oath whose character is no longer active returns 404 `not_found`, as detail reads do.
- Another account using the same `submissionId` value makes its own new submission.
- The hash covers the received bytes, not the normalized output, so the match does not depend on GD output staying stable. A changed image that fails normalization still gets its 422 before any lock.

A retry stages its own copy before the locks. That copy is removed like any refusal, so a replay leaves only the original object. Two identical requests at the same time meet at the account lock. The second one finds the committed row and replays it. The result is one row, one object, one 201 and one 200 with the same `receivedAt`. The unique constraint is never reached.

Receipt, pause and cutoff reconciliation take the account lock before the Oath locks, so the first committer wins. `R` is sampled after the locks, so time spent waiting counts against the cutoff. Bytes staged before S still return 409 `receipt_cutoff_passed` when `R` is after S. A receipt committed before a pause keeps the Oath `proof_pending`. A pause waiting behind it then lists the Oath in `preserve`, and a pause confirmed for the older preview returns 409 `pause_preview_changed`. A pause committed before a waiting receipt withdraws the Oath. The receipt then returns 409 `oath_not_active` with state `withdrawn` and keeps no row or object. A cutoff run that selected the Oath before a timely receipt committed rechecks it under the lock and leaves it `proof_pending`.

Promotion from staging to permanent storage is the last step before commit, so a committed row never points at a staged object the purge could remove. Every refusal after staging removes the staged copy. If the commit fails after promotion, the API checks whether any committed row references the object and deletes it when none does. A commit can succeed even though the API saw an error, so a referenced object stays. When that check itself fails, the object stays and the response is still 503. Storage or database failure returns 503 `temporarily_unavailable`. Responses and logs never contain the storage key, image bytes or declaration text. DBAL query logging is off in every environment, because it would log SQL parameters.
