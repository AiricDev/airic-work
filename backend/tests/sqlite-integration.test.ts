import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPersistence } from '../src/bootstrap/bindings';
import { SqliteControlStore } from '../src/adapters/driven/sqlite/store';
import { openControlDatabase } from '../src/adapters/driven/sqlite/database';
import { answer, beginStop, endRun, recordStopped } from '../src/domain/model';
import { candidate, create, decision, envelope, key, prepare, request, running, settings, steer, user } from './contracts/control-store';

type Result = { ok: boolean; result?: unknown; code?: string; message?: string };
/** ready 屏障让真实进程在同一批消息后竞争 SQLite，不用 Promise 模拟同步连接并发。 */
async function participant(filename: string, bootstrap = false) {
    const child = spawn(process.execPath, [fileURLToPath(new URL('./fixtures/sqlite-process.mjs', import.meta.url)), filename, bootstrap ? 'bootstrap' : 'store'], { stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    let diagnostics = '';
    child.stderr!.on('data', chunk => { diagnostics += chunk.toString(); });
    const ready = new Promise<void>((resolve, reject) => {
        child.once('message', message => { if ((message as { ready?: boolean }).ready) resolve(); else reject(new Error('missing ready')); });
        child.once('error', reject);
        child.once('exit', () => reject(new Error(`worker exited before ready: ${diagnostics}`)));
    });
    const done = new Promise<Result>((resolve, reject) => {
        child.on('message', message => { if ('ok' in (message as object)) resolve(message as Result); });
        child.once('error', reject);
        child.once('exit', (code, signal) => { if (signal) resolve({ ok: false, code: signal }); else if (code) reject(new Error(`worker failed: ${diagnostics}`)); });
    });
    // 防止 ready 失败时另一个 promise 产生未处理拒绝。
    void done.catch(() => {});
    const timer = setTimeout(() => child.kill('SIGKILL'), 15000);
    child.once('exit', () => clearTimeout(timer));
    await ready;
    return {
        run(operation: string, args: unknown[], crash?: 'beforeCommit' | 'afterCommit') {
            child.send({ operation, args, crash });
            return done;
        },
    };
}

describe('SQLite real storage and recovery', () => {
    let directory: string;
    let filename: string;
    let resources: ReturnType<typeof createPersistence>;
    beforeEach(async () => {
        directory = mkdtempSync(join(tmpdir(), 'airic-sqlite-'));
        filename = join(directory, 'nested', 'control.sqlite');
        resources = createPersistence({ filename, initialSettings: settings });
        for (const u of [user('admin', true), user('owner'), user('other')]) await resources.store.ensureUser(u);
    });
    afterEach(() => {
        resources?.close();
        rmSync(directory, { recursive: true });
    });
    async function race(jobs: { operation: string; args: unknown[] }[]) {
        const participants = await Promise.all(jobs.map(() => participant(filename)));
        return Promise.all(participants.map((p, i) => p.run(jobs[i].operation, jobs[i].args)));
    }
    function createJob(id: string, command = `create-${id}`, projectName = 'Original') {
        const e = candidate(id);
        e.creation.project_name = projectName;
        return { operation: 'createExecution', args: [key(command), { id: e.projectId, source: 'business', externalId: 'project', name: projectName }, e] };
    }
    function steeringJob(id: string, e: Awaited<ReturnType<typeof running>>) {
        const s = { id, executionId: e.id, userId: 'owner', text: 'more', files: [], at: '2026-10-30T00:00:00.000Z' };
        return { operation: 'submitSteering', args: [key(id), s, { ...envelope(e, `input-${id}`, 'steering', id), text: s.text }] };
    }

    it('configures WAL, FULL synchronous commits, foreign keys and a finite busy timeout', async () => {
        resources.close();
        const connection = openControlDatabase(filename);
        try {
            expect(connection.pragma('journal_mode', { simple: true })).toBe('wal');
            expect(connection.pragma('synchronous', { simple: true })).toBe(2);
            expect(connection.pragma('foreign_keys', { simple: true })).toBe(1);
            expect(connection.pragma('busy_timeout', { simple: true })).toBe(5000);
            if (process.platform !== 'win32') expect(statSync(filename).mode & 0o777).toBe(0o600);
            connection.close();
            const configured = createPersistence({ filename: ':memory:', initialSettings: settings });
            configured.close();
            configured.close();
            resources = createPersistence({ filename, initialSettings: { ...settings, branch: 'must-not-reset' } });
            expect(await resources.store.settings()).toEqual(settings);
        } finally { if (connection.open) connection.close(); }
    });

    it('preserves all control snapshots, command results and receipts after reopening', async () => {
        const e = await running(resources.store);
        const r = await request(resources.store, e);
        const d = decision();
        await resources.store.submitDecision(key('answer'), r.version, answer(r, d), d, envelope(e, 'answer-input', 'user-decision', d.id));
        await resources.store.markDelivered('owner', 'answer-input', 'stable-receipt');
        resources.close();
        resources = createPersistence({ filename, initialSettings: { ...settings, branch: 'ignored' } });
        expect(await resources.store.request(r.id)).toMatchObject({ status: 'answered', answeredAt: d.at });
        expect(await resources.store.decisions(r.id)).toEqual([d]);
        expect(await resources.store.replay('decision', key('answer'))).toEqual(d);
        expect(await resources.store.input('answer-input')).toMatchObject({ sequence: 2, receipt: 'stable-receipt' });
        expect(await resources.store.execution(e.id)).toEqual(e);
    });

    it('initializes one settings row when two independent connections open a database', async () => {
        const other = createPersistence({ filename, initialSettings: { ...settings, branch: 'ignored' } });
        try {
            await resources.store.saveSettings('admin', 0, { ...settings, version: 1, branch: 'updated' });
            expect(await other.store.settings()).toMatchObject({ version: 1, branch: 'updated' });
        } finally { other.close(); }
    });

    it('rejects unknown and tampered migration versions without resetting data', async () => {
        resources.close();
        const raw = new Database(filename);
        raw.prepare("UPDATE schema_migrations SET hash = 'tampered'").run();
        raw.close();
        expect(() => createPersistence({ filename, initialSettings: settings })).toThrow('migration mismatch');
        const check = new Database(filename);
        expect(check.prepare('SELECT count(*) AS n FROM users').get()).toEqual({ n: 3 });
        check.prepare('INSERT INTO schema_migrations VALUES (99, ?)').run('future');
        check.close();
        expect(() => createPersistence({ filename, initialSettings: settings })).toThrow();
    });

    it('refuses relative paths and versioned initial settings before opening a database', () => {
        expect(() => createPersistence({ filename: 'relative.sqlite', initialSettings: settings })).toThrow();
        expect(() => createPersistence({ filename, initialSettings: { ...settings, version: 2 } })).toThrow();
    });

    it('migrates and initializes an empty database safely across simultaneous processes', async () => {
        const empty = join(directory, 'fresh', 'control.sqlite');
        const starters = await Promise.all([participant(empty, true), participant(empty, true), participant(empty, true)]);
        const results = await Promise.all(starters.map(p => p.run('settings', [])));
        expect(results.every(r => r.ok)).toBe(true);
        expect(results.map(r => r.result)).toEqual([settings, settings, settings]);
        const reopened = createPersistence({ filename: empty, initialSettings: settings });
        reopened.close();
    }, 20000);

    it('enforces relational scope, checks and immutable records in the database itself', async () => {
        const e = await running(resources.store);
        const r = await request(resources.store, e);
        const d = decision();
        await resources.store.submitDecision(key('answer'), 0, answer(r, d), d, envelope(e, 'answer-input', 'user-decision', d.id));
        const raw = new Database(filename);
        raw.pragma('foreign_keys = ON');
        try {
            expect(() => raw.prepare("UPDATE user_decisions SET text = 'rewritten' WHERE id = ?").run(d.id)).toThrow();
            expect(() => raw.prepare("UPDATE users SET subject = 'rewritten' WHERE id = 'owner'").run()).toThrow();
            expect(() => raw.prepare("UPDATE executions SET owner_id = 'other' WHERE id = ?").run(e.id)).toThrow();
            expect(() => raw.prepare("UPDATE executions SET phase = 'invented' WHERE id = ?").run(e.id)).toThrow();
            expect(() => raw.prepare("UPDATE inputs SET status = 'delivered', receipt = NULL WHERE id = ?").run('answer-input')).toThrow();
            expect(() => raw.prepare("INSERT INTO input_files VALUES ('answer-input', 'missing', 'owner', ?)").run(e.id)).toThrow();
            expect(raw.pragma('foreign_key_check')).toEqual([]);
        } finally { raw.close(); }
    });

    for (const [table, event] of [
        ['user_decisions', 'INSERT'], ['decision_requests', 'UPDATE'], ['inputs', 'INSERT'],
        ['input_files', 'INSERT'], ['command_results', 'INSERT'],
    ]) {
        it(`rolls back the whole answer when ${table} ${event} fails`, async () => {
            const e = await running(resources.store);
            const r = await request(resources.store, e);
            const f = { id: 'upload', executionId: e.id, userId: 'owner', name: 'a', size: 1, hash: 'a'.repeat(64), contentRef: 'sha256:a' };
            await resources.store.saveUpload('owner', f);
            const d = { ...decision(), files: [f.id] };
            const raw = new Database(filename);
            try {
                raw.exec(`CREATE TRIGGER inject_failure AFTER ${event} ON ${table} BEGIN SELECT RAISE(ABORT, 'test injected failure'); END`);
                await expect(resources.store.submitDecision(key('answer'), 0, answer(r, d), d, envelope(e, 'answer-input', 'user-decision', d.id, d.files))).rejects.toMatchObject({ code: 'conflict' });
                expect(await resources.store.request(r.id)).toEqual(r);
                expect(await resources.store.decisions(r.id)).toEqual([]);
                expect(await resources.store.inputs(e.id)).toHaveLength(1);
                expect(await resources.store.replay('decision', key('answer'))).toBeUndefined();
                expect(raw.prepare('SELECT count(*) AS n FROM input_files').get()).toEqual({ n: 0 });
                raw.exec('DROP TRIGGER inject_failure');
                await resources.store.submitDecision(key('answer'), 0, answer(r, d), d, envelope(e, 'answer-input', 'user-decision', d.id, d.files));
                expect((await resources.store.input('answer-input')).sequence).toBe(2);
            } finally { raw.close(); }
        });
    }

    it('arbitrates concurrent identity creation in independent processes', async () => {
        const results = await race(['one', 'two', 'three'].map(id => ({ operation: 'ensureUser', args: [{ ...user(id), subject: 'same-subject' }] })));
        expect(results.every(r => r.ok)).toBe(true);
        expect(new Set(results.map(r => (r.result as { id: string }).id)).size).toBe(1);
        expect((await resources.store.users()).filter(u => u.subject === 'same-subject')).toHaveLength(1);
    }, 20000);

    it('arbitrates identical and conflicting command keys without partial projects', async () => {
        const same = await race([createJob('first', 'same'), createJob('second', 'same')]);
        expect(same.every(r => r.ok)).toBe(true);
        expect(same[0].result).toEqual(same[1].result);
        const conflict = await race([
            createJob('third', 'conflict'),
            { ...createJob('fourth', 'conflict'), args: [key('conflict', 'owner', 'different'), ...createJob('fourth', 'conflict').args.slice(1)] },
        ]);
        expect(conflict.filter(r => r.ok)).toHaveLength(1);
        expect(conflict.find(r => !r.ok)?.code).toBe('conflict');
        expect(await resources.store.projects()).toHaveLength(1);
        expect(await resources.store.executions()).toHaveLength(2);
    }, 20000);

    it('reuses the winning project without renaming it under process competition', async () => {
        const results = await race([createJob('first', 'one', 'First'), createJob('second', 'two', 'Second')]);
        expect(results.every(r => r.ok)).toBe(true);
        const projects = await resources.store.projects();
        expect(projects).toHaveLength(1);
        expect(['First', 'Second']).toContain(projects[0].name);
        expect((await resources.store.executions()).every(e => e.projectId === projects[0].id)).toBe(true);
        await create(resources.store, 'third');
        expect(await resources.store.projects()).toEqual(projects);
    }, 20000);

    it('serializes simultaneous answers using request CAS and retains only the winner', async () => {
        const e = await running(resources.store);
        const r = await request(resources.store, e);
        const results = await race(['one', 'two'].map(id => {
            const d = decision(id);
            return { operation: 'submitDecision', args: [key(id), 0, answer(r, d), d, envelope(e, `input-${id}`, 'user-decision', id)] };
        }));
        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(results.find(r => !r.ok)?.code).toBe('conflict');
        expect(await resources.store.decisions(r.id)).toHaveLength(1);
        expect(await resources.store.inputs(e.id)).toHaveLength(2);
    }, 20000);

    it('assigns durable ordered input sequences across processes without replay gaps', async () => {
        const e = await running(resources.store);
        const jobs = ['one', 'two', 'three', 'four'].map(id => steeringJob(id, e));
        expect((await race(jobs)).every(r => r.ok)).toBe(true);
        expect((await resources.store.inputs(e.id)).map(i => i.sequence)).toEqual([1, 2, 3, 4, 5]);
        const replay = await participant(filename);
        expect((await replay.run(jobs[0].operation, jobs[0].args)).ok).toBe(true);
        expect(await resources.store.inputs(e.id)).toHaveLength(5);
    }, 20000);

    it('protects the last administrator when two processes demote different administrators', async () => {
        await resources.store.ensureUser(user('admin2', true));
        const results = await race([
            { operation: 'manageUser', args: ['admin', 0, { ...user('admin2', true), admin: false, version: 1 }] },
            { operation: 'manageUser', args: ['admin2', 0, { ...user('admin', true), admin: false, version: 1 }] },
        ]);
        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(['blocked', 'forbidden']).toContain(results.find(r => !r.ok)?.code);
        expect((await resources.store.users()).filter(u => u.admin && u.enabled)).toHaveLength(1);
    }, 20000);

    it('coordinates Finish and new input regardless of which process wins', async () => {
        const e = await running(resources.store);
        const results = await race([
            { operation: 'transition', args: ['owner', e.version, endRun(e, e.generation), true] },
            steeringJob('message', e),
        ]);
        expect(results[1].ok).toBe(true);
        if (results[0].ok) expect((await resources.store.execution(e.id)).phase).toBe('ended');
        else {
            expect(results[0].code).toBe('blocked');
            expect((await resources.store.execution(e.id)).phase).toBe('running');
        }
        expect((await resources.store.input('input-message')).status).toBe('pending');
    }, 20000);

    it('rechecks qualification when disable and steering commits compete', async () => {
        const e = await running(resources.store);
        const ended = await resources.store.transition('owner', e.version, endRun(e, e.generation), true);
        const results = await race([
            { operation: 'manageUser', args: ['admin', 0, { ...user('owner'), enabled: false, version: 1 }] },
            steeringJob('message', ended),
        ]);
        expect(results[0].ok).toBe(true);
        if (!results[1].ok) expect(results[1].code).toBe('forbidden');
        expect((await resources.store.inputs(e.id)).length).toBe(results[1].ok ? 2 : 1);
        await expect(steer(resources.store, ended, 'after-disable')).rejects.toMatchObject({ code: 'forbidden' });
    }, 20000);

    it('cannot disable a user when a concurrent new execution establishes responsibility first', async () => {
        const results = await race([
            { operation: 'manageUser', args: ['admin', 0, { ...user('owner'), enabled: false, version: 1 }] },
            createJob('execution'),
        ]);
        expect(results.filter(r => r.ok)).toHaveLength(1);
        if (results[0].ok) expect(results[1].code).toBe('forbidden');
        else expect(results[0].code).toBe('blocked');
    }, 20000);

    it('uses settings CAS under simultaneous saves and stale preparation', async () => {
        const e = await create(resources.store);
        const s = await resources.store.settings();
        const prepared = await prepare(resources.store, await create(resources.store, 'other-prepared'));
        const results = await race([
            { operation: 'saveSettings', args: ['admin', s.version, { ...s, version: 1, branch: 'one' }] },
            { operation: 'saveSettings', args: ['admin', s.version, { ...s, version: 1, branch: 'two' }] },
        ]);
        expect(results.filter(r => r.ok)).toHaveLength(1);
        expect(results.find(r => !r.ok)?.code).toBe('conflict');
        await expect(resources.store.prepare('owner', e.version, s.version, { ...e, method: prepared.method, version: 1 }, envelope(e, 'start-execution'))).rejects.toMatchObject({ code: 'conflict' });
        expect(await resources.store.inputs(e.id)).toHaveLength(0);
    }, 20000);

    for (const crash of ['beforeCommit', 'afterCommit'] as const) {
        it(`recovers the complete answer boundary when the writer is killed ${crash}`, async () => {
            const e = await running(resources.store);
            const r = await request(resources.store, e);
            const d = decision();
            const writer = await participant(filename);
            expect(await writer.run('submitDecision', [key('answer'), 0, answer(r, d), d, envelope(e, 'answer-input', 'user-decision', d.id)], crash)).toMatchObject({ ok: false, code: 'SIGKILL' });
            resources.close();
            resources = createPersistence({ filename, initialSettings: settings });
            const committed = crash === 'afterCommit';
            expect((await resources.store.request(r.id)).status).toBe(committed ? 'answered' : 'pending');
            expect(await resources.store.decisions(r.id)).toHaveLength(committed ? 1 : 0);
            expect(await resources.store.inputs(e.id)).toHaveLength(committed ? 2 : 1);
            expect(await resources.store.replay('decision', key('answer'))).toEqual(committed ? d : undefined);
            await resources.store.submitDecision(key('answer'), 0, answer(r, d), d, envelope(e, 'answer-input', 'user-decision', d.id));
            expect(await resources.store.decisions(r.id)).toEqual([d]);
            expect((await resources.store.input('answer-input')).sequence).toBe(2);
        }, 20000);
    }

    it('rejects stale runtime writes after a second connection commits a cancellation', async () => {
        const e = await running(resources.store);
        const other = createPersistence({ filename, initialSettings: settings });
        try {
            const stopping = await other.store.transition('owner', e.version, beginStop(e));
            await expect(resources.store.transition('owner', e.version, endRun(e, e.generation), true)).rejects.toMatchObject({ code: 'conflict' });
            await expect(request(resources.store, e, 'stale')).rejects.toMatchObject({ code: 'blocked' });
            const stopped = await other.store.transition('owner', stopping.version, recordStopped(stopping));
            expect((await resources.store.execution(e.id)).phase).toBe(stopped.phase);
        } finally { other.close(); }
    });

    it('maps connection errors without exposing driver SQL or parameters', async () => {
        resources.close();
        const raw = new Database(filename);
        raw.pragma('foreign_keys = ON');
        const store = new SqliteControlStore(raw);
        raw.close();
        const calls = [
            () => store.ensureUser(user('sensitive-subject')),
            () => store.user('sensitive-subject'), () => store.users(),
            () => store.execution('sensitive-execution'), () => store.executions(), () => store.projects(),
            () => store.request('sensitive-request'), () => store.requests('sensitive-execution'),
            () => store.decisions('sensitive-request'), () => store.input('sensitive-input'),
            () => store.inputs('sensitive-execution'), () => store.upload('sensitive-upload'), () => store.settings(),
        ];
        for (const call of calls) await expect(call()).rejects.toMatchObject({ code: 'blocked', message: 'database unavailable' });
    });
});
