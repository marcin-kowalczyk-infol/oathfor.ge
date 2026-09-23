#!/usr/bin/env python3
"""Verify the local Compose lifecycle in a disposable source copy and UUID project."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import tempfile
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    project = 'oathforge-lifecycle-' + uuid.uuid4().hex[:12]
    env = {**os.environ, 'OATHFORGE_API_PORT': '0'}
    with tempfile.TemporaryDirectory(prefix='oathforge-lifecycle-') as directory:
        checkout = Path(directory)
        # Copy only non-ignored source, including this task's uncommitted files.
        paths = subprocess.check_output(
            ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT,
        ).decode().split('\0')
        for name in filter(None, paths):
            source = ROOT / name
            if source.is_file() and not source.is_symlink():
                target = checkout / name
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
        api_env = checkout / 'apps/api/.env'
        original_env = (checkout / 'apps/api/.env.example').read_bytes() + b'\n# preserved lifecycle fixture\n'
        api_env.write_bytes(original_env)
        compose = ['docker', 'compose', '-p', project, '-f', str(checkout / 'compose.yaml')]

        def run(*args: str, check: bool = True, timeout: int = 240) -> subprocess.CompletedProcess:
            print('+ ' + ' '.join(args[:8]), flush=True)
            return subprocess.run([*compose, *args], cwd=checkout, env=env,
                                  check=check, timeout=timeout, text=True, stdout=subprocess.PIPE,
                                  stderr=subprocess.STDOUT)

        def start() -> None:
            result = run('up', '--build', '-d', '--wait', '--wait-timeout', '120', check=False, timeout=600)
            if result.returncode:
                print(result.stdout)
                raise RuntimeError('Single-command startup failed')
            with urllib.request.urlopen('http://' + run('port', 'api', '8000').stdout.strip() + '/api/health', timeout=5) as response:
                assert response.status == 200 and response.headers.get_content_type() == 'application/json'
                assert response.read() == b'{"status":"ok"}'
            run('exec', '-T', 'api', 'php', 'bin/console', 'app:check-database')
            services = run('ps', '--services', '--status', 'running').stdout.splitlines()
            assert 'worker' in services, 'Managed worker is missing'
            assert api_env.read_bytes() == original_env, 'Existing environment was overwritten'

        try:
            run('config', '--quiet')
            start()
            # Persistent synthetic values belong only to this disposable project.
            run('exec', '-T', 'postgres', 'psql', '-U', 'oathforge', '-d', 'oathforge', '-c',
                "CREATE TABLE lifecycle_probe (value text); INSERT INTO lifecycle_probe VALUES ('preserved');")
            run('exec', '-T', 'redis', 'redis-cli', 'SET', 'lifecycle-probe', 'preserved')
            start()  # Repeated up must also be safe.
            run('down')
            start()
            assert run('exec', '-T', 'postgres', 'psql', '-U', 'oathforge', '-d', 'oathforge', '-Atc',
                       'SELECT value FROM lifecycle_probe').stdout.strip() == 'preserved'
            assert run('exec', '-T', 'redis', 'redis-cli', 'GET', 'lifecycle-probe').stdout.strip() == 'preserved'

            # Override only the worker into the existing test-only fixture environment.
            override = checkout / 'lifecycle.json'
            fixture_env = {'APP_ENV': 'test', 'MESSENGER_TRANSPORT_DSN': 'redis://redis:6379/lifecycle',
                           'MESSENGER_FAILURE_DSN': 'redis://redis:6379/lifecycle-failed'}
            override.write_text(json.dumps({'services': {'worker': {'environment': fixture_env}}}))
            compose.extend(['-f', str(override)])
            run('up', '-d', '--wait', '--wait-timeout', '60', 'worker')
            probe_id = uuid.uuid4().hex[:24]
            php = ("require 'vendor/autoload.php'; $k = new App\\Kernel('test', true); $k->boot(); "
                   "$k->getContainer()->get('messenger.default_bus')->dispatch("
                   "new App\\Tests\\Fixtures\\ProbeMessage('" + probe_id + "')); ")
            run('exec', '-T', 'worker', 'php', '-r', php)
            deadline = time.monotonic() + 20
            while run('exec', '-T', 'worker', 'test', '-f', '/app/var/probe-' + probe_id + '.done', check=False).returncode:
                if time.monotonic() >= deadline:
                    raise RuntimeError('Managed worker did not consume synthetic message')
                time.sleep(0.5)
            assert run('exec', '-T', 'worker', 'cat', '/app/var/probe-' + probe_id + '.done').stdout == 'handled'
            run('down')
            # A real Composer error, without changing the user's checkout or adding a fault switch.
            (checkout / 'apps/api/composer.json').write_text('{invalid lifecycle fixture')
            result = run('up', '-d', '--wait', '--wait-timeout', '60', check=False, timeout=120)
            assert result.returncode != 0, 'Bootstrap failure must propagate'
            running = run('ps', '--services', '--status', 'running').stdout.splitlines()
            assert not {'api', 'worker'} & set(running), 'Dependents started after bootstrap failure'
            assert api_env.read_bytes() == original_env
            print('PASS: clean/repeated startup, managed delivery, persistence and bootstrap failure')
            return 0
        except (subprocess.SubprocessError, RuntimeError, AssertionError) as error:
            print(f'FAIL: {error}')
            print(run('logs', '--no-color', '--tail', '40', check=False).stdout)
            return 1
        finally:
            run('down', '--volumes', '--remove-orphans', timeout=120)


if __name__ == '__main__':
    raise SystemExit(main())
