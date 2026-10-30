import { beforeEach, afterEach, describe, expect, it } from 'vitest';
import { answer, beginRun, beginStop, endRun, recordStopped, type Execution, type Input, type Settings, type User, type UserDecision } from '../../src/domain/model';
import type { ControlStore, Key } from '../../src/application/ports';

export const settings: Settings = { version: 0, omSource: 'repo', branch: 'main', root: 'om.md', connections: ['business'] };
export const user = (id: string, admin = false): User => ({ id, issuer: 'test', subject: id, name: id, enabled: true, admin, version: 0 });
export const key = (value: string, userId = 'owner', fingerprint = value): Key => ({ userId, key: value, fingerprint });
export const candidate = (id: string, ownerId = 'owner'): Execution => ({
    id, projectId: `project-${id}`, ownerId, sessionId: `session-${id}`, workspaceId: `workspace-${id}`,
    creation: { source: 'business', project_id: 'project', project_name: 'Original', task: { id: 'task' }, instruction: 'check' },
    phase: 'new', generation: 0, version: 0,
});
export function envelope(e: Execution, id: string, kind: Input['kind'] = 'start', sourceId = e.id, files: string[] = []): Omit<Input, 'sequence'> {
    return { id, executionId: e.id, sessionId: e.sessionId, userId: e.ownerId, kind, sourceId, text: kind === 'start' ? e.creation.instruction : 'yes', files, status: 'pending' };
}
export async function create(store: ControlStore, id = 'execution', ownerId = 'owner') {
    const e = candidate(id, ownerId);
    return store.createExecution(key(`create-${id}`, ownerId), { id: e.projectId, source: e.creation.source, externalId: e.creation.project_id, name: e.creation.project_name }, e);
}
export async function prepare(store: ControlStore, e: Execution) {
    return store.prepare(e.ownerId, e.version, (await store.settings()).version, {
        ...e, method: { source: 'repo', sha: 'sha', root: 'om.md', runtimeVersion: 'test', skillVersion: 'test' }, version: e.version + 1,
    }, envelope(e, `start-${e.id}`));
}
export async function running(store: ControlStore, id = 'execution') {
    const e = await prepare(store, await create(store, id));
    const next = await store.transition(e.ownerId, e.version, beginRun(e));
    await store.markDelivered(e.ownerId, `start-${id}`, `receipt-${id}`);
    return next;
}
export async function request(store: ControlStore, e: Execution, id = 'request') {
    return store.createRequest(key(id), e.generation, {
        id, executionId: e.id, question: '?', options: [{ id: 'yes', label: 'Yes', description: 'Accept' }],
        contexts: [{ revision: 1, content: { fact: 'old' }, sources: [] }], status: 'pending', createdAt: '2026-10-30T00:00:00.000Z', version: 0,
    });
}
export function decision(id = 'decision', requestId = 'request'): UserDecision {
    return { id, requestId, userId: 'owner', text: 'yes', contextRevision: 1, files: [], at: '2026-10-30T00:01:00.000Z' };
}
export async function steer(store: ControlStore, e: Execution, id: string, files: string[] = []) {
    const s = { id, executionId: e.id, userId: e.ownerId, text: 'more', files, at: '2026-10-30T00:00:00.000Z' };
    return store.submitSteering(key(id, e.ownerId), s, { ...envelope(e, `input-${id}`, 'steering', id, files), text: s.text });
}

