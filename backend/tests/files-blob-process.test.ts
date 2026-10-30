import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileStorage } from '../src/bootstrap/files';

type Result = { ok: boolean; result: { hash: string; size: number; contentRef: string } };
async function writer(root: string) {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/blob-process.mjs', import.meta.url)), root], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let diagnostic = '';
    let result: Result | undefined;
    child.stderr!.on('data', chunk => { diagnostic += String(chunk); });
    const ready = new Promise<void>((resolve, reject) => {
        child.once('message', () => resolve());
        child.once('error', reject);
        child.once('exit', () => reject(new Error(`writer exited before ready: ${diagnostic}`)));
    });
    const done = new Promise<Result>((resolve, reject) => {
        child.on('message', message => { if ('ok' in (message as object)) result = message as Result; });
        child.once('error', reject);
        child.once('exit', (code, signal) => {
            if (code === 0 && result) resolve(result);
            else reject(new Error(`writer failed: ${signal ?? code} ${diagnostic}`));
        });
    });
    void done.catch(() => {});
    const timeout = setTimeout(() => child.kill('SIGKILL'), 10000);
    child.once('exit', () => clearTimeout(timeout));
    await ready;
    return (bytes: Uint8Array) => { child.send({ bytes: Buffer.from(bytes).toString('base64') }); return done; };
}

describe('Blob independent process competition', () => {
    let directory: string;
    let root: string;
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-blob-process-'));
        root = join(directory, 'nested', 'blobs');
    });
    afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

    it('initializes and publishes one immutable object when independent writers race', async () => {
        const bytes = Buffer.alloc(128 * 1024, 123);
        const writers = await Promise.all([writer(root), writer(root), writer(root)]);
        const results = await Promise.all(writers.map(write => write(bytes)));
        expect(results.every(r => r.ok)).toBe(true);
        expect(results.map(r => r.result)).toEqual([results[0].result, results[0].result, results[0].result]);
        const { hash } = results[0].result;
        const shard = join(root, 'sha256', hash.slice(0, 2));
        expect(await readdir(shard)).toEqual([hash]);
        expect((await stat(join(shard, hash))).nlink).toBe(1);
        expect(await readFile(join(shard, hash))).toEqual(bytes);
        const reopened = await createFileStorage({ directory: root });
        expect(await reopened.files.put(bytes)).toEqual(results[0].result);
    }, 20000);

    it('preserves both objects when different content races within the same shard', async () => {
        const seen = new Map<string, Buffer>();
        let pair: Buffer[] = [];
        for (let index = 0; index < 10000; index++) {
            const bytes = Buffer.from(`blob-${index}`);
            const prefix = createHash('sha256').update(bytes).digest('hex').slice(0, 2);
            const previous = seen.get(prefix);
            if (previous) { pair = [previous, bytes]; break; }
            seen.set(prefix, bytes);
        }
        expect(pair).toHaveLength(2);
        const writers = await Promise.all([writer(root), writer(root)]);
        const results = await Promise.all(writers.map((write, index) => write(pair[index])));
        expect(results.every(r => r.ok)).toBe(true);
        expect(results[0].result.hash).not.toBe(results[1].result.hash);
        for (let index = 0; index < 2; index++) {
            const { hash } = results[index].result;
            expect(await readFile(join(root, 'sha256', hash.slice(0, 2), hash))).toEqual(pair[index]);
        }
    }, 20000);
});
