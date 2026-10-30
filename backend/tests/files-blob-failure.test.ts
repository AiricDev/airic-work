import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileStorage } from '../src/bootstrap/bindings';

vi.mock('node:fs/promises', async original => {
    const actual = await original<typeof fs>();
    return { ...actual, open: vi.fn(actual.open), link: vi.fn(actual.link), unlink: vi.fn(actual.unlink) };
});

describe('Blob filesystem failure boundaries', () => {
    let directory: string;
    let root: string;
    let storage: Awaited<ReturnType<typeof createFileStorage>>;
    let actual: typeof fs;
    const bytes = Buffer.from('fixed private bytes');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const shard = () => join(root, 'sha256', hash.slice(0, 2));
    const destination = () => join(shard(), hash);
    const failure = () => Object.assign(new Error('EIO /host/private/path fixed private bytes'), { code: 'EIO' });
    function reset() {
        vi.restoreAllMocks();
        vi.mocked(fs.open).mockImplementation(actual.open);
        vi.mocked(fs.link).mockImplementation(actual.link);
        vi.mocked(fs.unlink).mockImplementation(actual.unlink);
    }
    beforeEach(async () => {
        actual = await vi.importActual<typeof fs>('node:fs/promises');
        reset();
        directory = await actual.mkdtemp(join(tmpdir(), 'airic-blob-fault-'));
        root = join(directory, 'blobs');
        storage = await createFileStorage({ directory: root });
        root = await actual.realpath(root);
    });
    afterEach(async () => {
        reset();
        await actual.rm(directory, { recursive: true, force: true });
    });

    for (const method of ['writeFile', 'chmod', 'sync', 'close'] as const) {
        it(`does not publish incomplete content when staged ${method} fails`, async () => {
            vi.mocked(fs.open).mockImplementation(async (...args) => {
                const handle = await actual.open(...args);
                if (typeof args[1] === 'number' && (args[1] & constants.O_WRONLY)) {
                    if (method === 'writeFile') {
                        vi.spyOn(handle, 'writeFile').mockImplementationOnce(async () => {
                            await handle.write(bytes.subarray(0, 2));
                            throw failure();
                        });
                    } else vi.spyOn(handle, method).mockRejectedValueOnce(failure());
                }
                return handle;
            });
            await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked', message: 'blob storage unavailable' });
            expect(await actual.readdir(shard())).toEqual([]);
            reset();
            expect((await storage.files.put(bytes)).hash).toBe(hash);
            expect(await actual.readFile(destination())).toEqual(bytes);
        });
    }

    it('does not publish when the atomic link operation fails', async () => {
        vi.mocked(fs.link).mockRejectedValueOnce(failure());
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked', message: 'blob storage unavailable' });
        expect(await actual.readdir(shard())).toEqual([]);
    });

    it('fails closed after publication if directory synchronization fails, and safely retries', async () => {
        let published = false;
        vi.mocked(fs.link).mockImplementation(async (...args) => { await actual.link(...args); published = true; });
        vi.mocked(fs.open).mockImplementation(async (...args) => {
            const handle = await actual.open(...args);
            if (published && String(args[0]) === shard()) vi.spyOn(handle, 'sync').mockRejectedValueOnce(failure());
            return handle;
        });
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked' });
        expect(await actual.readFile(destination())).toEqual(bytes);
        reset();
        expect((await storage.files.put(bytes)).contentRef).toBe(`sha256:${hash}`);
    });

    it('never treats a failed read of an existing object as a successful deduplication', async () => {
        const original = await storage.files.put(bytes);
        vi.mocked(fs.open).mockImplementation(async (...args) => {
            if (String(args[0]) === destination()) throw failure();
            return actual.open(...args);
        });
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked', message: 'blob storage unavailable' });
        expect(await actual.readFile(destination())).toEqual(bytes);
        expect(await actual.readdir(shard())).toEqual([hash]);
        reset();
        expect(await storage.files.put(bytes)).toEqual(original);
    });

    it('keeps a complete orphan but does not return success if staging cleanup fails', async () => {
        vi.mocked(fs.unlink).mockRejectedValueOnce(failure());
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked' });
        expect(await actual.readFile(destination())).toEqual(bytes);
        expect(await actual.readdir(shard())).toEqual([hash]);
    });

    it('does not delete another writer or interrupted writer staging files during retry', async () => {
        await actual.mkdir(shard(), { recursive: true });
        const other = `.${hash}.other-writer.tmp`;
        await actual.writeFile(join(shard(), other), 'incomplete');
        expect((await storage.files.put(bytes)).hash).toBe(hash);
        expect(await actual.readFile(join(shard(), other), 'utf8')).toBe('incomplete');
        expect(await actual.readFile(destination())).toEqual(bytes);
    });

    it('reports cleanup failures safely without pretending the filesystem was repaired', async () => {
        vi.mocked(fs.link).mockRejectedValueOnce(failure());
        vi.mocked(fs.unlink).mockRejectedValueOnce(failure());
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked', message: 'blob storage unavailable' });
        const remaining = await actual.readdir(shard());
        expect(remaining).toHaveLength(1);
        expect(remaining[0]).toMatch(/^\..+\.tmp$/);
        expect(await actual.readFile(join(shard(), remaining[0]))).toEqual(bytes);
    });
});
