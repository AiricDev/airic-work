import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rename, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Method } from '../src/domain/model';
import { createMethods } from '../src/bootstrap/bindings';
import * as runner from '../src/adapters/driven/methods/git';
import * as storage from '../src/adapters/driven/methods/storage';
import { commit, configuration, file, git, options, repository } from './support/git-methods';

const sourceKey = (source: string) => createHash('sha256').update(source).digest('hex');
describe('real Git Methods', () => {
    let directory: string;
    let source: string;
    let settings: ReturnType<typeof options>;
    let methods: Awaited<ReturnType<typeof createMethods>>['methods'];
    const snapshot = (method: Method) => join(settings.directory, 'snapshots', sourceKey(method.source), method.sha);
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-methods-'));
        source = await repository(directory);
        settings = options(directory, source);
        ({ methods } = await createMethods(settings));
    });
    afterEach(async () => { vi.restoreAllMocks(); vi.unstubAllEnvs(); await rm(directory, { recursive: true, force: true }); });

    it('confirms the actual branch SHA, checks Root and preserves declared host versions', async () => {
        const method = await methods.latest(configuration);
        expect(method).toEqual({ source: 'repo', sha: await git(source, 'rev-parse', 'HEAD'), root: 'om.md', runtimeVersion: 'declared-runtime', skillVersion: 'declared-skill' });
        expect(await git(join(settings.directory, 'mirrors', sourceKey('repo'), 'mirror.git'), 'config', '--get', 'remote.origin.url')).toBe(source);
        expect(await methods.read(method, 'om.md')).toContain('Root marker alpha');
        expect(await methods.read(method, 'empty.md')).toBe('');
        const manifest = JSON.parse(await readFile(join(snapshot(method), 'manifest.json'), 'utf8'));
        expect(manifest.files.map((f: { path: string }) => f.path)).not.toContain('.ome/private.md');
        await expect(readFile(join(snapshot(method), 'runtime', '.ome/private.md'))).rejects.toMatchObject({ code: 'ENOENT' });
        expect(await methods.search(method, 'author-only')).toEqual([]);
    });

    it('pins old reads and search to the original SHA after a new commit', async () => {
        const old = await methods.latest(configuration);
        await file(source, 'om.md', 'new-root-only 新版本');
        const sha = await commit(source, 'Update method');
        const current = await methods.latest(configuration);
        expect(current.sha).toBe(sha);
        expect(current.sha).not.toBe(old.sha);
        expect(await methods.read(old, 'om.md')).toContain('Root marker alpha');
        expect(await methods.read(current, 'om.md')).toBe('new-root-only 新版本');
        expect(await methods.search(old, 'new-root-only')).toEqual([]);
        expect((await methods.search(current, 'new-root-only')).map(r => r.path)).toEqual(['om.md']);
    });

    it('never returns cached latest when the configured origin becomes unreachable', async () => {
        const method = await methods.latest(configuration);
        await rename(source, `${source}-offline`);
        try {
            await expect(methods.latest(configuration)).rejects.toMatchObject({ code: 'blocked' });
            expect(await methods.read(method, 'om.md')).toContain('Root marker');
            expect((await methods.search(method, '人工')).map(r => r.path)).toContain('om.md');
            await expect(methods.history('repo')).rejects.toMatchObject({ code: 'blocked' });
        } finally { await rename(`${source}-offline`, source); }
    });

    it('rejects missing branches and unavailable, linked or binary Roots', async () => {
        await expect(methods.latest({ ...configuration, branch: 'missing' })).rejects.toMatchObject({ code: 'blocked' });
        for (const root of ['missing.md', 'binary.bin']) await expect(methods.latest({ ...configuration, root })).rejects.toThrow();
        await symlink('om.md', join(source, 'linked-root.md'));
        await commit(source, 'Add linked root');
        await expect(methods.latest({ ...configuration, root: 'linked-root.md' })).rejects.toThrow();
    });

    it('uses the configured branch rather than default HEAD', async () => {
        const initial = await git(source, 'rev-parse', 'HEAD');
        await git(source, 'branch', 'release', initial);
        await file(source, 'om.md', 'main branch changed');
        await commit(source, 'Advance main');
        expect((await methods.latest({ ...configuration, branch: 'release' })).sha).toBe(initial);
        expect((await methods.latest(configuration)).sha).not.toBe(initial);
    });

    it('does not follow internal or external symlinks or recurse into gitlinks', async () => {
        const outside = join(directory, 'outside.md');
        await file(directory, 'outside.md', 'host secret');
        await symlink(outside, join(source, 'escape.md'));
        await symlink('guides', join(source, 'guide-link'));
        await commit(source, 'Add links');
        const sha = await git(source, 'rev-parse', 'HEAD');
        await git(source, 'update-index', '--add', '--cacheinfo', `160000,${sha},vendor`);
        await commit(source, 'Add gitlink', false);
        const method = await methods.latest(configuration);
        for (const path of ['escape.md', 'guide-link/判断.md', 'vendor/om.md'])
            await expect(methods.read(method, path)).rejects.toMatchObject({ code: 'not-found' });
        expect(await methods.search(method, 'host secret')).toEqual([]);
        expect(await readFile(outside, 'utf8')).toBe('host secret');
    });

    it('rejects traversal and author paths without touching arbitrary host files', async () => {
        const method = await methods.latest(configuration);
        for (const path of ['../outside', '/etc/passwd', 'a/../om.md', 'a\\b', '.ome/private.md', 'nested/.ome/private.md', '.git/config', 'a//b', 'a/./b', '\0x'])
            await expect(methods.read(method, path)).rejects.toMatchObject({ code: 'invalid' });
        for (const sha of ['HEAD', '--help', '../outside', 'a'.repeat(39)])
            await expect(methods.read({ ...method, sha }, 'om.md')).rejects.toMatchObject({ code: 'invalid' });
        await expect(methods.read({ ...method, sha: '0'.repeat(40) }, 'om.md')).rejects.toMatchObject({ code: 'not-found' });
        await expect(methods.read({ ...method, source: directory }, 'om.md')).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('isolates identical SHAs by allowed source and rejects a mismatched snapshot manifest', async () => {
        const original = await methods.latest(configuration);
        const { methods: another } = await createMethods({ ...settings, sources: { repo: source, another: source } });
        const copied = { ...original, source: 'another' };
        const destination = snapshot(copied);
        await mkdir(join(settings.directory, 'snapshots', sourceKey('another')), { recursive: true });
        await cp(snapshot(original), destination, { recursive: true });
        await expect(another.read(copied, 'om.md')).rejects.toMatchObject({ code: 'blocked' });
    });

    it('reopens fixed snapshots without a reachable Git source', async () => {
        const method = await methods.latest(configuration);
        await rename(source, `${source}-offline`);
        try {
            const reopened = await createMethods(settings);
            expect(await reopened.methods.read(method, 'om.md')).toContain('Root marker');
            expect((await reopened.methods.search(method, 'alpha')).length).toBeGreaterThan(0);
        } finally { await rename(`${source}-offline`, source); }
    });

    it('detects corrupted or linked snapshot content instead of serving it as pinned data', async () => {
        const method = await methods.latest(configuration);
        const path = join(snapshot(method), 'runtime', 'om.md');
        await rm(path);
        await file(snapshot(method), 'runtime/om.md', 'changed on disk');
        await expect(methods.read(method, 'om.md')).rejects.toMatchObject({ code: 'blocked' });
        await rm(join(snapshot(method), 'runtime', 'guides'), { recursive: true });
        await symlink(source, join(snapshot(method), 'runtime', 'guides'));
        await expect(methods.read(method, 'guides/判断.md')).rejects.toMatchObject({ code: 'blocked' });
    });

    it('fails closed when the branch advances before the final network confirmation', async () => {
        const original = runner.runGit;
        let advanced = false;
        vi.spyOn(runner, 'runGit').mockImplementation(async (args, ...rest) => {
            if (args.includes('ls-remote') && args.includes('--refs') && !advanced) {
                advanced = true;
                await file(source, 'om.md', 'advanced during sync');
                await commit(source, 'Concurrent branch update');
            }
            return original(args, ...rest);
        });
        await expect(methods.latest(configuration)).rejects.toMatchObject({ code: 'blocked', message: 'method branch changed during sync' });
        expect(await methods.latest(configuration)).toMatchObject({ sha: await git(source, 'rev-parse', 'HEAD') });
    });

    it('serializes concurrent local syncs without changing fixed content', async () => {
        const results = await Promise.all([methods.latest(configuration), methods.latest(configuration), methods.latest(configuration)]);
        expect(results).toEqual([results[0], results[0], results[0]]);
        const parent = join(settings.directory, 'snapshots', sourceKey('repo'));
        expect(await readdir(parent)).toEqual([results[0].sha]);
    });

    it.each(['local', 'managed'] as const)('supports a real SHA-256 %s repository without treating the SHA as a path', async kind => {
        const repo = join(directory, 'sha256-repository');
        await mkdir(repo);
        await git(repo, 'init', '--initial-branch=main', '--object-format=sha256');
        await file(repo, 'om.md', 'SHA-256 method root');
        const sha = await commit(repo, 'SHA-256 method');
        expect(sha).toHaveLength(64);
        const next = await createMethods({ ...settings, sources: { modern: kind === 'local' ? repo : { kind: 'managed', repository: repo } } });
        const method = await next.methods.latest({ ...configuration, omSource: 'modern' });
        expect(method.sha).toBe(sha);
        expect(await next.methods.read(method, 'om.md')).toBe('SHA-256 method root');
    });

    it('does not publish staging files when snapshot export fails', async () => {
        vi.spyOn(storage, 'writeFixed').mockRejectedValueOnce(new Error('private host details'));
        await expect(methods.latest(configuration)).rejects.toMatchObject({ code: 'blocked', message: 'method storage unavailable' });
        expect(await readdir(join(settings.directory, 'snapshots', sourceKey('repo')))).toEqual([]);
        vi.restoreAllMocks();
        expect((await methods.latest(configuration)).sha).toBe(await git(source, 'rev-parse', 'HEAD'));
    });

    it('refuses a nonempty template instead of importing executable hooks', async () => {
        await file(settings.directory, 'template/hooks/anything', 'not executed');
        await expect(createMethods(settings)).rejects.toMatchObject({ code: 'blocked' });
        await expect(methods.latest(configuration)).rejects.toMatchObject({ code: 'blocked' });
    });

    it('rejects configured limits rather than returning truncated file or snapshot content', async () => {
        const limited = await createMethods({ ...settings, directory: join(directory, 'limited'), limits: { ...settings.limits, maxFileBytes: 4 } });
        await expect(limited.methods.latest(configuration)).rejects.toMatchObject({ code: 'blocked' });
        const total = await createMethods({ ...settings, directory: join(directory, 'total'), limits: { ...settings.limits, maxSnapshotBytes: 10 } });
        await expect(total.methods.latest(configuration)).rejects.toMatchObject({ code: 'blocked' });
    });

    it('copies trusted configuration and ignores inherited Git repository/config overrides', async () => {
        settings.sources.repo = '/must-not-be-used';
        vi.stubEnv('GIT_DIR', '/must-not-be-used');
        vi.stubEnv('GIT_CONFIG_COUNT', '1');
        vi.stubEnv('GIT_CONFIG_KEY_0', 'protocol.file.allow');
        vi.stubEnv('GIT_CONFIG_VALUE_0', 'never');
        const method = await methods.latest(configuration);
        expect(await methods.read(method, 'om.md')).toContain('Root marker');
    });

    it('returns bounded actual Git history and reports truncation', async () => {
        await file(source, 'om.md', 'updated');
        const latest = await commit(source, 'Second revision');
        const full = await methods.history('repo') as { source: string; scope: string; commits: { sha: string; parents: string[] }[]; complete: boolean; limitations: string[] };
        expect(full.source).toBe('repo');
        expect(full.scope).toBe('branches');
        expect(full.commits).toHaveLength(2);
        expect(full.commits[0].sha).toBe(latest);
        expect(full.commits[0].parents).toEqual([full.commits[1].sha]);
        expect(full.complete).toBe(true);
        const small = await createMethods({ ...settings, limits: { ...settings.limits, historyEntries: 1 } });
        const page = await small.methods.history('repo') as typeof full;
        expect(page.commits).toHaveLength(1);
        expect(page.complete).toBe(false);
        expect(page.limitations).toEqual(['history limited to 1 commits']);
    });
});
