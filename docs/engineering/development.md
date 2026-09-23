# Development guide

Status: local API, PostgreSQL/Redis integration and bilingual Expo connectivity shell implemented. Hosted CI checks passed; native-device acceptance remains pending.

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
- Missing native PHP extensions: use the Compose runtime. Missing simctl/adb: native acceptance cannot run until a simulator/device is available.

## Local database and queue runtime

Local selection: [ADR 0002](../decisions/0002-local-infrastructure.md). Docker Engine with Compose is required. The PHP container supplies pdo_pgsql and redis; native PHP must provide the same extensions for service integration. PostgreSQL 17 and Redis 7.4 stay on the Compose network; dummy passwords are for this isolated local setup only.

From repository root (Docker service runtime):

```sh
docker compose -p oathforge-local build api
docker compose -p oathforge-local up -d --wait postgres redis
docker compose -p oathforge-local run --rm api composer install --no-interaction
docker compose -p oathforge-local run --rm api composer test
docker compose -p oathforge-local run --rm api composer analyse
docker compose -p oathforge-local up -d --wait api
curl --fail http://127.0.0.1:18082/api/health
```

Copy `apps/api/.env.example` to `apps/api/.env` before installation if absent. Compose environment overrides container connection settings. `OATHFORGE_API_PORT` can select another loopback port. Normal tests do not require services; `composer test:integration` requires PostgreSQL and Redis. Use `docker compose -p oathforge-local down` to stop this project while preserving its data. To discard only a disposable test project's volumes, run `docker compose -p YOUR_DISPOSABLE_PROJECT down --volumes`; never apply that command to data you intend to keep.

The initialization script creates `oathforge_test` alongside `oathforge` only on a new PostgreSQL volume. Existing volumes retain their contents. Doctrine DBAL and migrations are installed without ORM/domain entities. Inspect migration status with `docker compose -p oathforge-local run --rm api php bin/console doctrine:migrations:status`; generate a deliberate migration later with `doctrine:migrations:generate` and apply reviewed migrations with `doctrine:migrations:migrate`. An empty migration directory is expected now.

T05 verified on 2026-09-23: Docker Engine 29.4.0 / Compose 5.1.2; container PHP 8.5.10, phpredis 6.3.0, PostgreSQL 17.11 and Redis 7.4.11. Image build, empty database/test database initialization, Redis PING, locked Composer install/validation/platform checks, 2 tests / 5 assertions, PHPStan and migration status (zero migrations) passed. The same API tests passed with PostgreSQL and Redis stopped. HTTP through the loopback Compose port returned the liveness JSON. The service probes and delivery tests below are also implemented.

## Database transaction diagnostic

From repository root, with the local services running:

```sh
docker compose -p oathforge-local run --rm api php bin/console app:check-database
docker compose -p oathforge-local run --rm api composer test:integration
```

The CLI probe writes and reads one synthetic value in a temporary table, then rolls back. Success prints `DATABASE_OK` and exits 0. Failure prints only `DATABASE_UNAVAILABLE` and exits 1, with no raw exception/connection string. DBAL's PDO connection timeout is two seconds. Integration tests use the separate `oathforge_test` database and verify rollback cleanup plus a refused-port failure in a bounded subprocess. `composer test` excludes service integration tests; `composer test:integration` requires healthy services. No production entity, schema or user data is involved. Local diagnostic contract, MVP-02-T06.

## Redis worker verification

`composer test:integration` includes real Redis transport tests: enqueue leaves the handler idle until a separate `messenger:consume` process runs; a synthetic failure retries once then lands in the failed stream; a refused connection fails dispatch without a success receipt. Fixtures are registered only in `test`, use random per-test stream/receipt names, bound workers to ten seconds, and remove their own streams, delayed queues and files. This is infrastructure evidence, not reward idempotency or production monitoring.

