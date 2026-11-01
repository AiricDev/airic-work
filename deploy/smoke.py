#!/usr/bin/env python3
"""Exercise the release image with synthetic configuration and an isolated Compose volume."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent
project = 'airic-release-smoke-' + secrets.token_hex(4)
environment = dict(os.environ, AIRIC_WORK_IMAGE=sys.argv[1] if len(sys.argv) > 1 else 'airic-work:preview')

with tempfile.TemporaryDirectory(prefix='airic-release-') as temporary:
    directory = Path(temporary)
    config = (root / 'airic-work.env.example').read_text()
    config = config.replace('AIRIC_MODEL_API_KEY=\n', 'AIRIC_MODEL_API_KEY=synthetic-never-used\n')
    config = config.replace('AIRIC_MCP_ENCRYPTION_KEY=\n', 'AIRIC_MCP_ENCRYPTION_KEY=' + secrets.token_hex(32) + '\n')
    (directory / 'airic-work.env').write_text(config)
    # Reuse the shipped service definition, without binding a host port.
    compose = (root / 'compose.yaml').read_text().replace('    ports:\n      - "127.0.0.1:${AIRIC_WORK_PORT:-8010}:8010"\n', '')
    (directory / 'compose.yaml').write_text(compose)
    command = ['docker', 'compose', '-p', project, '-f', str(directory / 'compose.yaml')]

    def run(*args, check=True):
        return subprocess.run(command + list(args), env=environment, text=True, capture_output=True, check=check)

    def node(code):
        return run('exec', '-T', 'airic-work', 'node', '--input-type=module', '--import', './backend/node_modules/tsx/dist/loader.mjs', '-e', code).stdout.strip()

    try:
        run('config', '--quiet')
        run('up', '-d', '--wait', '--wait-timeout', '60')
        node("""
            import assert from 'node:assert/strict';
            const base = 'http://127.0.0.1:8010';
            assert.equal(process.getuid(), 1000);
            assert.equal((await (await fetch(base + '/healthz')).json()).agentExecution, 'unavailable');
            for (const path of ['/', '/projects/example']) {
                const r = await fetch(base + path, {headers:{accept:'text/html'}});
                assert.equal(r.status, 200); assert.match(await r.text(), /<html/);
            }
            assert.equal((await fetch(base + '/api/v1/me')).status, 401);
            assert.equal((await fetch(base + '/api/missing')).status, 404);
            assert.equal((await fetch(base + '/.env')).status, 404);
            const {createPersistence, loadConfiguration} = await import('./backend/src/bootstrap/bindings.ts');
            const p = createPersistence(loadConfiguration().persistence);
            try { await p.store.ensureUser({id:'release-smoke', issuer:'synthetic', subject:'synthetic', name:'Synthetic', enabled:true, admin:false, version:0}); }
            finally {p.close();}
        """)
        original = run('ps', '-q', 'airic-work').stdout.strip()
        run('stop', '-t', '30')
        stopped = subprocess.run(['docker', 'inspect', original, '--format', '{{.State.ExitCode}}'], env=environment, text=True, capture_output=True, check=True).stdout.strip()
        assert stopped == '0', stopped
        run('up', '-d', '--force-recreate', '--wait', '--wait-timeout', '60')
        node("""
            import assert from 'node:assert/strict';
            const {createPersistence, loadConfiguration} = await import('./backend/src/bootstrap/bindings.ts');
            const p = createPersistence(loadConfiguration().persistence);
            try { assert.equal((await p.store.user('release-smoke')).subject, 'synthetic'); }
            finally {p.close();}
        """)
        print(json.dumps({'result': 'passed', 'checks': ['compose', 'non-root', 'health', 'ui/deep-link', 'api-auth', 'clean-stop', 'recreate/persisted-user']}, ensure_ascii=False))
    except subprocess.CalledProcessError as error:
        print(error.stdout, error.stderr, file=sys.stderr)
        print(run('logs', '--no-color', check=False).stdout, file=sys.stderr)
        raise
    finally:
        # Only the randomly named smoke project and its synthetic volume are removed.
        run('down', '--volumes', '--remove-orphans', check=False)
