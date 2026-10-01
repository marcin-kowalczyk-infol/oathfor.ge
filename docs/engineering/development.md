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

`composer test` runs PHPUnit with nonempty test discovery and a kernel boot check. `composer analyse` runs PHPStan level 8 over `src/` and `tests/` with an explicit 512 MiB process limit; generated caches stay ignored. The kernel harness follows [Symfony testing](https://symfony.com/doc/7.4/testing.html). The functional test verifies the public [liveness contract](api-contract.md), including its exact JSON body. Database/queue integrations and mobile checks are described below.

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

Jest 29 with `jest-expo` 57, React Native Testing Library 14 and its test renderer provide a nonempty component harness. Sources: [Expo testing](https://docs.expo.dev/develop/unit-testing/), [RNTL setup](https://oss.callstack.com/react-native-testing-library/docs/start/quick-start). Verified 2026-09-23 with Node 24.21.0: npm ci, 14 API/client component tests, strict typecheck, Expo dependency compatibility and iOS/Android exports all passed. An export is bundle evidence, not a native launch. That foundation check predates the selected artwork and authentication shell described below. Native acceptance needs a compatible Expo Go/development client and an installed emulator/simulator or attached device.

## Mobile API connectivity

Copy `apps/mobile/.env.example` to `apps/mobile/.env` if absent, set `EXPO_PUBLIC_API_BASE_URL` to an API address reachable by the selected client, then run `npm start` from `apps/mobile`. These variables are public bundle content; never put credentials in them. The app normally opens authentication. Set `EXPO_PUBLIC_DIAGNOSTIC_MODE=true` in a development build to open the connectivity fixture. Only that explicit mode uses `EXPO_PUBLIC_DIAGNOSTIC_LOCALE=pl` or `en`; product screens follow the primary device/app language with English fallback until an account language is confirmed. Source: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/); fixture choice is local.

The diagnostic screen starts pending, validates HTTP200, JSON content type and the exact `{ "status": "ok" }` body, then reports connection success. Network errors, invalid responses and an eight-second timeout show a localized retry action. Unmount aborts pending work, and responses arriving after timeout cannot change the result. Tests exercise both Polish and English, including accessible retry labels. This is a diagnostic screen, not onboarding or a product Oath flow.

For an Android emulator, the host alias is normally `10.0.2.2`; an iOS simulator can use host loopback. Physical devices need a reachable LAN address and an explicit local networking arrangement because Compose publishes only loopback. Native HTTP policy must be verified on the actual client; do not relax production transport security to pass a development smoke test. Sources: [Android emulator networking](https://developer.android.com/studio/run/emulator-networking), [Expo iOS simulator](https://docs.expo.dev/workflow/ios-simulator/), [React Native networking](https://reactnative.dev/docs/network), checked 2026-09-23.

Native acceptance passed on 2026-09-24: Xcode 27.0 (27A266a), iOS 27.0, iPhone 18 Pro simulator, Expo Go 57.0.9 and project SDK 57. The native screen showed connection success against `http://127.0.0.1:18082`; stopping the API and reloading the app showed the recoverable error; restarting the API and pressing the native retry button restored success. These were actual simulator observations, not mocked requests. Android and physical-device behavior were not verified; this evidence satisfies the planned T10 device/emulator acceptance.

For the verified iOS workflow, start Docker as above, select Node from `.nvmrc`, and run from `apps/mobile`:

```sh
npm ci
EXPO_PUBLIC_API_BASE_URL=http://127.0.0.1:18082 EXPO_PUBLIC_DIAGNOSTIC_MODE=true EXPO_PUBLIC_DIAGNOSTIC_LOCALE=pl NODE_OPTIONS=--dns-result-order=ipv4first npm run ios -- --localhost
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

The owner-selected route and current boundary are recorded in [ADR 0003](../decisions/0003-apple-sign-in.md). `expo-apple-authentication` and its iOS capability/plugin are configured. The mobile adapter is connected to the authentication shell and session controller; synthetic provider tests cover the local flow. Run the normal mobile tests/typecheck and `npx expo install --check` after dependency changes. A rebuilt signed app and physical-device verification remain required; Expo Go is not standalone authentication acceptance. Anonymous challenge issuance, internal Apple verification, provider credential encryption and internal code exchange are implemented; account/session persistence and protected identity/logout routes also exist. The public login exchange is implemented below; mobile and signed-device acceptance remain pending. No provider secrets belong in mobile environment variables.

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


## Mobile authentication shell

T14 makes authentication the normal app entry. When native Apple authentication is available, the official button starts a new challenge, native credential request and server exchange through the session controller. Cancellation returns to sign-in; unsuccessful or ambiguous attempts require a fresh flow. The app requests no Apple profile scopes and renders only localized safe outcomes.

One session owner survives changes in the authenticated subtree. Foreground events revalidate or retry pending recovery; native Apple revocation events start current-session logout. PL/EN screens distinguish session verification failure, pending server revocation, incomplete local cleanup and expired credentials. None of these states expose product access or treat a stored bearer as proof of authorization.

T14 initially supplied provisional onboarding and first-Oath handoffs. T17 adds profile hydration and confirmed basic choices below; later steps follow in T18–T20, and the actual first-Oath commitment belongs to MVP-05. These placeholders create no Oath, deadline or reward. Native provider acceptance still requires a rebuilt signed app and a physical device.

Native visual check attempted on 2026-09-24 with an isolated synthetic presentation fixture: Expo opened the project on the booted iPhone 18 Pro/iOS 27.0 simulator, but the computer-use interface could not obtain its window (`cgWindowNotFound`). No layout acceptance is claimed. The temporary entrypoint was restored and Metro stopped; the ignored fixture is `graphics/mvp-04/ui/native-auth-preview.tsx`. Repeat PL/EN layout and system accessibility checks when the native window is accessible.


## Account onboarding profile

T16 implements authenticated `GET /api/profile`, atomic partial `PATCH /api/profile` and `POST /api/onboarding/complete` under the [onboarding contract](../product/onboarding.md). Apply migrations in the intended development database before exercising them; the isolated API checker migrates only its owned test database. New accounts expose unconfirmed profile defaults until explicit saves. The request accepts no target account ID, OS permission or numerical goal.

Profile mutations serialize with account deletion and recheck session validity after waiting for the account lock. Different-field updates merge; completion requires every confirmed field, including an explicit enabled/disabled notification preference. Companion acknowledgment and completion cannot be undone by this API. Completing onboarding neither starts an Oath nor extends the fixed session expiry. Basic mobile choices and the companion introduction are described below; notification choices and final completion are described below; physical-device acceptance remains pending.


## Mobile confirmed onboarding choices

T17 loads the server profile for every authenticated account before routing, including completed returning accounts, and applies the confirmed account language through the shared localization instance. Failed profile loading exposes retry/logout and no guessed destination. Logout discards profile/draft state and restores the normal signed-out locale resolver.

Pending accounts explicitly confirm Polish/English, an IANA timezone and the single regular-activity intention. Device timezone is only an editable suggestion; missing or unsupported values and an unchecked intention have visible localized explanations. The client checks native Intl support before submitting; the server remains authoritative for accepted timezone identifiers. Reading a saved server identifier does not require local Intl support, so an older device can still hydrate the profile and language. Pending onboarding offers explicit correction of an unsupported stored zone; completed accounts still bypass onboarding, with scheduling validation owned by the later Oath flow. Unsaved choices are not described as stored.

Profile transport shares the bounded authentication transport. Writes serialize as partial updates; ambiguous responses require a fresh profile read to reconcile the desired values before retry. Session/account guards discard stale results. Restart and foreground restore server-confirmed state. T18 adds the companion introduction below; T19 adds optional notification choices and T20 adds final completion below; onboarding completion itself creates no commitment; the separate MVP-05 form and confirmation are described below. Tests inject API/native boundaries, so real device interruption and system-language acceptance remain pending.


## Companion onboarding introduction

T18 shows the accepted Żaromir/Zharomir introduction after confirmed basic choices, using the selected base `CompanionArt` as decoration. “Continue” durably saves `companionIntroduced: true` through the existing partial-profile controller. Failure stays on the introduction with recovery; a confirmed acknowledgment resumes at notifications after restart. Missing artwork leaves the full message and action available. This step grants no XP or appearance entitlement. Native layout and accessibility acceptance remain pending.


## Optional notification preference and device permission

T19 adds SDK-compatible `expo-notifications` for permission checks and explicit requests. The account preference is saved before an opt-in request; skipping saves disabled without prompting. A failed preference save prevents the OS request. Once the decision is durable, denied or unavailable permission still allows continuation. Reopening the screen or foregrounding the app reads permission without requesting it. An interrupted opt-in resumes with the stored preference and fresh device status; another request requires an explicit action and `canAskAgain`. Settings failure leaves continuation usable.

The UI distinguishes account preference from this device’s not-determined, denied, authorized, provisional or ephemeral status. Permission does not demonstrate delivery. There is no push-token registration, notification scheduling, background delivery or foreground notification handler in this epic. Sources: [Expo SDK57 notifications](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) (checked 2026-09-25); interaction sequencing follows the local [onboarding contract](../product/onboarding.md).

Rebuild the native app after installing the module. The standard Expo notification plugin adds the iOS `aps-environment` entitlement, even when reached through Expo’s automatic plugin selection. Background remote notifications remain disabled. Signing/provisioning must match the generated entitlement; this does not configure a push service or authorize external console changes. Physical-device permission, Settings return, interrupted-save and signed-build acceptance remain pending.


## Onboarding completion and first-Oath handoff

T20 shows a final review for pending accounts with all fields confirmed, including returning accounts interrupted between saving notification opt-in and the OS prompt. It displays saved choices and freshly read device permission without automatically prompting. Denial or unavailable permission does not prevent completion. The explicit continuation calls `POST /api/onboarding/complete`; guard rejection refetches missing steps, and an ambiguous response is reconciled by a profile read before retry. Late results after logout cannot reopen the account.

Only a server-complete profile reaches the first-Oath entry. Returning completed accounts first hydrate their saved language and then bypass onboarding. MVP-05-T09 replaces the provisional Trial entry with the actual form and stored-rule review; T10 adds Today, history, detail and pause navigation around it. Entering it issues no commitment or XP; its separate explicit acceptance submits the saved preview. Real signed-device first-Oath acceptance remains the MVP-04-T22/MVP-05 native gate.

Implementation is locally verified with synthetic backend/native adapters. Release acceptance remains open in the [account/onboarding matrix](testing.md#account-and-onboarding-acceptance). `apps/mobile/app.json` still omits `ios.bundleIdentifier`; Expo introspection uses `com.placeholder.appid`, which is not a registered project identifier. Before a signed build, set the registered identifier matching backend `APPLE_CLIENT_ID`, configure matching Apple Sign in/APNs signing capabilities, and provision the private backend keys described above. Do not place keys in mobile configuration or chat.

## Oath previews

MVP-05 adds strict local deadline resolution and protected immutable rule previews. Apply reviewed migrations in the intended runtime before using `POST /api/oath-previews` and owner-only `GET /api/oath-previews/{id}`. The account must have server-complete onboarding and unpaused gameplay to create a preview; reads remain available while paused. No Oath or XP is created by a preview. The [contract](api-contract.md#original-oath-contract) distinguishes implemented previews, confirmation and commitment queries and pause from pending downstream receipt/outcome integration.

The committed policy source is the versioned JSON catalog in `apps/api/resources/oath/`; changing it affects newly generated previews only. Existing preview JSON is read from PostgreSQL. Real receipt processing, AI review, rewards, Recovery and native first-Oath acceptance remain pending. Ordinary tests use synthetic clocks/sessions; no live provider request is part of preview testing.

`POST /api/oaths` explicitly accepts a saved preview with an account-scoped request UUID and `accepted=true`. The transaction creates one active-now or future-scheduled commitment, copies immutable rules, and binds retries to the same Oath. Repeating the same accepted preview under another request UUID also returns that Oath. Fresh acceptance rejects expired scheduling choices and superseded template/reward versions; successful replay still requires current authentication. Acceptance now shares T06 due reconciliation before its successful response; proof and rewards remain subsequent work.

Local tooling adjustment, 2026-09-25: the fresh T04 isolated analysis exceeded PHP’s 128 MiB default. The Composer analysis script now uses PHPStan’s [memory-limit option](https://phpstan.org/user-guide/command-line-usage#--memory-limit) at 512 MiB; no application runtime or host permission setting changes.

Protected `GET /api/oaths/{id}` and `GET /api/oaths?view=today|history` expose owner-owned stored snapshots and states, including future/overdue nonterminal items and terminal history. Lists use stable keyset pagination (default 20, maximum 100) with owner/view-bound cursors. Changing device/profile locale cannot alter stored rules. These endpoints now reconcile due activation and unknown-availability cutoffs before returning their authoritative state.

## Oath reconciliation

From the migrated API runtime run `php bin/console app:oath:reconcile --limit=100`. The limit is 1–1000 (default 100) and bounds selected commitment rows. Output reports aggregate selected/activated/review counts only. Shared transactional reconciliation also runs on protected commitment reads acceptance responses and pause transactions. It preserves the committed activation/D/S instants, catches up after downtime and records fixed review entry/closure times once. At exactly S the ordinary first-receipt window remains open; only after S does unknown availability enter `review_pending`. No healthy-service miss is inferred.

No deployment timer is installed. Schedule and monitor the command in the eventual deployment as a separate operational step. Actual receipt finalization, availability evidence, review closure, outcome/reward settlement and Recovery remain downstream integrations; the command does not simulate those capabilities or make live provider calls.

## Oath pause contract

The implemented pause flow starts with `GET /api/oath-pause`, which reconciles elapsed deadlines and returns the complete affected set plus its revision. The client resolves each affected ID to an owner-only detail to present its activity and committed deadline; a paginated Today screen is not the confirmation list. Send `POST /api/oath-pause` with `paused=true` and that revision only after confirmation. A `pause_preview_changed` conflict requires a fresh summary and confirmation. Resume sends only `paused=false`; it restores no withdrawn commitment. Endpoint implementation status is tracked in the [API contract](api-contract.md#original-oath-contract).

Future receipt finalization and settlement must preserve the same account-first serialization. Pending proof/correction/terminal test fixtures establish pause preservation only; they do not establish real evidence or reward processing.

## Player characters

MVP-17 adds `GET` and `POST /api/characters` and `PUT /api/characters/active`, see the [contract](api-contract.md#player-character-contract). Apply the migrations `Version20260926100000` to `Version20260926120000` before use. The second of them deletes local Oaths, previews and acceptance requests, because no production data exists. The third moves the pause flag from the account to its characters. Every Oath endpoint except preview reads and acceptance needs an active character and otherwise answers `409 character_required`.

The preset catalog lives in `apps/api/resources/character/presets_v2.json`. Migration `Version20260927100000` adds the character build and sets existing characters to `thin`. Rolling it back drops the column, so applying it again makes every character `thin`. Name normalization uses the declared `symfony/polyfill-intl-normalizer`, because the runtime image has no `ext-intl`. Mobile creates the request identity with `expo-crypto` and stores a pending creation in SecureStore before sending. Pending Oath acceptances are stored per account and character. The demo runs the real creation and change-character screens against a DUMMY character client, see [demo README](../../apps/mobile/demo/README.md). Starter presets are listed in the [preset manifest](../art/player-preset-assets.md).

## Proof image normalization and storage

MVP-07-T02 adds the API side of [ADR 0008](../decisions/0008-proof-storage-and-upload.md). Since MVP-07-T03 the [proof submission endpoint](api-contract.md#proof-submission-contract) uses it. Apply migration `Version20261001100000` for its `proof_submission` table. The API image now builds GD with JPEG and PNG support and sets `upload_max_filesize` to 12M and `post_max_size` to 13M. It also sets `display_errors = stderr` and `display_startup_errors = Off`, because a displayed startup warning for a body over `post_max_size` was printed before the headers and turned the 413 JSON into 200 HTML. `ProofImageNormalizer` accepts a JPEG of at most 10,485,760 bytes, 2880 px on the long edge and 9 megapixels, checks the header before decoding and then re-encodes with GD at quality 85. A JPEG whose structure never reaches its end marker is refused as `unreadable_image`, because GD silently fills a truncated scan with grey. A JPEG with more than 32 scans is refused the same way, a local bound against CPU cost. Decoding and re-encoding a 2880 x 2880 JPEG of 7.4 MB in a bare PHP CLI process raised `memory_get_peak_usage(true)` from 9.1 to 51.2 MiB. The process high-water mark `VmHWM` from `/proc/self/status` rose from 32.4 to 76.3 MiB, so allocations outside the PHP limit stay near 2 MiB. Measured in the container on 2026-10-01. The default 128M `memory_limit` stays.

`FilesystemProofStorage` writes objects with random 32-hex names to `PROOF_STORAGE_DIR`. Compose mounts the named volume `proof_storage` at `/var/lib/oathforge/proofs` for every PHP service. Without the variable, the directory is `apps/api/var/proofs`. Both locations are outside `public/` and nothing serves them directly. Directories are created with mode 0700 and files with mode 0600. `deleteStaged` removes only the staged copy, so a purge never removes an object promoted after listing.

From the migrated API runtime run `php bin/console app:proof:purge-staging --limit=100` (MVP-07-T07). The limit is 1 to 1000 (default 100). It deletes staged objects whose staging time is strictly older than 24 hours by the server clock. An object staged at T stays at T + 24 h and goes at T + 24 h + 1 s. A staged key that a `proof_submission` row references is kept and reported, and the run exits nonzero, because a committed row should always point at a promoted object. Promoted objects are never touched. The same run removes leftover `.tmp-` write files of a crashed upload by the same rule, bounded by its own `--limit`. Their age is the file system time, which equals the server clock in production. Output is one counts line plus `REFERENCED_KEY` and `FAILED_KEY` lines, never object bytes. Any failed deletion is counted, the rest of the batch still runs, and the exit code is nonzero. A failed listing or reference check stops the staged pass. The temporary pass runs on its own. The counts and key lines of the work done so far are still printed, followed by `STAGING_PURGE_UNAVAILABLE`, and the exit code is nonzero. Failed keys are retried on the next run. The list is sorted by key without a cursor, so more than `--limit` persistently failing or referenced keys would hold the batch. Scheduling and monitoring this daily command stay pending like `app:oath:reconcile`.

## Mobile proof screen

MVP-07-T09 adds `expo-image-picker` and `expo-image-manipulator` 57.0.20. An active Oath's detail offers Prześlij dowód / Submit proof, which opens `src/proof/ProofScreen.tsx`. The player picks the photo or activity-record route with its rule from the Oath snapshot, takes a photo or chooses one from Photos, confirms the snapshot declaration and sends. Owner decisions D1 to D3 in [ADR 0008](../decisions/0008-proof-storage-and-upload.md) apply.

- `src/proof/capture.ts` asks for the camera permission before the camera opens. Photos uses the system picker, which needs no library permission, so the app never asks for full library access. Picker options request images only, `exif: false`, `allowsEditing: false` and `shouldDownloadFromNetwork: true`, so a photo kept only in iCloud can be chosen. The picker's copy is deleted after normalizing. The normalized JPEG is deleted when it is replaced, when the controller holds its own copy and when the screen closes.
- `src/proof/normalizeImage.ts` always resizes once, to the picker's upright size capped at 2880 px on the long edge, and saves a new JPEG at quality 0.85. The resize redraws the pixels upright, so the file never relies on an Orientation tag, which the API's GD re-encode ignores. It does not enlarge an image, which relies on the iOS picker reporting the upright size. If the rendered image is still above 2880 px, a defensive second pass resizes it. The client never requests the source EXIF. The iOS encoder still writes technical defaults into the new JPEG: Orientation 1, resolution, color space and pixel dimensions, with no GPS, camera or dates. The MVP-07-T11 capture also found an APP13 Photoshop segment. The API re-encodes with GD, which removes all metadata from the stored object.
- `app.json` configures the picker plugin with English `cameraPermission` and `photosPermission` and `microphonePermission: false`. Polish prompts come from Expo's `locales` setting, which writes `pl.lproj/InfoPlist.strings` from `src/localization/native/pl.json`. The demo config rewrites these paths, because Expo resolves them against `demo/`. Source: [Expo app metadata localization](https://docs.expo.dev/guides/localization/#translating-app-metadata), checked 2026-10-01.
- The proof screen reads controller answers only for its own Oath: the Oath it sent or the Oath of the pending proof. A pending proof of another Oath blocks the form with a note, Send again and the way back. Delete is offered only on that proof's own Oath. If the screen closes while its send waits for the copy, the normalized image is deleted only after the send settles.
- MVP-07-T10: a `proof_pending` detail shows `oath.proofPending` and the server `proof.receivedAt` as "Czas odebrania" / "Receipt time", in the Oath's committed zone with its zone label and the History date format. While the controller holds a record, its Oath's Today row and detail show the interrupted upload with Wyślij ponownie / Send again, which calls `recover()`. Only the detail also offers Usuń kopię z tego urządzenia / Delete the copy on this device (`discard()`, the same label as on the proof screen), without a confirmation step, because the app has no confirmation pattern and the proof screen deletes the same way. During the resend the line says the proof is being sent. A 200 or 201 hands the server Oath to the detail and the Today row. A final refusal clears the record in the controller, which keeps its Oath and code as `lastRefusal`, also after the automatic resend on load. The controller keeps it only for a resend or for a code that closes the Oath to proof (`receipt_cutoff_passed`, `oath_not_active`, `proof_already_submitted`), because the proof screen already showed the other refusals of the player's own send. The reason then shows on that Oath's Today row and detail until the player chooses Rozumiem / Got it in the detail or sends again, and the detail or list is asked again. During a delete the line reads Usuwanie kopii dowodu… / Deleting the proof copy…, on the detail and on the proof screen. A lost reply leaves a received Oath with its record. When the shown Oath already holds the record's `submissionId`, the screen shows only the receipt and calls `recover()` once per submission while it is open. The replay returns the original receipt and clears the record.
- `expo-file-system` (MVP-07-T08), `expo-image-picker` and `expo-image-manipulator` are native modules, so the app and the demo need a new development build. Expo Go and a bundle do not show the prompts or the camera. The MVP-07-T11 results and the open native gates are in [testing](testing.md#proof-submission-acceptance-mvp-07-2026-10-01).
- The demo's DUMMY wire check sends the real multipart upload to a local capture server with a DUMMY bearer. Authentication code is unchanged. See the [demo README](../../apps/mobile/demo/README.md#dummy-wire-check-mvp-07-t11).

## Mobile Oath transport boundary

Local implementation choices for MVP-05-T08, 2026-09-25: validate the known catalog/policy version and policy values, dynamic deadline relationships and complete bilingual copy shape before rendering server data. Display stored server copy; a bundled validator must not replace an accepted snapshot with newer text. Unknown or malformed payloads are recoverable transport failures, never gameplay outcomes.

Complete rule snapshots make commitment lists larger than authentication responses. The Oath client uses a bounded 4 MiB list budget; ordinary single responses retain 64 KiB. Streamed byte counting remains authoritative even without Content-Length. These are response safety bounds, not product quotas. Pause summaries describe the full affected set and are not capped to a list page. Authentication and profile endpoints retain their strict existing response defaults.

Pending acceptance stores account/preview/request identifiers only, with the session store's device-only Keychain accessibility. It does not store tokens, proof or rule snapshots. Network acceptance waits for a successful durable write; ambiguous delivery reuses the saved identity after restart. Real iOS Keychain persistence and signed-provider reauthentication remain separate native acceptance gates.

## Mobile original-Oath review

The creation flow uses the app-owned Oath client and a session-bound controller. Activity, activation choice and completion date/time are explicit choices. The form retains user-entered local values; nonexistent times require correction, and repeated times require a server-provided explicit UTC offset. A preview remains separate from acceptance.

Before confirmation, the screen renders the complete stored bilingual rule copy, selected activity, activation choice, D and S, with the committed IANA zone and resolved offset. Changing display language selects the saved translation. Only the explicit acceptance action enters the durable confirmation flow. Lost responses expose recovery of the existing acceptance; superseded rules or elapsed timing require a new preview and review. The resulting detail uses the authoritative commitment response and does not imply proof submission or awarded XP.

These screens use existing mobile controls/tokens and a scrolling column with growing text. Component tests and an iOS export establish local wiring/packaging; signed-device layout, Keychain, VoiceOver and system Dynamic Type remain the separate acceptance matrix above.

## Mobile Today, history and pause

The completed-profile destination exposes Today, creation, owner-only detail and terminal history. Lists retain the server's ordering and include future scheduled and overdue pending commitments. Date groups use each commitment's saved zone; changing the device locale or zone cannot hide pending work or move its deadline. Only server state determines the displayed outcome. History does not infer awarded XP or linked Recovery from policy text.

Pause first loads the complete affected set and owner details for every listed commitment, so the confirmation identifies activity and deadline instead of opaque IDs. A changed revision requires a refreshed summary and renewed confirmation. Successful pause/resume refreshes lists from their first page; resume never restores withdrawn commitments. Pending acceptance recovery remains available alongside these views. Proof, outcome settlement, actual reward balances and Recovery actions remain downstream work.

## MVP-05 acceptance handoff

The creation/tracking implementation has passed the final local checks recorded in the [verification matrix](testing.md#mvp-05-local-verification-and-release-gates). Native inspection remains open because Device Hub window access failed with `cgWindowNotFound`. A resumable DUMMY fixture is retained at `graphics/mvp-05/ui/native-oath-preview.tsx`; copy it to `.expo` only for an explicitly temporary development entrypoint, then restore the normal entrypoint. It uses fake API/memory storage/denied-permission boundaries, never live authentication, Keychain, proofs or rewards. Its Restart control remounts controllers; it does not establish process-restart durability.

The final native attempt also observed Metro binding `::1` while Expo opened `127.0.0.1`. A process-only `NODE_OPTIONS=--dns-result-order=ipv4first` retry bound the expected IPv4 loopback address, but did not resolve window access. This is recorded environment evidence, not an application networking change. Temporary servers and the isolated `oathforge-mvp05-tests` project were removed after verification; the developer's existing runtime was preserved.

Before release, complete the signed-device/provider and native accessibility matrix, deploy scheduling/monitoring for the reconciler, and integrate the downstream receipt/review/outcome/reward/Recovery owners. The current unknown-availability review path remains conservative until real availability evidence exists.

### First-Oath simulator demo

From `apps/mobile`, run `npm run demo -- --ios --localhost` using the repository Node version. The isolated development project on port 8082 starts at an empty Polish Forge; the small DEMO control opens PL/EN and synthetic returning/offline/lost-response scenarios. Production `index.ts` stays unchanged. See [demo instructions and limits](../../apps/mobile/demo/README.md). Production export of the demo is rejected; the ordinary application export remains separate. No Apple membership or live credentials are required for this UI-only simulator flow. A task worktree may link `apps/mobile/node_modules` to another checkout. The demo Metro config resolves that link to its real path and watches it, so the demo runs from such a worktree without a copy (local decision, MVP-18, 2026-09-26).

### Demo development build and React Native patch

Expo Go cannot show native fixes. React Native 0.86.3 on iOS applies a stale image response to a recycled image view ([react/react-native issue 58667](https://github.com/react/react-native/issues/58667)). The Oath creation backdrop then showed the state seal sheet. The upstream fix [53bf98b](https://github.com/react/react-native/commit/53bf98bf40713fad1bbe00a652d2aabce8b91eb1) (PR 58669, landed 2026-09-25) is backported as a patch. Image acceptance therefore needs this development build of the demo. See [ADR 0006](../decisions/0006-react-native-image-patch.md) and the [verification](testing.md#main-menu-acceptance-mvp-18-2026-09-26).

Patch mechanism:

- `apps/mobile/patches/react-native+0.86.3.patch` holds the upstream diff unchanged. [patch-package](https://github.com/ds300/patch-package) 8.0.1 applies it from the `postinstall` script with `--error-on-fail`, so `npm ci` fails on a mismatch. Regenerate it with `npx patch-package react-native` after editing the file in `node_modules`.
- patch-package is a devDependency, so `npm ci --omit=dev` fails in `postinstall`. No pipeline installs that way today.
- `scripts/reactNativePatch.test.js` fails when the patch, the pinned version, the installed fix, the source build setting or the scene setting is missing.
- The patch lands in the `node_modules` the build uses. A worktree whose `node_modules` links to another checkout would patch that checkout. Give such a worktree its own `npm ci` before a native build (local decision, MVP-18-T11, 2026-09-27).
- Drop the patch, its test and `ios.buildReactNativeFromSource` once the Expo SDK in use ships a React Native release containing 53bf98b. On 2026-09-27 it was in none of 0.86.3, 0.87.1 and 0.88.0-rc.2.

Source build: React Native 0.86 links precompiled core binaries by default. `scripts/react_native_pods.rb` in the 0.86.3 package sets `RCT_USE_PREBUILT_RNCORE` and `RCT_USE_RN_DEP` to `1` unless they are `0`. The precompiled core does not contain the patched file. `expo-build-properties` therefore sets `ios.buildReactNativeFromSource` ([Expo build properties for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/)). The generated Podfile sets both variables to `0` only with `||=`, so a value exported in the shell wins.

**An exported `RCT_USE_PREBUILT_RNCORE=1` or `RCT_USE_RN_DEP=1` silently links the unpatched prebuilt core.** Unset both before `pod install`. `pod install` must print `[ReactNativeCore] Building from source: true`. The build script below refuses to start when either variable is `1`, and it stops when `pod install` does not print that line. Expo modules are then built from source too.

iOS 27 SDK: an app without the UIScene life cycle stops at launch. The Expo SDK 57 template still creates its window in the app delegate. `expo-build-properties` sets `ios.enableSceneSupport`, which Expo documents as adopting the scene life cycle in an SDK 57 project "as required by the iOS 27 SDK" ([Expo build properties for SDK 57](https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/), expo-build-properties 57.0.22, expo/expo PR 50205 and 50221). It moves React Native startup to Expo's `ExpoAppSceneDelegate` and adds the scene manifest to `Info.plist`. It is a no-op on SDK 58, so remove it with that upgrade.

Prerequisites: Xcode with an iOS simulator runtime and CocoaPods (`brew install cocoapods`, 1.17.0 verified on 2026-09-27). The shell needs a UTF-8 locale, for example `LANG=en_US.UTF-8`. Without it CocoaPods 1.17.0 on Ruby 4.0.7 stopped with `Encoding::CompatibilityError` (local observation, 2026-09-29). The build needs no Apple account or signing. Native folders are generated and ignored (`apps/mobile/ios`, `apps/mobile/demo/ios`). The demo uses the unregistered placeholder bundle identifier `com.placeholder.oathforge.demo` for simulators only.

From `apps/mobile`, with the Node version from `.nvmrc` and the simulator booted:

```sh
npm ci
npm run demo:build-ios -- --device "iPhone 18 Pro" --port 8083
npm run demo -- --localhost --port 8083
# in another shell, once Metro is ready:
xcrun simctl launch "iPhone 18 Pro" com.placeholder.oathforge.demo
```

`scripts/demoIos.cjs` runs a clean `expo prebuild` of the demo, `pod install`, a Debug `xcodebuild` for the simulator and `simctl install`, with `NODE_ENV=development`, `OATHFORGE_DEMO=1` and `RCT_METRO_PORT` set. The Metro port is compiled into the binary, so `--port` must match in both commands. Port 8083 avoids a demo Metro that another worktree serves on 8082. `demo/package.json` declares `expo`, `react` and `react-native` with the app's ranges, so prebuild leaves it unchanged, and a test keeps the ranges equal. It also searches `../node_modules`, so autolinking links the same native modules as the app. `npx expo run:ios` is not used. On 2026-09-27 Expo CLI 57 treated a simulator listed by Xcode 27 `devicectl` as a physical device and stopped with "No code signing certificates are available to use". Metro serves the images in this Debug build, as in Expo Go. A Release build of the demo is impossible by design, because the demo rejects production bundles.
