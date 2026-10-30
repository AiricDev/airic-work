import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputUseCases } from '../src/application/input';
import { ApplicationPolicy } from '../src/application/policy';
import type { Runtime, Workspace } from '../src/application/ports';
import { createFileStorage } from '../src/bootstrap/bindings';
import { createPersistence } from '../src/bootstrap/bindings';
import { create, settings, user } from './contracts/control-store';

describe('real Files and SQLite upload boundary', () => {
    let directory: string;
    let filename: string;
    let resources: ReturnType<typeof createPersistence>;
    let storage: Awaited<ReturnType<typeof createFileStorage>>;
    let input: InputUseCases;
    let execution: Awaited<ReturnType<typeof create>>;
    const root = () => join(directory, 'blobs');
    const path = (hash: string) => join(root(), 'sha256', hash.slice(0, 2), hash);
    const unexpected = async (): Promise<never> => { throw new Error('Agent is outside this test'); };
    const runtime: Runtime = { ensure: unexpected, start: unexpected, accepted: unexpected, deliver: unexpected, stop: unexpected, stopped: unexpected };
    const workspace: Workspace = { ensure: unexpected, materialize: unexpected, stopped: unexpected };
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-upload-'));
        filename = join(directory, 'control.sqlite');
        resources = createPersistence({ filename, initialSettings: settings });
        storage = await createFileStorage({ directory: root() });
        await resources.store.ensureUser(user('owner'));
        await resources.store.ensureUser(user('other'));
        execution = await create(resources.store);
        input = new InputUseCases(storage.files, runtime, resources.store, resources.support, workspace, new ApplicationPolicy(resources.store, resources.support));
    });
    afterEach(async () => {
        resources.close();
        vi.restoreAllMocks();
        await rm(directory, { recursive: true, force: true });
    });

    it('saves the actual fixed descriptor and a file-only pending input without dispatching', async () => {
        const bytes = Buffer.from([0, 1, 255, 128]);
        const upload = await input.upload('owner', execution.id, 'input.bin', bytes);
        expect(upload).toMatchObject({ userId: 'owner', executionId: execution.id, name: 'input.bin', size: 4, hash: createHash('sha256').update(bytes).digest('hex') });
        expect(upload.contentRef).toBe(`sha256:${upload.hash}`);
        expect(await readFile(path(upload.hash))).toEqual(bytes);
        expect(await resources.store.upload(upload.id)).toEqual(upload);
        await input.submitSteering('owner', execution.id, 'file-only', '', [upload.id]);
        expect(await resources.store.inputs(execution.id)).toMatchObject([{ files: [upload.id], status: 'pending', kind: 'steering' }]);
        resources.close();
        resources = createPersistence({ filename, initialSettings: settings });
        expect(await resources.store.upload(upload.id)).toEqual(upload);
    });

    it('does not overwrite same-named files or use display names as host paths', async () => {
        const first = await input.upload('owner', execution.id, '../../escape.bin', Buffer.from('first'));
        const second = await input.upload('owner', execution.id, '../../escape.bin', Buffer.from('second'));
        expect(first.id).not.toBe(second.id);
        expect(first.contentRef).not.toBe(second.contentRef);
        expect(await readFile(path(first.hash), 'utf8')).toBe('first');
        expect(await readFile(path(second.hash), 'utf8')).toBe('second');
        await expect(stat(join(directory, 'escape.bin'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('deduplicates bytes without merging user or execution scopes', async () => {
        const other = await create(resources.store, 'other-execution', 'other');
        const ownerSecond = await create(resources.store, 'owner-second');
        const bytes = Buffer.from('shared content, distinct authority');
        const first = await input.upload('owner', execution.id, 'same.txt', bytes);
        const second = await input.upload('other', other.id, 'same.txt', bytes);
        expect(first.contentRef).toBe(second.contentRef);
        expect(first.id).not.toBe(second.id);
        await expect(input.submitSteering('other', other.id, 'forged', '', [first.id])).rejects.toMatchObject({ code: 'forbidden' });
        await expect(input.submitSteering('owner', ownerSecond.id, 'cross-execution', '', [first.id])).rejects.toMatchObject({ code: 'forbidden' });
        expect(await resources.store.inputs(other.id)).toEqual([]);
        expect(await resources.store.inputs(ownerSecond.id)).toEqual([]);
    });

    it('rejects unauthorized uploads before invoking Blob storage', async () => {
        const put = vi.spyOn(storage.files, 'put');
        await expect(input.upload('other', execution.id, 'secret.bin', Buffer.from('private'))).rejects.toMatchObject({ code: 'forbidden' });
        expect(put).not.toHaveBeenCalled();
        await expect(stat(join(root(), 'sha256'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('leaves only complete unbound content if the database upload commit fails', async () => {
        const bytes = Buffer.from('complete orphan');
        const hash = createHash('sha256').update(bytes).digest('hex');
        const raw = new Database(filename);
        try {
            raw.exec("CREATE TRIGGER fail_upload AFTER INSERT ON uploads BEGIN SELECT RAISE(ABORT, 'injected failure'); END");
            await expect(input.upload('owner', execution.id, 'fixed.txt', bytes)).rejects.toMatchObject({ code: 'conflict' });
            expect(raw.prepare('SELECT count(*) AS n FROM uploads').get()).toEqual({ n: 0 });
            expect(await readFile(path(hash))).toEqual(bytes);
            const originalInode = (await stat(path(hash))).ino;
            raw.exec('DROP TRIGGER fail_upload');
            const retried = await input.upload('owner', execution.id, 'fixed.txt', bytes);
            expect(retried.hash).toBe(hash);
            expect((await stat(path(hash))).ino).toBe(originalInode);
            expect(raw.prepare('SELECT count(*) AS n FROM uploads').get()).toEqual({ n: 1 });
        } finally { raw.close(); }
    });

    it('never calls saveUpload when a supposed existing Blob is corrupt', async () => {
        const bytes = Buffer.from('expected content');
        const hash = createHash('sha256').update(bytes).digest('hex');
        await mkdir(join(root(), 'sha256', hash.slice(0, 2)), { recursive: true });
        await writeFile(path(hash), 'wrong');
        const save = vi.spyOn(resources.store, 'saveUpload');
        await expect(input.upload('owner', execution.id, 'file.bin', bytes)).rejects.toMatchObject({ code: 'blocked' });
        expect(save).not.toHaveBeenCalled();
        expect(await readFile(path(hash), 'utf8')).toBe('wrong');
    });
});