/** 共享端口行为，不把内存结构或 SQL 作为断言依据。 */
export function controlStoreContract(name: string, factory: () => Promise<{ store: ControlStore; close(): void }>) {
    describe(`${name}: ControlStore contract`, () => {
        let store: ControlStore;
        let close: () => void;
        beforeEach(async () => {
            ({ store, close } = await factory());
            for (const u of [user('admin', true), user('owner'), user('other')])
                await store.ensureUser(u);
        });
        afterEach(() => close?.());

        it('preserves local identity, permissions and detached snapshots on repeated authentication', async () => {
            const original = await store.user('owner');
            original.name = 'not saved';
            expect((await store.user('owner')).name).toBe('owner');
            expect(await store.ensureUser({ ...user('candidate', true), subject: 'owner', name: 'external' })).toEqual(user('owner'));
            await store.manageUser('admin', 0, { ...user('other'), enabled: false, version: 1 });
            expect((await store.ensureUser({ ...user('new'), subject: 'other' })).enabled).toBe(false);
            expect(await store.users()).toHaveLength(3);
        });

        it('separates project uniqueness, command replay and task association', async () => {
            const a = await create(store);
            expect(await create(store)).toEqual(a);
            const b = await create(store, 'second');
            expect(b.projectId).toBe(a.projectId);
            expect(await store.projects()).toHaveLength(1);
            expect(await store.executions()).toHaveLength(2);
            await expect(store.replay('create', key('create-execution', 'owner', 'different'))).rejects.toMatchObject({ code: 'conflict' });
            expect(await store.replay('create', key('create-execution', 'other'))).toBeUndefined();
            expect(await store.replay('steering', key('create-execution'))).toBeUndefined();
        });

        it('rechecks enabled status even for an original command result', async () => {
            const e = await create(store);
            const stopped = await store.transition('owner', e.version, beginStop(e));
            await store.transition('owner', stopped.version, recordStopped(stopped));
            await store.manageUser('admin', 0, { ...user('owner'), enabled: false, version: 1 });
            await expect(create(store)).rejects.toMatchObject({ code: 'forbidden' });
            await expect(store.replay('create', key('create-execution'))).rejects.toMatchObject({ code: 'forbidden' });
        });

        it('atomically compares settings and execution versions and fixes one start input', async () => {
            const e = await create(store);
            await store.saveSettings('admin', 0, { ...settings, version: 1, branch: 'next' });
            const prepared = { ...e, method: { source: 'repo', sha: 'sha', root: 'om.md', runtimeVersion: 'test', skillVersion: 'test' }, version: 1 };
            await expect(store.prepare('owner', 0, 0, prepared, envelope(e, 'bad-start'))).rejects.toMatchObject({ code: 'conflict' });
            expect(await store.inputs(e.id)).toEqual([]);
            const saved = await prepare(store, e);
            await expect(prepare(store, saved)).rejects.toMatchObject({ code: 'conflict' });
            expect(await store.inputs(e.id)).toHaveLength(1);
            await expect(store.prepare('other', e.version, 1, prepared, envelope(e, 'other-start'))).rejects.toMatchObject({ code: 'forbidden' });
        });

        it('fences stale generations and preserves Context and answered facts', async () => {
            const e = await running(store);
            const r = await request(store, e);
            const next = { ...r, contexts: [...r.contexts, { revision: 2, content: { fact: 'new' }, sources: [] }], version: 1 };
            await expect(store.refreshContext('owner', e.generation - 1, 0, next)).rejects.toMatchObject({ code: 'blocked' });
            await store.refreshContext('owner', e.generation, 0, next);
            await expect(store.refreshContext('owner', e.generation, 0, next)).rejects.toMatchObject({ code: 'conflict' });
            expect((await store.request(r.id)).contexts).toHaveLength(2);
            expect(await store.requests(e.id)).toHaveLength(1);
            const stopping = await store.transition('owner', e.version, beginStop(e));
            await expect(request(store, stopping, 'late')).rejects.toMatchObject({ code: 'blocked' });
        });

        it('saves an answer and correction with immutable original timestamps and inputs', async () => {
            const e = await running(store);
            const r = await request(store, e);
            const d = decision();
            const input = envelope(e, 'answer-input', 'user-decision', d.id);
            const answered = answer(r, d);
            expect(await store.submitDecision(key('answer'), r.version, answered, d, input)).toEqual(d);
            expect(await store.submitDecision(key('answer'), r.version, answered, d, input)).toEqual(d);
            const correction = { ...decision('correction'), correctionOf: d.id, at: '2026-10-30T00:02:00.000Z' };
            await store.submitDecision(key('correction'), answered.version, answer(answered, correction), correction, envelope(e, 'correction-input', 'user-decision', correction.id));
            expect(await store.decisions(r.id)).toEqual([d, correction]);
            expect((await store.request(r.id)).answeredAt).toBe(d.at);
            expect((await store.inputs(e.id)).map(i => i.sequence)).toEqual([1, 2, 3]);
        });

        it('rejects stale answers without partial decision or input writes', async () => {
            const e = await running(store);
            const r = await request(store, e);
            const next = { ...r, contexts: [...r.contexts, { revision: 2, content: {}, sources: [] }], version: 1 };
            await store.refreshContext('owner', e.generation, 0, next);
            const d = decision();
            await expect(store.submitDecision(key('answer'), 0, answer(r, d), d, envelope(e, 'answer-input', 'user-decision', d.id))).rejects.toMatchObject({ code: 'conflict' });
            expect(await store.decisions(r.id)).toEqual([]);
            expect(await store.inputs(e.id)).toHaveLength(1);
            expect((await store.request(r.id)).status).toBe('pending');
            expect(await store.replay('decision', key('answer'))).toBeUndefined();
        });

        it('rechecks file scope at commit and preserves fixed upload descriptors', async () => {
            const e = await running(store);
            const other = await create(store, 'other-execution');
            const f = { id: 'upload', userId: 'owner', executionId: e.id, hash: 'a'.repeat(64), size: 1, contentRef: 'sha256:fixed', name: 'same.txt' };
            await store.saveUpload('owner', f);
            expect(await store.saveUpload('owner', f)).toEqual(f);
            await expect(store.saveUpload('owner', { ...f, size: 2 })).rejects.toMatchObject({ code: 'conflict' });
            await expect(store.saveUpload('other', { ...f, id: 'forged' })).rejects.toMatchObject({ code: 'forbidden' });
            await expect(steer(store, other, 'cross-file', [f.id])).rejects.toMatchObject({ code: 'forbidden' });
            await expect(steer(store, e, 'missing', ['missing'])).rejects.toMatchObject({ code: 'not-found' });
            const r = await request(store, e);
            const d = { ...decision(), files: [f.id] };
            await store.submitDecision(key('answer'), r.version, answer(r, d), d, envelope(e, 'answer-input', 'user-decision', d.id, d.files));
            expect((await store.input('answer-input')).files).toEqual([f.id]);
            expect(await store.upload(f.id)).toEqual(f);
        });

        it('queues during cancellation and after ending without answering pending requests', async () => {
            const e = await running(store);
            const r = await request(store, e);
            const stopping = await store.transition('owner', e.version, beginStop(e));
            await steer(store, stopping, 'during-stop');
            await steer(store, stopping, 'during-stop');
            expect((await store.request(r.id)).status).toBe('pending');
            const stopped = await store.transition('owner', stopping.version, recordStopped(stopping));
            const resumed = await store.transition('owner', stopped.version, beginRun(stopped));
            expect(resumed.generation).toBe(e.generation + 1);
            expect((await store.inputs(e.id)).map(i => i.sequence)).toEqual([1, 2]);
        });

        it('acknowledges only a stable receipt, rechecking current ownership', async () => {
            const e = await running(store);
            await steer(store, e, 'message');
            await expect(store.markDelivered('other', 'input-message', 'receipt')).rejects.toMatchObject({ code: 'forbidden' });
            await store.markDelivered('owner', 'input-message', 'receipt');
            await store.markDelivered('owner', 'input-message', 'receipt');
            await expect(store.markDelivered('owner', 'input-message', 'changed')).rejects.toMatchObject({ code: 'conflict' });
            expect(await store.input('input-message')).toMatchObject({ status: 'delivered', receipt: 'receipt' });
        });

        it('prevents Finish from losing committed input but permits input after Finish', async () => {
            const e = await running(store);
            await steer(store, e, 'message');
            await expect(store.transition('owner', e.version, endRun(e, e.generation), true)).rejects.toMatchObject({ code: 'blocked' });
            await store.markDelivered('owner', 'input-message', 'receipt');
            const ended = await store.transition('owner', e.version, endRun(e, e.generation), true);
            await steer(store, ended, 'after-end');
            expect((await store.input('input-after-end')).status).toBe('pending');
            await expect(store.transition('owner', e.version, beginStop(e))).rejects.toMatchObject({ code: 'conflict' });
        });

        it('preserves owner, session, workspace, creation, method and runtime fencing', async () => {
            const e = await running(store);
            for (const patch of [{ ownerId: 'other' }, { sessionId: 'new' }, { workspaceId: 'new' }, { projectId: 'new' }, { creation: { ...e.creation, instruction: 'new' } }, { method: { ...e.method!, sha: 'new' } }, { generation: 0 }])
                await expect(store.transition('owner', e.version, { ...beginStop(e), ...patch })).rejects.toMatchObject({ code: 'conflict' });
            const stopping = await store.transition('owner', e.version, beginStop(e));
            await expect(store.transition('owner', stopping.version, { ...stopping, phase: 'running', generation: stopping.generation + 1, version: stopping.version + 1 })).rejects.toMatchObject({ code: 'blocked' });
        });

        it('protects privileges, account versions and the last effective administrator', async () => {
            await expect(store.manageUser('owner', 0, { ...user('other'), admin: true, version: 1 })).rejects.toMatchObject({ code: 'forbidden' });
            await expect(store.manageUser('admin', 0, { ...user('admin', true), admin: false, version: 1 })).rejects.toMatchObject({ code: 'blocked' });
            const profile = await store.updateProfile('owner', 0, 'Changed');
            expect(profile).toMatchObject({ name: 'Changed', admin: false, enabled: true, version: 1 });
            await expect(store.updateProfile('owner', 0, 'Stale')).rejects.toMatchObject({ code: 'conflict' });
            const preferences = { language: 'zh', timezone: 'UTC', notify: { decision: true, anomaly: false, result: false } };
            expect(await store.updatePreferences('owner', 1, preferences)).toMatchObject({ preferences, admin: false, version: 2 });
            await expect(store.manageUser('admin', 2, { ...profile, issuer: 'changed', version: 3 })).rejects.toMatchObject({ code: 'conflict' });
        });

        it('does not rewrite a pinned method just because JSON property order differs', async () => {
            const e = await running(store);
            const method = Object.fromEntries(Object.entries(e.method!).reverse()) as typeof e.method;
            const stopped = await store.transition('owner', e.version, { ...beginStop(e), method });
            expect(stopped.method).toEqual(e.method);
        });

        it('protects active responsibilities and pending questions when disabling users', async () => {
            const e = await running(store);
            await request(store, e);
            await expect(store.manageUser('admin', 0, { ...user('owner'), enabled: false, version: 1 })).rejects.toMatchObject({ code: 'blocked' });
            await store.transition('owner', e.version, endRun(e, e.generation), true);
            await expect(store.manageUser('admin', 0, { ...user('owner'), enabled: false, version: 1 })).rejects.toMatchObject({ code: 'blocked' });
        });

        it('saves versioned settings for admins without mutating fixed methods', async () => {
            const e = await running(store);
            await expect(store.saveSettings('owner', 0, { ...settings, version: 1 })).rejects.toMatchObject({ code: 'forbidden' });
            const next = { ...settings, branch: 'next', version: 1 };
            expect(await store.saveSettings('admin', 0, next)).toEqual(next);
            await expect(store.saveSettings('admin', 0, next)).rejects.toMatchObject({ code: 'conflict' });
            expect((await store.execution(e.id)).method).toEqual(e.method);
            expect(await store.settings()).toEqual(next);
        });

        it('reports absent records rather than manufacturing snapshots', async () => {
            for (const read of [() => store.user('missing'), () => store.execution('missing'), () => store.request('missing'), () => store.input('missing'), () => store.upload('missing')])
                await expect(read()).rejects.toMatchObject({ code: 'not-found' });
        });
    });
}
