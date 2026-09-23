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

Runtime prerequisites: Ctype, iconv, PCRE, Session, SimpleXML and Tokenizer for [Symfony 7.4](https://symfony.com/doc/7.4/setup.html); DOM, JSON, libxml, mbstring, XML and XMLWriter for [PHPUnit 12.5](https://docs.phpunit.de/en/12.5/installation.html). PHP 8.5 satisfies Symfony's PHP 8.2+ and PHPUnit's PHP 8.3+ floors. [PHPStan](https://phpstan.org/user-guide/getting-started) requires PHP 7.4+; [Composer](https://getcomposer.org/doc/00-intro.md) requires PHP 7.2.5+. Sources checked 2026-09-23. Required extensions were present in `php -m`; coverage drivers are optional and not installed.

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
