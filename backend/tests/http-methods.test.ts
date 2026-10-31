import { mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createMethods } from '../src/bootstrap/bindings';
import { configuration, file, commit, options, repository } from './support/git-methods';

it('browses fixed method snapshots, trees, diffs and cached history without fetching or exposing author files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'airic-http-method-'));
    try {
        const source = await repository(directory);
        const { methods } = await createMethods(options(directory, source));
        await expect(methods.browse!(configuration)).rejects.toMatchObject({ code: 'not-found' });
        const original = await methods.sync(configuration);
        await file(source, 'om.md', 'Updated method');
        await commit(source, 'Update method');
        await rename(source, source + '-offline');
        expect(await methods.browse!(configuration)).toEqual(original);
        expect((await methods.tree!(original)).map(f => f.path)).not.toContain('.ome/private.md');
        expect(await methods.read(original, original.root)).toContain('Root marker');
        expect(JSON.stringify(await methods.cachedHistory!('repo'))).toContain(original.sha);
        expect(JSON.stringify(await methods.commit!(original))).not.toContain('author-only-private-keyword');
        await expect(methods.browse!(configuration, 'f'.repeat(40))).rejects.toMatchObject({ code: 'not-found' });
    } finally { await rm(directory, { recursive: true, force: true }); }
});

it('opens an unsnapshotted historical commit from a local repository without changing its branch', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'airic-http-historical-'));
    try {
        const source = await repository(directory);
        const opts = options(directory, source); opts.sources = { repo: {kind:'local', directory:source} };
        const {methods} = await createMethods(opts);
        const oldSha = await import('./support/git-methods').then(m=>m.git(source,'rev-parse','HEAD'));
        await file(source,'om.md','New method'); const latestSha = await commit(source,'Latest');
        await methods.latest(configuration);
        const historical = await methods.browse!(configuration, oldSha);
        expect(await methods.read(historical,'om.md')).toContain('Root marker');
        expect(await import('./support/git-methods').then(m=>m.git(source,'rev-parse','HEAD'))).toBe(latestSha);
        expect((await methods.browse!(configuration)).sha).toBe(latestSha);
    } finally { await rm(directory,{recursive:true,force:true}); }
});
