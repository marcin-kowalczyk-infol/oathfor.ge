# Development guide

Status: local API, PostgreSQL/Redis integration and bilingual Expo connectivity shell implemented. iOS simulator connectivity acceptance passed; earlier hosted CI checks passed, with the updated Docker lifecycle workflow awaiting a hosted run.

## Available now

Requirements: Git and Python 3.11+. See [commands](../../.agents/commands/README.md).

```sh
python3 .agents/commands/check_repository.py
git diff --check
mkdir -p graphics
```

The checker reads tracked/untracked non-ignored project files, resolves local Markdown file links, validates shared skills/role registration, and checks ignore behavior. It does not contact providers or prove application correctness.

## Quick verification

Requirements: Docker Engine/Compose, Python 3.11+, and Node 24.21.0/npm for mobile. The isolated API check builds its runtime, creates disposable service volumes, runs tests/static checks and verifies HTTP, then removes only its own Compose project:

```sh
python3 .agents/commands/check_api.py
```

For interactive development use the Compose and mobile instructions below. Native PHP is optional and needs every declared extension, including redis. Example configuration is inert local data; private provider integrations are absent.

## API — Symfony 7.4 kernel

Local tooling selection, 2026-09-23: PHP 8.5.x CLI and Composer 2.x. Verified host: PHP 8.5.7, Composer 2.10.1. Locked dependencies include FrameworkBundle 7.4.19, PHPUnit 12.5.35 and PHPStan 2.2.15. Symfony components stay constrained to `7.4.*`; exact versions live in `apps/api/composer.lock` and Flex recipes in `symfony.lock`.

