import { describe, it, expect } from 'vitest';
import { harness } from './support/harness';
import { canonical, runtimePath } from '../src/domain/model';
const context = { revision: 1, content: { facts: 'observed' }, sources: [] };
async function request(h: ReturnType<typeof harness>) { const { u, e } = await h.running(); const r = await h.app.decision.createDecisionRequest(u.id, e.id, e.generation, 'request', 'Accept?', [], context); return { u, e, r }; }
const payload = { text: 'Yes, within scope', contextRevision: 1, files: [] };
describe('phase 1 product contract', () => {
    it('C01 automatically creates exactly one local user and cannot reactivate a disabled user', async () => {
        const h = harness();
        const a = await h.app.account.ensureUser('owner');
        expect(await h.app.account.ensureUser('owner')).toEqual(a);
        h.store.u.set(a.id, { ...a, enabled: false });
        await expect(h.app.account.ensureUser('owner')).rejects.toMatchObject({ code: 'forbidden' });
        expect(h.store.u.size).toBe(1);
    });
    it('C02 separates task association, grouping and command idempotency', async () => {
        const h = harness();
        const { u, e } = await h.running();
        expect((await h.app.execution.createExecution(u.id, 'create', e.creation)).id).toBe(e.id);
        const second = await h.app.execution.createExecution(u.id, 'new', e.creation);
        expect(second.id).not.toBe(e.id);
        expect(second.projectId).toBe(e.projectId);
        expect(h.store.p.size).toBe(1);
        await expect(h.app.execution.createExecution(u.id, 'create', { ...e.creation, instruction: 'changed' })).rejects.toMatchObject({ code: 'conflict' });
    });
    it('C03 refuses unconfirmed Git and never repins an existing execution', async () => {
        const h = harness();
        const { u, e } = await h.running();
        h.flags.gitFail = true;
        expect((await h.app.execution.prepareExecution(u.id, e.id)).method?.sha).toBe('fixed-sha');
        const other = await h.app.execution.createExecution(u.id, 'next', e.creation);
        await expect(h.app.execution.prepareExecution(u.id, other.id)).rejects.toThrow();
        expect((await h.store.execution(other.id)).method).toBeUndefined();
    });
    it('C04 answers immediately with one delivery intent and a one-to-one episode', async () => {
        const h = harness();
        const { u, r } = await request(h);
        const d = await h.app.decision.submitUserDecision(u.id, r.id, 'answer', payload);
        const ep = await h.app.query.queryEpisode(u.id, r.id);
        expect(ep.id).toBe(r.id);
        expect(ep.request.status).toBe('answered');
        expect(ep.decisions).toEqual([d]);
        expect(ep.inputs[0].status).toBe('pending');
        expect(await h.app.decision.submitUserDecision(u.id, r.id, 'answer', payload)).toEqual(d);
        expect((await h.app.query.queryEpisode(u.id, r.id)).inputs).toHaveLength(1);
    });
    it('C05 old Context remains answerable and corrections preserve both submissions', async () => {
        const h = harness();
        const { u, e, r } = await request(h);
        await h.app.decision.refreshContext(u.id, r.id, e.generation, { ...context, revision: 2 });
        const a = await h.app.decision.submitUserDecision(u.id, r.id, 'a', payload);
        await h.app.decision.submitUserDecision(u.id, r.id, 'b', { ...payload, text: 'Correction', correctionOf: a.id });
        const ep = await h.app.query.queryEpisode(u.id, r.id);
        expect(ep.decisions).toHaveLength(2);
        expect(ep.request.status).toBe('answered');
        expect(ep.request.contexts).toHaveLength(2);
    });
    it('C04 transaction failure leaves no answered state or orphan delivery', async () => {
        const h = harness();
        const { u, r } = await request(h);
        h.store.fail = true;
        await expect(h.app.decision.submitUserDecision(u.id, r.id, 'a', payload)).rejects.toThrow();
        expect((await h.store.request(r.id)).status).toBe('pending');
        expect(await h.store.decisions(r.id)).toHaveLength(0);
    });
    it('C06 delivery failure never retracts the saved answer; retries use the same input', async () => {
        const h = harness();
        const { u, e, r } = await request(h);
        await h.app.decision.submitUserDecision(u.id, r.id, 'a', payload);
        const i = (await h.store.inputs(e.id)).at(-1)!;
        h.flags.deliverFail = true;
        await expect(h.app.input.dispatchInput(u.id, i.id)).rejects.toThrow();
        expect((await h.store.request(r.id)).status).toBe('answered');
        h.flags.deliverFail = false;
        const before = h.flags.deliverCount;
        await h.app.input.dispatchInput(u.id, i.id);
        await h.app.input.dispatchInput(u.id, i.id);
        expect(h.flags.deliverCount - before).toBe(1);
    });
    it('C06 recovers when Runtime accepted but local acknowledgement failed', async () => {
        const h = harness();
        const { u, e } = await h.running();
        await h.app.input.submitSteering(u.id, e.id, 's', 'more');
        const i = (await h.store.inputs(e.id)).at(-1)!;
        const mark = h.d.store.markDelivered.bind(h.d.store);
        h.d.store.markDelivered = async () => { throw Error('commit lost'); };
        await expect(h.app.input.dispatchInput(u.id, i.id)).rejects.toThrow();
        const n = h.flags.deliverCount;
        h.d.store.markDelivered = mark;
        await h.app.input.dispatchInput(u.id, i.id);
        expect(h.flags.deliverCount).toBe(n);
        expect((await h.store.input(i.id)).status).toBe('delivered');
    });
    it('C07 finished execution continues with the same Session, Workspace and method', async () => {
        const h = harness();
        const { u, e } = await h.running();
        await h.app.execution.finishExecution(u.id, e.id, e.generation);
        await h.app.input.submitSteering(u.id, e.id, 's', 'continue');
        await h.app.input.dispatchInput(u.id, (await h.store.inputs(e.id)).at(-1)!.id);
        const after = await h.store.execution(e.id);
        expect([after.sessionId, after.workspaceId, after.method]).toEqual([e.sessionId, e.workspaceId, e.method]);
        expect(after.generation).toBe(e.generation + 1);
    });
    it('C07 cannot finish over already committed pending input', async () => {
        const h = harness();
        const { u, e } = await h.running();
        await h.app.input.submitSteering(u.id, e.id, 's', 'continue');
        await expect(h.app.execution.finishExecution(u.id, e.id, e.generation)).rejects.toMatchObject({ code: 'blocked' });
    });
    it('C08 queues during cancellation and fences old runtime generation', async () => {
        const h = harness();
        const { u, e } = await h.running();
        await h.app.execution.requestCancellation(u.id, e.id);
        await h.app.input.submitSteering(u.id, e.id, 's', 'continue');
        const i = (await h.store.inputs(e.id)).at(-1)!;
        await expect(h.app.input.dispatchInput(u.id, i.id)).rejects.toMatchObject({ code: 'blocked' });
        h.flags.stopped = false;
        await expect(h.app.execution.confirmStopped(u.id, e.id)).rejects.toMatchObject({ code: 'blocked' });
        h.flags.stopped = true;
        await h.app.execution.confirmStopped(u.id, e.id);
        await h.app.input.dispatchInput(u.id, i.id);
        await expect(h.app.decision.createDecisionRequest(u.id, e.id, e.generation, 'old', '?', [], context)).rejects.toMatchObject({ code: 'blocked' });
    });
    it('C09 rejects another execution file and preserves saved input on materialization failure', async () => {
        const h = harness();
        const { u, e } = await h.running();
        const f = await h.app.input.upload(u.id, e.id, 'file', new Uint8Array([1]));
        const other = await h.app.execution.createExecution(u.id, 'other', e.creation);
        await expect(h.app.input.submitSteering(u.id, other.id, 'cross', 'file', [f.id])).rejects.toMatchObject({ code: 'forbidden' });
        await h.app.input.submitSteering(u.id, e.id, 's', 'file', [f.id]);
        h.flags.materializeFail = true;
        await expect(h.app.input.dispatchInput(u.id, (await h.store.inputs(e.id)).at(-1)!.id)).rejects.toThrow();
        expect((await h.store.inputs(e.id)).at(-1)!.status).toBe('pending');
    });
    it('C10 administrator never inherits another user content or command cache', async () => {
        const h = harness();
        const { u, e } = await h.running();
        const other = await h.app.account.ensureUser('admin');
        h.store.u.set(other.id, { ...other, admin: true });
        await expect(h.app.query.queryExecution(other.id, e.id)).rejects.toMatchObject({ code: 'forbidden' });
        expect(await h.app.query.queryProjects(other.id)).toEqual([]);
        h.store.u.set(u.id, { ...u, enabled: false });
        await expect(h.app.execution.createExecution(u.id, 'create', e.creation)).rejects.toMatchObject({ code: 'forbidden' });
    });
    it('C11 no history write means no network operation, timeout means unknown', async () => {
        const h = harness();
        const { u, e } = await h.running();
        h.flags.historyFail = true;
        await expect(h.app.mcpCases.callMcp(u.id, e.id, e.generation, 'business', 'tool', { token: 'secret', x: 1 }, h.d.support.id())).rejects.toThrow();
        expect(h.flags.callCount).toBe(0);
        h.flags.historyFail = false;
        h.flags.callFail = true;
        const result = await h.app.mcpCases.callMcp(u.id, e.id, e.generation, 'business', 'tool', { token: 'secret', x: 1 }, h.d.support.id());
        expect(result.status).toBe('unknown');
        expect(h.calls[0].parameters).toEqual({ x: 1 });
        expect(h.calls[0].type).toBe('unknown');
    });
    it('C12 write filtering still reports unknown calls', async () => {
        const h = harness();
        const { u, e } = await h.running();
        await h.app.mcpCases.callMcp(u.id, e.id, e.generation, 'business', 'tool', {}, h.d.support.id());
        const page = await h.app.query.queryMcpCalls(u.id, e.id, 'write');
        expect(page.items).toHaveLength(0);
        expect(page.unknownCount).toBe(1);
    });
    it('C13 protects the last administrator and responsibility holders', async () => {
        const h = harness();
        const { u } = await h.running();
        const admin = await h.app.account.ensureUser('admin');
        h.store.u.set(admin.id, { ...admin, admin: true });
        await expect(h.app.account.manageUser(admin.id, admin.id, { admin: false })).rejects.toMatchObject({ code: 'blocked' });
        await expect(h.app.account.manageUser(admin.id, u.id, { enabled: false })).rejects.toMatchObject({ code: 'blocked' });
    });
    it('C15 excludes author material and traversal in reads and search', async () => {
        const h = harness();
        const { u, e } = await h.running();
        for (const path of ['.ome/a.md', 'a/../b.md', '/om.md'])
            expect(() => runtimePath(path)).toThrow();
        await expect(h.app.method.readMethod(u.id, e.method!, '.ome/a.md')).rejects.toThrow();
        expect(await h.app.method.searchMethod(u.id, e.method!, 'query')).toEqual([{ path: 'om.md', excerpt: 'allowed' }]);
    });
    it('fingerprints do not depend on JSON key order', () => { expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 })); });
});
