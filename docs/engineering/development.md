# Development guide

Status: documentation foundation. No PHP/Node dependencies or app scripts exist yet.

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

## API runtime recipe — selected, installation pending

MVP-02-T01, local engineering selection, 2026-09-23: use PHP 8.5.x CLI, Composer 2.x, Symfony components constrained to `7.4.*`, PHPUnit `^12.5` and PHPStan `^2.1`. Exact dependency patches will be recorded by T02 in `composer.lock`; this recipe does not claim an installed application.

Compatibility sources checked 2026-09-23:

- Symfony 7.4 requires PHP 8.2+ with Ctype, iconv, PCRE, Session, SimpleXML and Tokenizer. The selected PHP is above that floor. [Symfony 7.4 setup](https://symfony.com/doc/7.4/setup.html).
- PHPUnit 12 requires PHP 8.3+ and DOM, JSON, libxml, mbstring, XML and XMLWriter. Coverage drivers are optional for the initial test run. [PHPUnit 12.5 installation](https://docs.phpunit.de/en/12.5/installation.html).
- PHPStan requires PHP 7.4+ and supports project-local Composer installation. Version 2.1 and analysis level 8 are local selections; dependency resolution and source analysis remain T02 checks. [PHPStan setup](https://phpstan.org/user-guide/getting-started).
- Composer 2 runs on PHP 7.2.5+; use the current stable 2.x tool and record the actual version during validation. [Composer requirements and installation](https://getcomposer.org/doc/00-intro.md).

Observed host inventory: `php --version` reports 8.5.7 and `composer --version` reports 2.10.1. `php -m` includes all extensions above, plus curl, OpenSSL and Zip for dependency downloads. No runtime prerequisite for this API slice is missing. PHPUnit, PHPStan and the application dependencies have not been installed. Redis, PostgreSQL and mobile tooling are outside this recipe; their readiness is unverified.

On a new macOS machine, install PHP using the [PHP macOS package instructions](https://www.php.net/manual/en/install.macosx.packages.php), selecting the 8.5 branch, then follow Composer's linked installer instructions (including its current checksum verification). Verify the installed CLI rather than assuming a package install selected it:

```sh
php --version
php -m
composer --version
```

### Proposed T02 scaffold procedure

These commands are for creating the scaffold once, not for an existing checkout. They have not been executed. First remove only `apps/api/.gitkeep` and its now-empty directory; stop if other files exist. From the repository root:

```sh
composer create-project symfony/skeleton:"7.4.*" apps/api --no-interaction
cd apps/api
composer require --dev 'phpunit/phpunit:^12.5' 'phpstan/phpstan:^2.1' 'symfony/browser-kit:7.4.*' 'symfony/css-selector:7.4.*'
```

T02 will retain Symfony's normal kernel, runtime and Flex configuration, constrain Symfony to 7.4, set the application's PHP requirement to `~8.5.0`, and preserve `composer.lock` and `symfony.lock`. Review generated configuration and provide `.env.example` with inert local values; real `.env` files stay ignored. No database, queue or private provider credentials are needed to boot this slice. These are local scaffold decisions using the [Symfony setup procedure](https://symfony.com/doc/7.4/setup.html) and [project security rules](../../.agents/rules/security.md).

T02 will configure PHPUnit bootstrap, test discovery and Symfony's test environment, with a real `KernelTestCase` boot check. BrowserKit enables T03's HTTP assertions. See [Symfony 7.4 testing](https://symfony.com/doc/7.4/testing.html). Proposed Composer scripts (not currently available):

```json
{
  "test": "phpunit --fail-on-empty-test-suite",
  "analyse": "phpstan analyse --no-progress"
}
```

PHPStan configuration will analyse `src/` and `tests/` at level 8, using a cache under ignored `var/`. Before claiming the harness works, T02 must run `composer validate --strict`, `composer install --no-interaction`, `composer check-platform-reqs`, `php bin/console about`, `composer test` and `composer analyse`. A nonempty passing kernel test is setup evidence; the missing-route 404 in T03 is the first intended behavioral red. Fresh-checkout HTTP startup is verified separately in T04.

## Troubleshooting the foundation

- Broken symlink: restore its relative target from the [agent guide](../../.agents/README.md). Do not maintain a second copy.
- Skill/role absent: restart the agent in this repository, check project trust/settings and supported version; use the documented manual fallback if the host lacks discovery.
- Missing graphics after clone: expected, because Git excludes the entire directory.
- App command missing: expected until scaffolding; do not invent successful build/test results.
