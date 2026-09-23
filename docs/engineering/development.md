# Development guide

Status: API kernel and checks scaffolded; mobile and service integration are pending.

## Available now

Requirements: Git and Python 3.11+. See [commands](../../.agents/commands/README.md).

```sh
python3 .agents/commands/check_repository.py
git diff --check
mkdir -p graphics
```

The checker reads tracked/untracked non-ignored project files, resolves local Markdown file links, validates shared skills/role registration, and checks ignore behavior. It does not contact providers or prove application correctness.

## Application setup — pending

When scaffolding is requested:
- Select compatible supported Expo/React Native/Node versions from official documentation; record the versions and commit the chosen lockfile. No Expo SDK version is fixed by the previous chat. **Basis: [Expo monorepos](https://docs.expo.dev/guides/monorepos/); lockfile policy is local.**
- Create Symfony 7.4 LTS under `apps/api` using its normal structure; document PHP/extensions and commit Composer's lockfile. **Basis: [Symfony practices](https://symfony.com/doc/7.4/best_practices.html); version choice: [ADR 0001](../decisions/0001-project-foundation.md).**
- Replace this pending section with commands verified against actual manifests for install, run, test, lint, type/static analysis and migrations. **Local workflow.**
- Document configuration names in reviewed example files with placeholders. Do not put private tokens in examples, mobile variables or logs. **Basis: [security rules](../../.agents/rules/security.md).**

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

`composer test` runs PHPUnit with nonempty test discovery and a kernel boot check. `composer analyse` runs PHPStan level 8 over `src/` and `tests/`; generated caches stay ignored. The kernel harness follows [Symfony testing](https://symfony.com/doc/7.4/testing.html). The functional test verifies the public [liveness contract](api-contract.md), including its exact JSON body. Database, Messenger, mobile and CI are pending.

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
- Mobile/service commands are pending their scaffold tasks; the API commands above are available.

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

Copy `apps/api/.env.example` to `.env` before installation if absent. Compose environment overrides container connection settings. `OATHFORGE_API_PORT` can select another loopback port. Normal tests do not require services; integration commands will be introduced with their tests. Use `docker compose -p oathforge-local down` to stop this project while preserving its data. To discard only a disposable test project's volumes, run `docker compose -p YOUR_DISPOSABLE_PROJECT down --volumes`; never apply that command to data you intend to keep.

The initialization script creates `oathforge_test` alongside `oathforge` only on a new PostgreSQL volume. Existing volumes retain their contents. Doctrine DBAL and migrations are installed without ORM/domain entities. Inspect migration status with `docker compose -p oathforge-local run --rm api php bin/console doctrine:migrations:status`; generate a deliberate migration later with `doctrine:migrations:generate` and apply reviewed migrations with `doctrine:migrations:migrate`. An empty migration directory is expected now.

T05 verified on 2026-09-23: Docker Engine 29.4.0 / Compose 5.1.2; container PHP 8.5.10, phpredis 6.3.0, PostgreSQL 17.11 and Redis 7.4.11. Image build, empty database/test database initialization, Redis PING, locked Composer install/validation/platform checks, 2 tests / 5 assertions, PHPStan and migration status (zero migrations) passed. The same API tests passed with PostgreSQL and Redis stopped. HTTP through the loopback Compose port returned the liveness JSON. Service probes and actual message delivery are subsequent tasks.

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
