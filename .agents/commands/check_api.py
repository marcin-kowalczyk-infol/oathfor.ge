#!/usr/bin/env python3
"""Run API checks in an isolated, disposable Compose project (Python 3.11+)."""
from pathlib import Path
import json
import os
import shutil
import subprocess
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[2]


def main() -> int:
    project = 'oathforge-check-' + uuid.uuid4().hex[:12]
    compose = ['docker', 'compose', '-p', project]
    env = {**os.environ, 'OATHFORGE_API_PORT': '0'}
    api_env = ROOT / 'apps/api/.env'
    if not api_env.exists():
        shutil.copyfile(ROOT / 'apps/api/.env.example', api_env)

    def run(*args: str) -> None:
        print('+ ' + ' '.join(args), flush=True)
        subprocess.run(args, cwd=ROOT, env=env, check=True, timeout=600)

    try:
        run(*compose, 'config', '--quiet')
        run(*compose, 'up', '--build', '-d', '--wait', '--wait-timeout', '120')
        for command in [
            ['composer', 'validate', '--strict'],
            ['composer', 'check-platform-reqs'],
            ['php', 'bin/console', 'about'],
            ['composer', 'test'],
            ['composer', 'analyse'],
            ['composer', 'test:integration'],
            ['php', 'bin/console', 'doctrine:migrations:status'],
        ]:
            run(*compose, 'run', '--rm', '--no-deps', 'api', *command)
        address = subprocess.check_output(
            [*compose, 'port', 'api', '8000'], cwd=ROOT, env=env, text=True, timeout=30,
        ).strip()
        with urllib.request.urlopen(f'http://{address}/api/health', timeout=5) as response:
            if response.status != 200 or response.headers.get_content_type() != 'application/json' or json.load(response) != {'status': 'ok'}:
                raise RuntimeError('HTTP liveness contract failed')
        print('PASS: isolated API tests, static analysis, services and real HTTP')
        return 0
    except subprocess.CalledProcessError as error:
        return error.returncode or 1
    finally:
        # This UUID project was created by this invocation, never a user's existing project.
        subprocess.run([*compose, 'down', '--volumes', '--remove-orphans'], cwd=ROOT, env=env, check=True, timeout=600)


if __name__ == '__main__':
    raise SystemExit(main())