Runtime prerequisites: pdo_pgsql and redis 6.3+ (provided by the Compose image below), Ctype, iconv, PCRE, Session, SimpleXML and Tokenizer for [Symfony 7.4](https://symfony.com/doc/7.4/setup.html); DOM, JSON, libxml, mbstring, XML and XMLWriter for [PHPUnit 12.5](https://docs.phpunit.de/en/12.5/installation.html). PHP 8.5 satisfies Symfony's PHP 8.2+ and PHPUnit's PHP 8.3+ floors. [PHPStan](https://phpstan.org/user-guide/getting-started) requires PHP 7.4+; [Composer](https://getcomposer.org/doc/00-intro.md) requires PHP 7.2.5+. Sources checked 2026-09-23. Core test extensions were present in the native host; redis was absent, so the service-enabled runtime uses Compose. Coverage drivers are optional and not installed.

On a new macOS machine, use the [PHP macOS package instructions](https://www.php.net/manual/en/install.macosx.packages.php) to install PHP 8.5, then Composer's linked installer instructions with its current checksum verification. Check `php --version`, `php -m` and `composer --version` before installing this project.

From the repository root, on a fresh checkout:

```sh
cd apps/api
cp .env.example .env
composer install --no-interaction
composer validate --strict
composer check-platform-reqs
php bin/console about
composer test
composer analyse
```

The copy step is for a new checkout; preserve an existing `.env`. The example contains an explicitly `DUMMY` local secret, not production credentials. Tests use a separate inert test secret. No database, queue or provider credentials are needed. Real environment files stay ignored. Sources: [Symfony setup](https://symfony.com/doc/7.4/setup.html), [security rules](../../.agents/rules/security.md).

`composer test` runs PHPUnit with nonempty test discovery and a kernel boot check. `composer analyse` runs PHPStan level 8 over `src/` and `tests/`; generated caches stay ignored. The kernel harness follows [Symfony testing](https://symfony.com/doc/7.4/testing.html). The functional test verifies the public [liveness contract](api-contract.md), including its exact JSON body. Database/queue integrations and mobile checks are described below.

## Run the API locally

After installation above, from `apps/api`:

```sh
php -S 127.0.0.1:8000 -t public public/index.php
```

In another terminal:

```sh
curl --fail --silent --show-error --include http://127.0.0.1:8000/api/health
```

Expected: HTTP 200, `Content-Type: application/json`, body `{"status":"ok"}`. Stop the server with Ctrl+C. The PHP development server prints request/error diagnostics to its terminal; cache files are under ignored `apps/api/var/`. `APP_ENV` selects the environment, `APP_SECRET` is a local dummy, and `DEFAULT_URI` supplies the URL used in CLI contexts.

This loopback-only development command uses PHP's [built-in server and router script](https://www.php.net/manual/en/features.commandline.webserver.php) (checked 2026-09-23); it is not a deployment server. Local server selection is an MVP-02 engineering decision. Native device access will be documented with mobile verification.

Verified 2026-09-23 on macOS with PHP 8.5.7 / Composer 2.10.1: a disposable local Git clone at `aecb45c`, configuration copied only from `.env.example`, locked install, validation, platform requirements, kernel info, 2 tests / 5 assertions and PHPStan all passed. HTTP status, content type and exact JSON were checked over a real socket and with curl. Port 8000 was occupied, so both server and request used `127.0.0.1:18082`; when necessary substitute an available port in both commands. The task server was stopped and disposable clone removed. The repository checker also passed without the local backlog. Only the API slice is covered; no claim of complete MVP-02 readiness.

## Troubleshooting the foundation

- Broken symlink: restore its relative target from the [agent guide](../../.agents/README.md). Do not maintain a second copy.
- Skill/role absent: restart the agent in this repository, check project trust/settings and supported version; use the documented manual fallback if the host lacks discovery.
- Missing graphics after clone: expected, because Git excludes the entire directory.
- Missing native PHP extensions: use the Compose runtime. Missing simctl/adb on another machine: install the appropriate simulator tooling before native checks. The verified local iOS setup is described below.

## Local database and queue runtime

Local selection: [ADR 0002](../decisions/0002-local-infrastructure.md). Docker Engine with Compose is required. The PHP container supplies pdo_pgsql and redis; native PHP must provide the same extensions for service integration. PostgreSQL 17 and Redis 7.4 stay on the Compose network; dummy passwords are for this isolated local setup only.

From repository root (Docker service runtime):

```sh
test -f apps/api/.env || cp apps/api/.env.example apps/api/.env
docker compose -p oathforge-local up --build -d --wait
docker compose -p oathforge-local exec api composer test
docker compose -p oathforge-local exec api composer analyse
curl --fail http://127.0.0.1:18082/api/health
```

The single startup command installs locked dependencies in a one-shot `init` container, then starts the API and managed worker after initialization succeeds and PostgreSQL/Redis are healthy. API HTTP and worker process/transport healthchecks gate `--wait`. No host PHP/Composer or manual install is required. Source files remain mounted for development; dependencies/cache stay in project volumes. Initialization does not overwrite `.env` or run migrations. Inspect bootstrap failures with `docker compose -p oathforge-local logs init`; use `logs worker` for worker diagnostics. After changing dependencies, stop the stack with ordinary `down`, then run the same startup command. Compose environment overrides container connection settings. `OATHFORGE_API_PORT` can select another loopback port. Normal tests do not require services; `composer test:integration` requires PostgreSQL and Redis. Use `docker compose -p oathforge-local down` to stop this project while preserving its data. To discard only a disposable test project's volumes, run `docker compose -p YOUR_DISPOSABLE_PROJECT down --volumes`; never apply that command to data you intend to keep.

The initialization script creates `oathforge_test` alongside `oathforge` only on a new PostgreSQL volume. Existing volumes retain their contents. Doctrine DBAL and migrations are installed without ORM/domain entities. Inspect migration status with `docker compose -p oathforge-local exec api php bin/console doctrine:migrations:status`; generate a deliberate migration later with `doctrine:migrations:generate` and apply reviewed migrations with `doctrine:migrations:migrate`. The migration directory now includes the login challenge and rate-counter schema. Startup still does not apply migrations automatically.

T05 verified on 2026-09-23: Docker Engine 29.4.0 / Compose 5.1.2; container PHP 8.5.10, phpredis 6.3.0, PostgreSQL 17.11 and Redis 7.4.11. Image build, empty database/test database initialization, Redis PING, locked Composer install/validation/platform checks, 2 tests / 5 assertions, PHPStan and migration status (zero migrations) passed. The same API tests passed with PostgreSQL and Redis stopped. HTTP through the loopback Compose port returned the liveness JSON. The service probes and delivery tests below are also implemented.

## Database transaction diagnostic

From repository root, with the local services running:

```sh
docker compose -p oathforge-local exec api php bin/console app:check-database
docker compose -p oathforge-local exec api php bin/console doctrine:migrations:migrate --env=test --no-interaction
docker compose -p oathforge-local exec api composer test:integration
```

The CLI probe writes and reads one synthetic value in a temporary table, then rolls back. Success prints `DATABASE_OK` and exits 0. Failure prints only `DATABASE_UNAVAILABLE` and exits 1, with no raw exception/connection string. DBAL's PDO connection timeout is two seconds. Integration tests use the separate `oathforge_test` database and verify rollback cleanup plus a refused-port failure in a bounded subprocess. `composer test` excludes service integration tests; `composer test:integration` requires healthy services. The diagnostic probe itself touches no persistent schema. The challenge integration suite uses its migrated test tables and clears their synthetic fixtures; never point the test connection at user data. Local diagnostic contract: MVP-02-T06; challenge extension: MVP-04-T04.

## Redis worker verification

`composer test:integration` includes real Redis transport tests: enqueue leaves the handler idle until a separate `messenger:consume` process runs; a synthetic failure retries once then lands in the failed stream; a refused connection fails dispatch without a success receipt. Fixtures are registered only in `test`, use random per-test stream/receipt names, bound workers to ten seconds, and remove their own streams, delayed queues and files. This is infrastructure evidence, not reward idempotency or production monitoring.

Local Messenger configuration selects `async` and `failed` Redis streams with two-second connection/read timeouts, one immediate retry, and deletion after acknowledgement (the transport default). Production retry/backoff policy belongs to the operations epic. Source: [Symfony 7.4 Messenger](https://symfony.com/doc/7.4/messenger.html), checked 2026-09-23; exact retry choice is local.

Compose already manages one worker, named `local-worker` inside its isolated Redis project. It restarts on process failure; after editing handler code, restart it with `docker compose -p oathforge-local restart worker`. Do not scale this service without assigning distinct consumer identities. For failed-message inspection:

```sh
docker compose -p oathforge-local exec api php bin/console messenger:failed:show
```

Each concurrent worker needs a unique consumer name for the same stream/group. The scaffold deliberately has no production messages; synthetic fixture routing exists only under `test`. Inspect failed messages before explicitly retrying with `messenger:failed:retry ID` or removing with `messenger:failed:remove ID`. Do not treat queue availability as an Oath outcome. Sources: [Messenger consumer identity and failures](https://symfony.com/doc/7.4/messenger.html#redis-transport), [architecture invariants](architecture.md).

## Mobile harness

Local tooling selection, 2026-09-23: Node 24.21.0 LTS (`.nvmrc`) and npm; Expo 57, React Native 0.86.3, React 19.2.3 and strict TypeScript 6. Exact packages are locked in `apps/mobile/package-lock.json`. Use your Node version manager to select `.nvmrc`; no global Node setting is changed by repository commands. Sources: [Expo SDK matrix](https://docs.expo.dev/versions/latest/), [Node releases](https://nodejs.org/en/about/previous-releases), checked 2026-09-23.

From `apps/mobile`:

```sh
npm ci
npm test -- --runInBand
npm run typecheck
npx expo install --check
npx expo export --platform ios --platform android
npm start
```

Jest 29 with `jest-expo` 57, React Native Testing Library 14 and its test renderer provide a nonempty component harness. Sources: [Expo testing](https://docs.expo.dev/develop/unit-testing/), [RNTL setup](https://oss.callstack.com/react-native-testing-library/docs/start/quick-start). Verified 2026-09-23 with Node 24.21.0: npm ci, 14 API/client component tests, strict typecheck, Expo dependency compatibility and iOS/Android exports all passed. An export is bundle evidence, not a native launch. The scaffold contains no selected artwork or product/onboarding flow. Native acceptance needs a compatible Expo Go/development client and an installed emulator/simulator or attached device.

## Mobile API connectivity

Copy `apps/mobile/.env.example` to `apps/mobile/.env` if absent, set `EXPO_PUBLIC_API_BASE_URL` to an API address reachable by the selected client, then run `npm start` from `apps/mobile`. These variables are public bundle content; never put credentials in them. `EXPO_PUBLIC_DIAGNOSTIC_LOCALE=pl` or `en` selects the development diagnostic fixture; without an override, the shared locale provider follows the primary device/app language, with English fallback. Source: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/); fixture choice is local.

The shell starts pending, validates HTTP200, JSON content type and the exact `{ "status": "ok" }` body, then reports connection success. Network errors, invalid responses and an eight-second timeout show a localized retry action. Unmount aborts pending work, and responses arriving after timeout cannot change the result. Tests exercise both Polish and English, including accessible retry labels. This is a diagnostic screen, not onboarding or a product Oath flow.

For an Android emulator, the host alias is normally `10.0.2.2`; an iOS simulator can use host loopback. Physical devices need a reachable LAN address and an explicit local networking arrangement because Compose publishes only loopback. Native HTTP policy must be verified on the actual client; do not relax production transport security to pass a development smoke test. Sources: [Android emulator networking](https://developer.android.com/studio/run/emulator-networking), [Expo iOS simulator](https://docs.expo.dev/workflow/ios-simulator/), [React Native networking](https://reactnative.dev/docs/network), checked 2026-09-23.

Native acceptance passed on 2026-09-24: Xcode 27.0 (27A266a), iOS 27.0, iPhone 18 Pro simulator, Expo Go 57.0.9 and project SDK 57. The native screen showed connection success against `http://127.0.0.1:18082`; stopping the API and reloading the app showed the recoverable error; restarting the API and pressing the native retry button restored success. These were actual simulator observations, not mocked requests. Android and physical-device behavior were not verified; this evidence satisfies the planned T10 device/emulator acceptance.

For the verified iOS workflow, start Docker as above, select Node from `.nvmrc`, and run from `apps/mobile`:

```sh
npm ci
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:18082 EXPO_PUBLIC_DIAGNOSTIC_LOCALE=pl NODE_OPTIONS=--dns-result-order=ipv4first npm run ios -- --localhost
```

Local observed workaround: without the process-scoped Node option, Metro bound only to `::1` while Expo opened `exp://127.0.0.1:8081`, producing a connection refusal. Preferring IPv4 resolved it without changing application transport security or global settings. The command overrides only the public diagnostic values for this run and preserves existing `.env` files. Xcode 27 displays the simulator in Device Hub. Leave Metro running; `r` reloads the app and Ctrl+C stops Metro.

To repeat acceptance, stop the API with `docker compose -p oathforge-local stop api`, then press `r` in Metro. The current screen checks on mount/retry, so stopping the API alone does not update an already successful screen. Restore with `docker compose -p oathforge-local up -d --wait api`; after health succeeds, press **Spróbuj ponownie** in the app. Ordinary `docker compose -p oathforge-local down` stops the backend while retaining data.

## CI and acceptance status

[GitHub Actions checks](../../.github/workflows/checks.yml) run repository validation, the isolated API check above, npm ci, mobile tests/type checks, Expo compatibility and both native bundle exports. Actions are pinned to inspected upstream commits; token permissions are read-only. Local workflow choice: MVP-02-T11. Sources checked 2026-09-23: [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [setup-python](https://github.com/actions/setup-python).

The previously published workflow passed on GitHub for commit `3853216` on 2026-09-23: [hosted run 35922303447](https://github.com/marcin-kowalczyk-infol/oathfor.ge/actions/runs/35922303447). Repository checks, API/PostgreSQL/Redis verification, mobile tests/types and both native bundle exports succeeded. Initial publication was explicitly authorized by the owner; this is CI evidence, not a production deployment. The subsequent iOS simulator acceptance is recorded above. Dummy local database/application secrets are intentional development fixtures, not production provisioning; no external provider credentials or artwork are needed for this scaffold.

Local clean-checkout verification, 2026-09-23: a disposable clone of `9e1fea0` plus the intended CI diff passed repository checks, fresh isolated API build/install, 2 ordinary API tests / 5 assertions, 5 integration tests / 19 assertions, PHPStan, migration status and HTTP over a dynamically assigned loopback port. Mobile npm ci, 14 tests, strict types, Expo compatibility and both exports passed using only the example configuration. The API script removed its UUID project and volumes. That local check did not exercise hosted execution or a native screen; hosted evidence is recorded above.

Failure propagation was checked in the disposable checkout: temporary failing PHPUnit and Jest assertions each produced a nonzero exit; the API orchestrator still cleaned its project. Both temporary faults were removed. These local checks do not substitute for a GitHub Actions run.


## Docker lifecycle verification

Run `python3 .agents/commands/check_docker.py` (Docker and Python 3.11+) to copy non-ignored source into a disposable checkout and start a unique Compose project with empty volumes. It checks real HTTP/database health, repeated startup, PostgreSQL/Redis persistence across ordinary `down`/`up`, delivery by the managed worker using test-only fixtures, and nonzero startup failure from deliberately invalid Composer input. The fault exists only in the disposable copy. Cleanup removes only that invocation's project and volumes, including on failure; subprocesses have bounded timeouts. Existing project environment files are neither copied nor overwritten. The harness uses only DUMMY configuration.

CI now includes this lifecycle check as well as the existing API and mobile checks. Hosted evidence above predates this orchestration change; its updated hosted run remains pending publication. Native T10 acceptance subsequently passed on iOS, as recorded above. Local orchestration follows the initialization/health dependency conditions in [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) (checked 2026-09-23); the lifecycle and single-worker scope are local MVP-02-T12 decisions.

Verified locally on 2026-09-23 for T12: the full lifecycle harness passed, including preserved PostgreSQL/Redis values and actual managed-worker delivery after restart. The adapted API check passed 2 tests / 5 assertions, 5 integration tests / 19 assertions, PHPStan, Composer validation/platform checks, migration status and real HTTP. Compose configuration, repository/whitespace checks, Python compilation and workflow lint also passed. Mobile source was unchanged; updated hosted validation remains pending; subsequent native iOS evidence is recorded above.

## Shared mobile localization

MVP-04-T01 migrates the diagnostic shell to `src/localization/LocalizationProvider.tsx` and complete UTF-8 `locales/pl/messages.json` / `locales/en/messages.json` catalogs. Wrap a screen tree once with `LocalizationProvider`; consume `useTranslation` from that module. Use full message keys and named arguments; call `i18n.changeLanguage('pl' | 'en')` for session language changes. Future settings own persistence; no account preference is currently stored. `formatDeadline` requires the committed timezone explicitly and does not change its input instant. This is the [local translation contract](../product/glossary.md#translation-storage-and-runtime-contract).

Existing `npm test -- --runInBand` runs locale/fallback, catalog completeness, interpolation/plurals, React switching and diagnostic request regressions. `npm run typecheck` checks the code; `npx expo install --check` checks SDK compatibility; `npx expo export --platform ios` checks the bundle. Expo's localization plugin declares Polish and English for iOS. A new binary is required to validate app-specific system language metadata; Expo Go and a bundle export do not prove that behavior. [Expo SDK57 localization](https://docs.expo.dev/versions/v57.0.0/sdk/localization/), checked 2026-09-24. No new permission prompt or permission description is introduced in this slice.

Verified for MVP-04-T01 on 2026-09-24 under Node24.21.0: 35 mobile tests and strict types passed; Expo SDK compatibility and iOS bundle export passed. Config introspection produced `CFBundleLocalizations = [pl, en]`. The compatibility check required the bounded Expo patch from57.0.24 to57.0.25. No rebuilt native binary/system-language test or product onboarding acceptance is claimed.

## Apple sign-in preparation

The owner-selected route and current boundary are recorded in [ADR 0003](../decisions/0003-apple-sign-in.md). `expo-apple-authentication` and its iOS capability/plugin are configured. The mobile adapter is covered by synthetic provider tests; it is not yet connected to a login screen or server sessions. Run the normal mobile tests/typecheck and `npx expo install --check` after dependency changes. A rebuilt signed app and physical-device verification remain required; Expo Go is not standalone authentication acceptance. Anonymous challenge issuance, internal Apple verification, provider credential encryption and internal code exchange are implemented; account/session persistence and protected identity/logout routes also exist. The public login exchange is implemented below; mobile and signed-device acceptance remain pending. No provider secrets belong in mobile environment variables.

MVP-04-T03 selects the [authentication contract](api-contract.md#planned-authentication-contract), including required native authorization-code handoff and backend-only provider credentials/encryption. The configuration for internal verification and encryption is implemented below; public login exchange is composed in T10 below. Missing production credentials must fail closed; synthetic providers belong only in tests. The accepted app session lasts 30 days without renewal.


## Login challenge runtime

MVP-04-T04 adds `POST /api/auth/apple/challenges` and the durable one-use repository from the [authentication contract](api-contract.md#challenge-and-exchange). Apply the project migrations to the intended local development database before exercising this route; integration tests must use the isolated test database. Health remains usable independently of PostgreSQL. A database outage yields a safe 503; malformed input and per-minute limits have explicit JSON reason codes. The challenge contains no account/session credential and does not enable Apple login.

The isolated API checker migrates its test database before integration tests. `composer test:integration -- --filter LoginChallengeTest` covers synthetic challenge behavior within that prepared runtime. Provider values are unnecessary for challenge issuance. Token verification, authorization-code exchange and account/session persistence are now implemented as separate boundaries; the configured production app must never treat a challenge as authentication.


## Apple identity verification boundary

MVP-04-T05 implements the internal RS256 verifier and trusted-key cache described by the [API contract](api-contract.md#verification-and-key-availability), using locked `firebase/php-jwt` 7.2.0 and Symfony HttpClient 7.4.19 with OpenSSL. `APPLE_CLIENT_ID` is the exact native bundle audience; absent/blank or DUMMY placeholder values fail closed when verification is requested. Health and anonymous challenges do not depend on it. This boundary issues no app session and has no public verification endpoint.

Production key reads use only Apple's fixed public JWKS URL with bounded transport and a shared filesystem cache/lock on the single API host. Deployments must share the configured cache between PHP request processes; extending to multiple API hosts requires a reviewed shared-cache strategy. Tests inject synthetic DUMMY signed keys and HTTP responses without calling Apple. This establishes local verification behavior, not signed-device compatibility.


## Provider credential encryption

MVP-04-T07 adds the internal libsodium XChaCha20-Poly1305 cipher; database credential storage remains a separate task; internal provider exchange is described below. Configure `PROVIDER_TOKEN_KEYRING_PATH` to a private backend JSON file and `PROVIDER_TOKEN_CURRENT_KEY_ID` to its write key. The keyring has shape `{"keys":{"key-id":"standard-base64-encoded-32-byte-key"}}`; that text is schematic and not a usable key. Generate actual keys privately with a cryptographic source, keep them outside the repository/mobile bundle and application-data backups, and never paste them into logs/chat. The path must be absolute and name a regular local file. The JSON is limited to 16 KiB and exactly one `keys` object containing 1–32 keys. Key IDs contain 1–64 ASCII letters, digits, dots, underscores or hyphens; each value is canonical standard base64 encoding exactly 32 bytes. File permissions must be owner-only (0400 or 0600); this is a local fail-closed configuration choice under [ADR 0003](../decisions/0003-apple-sign-in.md#provider-credentials-and-deletion).

Rotation installs the new key alongside old versions, switches the current key ID and keeps old keys until their stored envelopes are re-encrypted or removed. Deleting an old key makes its ciphertext unreadable; tests cover this failure explicitly. The cipher reads configuration lazily, so missing keys do not break health/challenge routes. Encryption uses a fresh 24-byte nonce and authenticates the provider identity and envelope metadata; invalid material produces a safe failure with no plaintext. Tests create synthetic keys in private temporary files and remove them afterward. No real keyring or provider token is provisioned by this task.


## Backend Apple code exchange

The T08 internal exchange boundary uses `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID` and `APPLE_PRIVATE_KEY_PATH`. Provision the private Apple signing key outside the repository/mobile bundle and configure only its backend path. Example values remain DUMMY; no real provider configuration is supplied. The key path must be absolute and refer to a local regular file with permissions 0400/0600, at most 16 KiB, containing a P-256 private key. Client IDs are bounded to 255 bytes and team/key IDs to 128; blank, surrounding whitespace, DUMMY and wildcard values are rejected. Missing/invalid configuration is read lazily and fails closed. The client secret is signed with ES256 for a five-minute lifetime using the existing JWT library. Native requests omit `redirect_uri`.

The boundary exchanges a code only after native identity verification, then verifies the returned identity token against the same challenge nonce and subject before returning a provider refresh credential for encrypted persistence by the issuance service. Transport targets only Apple's fixed token endpoint, rejects redirects and does not retry a single-use code. Synthetic signed tokens and fake HTTP responses cover the local behavior; they do not establish real Apple compatibility. T10 composition owns the public exchange route, account transaction and app session. A provider success followed by database failure requires a fresh native login under the [accepted retry contract](api-contract.md#transactions-retry-and-provider-exchange).


## Account and app-session persistence

T09 adds Symfony SecurityBundle 7.4 and explicitly aligns Doctrine Bridge to 7.4 (the earlier transitive 8.1 lock conflicted with SecurityBundle’s property-info requirements). It introduces internal verified-identity issuance plus `GET /api/me` and `DELETE /api/auth/session`. Apply migrations before using these routes. T10 adds public login exchange as described below; ordinary fixtures issue synthetic sessions inside isolated tests. Never seed a production session or use an account UUID as a credential.

Each app bearer contains 256 random bits; PostgreSQL stores its SHA-256 digest. Expiry is fixed at issuance plus 2,592,000 elapsed seconds. Authenticated reads do not renew it. Session deletion accepts a syntactically valid bearer even after expiry or prior revocation, returning 204; it affects only that bearer and never revokes Apple authorization. Missing or malformed credentials receive the same safe 401 as other unauthenticated access. Infrastructure failures return 503. Both routes use no-store responses.

The internal deletion gate locks the account and denies all sessions immediately. It records pending provider revocation for T11 maintenance below. Full account-data deletion and real provider acceptance remain the MVP-14 handoff. Concurrent issuance locks the same account and rechecks both active status and the trusted challenge deadline after waiting. Login composition owns the outer transaction so an issuance failure rolls back challenge consumption and local identity/credential writes together. Read the [API contract](api-contract.md#app-session-and-sign-out) before adding protected endpoints; Symfony bearer authentication must remain separate from the idempotent logout route.


## Public Apple login composition

T10 connects `POST /api/auth/apple/exchange` to the verified boundaries above. The request carries exactly the server challenge ID, native identity token and authorization code. The expected nonce digest and challenge deadline come exclusively from stored server state. After both native and exchanged identities verify, one database transaction consumes the still-live challenge, reuses or creates the account, encrypts the provider refresh credential and creates the app session. Expiry or deletion after lock contention rejects and rolls back all local writes.

Synthetic tests run the full route with signed fixtures and injected fake Apple HTTP; production wiring requires private valid configuration and never enables a DUMMY login route. A replayed successful request gets 409 and cannot recover the old bearer. An unavailable/ambiguous exchange gets 503 and requires a fresh challenge/native login, not automatic code replay. Do not revoke shared Apple authorization as failed-transaction cleanup. The public route alone does not complete release acceptance: deployment scheduling for the maintenance command below, mobile recovery and a signed physical-device journey remain required.


## Provider validity and deletion revocation

T11 adds explicit provider maintenance via `php bin/console app:identity:maintain --limit=100` from `apps/api` in the configured backend runtime. The limit defaults to 100 and accepts integers 1–1000, bounding sequential candidates per invocation. No scheduler is configured by this task. Active identities with unexpired app sessions are eligible for Apple refresh validation at most once per 86,400 seconds. A durable reservation advances the next due time before the bounded provider call, preventing duplicate attempts after overlap or a crash. Provider success never creates or extends an app session. Explicit `invalid_grant` denies existing sessions; configuration errors, outages and malformed results leave only their original expiry in force.

Maintenance verifies a refresh response against the stored identity without pretending there is a live login challenge. Login retains its strict nonce verification. Apple may omit a replacement refresh token, in which case the existing encrypted credential is retained. Any accepted replacement is encrypted under the current key and advances its credential generation. Claims and generations prevent late results from overwriting a newer login or applying to a deleting account.

The internal deletion gate immediately denies app sessions and records an immutable request time. Revocation retries use the fixed Apple revoke endpoint, at intervals of at least 900 seconds. A confirmed revocation removes the encrypted credential; at request time plus 604,800 seconds, maintenance purges it even if Apple remains unavailable, recording a safe unresolved outcome. Purging runs before network work. This does not implement full account/Oath-data deletion, which remains MVP-14. For legacy inactive accounts whose deletion time was never stored, migration uses account creation as a conservative lower bound and records that the historical request time is unknown. This can shorten credential retention but cannot grant a fresh seven days on upgrade; it is not a recovered audit timestamp. Real-account rollout remains gated on this maintenance path.

Deployment must invoke maintenance frequently enough for the retry interval and purge deadline; a once-daily command is insufficient even though validity checks are daily per identity. Configure scheduling and monitoring only in the deployment workflow, and validate real provider revocation/deletion recovery before real-account release. Tests use fake transport, temporary keys and controlled clocks. Do not run maintenance against real credentials as a routine development check.


## Mobile authentication transport

T12 adds a typed mobile API boundary for challenges, code exchange, current-account reads and current-session deletion. It validates response shapes and values before exposing success and returns safe retry/reauthentication outcomes without surfacing raw server text. This client does not persist a bearer or render authenticated UI; T13/T14 own those steps.

Credential requests use the installed `expo/fetch` implementation with `redirect: 'error'` and `credentials: 'omit'`, a ten-second total deadline and a 64 KiB streamed response limit. Exchange failures that leave code use uncertain explicitly require a fresh login. Production requires an HTTPS API origin; insecure loopback URLs are permitted only by an explicit development option. Bearers appear only in Authorization headers for identity read/logout, and Apple token/code only in the exchange JSON body. No credential query parameters, logging or automatic exchange retries are added. Unit tests inject fake transport; signed native acceptance must still verify actual redirect rejection and backend connectivity.


## Mobile session persistence and recovery

T13 adds the SecureStore-backed session owner used by the later UI integration. It stores one versioned envelope under `oathforge.session.v1`, using keychain service `oathforge.session`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` and `requireAuthentication: false`. The Expo plugin sets `faceIDPermission: false`, so this flow does not introduce unused biometric permission text. Rebuild the native app after installing SecureStore; an iOS bundle export is not keychain acceptance.

A restored bearer must pass `GET /api/me` before authenticated UI is exposed. Login stores its active envelope before reporting authenticated state. Generation guards cover the entire login attempt, and serialized storage writes prevent late work from restoring access after logout. The fixed server expiry is never extended locally; foreground checks and bounded timers enforce the local expired state.

Logout immediately hides authenticated state and durably records `revocation_pending` before calling server deletion. Offline failure keeps the old token solely for revocation and offers retry on foreground/manual action. A server204 receipt permits replacement with `signed_out`. Pending revocation or failed local cleanup blocks new login; storage failures are not treated as confirmed server revocation. Apple identity tokens and authorization codes stay only in memory for the current attempt.

Tests inject storage/API/clock and deferred promises to exercise interrupted writes, restart, logout and late responses. Real-device locked-keychain behavior, reinstall recovery and native revocation acceptance remain required before release; no real credentials are used by these tests.
