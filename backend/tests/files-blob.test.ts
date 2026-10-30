import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { chmod, lstat, mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createFileStorage } from '../src/bootstrap/files';

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

describe('local Files Blob', () => {
    let directory: string;
    let root: string;
    let storage: Awaited<ReturnType<typeof createFileStorage>>;
    const path = (hash: string) => join(root, 'sha256', hash.slice(0, 2), hash);
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-blob-'));
        root = join(directory, 'blobs');
        storage = await createFileStorage({ directory: root });
    });
    afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

    it.each([
        ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
        ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ])('fixes the known SHA-256 vector for %j', async (text, hash) => {
        const bytes = Buffer.from(text);
        expect(await storage.files.put(bytes)).toEqual({ hash, size: bytes.length, contentRef: `sha256:${hash}` });
        expect(await readFile(path(hash))).toEqual(bytes);
    });

    it('stores binary and Unicode bytes without decoding or normalization', async () => {
        for (const bytes of [Uint8Array.from([0, 255, 0, 128, 13, 10]), Buffer.from('中文\né\u0000👋')]) {
            const result = await storage.files.put(bytes);
            expect(result).toEqual({ hash: digest(bytes), size: bytes.byteLength, contentRef: `sha256:${digest(bytes)}` });
            expect(await readFile(path(result.hash))).toEqual(Buffer.from(bytes));
            expect(result.contentRef).not.toContain(root);
        }
    });

    it('snapshots the exact supplied subarray before the first asynchronous operation', async () => {
        const source = Buffer.from([90, 1, 2, 3, 90]);
        const expected = Buffer.from([1, 2, 3]);
        const pending = storage.files.put(source.subarray(1, 4));
        source.fill(0);
        const result = await pending;
        expect(result.hash).toBe(digest(expected));
        expect(result.size).toBe(3);
        expect(await readFile(path(result.hash))).toEqual(expected);
    });

    it('deduplicates without changing the published inode or its modification time', async () => {
        const bytes = Buffer.from('fixed');
        const original = await storage.files.put(bytes);
        const before = await stat(path(original.hash));
        expect(await storage.files.put(bytes)).toEqual(original);
        const after = await stat(path(original.hash));
        expect([after.ino, after.mtimeMs, after.nlink]).toEqual([before.ino, before.mtimeMs, 1]);
        expect(await readdir(join(root, 'sha256', original.hash.slice(0, 2)))).toEqual([original.hash]);
        if (process.platform !== 'win32') {
            expect(after.mode & 0o777).toBe(0o400);
            expect((await stat(root)).mode & 0o777).toBe(0o700);
        }
    });

    it('keeps different byte sequences independently immutable', async () => {
        const first = await storage.files.put(Buffer.from('first'));
        const second = await storage.files.put(Buffer.from('second'));
        expect(first.contentRef).not.toBe(second.contentRef);
        expect(await readFile(path(first.hash))).toEqual(Buffer.from('first'));
        expect(await readFile(path(second.hash))).toEqual(Buffer.from('second'));
    });

    it('arbitrates concurrent same-content and different-content uploads on disk', async () => {
        const bytes = Buffer.from('concurrent');
        const results = await Promise.all(Array.from({ length: 16 }, () => storage.files.put(bytes)));
        expect(results.every(r => r.contentRef === results[0].contentRef)).toBe(true);
        expect(await readFile(path(results[0].hash))).toEqual(bytes);
        expect((await stat(path(results[0].hash))).nlink).toBe(1);
        const different = await Promise.all(Array.from({ length: 8 }, (_, index) => storage.files.put(Buffer.from(`value-${index}`))));
        expect(new Set(different.map(r => r.contentRef)).size).toBe(8);
        expect((await readdir(join(root, 'sha256', results[0].hash.slice(0, 2)))).some(name => name.endsWith('.tmp'))).toBe(false);
    });

    it('reopens an existing root without replacing or resetting any content', async () => {
        const bytes = Buffer.from('survives reopening');
        const original = await storage.files.put(bytes);
        const reopened = await createFileStorage({ directory: root });
        expect(await reopened.files.put(bytes)).toEqual(original);
        expect(await readFile(path(original.hash))).toEqual(bytes);
    });

    it.each(['short', 'same-size'])('refuses existing %s corruption instead of overwriting it', async kind => {
        const bytes = Buffer.from('original');
        const hash = digest(bytes);
        await mkdir(join(root, 'sha256', hash.slice(0, 2)), { recursive: true });
        const corrupt = Buffer.from(kind === 'short' ? 'x' : 'modified');
        await writeFile(path(hash), corrupt, { mode: 0o600 });
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked' });
        expect(await readFile(path(hash))).toEqual(corrupt);
        expect(await readdir(join(root, 'sha256', hash.slice(0, 2)))).toEqual([hash]);
    });

    it.each(['root', 'algorithm', 'shard', 'object'])('rejects a symlink at the %s boundary', async boundary => {
        const bytes = Buffer.from('do not follow');
        const hash = digest(bytes);
        const outside = join(directory, 'outside');
        await mkdir(outside);
        await writeFile(join(outside, 'untouched'), 'unchanged');
        if (boundary === 'root') {
            await rm(root, { recursive: true });
            await symlink(outside, root);
            await expect(createFileStorage({ directory: root })).rejects.toMatchObject({ code: 'blocked' });
        } else if (boundary === 'algorithm') {
            await symlink(outside, join(root, 'sha256'));
        } else if (boundary === 'shard') {
            await mkdir(join(root, 'sha256'));
            await symlink(outside, join(root, 'sha256', hash.slice(0, 2)));
        } else {
            await mkdir(join(root, 'sha256', hash.slice(0, 2)), { recursive: true });
            await symlink(join(outside, 'untouched'), path(hash));
        }
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked' });
        expect(await readdir(outside)).toEqual(['untouched']);
        expect(await readFile(join(outside, 'untouched'), 'utf8')).toBe('unchanged');
    });

    it('rejects non-directory storage components and a directory at the final blob path', async () => {
        const bytes = Buffer.from('not a directory');
        const hash = digest(bytes);
        await writeFile(join(root, 'sha256'), 'not a directory');
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked' });
        await rm(join(root, 'sha256'));
        await mkdir(path(hash), { recursive: true });
        await expect(storage.files.put(bytes)).rejects.toMatchObject({ code: 'blocked' });
        expect((await lstat(path(hash))).isDirectory()).toBe(true);
    });

    it('rejects relative roots and roots writable by untrusted local users', async () => {
        await expect(createFileStorage({ directory: 'relative/blobs' })).rejects.toMatchObject({ code: 'invalid' });
        if (process.platform !== 'win32') {
            await chmod(root, 0o777);
            try { await expect(createFileStorage({ directory: root })).rejects.toMatchObject({ code: 'blocked' }); }
            finally { await chmod(root, 0o700); }
        }
    });

    it('does not advertise a content reference when storage has become unavailable', async () => {
        await rm(root, { recursive: true });
        await writeFile(root, 'not storage');
        await expect(storage.files.put(Buffer.from('private data'))).rejects.toMatchObject({ code: 'blocked', message: 'blob storage unavailable' });
    });

    it('requires platform support for non-following file opens', () => {
        expect(typeof constants.O_NOFOLLOW).toBe('number');
    });
});
