import { spawn } from 'node:child_process';
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMethods } from '../src/bootstrap/methods';
import { configuration, options, repository } from './support/git-methods';
import type { Method } from '../src/domain/model';

type Result = { ok: boolean; code?: string; result?: unknown };
async function reader() {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/methods-process.mjs', import.meta.url))], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let diagnostics = '';
    let result: Result | undefined;
    child.stderr!.on('data', chunk => { diagnostics += String(chunk); });
    const ready = new Promise<void>((resolve, reject) => {
        child.once('message', () => resolve());
        child.once('error', reject);
        child.once('exit', () => reject(new Error('Methods worker exited before ready')));
    });
    const done = new Promise<Result>((resolve, reject) => {
        child.on('message', message => { if ('ok' in (message as object)) result = message as Result; });
        child.once('error', reject);
        child.once('exit', (code, signal) => {
            if (code === 0 && result) resolve(result);
            else reject(new Error(`Methods worker failed: ${signal ?? code} ${diagnostics}`));
        });
    });
    void done.catch(() => {});
    const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.once('exit', () => clearTimeout(timer));
    await ready;
    return (payload: object) => { child.send(payload); return done; };
}

describe('Methods independent process coordination', () => {
    let directory: string;
    let source: string;
    let config: ReturnType<typeof options>;
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-method-process-'));
        source = await repository(directory);
        config = options(directory, source);
    });
    afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

    it('publishes only complete snapshots under independent process synchronization', async () => {
        const readers = await Promise.all([reader(), reader()]);
        const results = await Promise.all(readers.map(run => run({ options: config, configuration })));
        expect(results.some(r => r.ok)).toBe(true);
        expect(results.filter(r => !r.ok).every(r => r.code === 'blocked')).toBe(true);
        const method = results.find(r => r.ok)!.result as Method;
        const reopened = await createMethods(config);
        expect(await reopened.methods.read(method, 'om.md')).toContain('Root marker');
        expect(await reopened.methods.latest(configuration)).toEqual(method);
    }, 20000);

    it('builds the same index transactionally from two offline snapshot readers', async () => {
        const { methods } = await createMethods(config);
        const method = await methods.latest(configuration);
        await rename(source, `${source}-offline`);
        try {
            const readers = await Promise.all([reader(), reader()]);
            const results = await Promise.all(readers.map(run => run({ options: config, method, query: '判断标准' })));
            expect(results.every(r => r.ok), JSON.stringify(results)).toBe(true);
            expect(results[0].result).toEqual(results[1].result);
            expect(results[0].result).toMatchObject([{ path: 'guides/判断.md' }]);
        } finally { await rename(`${source}-offline`, source); }
    }, 20000);
});
