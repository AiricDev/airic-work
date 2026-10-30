import { it, expect } from 'vitest';
import { harness } from './support/harness';
import { canonical, beginRun } from '../src/domain/model';
it('concurrent identical create commands commit one execution', async () => {
    const h = harness();
    const u = await h.app.account.ensureUser('owner');
    const c = { source: 'business', project_id: 'p', project_name: 'P', task: {}, instruction: 'do' };
    const [a, b] = await Promise.all([h.app.execution.createExecution(u.id, 'same', c), h.app.execution.createExecution(u.id, 'same', c)]);
    expect(a.id).toBe(b.id);
    expect(h.store.e.size).toBe(1);
});
it('runtime command replay with stable call ID never repeats unknown external effects', async () => {
    const h = harness();
    const { u, e } = await h.running();
    h.flags.callFail = true;
    await h.app.mcpCases.callMcp(u.id, e.id, e.generation, 'business', 'tool', { x: 1 }, 'stable-call');
    await h.app.mcpCases.callMcp(u.id, e.id, e.generation, 'business', 'tool', { x: 1 }, 'stable-call');
    expect(h.flags.callCount).toBe(1);
    await expect(h.app.mcpCases.callMcp(u.id, e.id, e.generation, 'business', 'tool', { x: 2 }, 'stable-call')).rejects.toMatchObject({ code: 'conflict' });
});
it('reply cannot bind a fabricated reading version', async () => {
    const h = harness();
    const { u, e } = await h.running();
    const r = await h.app.decision.createDecisionRequest(u.id, e.id, e.generation, 'q', '?', [], { revision: 1, content: {}, sources: [] });
    await expect(h.app.decision.submitUserDecision(u.id, r.id, 'd', { text: 'x', files: [], contextRevision: 99 })).rejects.toMatchObject({ code: 'invalid' });
    expect((await h.store.request(r.id)).status).toBe('pending');
});
it('preparation commit detects changed settings and leaves no start message', async () => {
    const h = harness();
    const u = await h.app.account.ensureUser('owner');
    const e = await h.app.execution.createExecution(u.id, 'x', { source: 'business', project_id: 'p', project_name: 'p', task: {}, instruction: 'do' });
    const latest = h.d.methods.latest;
    h.d.methods.latest = async (s) => { h.store.config.version++; return latest(s); };
    await expect(h.app.execution.prepareExecution(u.id, e.id)).rejects.toMatchObject({ code: 'conflict' });
    expect(await h.store.inputs(e.id)).toHaveLength(0);
});
it('later inputs cannot overtake an earlier undelivered input', async () => {
    const h = harness();
    const { u, e } = await h.running();
    await h.app.input.submitSteering(u.id, e.id, 'a', 'a');
    await h.app.input.submitSteering(u.id, e.id, 'b', 'b');
    await expect(h.app.input.dispatchInput(u.id, (await h.store.inputs(e.id)).at(-1)!.id)).rejects.toMatchObject({ code: 'blocked' });
});
it('atomic stale version protection cannot overwrite a cancellation', async () => {
    const h = harness();
    const { u, e } = await h.running();
    await h.app.execution.requestCancellation(u.id, e.id);
    await expect(h.store.transition(u.id, e.version, { ...e, phase: 'ended', version: e.version + 1 })).rejects.toMatchObject({ code: 'conflict' });
});
it('unprepared execution can be cancelled without inventing an OM snapshot', async () => {
    const h = harness();
    const u = await h.app.account.ensureUser('owner');
    const e = await h.app.execution.createExecution(u.id, 'x', { source: 'business', project_id: 'p', project_name: 'p', task: {}, instruction: 'do' });
    await h.app.execution.requestCancellation(u.id, e.id);
    await h.app.execution.confirmStopped(u.id, e.id);
    expect((await h.store.execution(e.id)).method).toBeUndefined();
    expect(() => beginRun(e)).toThrow();
});
it('queries expose only the corresponding decision messages', async () => {
    const h = harness();
    const { u, e } = await h.running();
    const a = await h.app.decision.createDecisionRequest(u.id, e.id, e.generation, 'a', 'a', [], { revision: 1, content: {}, sources: [] });
    const b = await h.app.decision.createDecisionRequest(u.id, e.id, e.generation, 'b', 'b', [], { revision: 1, content: {}, sources: [] });
    for (const r of [a, b])
        await h.app.decision.submitUserDecision(u.id, r.id, r.id, { text: 'yes', files: [], contextRevision: 1 });
    expect((await h.app.query.queryEpisode(u.id, a.id)).inputs).toHaveLength(1);
    expect(await h.app.query.queryPending(u.id)).toEqual([]);
});
it('profile updates cannot elevate administrator or reset disable state', async () => {
    const h = harness();
    const u = await h.app.account.ensureUser('owner');
    const next = await h.app.account.updateProfile(u.id, 'Updated');
    expect(next.name).toBe('Updated');
    expect(next.admin).toBe(false);
    await expect(h.app.account.listUsers(u.id)).rejects.toMatchObject({ code: 'forbidden' });
});
it('invalid input fingerprints do not silently drop non-JSON values', () => { expect(() => canonical({ a: undefined })).toThrow(); });