Local Messenger configuration selects `async` and `failed` Redis streams with two-second connection/read timeouts, one immediate retry, and deletion after acknowledgement (the transport default). Production retry/backoff policy belongs to the operations epic. Source: [Symfony 7.4 Messenger](https://symfony.com/doc/7.4/messenger.html), checked 2026-09-23; exact retry choice is local.

For future routed application messages, run one worker with:

```sh
docker compose -p oathforge-local run --rm -e MESSENGER_CONSUMER_NAME=worker-1 api php bin/console messenger:consume async --time-limit=60
docker compose -p oathforge-local run --rm api php bin/console messenger:failed:show
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

Copy `apps/mobile/.env.example` to `apps/mobile/.env` if absent, set `EXPO_PUBLIC_API_BASE_URL` to an API address reachable by the selected client, then run `npm start` from `apps/mobile`. These variables are public bundle content; never put credentials in them. `EXPO_PUBLIC_DIAGNOSTIC_LOCALE=pl` or `en` selects the development diagnostic fixture; it does not settle the product's language-selection policy. Source: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/); fixture choice is local.

The shell starts pending, validates HTTP200, JSON content type and the exact `{ "status": "ok" }` body, then reports connection success. Network errors, invalid responses and an eight-second timeout show a localized retry action. Unmount aborts pending work, and responses arriving after timeout cannot change the result. Tests exercise both Polish and English, including accessible retry labels. This is a diagnostic screen, not onboarding or a product Oath flow.

For an Android emulator, the host alias is normally `10.0.2.2`; an iOS simulator can use host loopback. Physical devices need a reachable LAN address and an explicit local networking arrangement because Compose publishes only loopback. Native HTTP policy must be verified on the actual client; do not relax production transport security to pass a development smoke test. Sources: [Android emulator networking](https://developer.android.com/studio/run/emulator-networking), [Expo iOS simulator](https://docs.expo.dev/workflow/ios-simulator/), [React Native networking](https://reactnative.dev/docs/network), checked 2026-09-23.

Native acceptance is pending: the execution host has neither an available `simctl` nor `adb`. Required evidence is a real native screen connecting to this API, showing a recoverable error when the API stops, and succeeding after restart/retry. Unit/component tests and iOS/Android bundle exports do not satisfy that device acceptance.

## CI and acceptance status

[GitHub Actions checks](../../.github/workflows/checks.yml) run repository validation, the isolated API check above, npm ci, mobile tests/type checks, Expo compatibility and both native bundle exports. Actions are pinned to inspected upstream commits; token permissions are read-only. Local workflow choice: MVP-02-T11. Sources checked 2026-09-23: [workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax), [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), [setup-python](https://github.com/actions/setup-python).

The workflow passed on GitHub for commit `3853216` on 2026-09-23: [hosted run 35922303447](https://github.com/marcin-kowalczyk-infol/oathfor.ge/actions/runs/35922303447). Repository checks, API/PostgreSQL/Redis verification, mobile tests/types and both native bundle exports succeeded. Initial publication was explicitly authorized by the owner; this is CI evidence, not a production deployment. Native connectivity acceptance remains pending as described above. Dummy local database/application secrets are intentional development fixtures, not production provisioning; no external provider credentials or artwork are needed for this scaffold.

Local clean-checkout verification, 2026-09-23: a disposable clone of `9e1fea0` plus the intended CI diff passed repository checks, fresh isolated API build/install, 2 ordinary API tests / 5 assertions, 5 integration tests / 19 assertions, PHPStan, migration status and HTTP over a dynamically assigned loopback port. Mobile npm ci, 14 tests, strict types, Expo compatibility and both exports passed using only the example configuration. The API script removed its UUID project and volumes. That local check did not exercise hosted execution or a native screen; hosted evidence is recorded above.

Failure propagation was checked in the disposable checkout: temporary failing PHPUnit and Jest assertions each produced a nonzero exit; the API orchestrator still cleaned its project. Both temporary faults were removed. These local checks do not substitute for a GitHub Actions run.
