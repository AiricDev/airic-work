import { chmod, mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMethods } from '../src/bootstrap/methods';
import { RuleError } from '../src/domain/model';
import type { GitMethodSource } from '../src/adapters/driven/methods/repositories';
import * as runner from '../src/adapters/driven/methods/git';
import { commit, configuration, file, git, options, repository } from './support/git-methods';

describe('direct local OM repositories', () => {
    let directory: string;
    let source: string;
    const open = async (definition: GitMethodSource = source) => (await createMethods({ ...options(directory, source), sources: { repo: definition } })).methods;
    beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'airic-local-methods-')); source = await repository(directory); });
    afterEach(async () => { vi.restoreAllMocks(); await rm(directory, { recursive: true, force: true }); });

    async function clone() {
        const checkout = join(directory, 'checkout');
        await git(directory, 'clone', '--', source, checkout);
        return { checkout, methods: await open(checkout) };
    }

    it('runs, searches and reads history without a remote or an additional clone', async () => {
        const methods = await open();
        const run = vi.spyOn(runner, 'runGit');
        const method = await methods.latest(configuration);
        expect(method.sha).toBe(await git(source, 'rev-parse', 'HEAD'));
        expect(await methods.read(method, 'om.md')).toContain('Root marker');
        expect(await methods.search(method, '判断标准')).toMatchObject([{ path: 'guides/判断.md' }]);
        expect(await methods.history('repo')).toMatchObject({ commits: [{ sha: method.sha }], complete: true });
        expect(await methods.status(configuration)).toMatchObject({ source: 'repo', kind: 'local', sync: { enabled: false, reason: 'no-remote', message: expect.stringContaining('仍可使用') } });
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'blocked', message: expect.stringContaining('同步已禁用') });
        expect(run.mock.calls.every(([args]) => !args.includes('clone') && !args.includes('fetch') && !args.includes('ls-remote'))).toBe(true);
        expect(await readdir(join(directory, 'methods', 'mirrors'))).toEqual([]);
    });

    it('uses committed bytes, not dirty, staged or untracked files', async () => {
        const methods = await open();
        const sha = await git(source, 'rev-parse', 'main');
        await file(source, 'om.md', 'uncommitted-only');
        await git(source, 'add', 'om.md');
        await file(source, 'guides/new.md', 'untracked-only');
        const before = await git(source, 'status', '--porcelain');
        const method = await methods.latest(configuration);
        expect(method.sha).toBe(sha);
        expect(await methods.read(method, 'om.md')).toContain('Root marker');
        expect(await methods.search(method, 'uncommitted-only')).toEqual([]);
        await expect(methods.read(method, 'guides/new.md')).rejects.toMatchObject({ code: 'not-found' });
        expect(await git(source, 'status', '--porcelain')).toBe(before);
    });

    it('uses the configured branch without switching the working tree', async () => {
        const original = await git(source, 'rev-parse', 'main');
        await git(source, 'branch', 'release');
        await file(source, 'om.md', 'main update');
        await commit(source, 'Advance current branch');
        const methods = await open();
        expect((await methods.latest({ ...configuration, branch: 'release' })).sha).toBe(original);
        expect(await git(source, 'branch', '--show-current')).toBe('main');
        expect(await readFile(join(source, 'om.md'), 'utf8')).toBe('main update');
    });

    it.each([
        { names: ['backup'], expected: 'backup' },
        { names: ['backup', 'origin'], expected: 'origin' },
        { names: ['backup', 'origin'], upstream: 'backup', expected: 'backup', branch: 'release' },
        { names: ['backup', 'origin'], explicit: 'backup', expected: 'backup' },
    ])('selects a configured or unambiguous remote: %j', async ({ names, upstream, explicit, expected, branch }) => {
        for (const name of names) await git(source, 'remote', 'add', name, join(directory, 'remote'));
        if (upstream) {
            await git(source, 'config', 'branch.main.remote', upstream);
            await git(source, 'config', 'branch.main.merge', 'refs/heads/release');
        }
        const methods = await open({ kind: 'local', directory: source, remote: explicit });
        expect(await methods.status(configuration)).toMatchObject({ kind: 'local', sync: { enabled: true, remote: expected, branch: branch ?? 'main' } });
    });

    it('disables ambiguous remotes and notices configuration changes without reopening', async () => {
        await git(source, 'remote', 'add', 'first', source);
        await git(source, 'remote', 'add', 'second', source);
        const methods = await open();
        expect(await methods.status(configuration)).toMatchObject({ sync: { enabled: false, reason: 'ambiguous-remote' } });
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'blocked' });
        await git(source, 'remote', 'remove', 'second');
        expect(await methods.status(configuration)).toMatchObject({ sync: { enabled: true, remote: 'first' } });
        await git(source, 'remote', 'remove', 'first');
        expect(await methods.status(configuration)).toMatchObject({ sync: { enabled: false, reason: 'no-remote' } });
    });

    it.each(['ext::sh -c unwanted', 'http://host/repo', 'https://user:private@host/repo', 'https://host/repo?token=private'])('disables unsafe remote %j without leaking it', async url => {
        await git(source, 'remote', 'add', 'origin', url);
        const methods = await open();
        const status = await methods.status(configuration);
        expect(status).toMatchObject({ sync: { enabled: false, reason: 'unsupported-remote' } });
        expect(JSON.stringify(status)).not.toContain(url);
        expect(JSON.stringify(status)).not.toContain('private');
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'blocked' });
        expect((await methods.latest(configuration)).sha).toBe(await git(source, 'rev-parse', 'HEAD'));
    });

    it('recognizes SCP-style SSH remotes without probing the network', async () => {
        await git(source, 'remote', 'add', 'origin', 'git@example.com:team/om.git');
        const methods = await open();
        const run = vi.spyOn(runner, 'runGit');
        expect(await methods.status(configuration)).toMatchObject({ sync: { enabled: true, remote: 'origin' } });
        expect(run.mock.calls.every(([args]) => !args.includes('fetch') && !args.includes('ls-remote'))).toBe(true);
    });

    it('keeps local execution usable when a configured remote is unreachable', async () => {
        await git(source, 'remote', 'add', 'origin', join(directory, 'unreachable'));
        const methods = await open();
        const initial = await methods.latest(configuration);
        expect(await methods.status(configuration)).toMatchObject({ sync: { enabled: true } });
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'blocked' });
        expect(await methods.latest(configuration)).toEqual(initial);
        expect(await methods.history('repo')).toMatchObject({ complete: true });
    });

    it('fast-forwards only on explicit sync, preserves old snapshots and never executes hooks', async () => {
        const { checkout, methods } = await clone();
        const old = await methods.latest(configuration);
        await file(checkout, '.ome/scratch.md', 'author scratch');
        await file(checkout, '.git/hooks/post-merge', '#!/bin/sh\nprintf unsafe > hook-ran\n');
        await chmod(join(checkout, '.git/hooks/post-merge'), 0o700);
        await file(source, 'om.md', 'remote update');
        const next = await commit(source, 'Remote method update');
        expect(await methods.latest(configuration)).toEqual(old);
        expect(await readFile(join(checkout, 'om.md'), 'utf8')).toContain('Root marker');
        const synced = await methods.sync(configuration);
        expect(synced.sha).toBe(next);
        expect((await methods.latest(configuration)).sha).toBe(next);
        expect(await readFile(join(checkout, 'om.md'), 'utf8')).toBe('remote update');
        expect(await readFile(join(checkout, '.ome/scratch.md'), 'utf8')).toBe('author scratch');
        await expect(readFile(join(checkout, 'hook-ran'))).rejects.toMatchObject({ code: 'ENOENT' });
        expect(await methods.read(old, 'om.md')).toContain('Root marker');
        expect(await readdir(join(directory, 'methods', 'mirrors'))).toEqual([]);
    });

    it.each([false, true])('rejects sync with local modifications, staged=%s', async staged => {
        const { checkout, methods } = await clone();
        await file(checkout, 'om.md', 'local edits');
        if (staged) await git(checkout, 'add', 'om.md');
        const head = await git(checkout, 'rev-parse', 'HEAD');
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'conflict' });
        expect(await git(checkout, 'rev-parse', 'HEAD')).toBe(head);
        expect(await readFile(join(checkout, 'om.md'), 'utf8')).toBe('local edits');
    });

    it('refuses divergence without overwriting local commits', async () => {
        const { checkout, methods } = await clone();
        await file(checkout, 'local.md', 'local');
        const local = await commit(checkout, 'Local method change');
        await file(source, 'remote.md', 'remote');
        await commit(source, 'Remote method change');
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'conflict' });
        expect(await git(checkout, 'rev-parse', 'HEAD')).toBe(local);
        expect(await readFile(join(checkout, 'local.md'), 'utf8')).toBe('local');
        await expect(readFile(join(checkout, 'remote.md'))).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('does not switch branches or update a different checked-out branch', async () => {
        const { checkout, methods } = await clone();
        await git(checkout, 'switch', '-c', 'other');
        const old = await git(checkout, 'rev-parse', 'main');
        await file(source, 'om.md', 'next');
        await commit(source, 'Advance remote main');
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'conflict' });
        expect(await git(checkout, 'branch', '--show-current')).toBe('other');
        expect((await methods.latest(configuration)).sha).toBe(old);
    });

    it('validates the incoming Root before changing local HEAD', async () => {
        const { checkout, methods } = await clone();
        const old = await git(checkout, 'rev-parse', 'HEAD');
        await file(source, 'om.md', new Uint8Array([0, 255]));
        await commit(source, 'Unusable remote root');
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'blocked' });
        expect(await git(checkout, 'rev-parse', 'HEAD')).toBe(old);
        expect(await readFile(join(checkout, 'om.md'), 'utf8')).toContain('Root marker');
    });

    it('does not materialize remote author-directory changes into the local checkout', async () => {
        const { checkout, methods } = await clone();
        const old = await git(checkout, 'rev-parse', 'HEAD');
        await file(source, '.ome/private.md', 'remote author content');
        await commit(source, 'Accidentally tracked author update');
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'blocked', message: expect.stringContaining('作者目录') });
        expect(await git(checkout, 'rev-parse', 'HEAD')).toBe(old);
    });

    it('rechecks the checkout after fetching, rather than updating a newly selected branch', async () => {
        const { checkout, methods } = await clone();
        await file(source, 'om.md', 'remote update');
        await commit(source, 'Advance remote');
        const original = runner.runGit;
        vi.spyOn(runner, 'runGit').mockImplementation(async (args, ...rest) => {
            const result = await original(args, ...rest);
            if (args.includes('fetch')) await git(checkout, 'switch', '-c', 'other');
            return result;
        });
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'conflict' });
        expect(await git(checkout, 'branch', '--show-current')).toBe('other');
        expect(await readFile(join(checkout, 'om.md'), 'utf8')).toContain('Root marker');
    });

    it('rejects non-Git directories, parent-repository discovery and missing commits/branches', async () => {
        const plain = join(directory, 'plain');
        await mkdir(plain);
        await file(plain, 'om.md', 'plain OM');
        await expect((await open(plain)).latest(configuration)).rejects.toMatchObject({ code: 'blocked' });
        await expect((await open(join(source, 'guides'))).latest(configuration)).rejects.toMatchObject({ code: 'blocked' });
        await expect((await open()).latest({ ...configuration, branch: 'missing' })).rejects.toMatchObject({ code: 'blocked' });
        await git(plain, 'init', '--initial-branch=main');
        await expect((await open(plain)).latest(configuration)).rejects.toMatchObject({ code: 'blocked' });
    });

    it('supports linked worktree roots without a second clone', async () => {
        const linked = join(directory, 'linked');
        await git(source, 'worktree', 'add', '-b', 'release', linked, 'HEAD');
        const methods = await open(linked);
        const method = await methods.latest({ ...configuration, branch: 'release' });
        expect(await methods.read(method, 'om.md')).toContain('Root marker');
    });

    it('supports safe explicit sync of a bare local repository', async () => {
        const bare = join(directory, 'bare.git');
        await git(directory, 'clone', '--bare', '--', source, bare);
        const methods = await open(bare);
        const old = await methods.latest(configuration);
        await file(source, 'om.md', 'next bare revision');
        const next = await commit(source, 'Advance bare source');
        expect((await methods.sync(configuration)).sha).toBe(next);
        expect(await methods.read(old, 'om.md')).toContain('Root marker');
    });

    it('honors an upstream branch with a different local branch name', async () => {
        const { checkout, methods } = await clone();
        await git(checkout, 'branch', '-m', 'main', 'working');
        await file(source, 'om.md', 'upstream main update');
        const next = await commit(source, 'Advance upstream main');
        const settings = { ...configuration, branch: 'working' };
        expect(await methods.status(settings)).toMatchObject({ sync: { remote: 'origin', branch: 'main' } });
        expect((await methods.sync(settings)).sha).toBe(next);
        expect(await git(checkout, 'branch', '--show-current')).toBe('working');
    });

    it('preserves colliding untracked files when Git refuses a fast-forward checkout', async () => {
        const { checkout, methods } = await clone();
        const old = await git(checkout, 'rev-parse', 'HEAD');
        await file(checkout, 'new.md', 'local untracked content');
        await file(source, 'new.md', 'remote tracked content');
        await commit(source, 'Add incoming file');
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'blocked' });
        expect(await git(checkout, 'rev-parse', 'HEAD')).toBe(old);
        expect(await readFile(join(checkout, 'new.md'), 'utf8')).toBe('local untracked content');
    });

    it('does not update a bare branch checked out by another worktree', async () => {
        const bare = join(directory, 'bare.git');
        const checkout = join(directory, 'bare-worktree');
        await git(directory, 'clone', '--bare', '--', source, bare);
        await git(bare, 'worktree', 'add', checkout, 'main');
        const methods = await open(bare);
        const old = await git(bare, 'rev-parse', 'main');
        await file(source, 'om.md', 'remote advance');
        await commit(source, 'Advance worktree origin');
        await expect(methods.sync(configuration)).rejects.toMatchObject({ code: 'conflict' });
        expect(await git(bare, 'rev-parse', 'main')).toBe(old);
        expect(await readFile(join(checkout, 'om.md'), 'utf8')).toContain('Root marker');
    });

    it('does not disguise Git inspection failure as an unsupported remote', async () => {
        await git(source, 'remote', 'add', 'origin', source);
        const methods = await open();
        const original = runner.runGit;
        vi.spyOn(runner, 'runGit').mockImplementation((args, ...rest) => {
            if (args.includes('--normalize')) return Promise.reject(new RuleError('blocked', 'Git unavailable'));
            return original(args, ...rest);
        });
        await expect(methods.status(configuration)).rejects.toMatchObject({ code: 'blocked', message: 'Git unavailable' });
    });

    it('fails closed if the local branch changes during snapshot confirmation', async () => {
        const methods = await open();
        const original = runner.runGit;
        let confirmations = 0;
        vi.spyOn(runner, 'runGit').mockImplementation(async (args, ...rest) => {
            if (args.includes('--verify') && args.includes('refs/heads/main^{commit}') && ++confirmations === 2) {
                await file(source, 'om.md', 'concurrent local commit');
                await commit(source, 'Concurrent local update');
            }
            return original(args, ...rest);
        });
        await expect(methods.latest(configuration)).rejects.toMatchObject({ code: 'blocked', message: 'method branch changed during sync' });
    });
});
