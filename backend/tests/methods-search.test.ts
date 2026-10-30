import { createHash } from 'node:crypto';
import { mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { createMethods } from '../src/bootstrap/bindings';
import { configuration, file, commit, options, repository } from './support/git-methods';
import type { Method } from '../src/domain/model';

describe('fixed snapshot FTS5 search', () => {
    let directory: string;
    let source: string;
    let settings: ReturnType<typeof options>;
    let methods: Awaited<ReturnType<typeof createMethods>>['methods'];
    let method: Method;
    const index = () => join(settings.directory, 'indexes', createHash('sha256').update('repo').digest('hex'), `${method.sha}.sqlite`);
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-search-'));
        source = await repository(directory);
        settings = options(directory, source);
        ({ methods } = await createMethods(settings));
        method = await methods.latest(configuration);
    });
    afterEach(async () => { await rm(directory, { recursive: true, force: true }); });

    it('searches Chinese trigrams and short Chinese queries within one SHA', async () => {
        const long = await methods.search(method, '判断标准');
        expect(long.map(row => row.path)).toEqual(['guides/判断.md']);
        expect(long[0].excerpt).toContain('判断标准');
        expect((await methods.search(method, '判断')).map(row => row.path)).toEqual(['guides/判断.md', 'om.md']);
        expect((await methods.search(method, '固')).map(row => row.path)).toEqual(['om.md']);
        const raw = new Database(index());
        try {
            expect((raw.prepare("SELECT sql FROM sqlite_master WHERE name='file_search'").get() as { sql: string }).sql).toContain("tokenize='trigram'");
        } finally { raw.close(); }
    });

    it('searches file paths and names, including binary names without inventing text', async () => {
        expect((await methods.search(method, 'PATH-ONLY')).map(row => row.path)).toEqual(['guides/path-only.md']);
        expect(await methods.search(method, 'binary')).toEqual([{ path: 'binary.bin', excerpt: '' }]);
        await expect(methods.read(method, 'binary.bin')).rejects.toMatchObject({ code: 'blocked' });
    });

    it.each(['100%', 'a_b', 'x\\y', '%', '_', '\\'])('treats %j as literal text rather than wildcard or syntax', async query => {
        const result = await methods.search(method, query);
        expect(result.map(row => row.path)).toEqual(['guides/判断.md']);
        expect(result[0].excerpt).toContain(query);
    });

    it.each(['" OR *', "'; DROP TABLE file_search; --", 'NEAR(foo bar)', '"', '*'])('does not execute query syntax for %j', async query => {
        expect(await methods.search(method, query)).toEqual([]);
        expect((await methods.search(method, 'alpha')).length).toBeGreaterThan(0);
    });

    it('returns stable literal excerpts around a late match without HTML markup', async () => {
        await file(source, 'long.md', `${'前文'.repeat(150)}目标判断标准${'后文'.repeat(150)}`);
        await commit(source, 'Add long content');
        const latest = await methods.latest(configuration);
        const result = await methods.search(latest, '目标判断标准');
        expect(result.map(row => row.path)).toEqual(['long.md']);
        expect(result[0].excerpt).toContain('目标判断标准');
        expect(result[0].excerpt.startsWith('…')).toBe(true);
        expect(result[0].excerpt).not.toContain('<mark>');
        expect(await methods.search(method, '目标判断标准')).toEqual([]);
    });

    it('rebuilds a deleted index offline from the same immutable snapshot', async () => {
        const expected = await methods.search(method, 'alpha');
        await rm(index());
        await rename(source, `${source}-offline`);
        try { expect(await methods.search(method, 'alpha')).toEqual(expected); }
        finally { await rename(`${source}-offline`, source); }
    });

    it('rolls back document replacement if the index metadata commit fails and safely retries', async () => {
        await methods.search(method, 'alpha');
        const raw = new Database(index());
        try {
            raw.prepare("UPDATE snapshot_meta SET manifest_hash='stale'").run();
            raw.exec("CREATE TRIGGER fail_index BEFORE INSERT ON snapshot_meta BEGIN SELECT RAISE(ABORT, 'injected index failure'); END");
            await expect(methods.search(method, 'alpha')).rejects.toMatchObject({ code: 'conflict' });
            expect(raw.prepare('SELECT count(*) AS n FROM file_search').get()).toEqual({ n: 5 });
            expect(raw.prepare('SELECT manifest_hash AS hash FROM snapshot_meta').get()).toEqual({ hash: 'stale' });
            raw.exec('DROP TRIGGER fail_index');
            expect((await methods.search(method, 'alpha')).length).toBeGreaterThan(0);
        } finally { raw.close(); }
    });

    it('rejects empty and NUL queries and unknown index versions', async () => {
        for (const query of ['', '   ', '\0']) await expect(methods.search(method, query)).rejects.toMatchObject({ code: 'invalid' });
        await methods.search(method, 'alpha');
        const raw = new Database(index());
        raw.pragma('user_version=99');
        raw.close();
        await expect(methods.search(method, 'alpha')).rejects.toMatchObject({ code: 'blocked' });
    });
});
