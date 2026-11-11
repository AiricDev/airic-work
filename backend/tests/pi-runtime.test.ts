import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createModels, fauxProvider, fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { PiRuntime, type WorkerHost } from '../src/adapters/driven/runtime/pi-runtime';
import type { Execution, Input } from '../src/domain/model';
const directories: string[] = [];
const runtimes: PiRuntime[] = [];
afterEach(async () => { for (const r of runtimes) await r.close(); runtimes.length = 0; for (const d of directories) await rm(d, { recursive: true, force: true }); directories.length = 0; });
const e: Execution = { id: 'execution', ownerId: 'user', projectId: 'project', sessionId: 'session', workspaceId: 'workspace', generation: 1, version: 1, phase: 'running', creation: { source: 'test', project_id: 'p', project_name: 'P', task: {}, instruction: 'Review A B C' } };
const input = (id: string, requestId?: string): Input => ({ id, executionId: e.id, sessionId: e.sessionId, userId: e.ownerId, kind: requestId ? 'user-decision' : 'start', sourceId: requestId ?? e.id, text: requestId ?? 'Review A B C', files: [], sequence: 1, status: 'pending' });
const text = (s: string) => fauxAssistantMessage([fauxText(s)]);
const ask = (part: string) => fauxAssistantMessage([fauxToolCall('work_request_decision', { question: part, scope: part }, { id: part })], { stopReason: 'toolUse' });
it('persists questions, continues independent work, routes reverse answers, deduplicates and reopens the original Session', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'airic-runtime-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    const questions: string[] = [];
    const host: WorkerHost = { assembly: async () => ({ worker: 'worker', root: 'om', version: 'fixed' }), check: async () => {}, input: async (_e, i) => ({ content: i.text, ...(i.kind === 'user-decision' ? { requestId: i.sourceId } : {}) }), request: async (_e, _key, question) => { questions.push(question); return question; } };
    let runtime = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host); runtimes.push(runtime);
    await runtime.start(e);
    faux.setResponses([ask('A'), ask('B'), text('C completed')]);
    const receipt = await runtime.deliver(e, input('start'));
    await runtime.drain(e.sessionId);
    expect(questions).toEqual(['A', 'B']);
    expect(await runtime.deliver(e, input('start'))).toBe(receipt);
    faux.setResponses([text('B continued'), text('A continued')]);
    await runtime.deliver(e, input('answer-B', 'B')); await runtime.drain(e.sessionId);
    await runtime.deliver(e, input('answer-A', 'A')); await runtime.drain(e.sessionId);
    const records = await runtime.records(e.sessionId);
    expect(JSON.stringify(records)).toContain('B continued');
    expect(JSON.stringify(records)).toContain('A continued');
    await runtime.close();
    runtime = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host); runtimes.push(runtime);
    await runtime.ensure(e);
    expect(await runtime.accepted(e.sessionId, 'start')).toBe(receipt);
    expect((await runtime.records(e.sessionId)).length).toBe(records.length);
    await runtime.stop(e);
    expect(await runtime.stopped(e)).toBe(true);
});

it('rejects changed assembly and competing writers, and allows a new generation after full stop', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'airic-runtime-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    let version = 'one';
    const host: WorkerHost = { assembly: async () => ({ worker: 'worker', root: 'om', version }), check: async () => {}, input: async (_e, i) => ({ content: i.text }), request: async () => 'request' };
    const first = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host); runtimes.push(first);
    await first.start(e);
    const other = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host); runtimes.push(other);
    await expect(other.ensure(e)).rejects.toThrow();
    await first.stop(e);
    await first.start({ ...e, generation: 2 });
    faux.setResponses([text('continued')]);
    await first.deliver({ ...e, generation: 2 }, input('new-input'));
    await first.drain(e.sessionId);
    await first.close();
    version = 'changed';
    await expect(other.ensure(e)).rejects.toThrow('assembly changed');
});

it('surfaces failed model slices instead of treating terminal tasks as success', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'airic-runtime-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    const host: WorkerHost = { assembly: async () => ({ worker: 'worker', root: 'om', version: 'one' }), check: async () => {}, input: async (_e, i) => ({ content: i.text }), request: async () => 'request' };
    const r = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host); runtimes.push(r);
    await r.start(e);
    faux.setResponses([]);
    await r.deliver(e, input('failure'));
    await expect(r.drain(e.sessionId)).rejects.toThrow('worker slice failed');
});

it('runs existing application use cases through worker bootstrap and resumes an ended execution on UserDecision', async () => {
    const { harness } = await import('./support/harness');
    const { createWorker } = await import('../src/bootstrap/bindings');
    const { createBackend } = await import('../src/bootstrap/container');
    const h = harness();
    const dir = await mkdtemp(join(tmpdir(), 'airic-worker-app-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    const worker = createWorker({ directory: dir, models, model: { provider: 'faux', modelId: 'faux-1' }, skillPath: join(import.meta.dirname, '../prompts/worker.md') }, h.store, h.d.methods, h.d.support);
    runtimes.push(worker.runtime);
    const backend = createBackend({ ...h.d, runtime: worker.runtime, history: worker.history });
    const app = backend.application;
    const owner = await app.account.ensureUser('owner');
    const execution = await app.execution.createExecution(owner.id, 'create', { source: 'test', project_id: 'p', project_name: 'P', task: {}, instruction: 'Review A B C' });
    faux.setResponses([ask('A'), ask('B'), text('C completed')]);
    const runner = worker.runner(app);
    expect((await runner.run(owner.id, execution.id)).phase).toBe('ended');
    const pending = await app.query.queryPending(owner.id);
    expect(pending).toHaveLength(2);
    const b = pending.find(r => r.question === 'B')!;
    await app.decision.submitUserDecision(owner.id, b.id, 'decision-B', { text: 'accept B', contextRevision: 1, files: [] });
    expect((await app.query.queryDecisionRequest(owner.id, b.id)).status).toBe('answered');
    faux.setResponses([text('B continued after C')]);
    expect((await runner.run(owner.id, execution.id)).phase).toBe('ended');
    expect((await app.query.queryPending(owner.id)).map(r => r.question)).toEqual(['A']);
    expect(JSON.stringify(await app.query.querySession(owner.id, execution.id))).toContain('B continued after C');
    await backend.dispose();
});

it('records MCP attempts atomically in the same Session and projects completed results', async () => {
    const { PiHistory } = await import('../src/adapters/driven/runtime/pi-history');
    const dir = await mkdtemp(join(tmpdir(), 'airic-history-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    const host: WorkerHost = { assembly: async () => ({ worker: 'worker', root: 'om', version: 'fixed' }), check: async () => {}, input: async (_e, i) => ({ content: i.text }), request: async () => 'request' };
    const runtime = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host); runtimes.push(runtime);
    await runtime.ensure(e);
    const history = new PiHistory(runtime);
    const call = { id: 'call', sessionId: e.sessionId, connection: 'business', tool: 'write', at: '2026-10-30T00:00:00Z', type: 'write' as const, schemaRevision: '1', parameters: {}, status: 'calling' as const };
    const results = await Promise.allSettled([history.appendCall(call), history.appendCall(call)]);
    expect(results.filter(r => r.status === 'fulfilled')).toHaveLength(1);
    await history.finishCall(e.sessionId, call.id, 'unknown', { reason: 'unconfirmed' });
    expect(await history.call(e.sessionId, call.id)).toMatchObject({ status: 'unknown' });
    expect((await history.calls(e.sessionId, 'write')).items).toHaveLength(1);
});

it('reuses one continuation when two questions block the same work', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'airic-group-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    const host: WorkerHost = { assembly: async () => ({ worker: 'worker', root: 'om', version: 'fixed' }), check: async () => {}, input: async (_e, i) => ({ content: i.text, ...(i.kind === 'user-decision' ? { requestId: i.sourceId } : {}) }), request: async (_e, _key, question) => question };
    const r = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host); runtimes.push(r);
    await r.start(e);
    const groupAsk = (question: string, continuationId?: string) => fauxAssistantMessage([fauxToolCall('work_request_decision', { question, scope: 'shared-work', ...(continuationId ? { continuationId } : {}) }, { id: question })], { stopReason: 'toolUse' });
    faux.setResponses([groupAsk('A'), groupAsk('B', 'A'), text('independent work done')]);
    await r.deliver(e, input('start')); await r.drain(e.sessionId);
    faux.setResponses([text('partial response B'), text('remaining response A')]);
    await r.deliver(e, input('B-reply', 'B')); await r.drain(e.sessionId);
    await r.deliver(e, input('A-reply', 'A')); await r.drain(e.sessionId);
    expect(new Set((await r.records(e.sessionId)).map(record => record.conversationId)).size).toBe(2);
});

it('holds answers for shared work until all its Decision Requests are answered', async () => {
    const { harness } = await import('./support/harness');
    const { createWorker } = await import('../src/bootstrap/bindings');
    const { createBackend } = await import('../src/bootstrap/container');
    const h = harness();
    const dir = await mkdtemp(join(tmpdir(), 'airic-shared-work-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    const worker = createWorker({ directory: dir, models, model: { provider: 'faux', modelId: 'faux-1' }, skillPath: join(import.meta.dirname, '../prompts/worker.md') }, h.store, h.d.methods, h.d.support);
    runtimes.push(worker.runtime);
    const backend = createBackend({ ...h.d, runtime: worker.runtime, history: worker.history });
    try {
        const app = backend.application;
        const owner = await app.account.ensureUser('owner');
        const execution = await app.execution.createExecution(owner.id, 'create', { source: 'test', project_id: 'p', project_name: 'P', task: {}, instruction: 'Review A and B' });
        const runner = worker.runner(app);
        faux.setResponses([ask('A'), async () => {
            const requestId = (await h.store.requests(execution.id))[0].id;
            return fauxAssistantMessage([fauxToolCall('work_request_decision', { question: 'B', scope: 'A', continuationId: requestId }, { id: 'B' })], { stopReason: 'toolUse' });
        }, text('Waiting')]);
        await runner.run(owner.id, execution.id);
        const requests = await app.query.queryPending(owner.id);
        expect(requests.map(r => r.question)).toEqual(['A', 'B']);
        const [a, b] = requests;
        const answer = { contextRevision: 1, files: [] };
        await app.decision.submitUserDecision(owner.id, b.id, 'b', { ...answer, text: 'Answer B' });
        const waiting = await runner.run(owner.id, execution.id);
        expect(waiting.phase).toBe('ended');
        expect((await h.store.inputs(execution.id)).filter(i => i.status === 'pending')).toHaveLength(1);
        await app.decision.submitUserDecision(owner.id, a.id, 'a', { ...answer, text: 'Answer A' });
        let firstContinuation = '';
        faux.setResponses([context => {
            firstContinuation = JSON.stringify(context.messages);
            return text('B delivered after both answers');
        }, text('A delivered after both answers')]);
        await runner.run(owner.id, execution.id);
        expect(firstContinuation).toContain('Answer A');
        expect(firstContinuation).toContain('Answer B');
        expect((await h.store.inputs(execution.id)).every(i => i.status === 'delivered')).toBe(true);
    } finally { await backend.dispose(); }
});

it('rejects an unknown continuation before saving a request so a corrected tool call creates only one question', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'airic-invalid-continuation-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    const saved: string[] = [];
    const host: WorkerHost = { assembly: async () => ({ worker: 'worker', root: 'om', version: 'fixed' }), check: async () => {}, input: async (_e, i) => ({ content: i.text }), request: async (_e, _key, question) => { saved.push(question); return `request-${saved.length}`; } };
    const r = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host); runtimes.push(r);
    await r.start(e);
    faux.setResponses([
        fauxAssistantMessage([fauxToolCall('work_request_decision', { question: 'O7', scope: 'O7', continuationId: e.id }, { id: 'invalid-link' })], { stopReason: 'toolUse' }),
        fauxAssistantMessage([fauxToolCall('work_request_decision', { question: 'O7', scope: 'O7' }, { id: 'corrected-link' })], { stopReason: 'toolUse' }),
        text('waiting for O7'),
    ]);
    await r.deliver(e, input('start')); await r.drain(e.sessionId);
    expect(saved).toEqual(['O7']);
    expect(JSON.stringify(await r.records(e.sessionId))).toContain('unknown continuation');
});

it('routes one decision to two anchored scopes and deduplicates the input after reopening', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'airic-fanout-')); directories.push(dir);
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    const requests: string[] = [];
    const host: WorkerHost = {
        assembly: async () => ({ worker: 'worker', root: 'om', version: 'fixed' }),
        check: async () => {},
        input: async (_e, i) => ({ content: i.text, ...(i.kind === 'user-decision' ? { requestId: i.sourceId } : {}) }),
        request: async (_e, _key, question) => { requests.push(question); return question; },
        pendingRequests: async () => requests,
    };
    const open = () => {
        const runtime = new PiRuntime(dir, models, { provider: 'faux', modelId: 'faux-1' }, host);
        runtimes.push(runtime);
        return runtime;
    };
    let runtime = open();
    await runtime.start(e);
    faux.setResponses([
        ask('maintenance'),
        fauxAssistantMessage([fauxToolCall('work_wait_for_decision', { requestId: 'maintenance', scope: 'test-plan' }, { id: 'reuse' })], { stopReason: 'toolUse' }),
        text('Waiting'),
    ]);
    await runtime.deliver(e, input('start'));
    await runtime.drain(e.sessionId);
    expect(requests).toEqual(['maintenance']);
    const scopes = await runtime.decisionScope(e, 'maintenance');
    expect(scopes.map(scope => scope.label)).toEqual(['maintenance', 'test-plan']);
    const answer = input('shared-answer', 'maintenance');
    faux.setResponses([ask('follow-up'), text('Second scope resumed')]);
    const receipt = await runtime.deliver(e, answer);
    await runtime.drain(e.sessionId);
    await runtime.close();
    runtime = open();
    await runtime.ensure(e);
    expect(await runtime.deliver(e, answer)).toBe(receipt);
    await runtime.drain(e.sessionId);
    const entries = (await runtime.records(e.sessionId)).filter(entry => entry.kind === 'aw.user-decision');
    expect(entries.map(entry => entry.data)).toMatchObject(scopes.map(({ workId }) => ({ inputId: answer.id, requestId: 'maintenance', workId })));
    expect(new Set(entries.map(entry => entry.conversationId)).size).toBe(2);
    expect(requests).toEqual(['maintenance', 'follow-up']);
    expect(JSON.stringify(await runtime.records(e.sessionId))).toContain('Second scope resumed');
    const summaries = (await runtime.records(e.sessionId)).filter(entry => entry.kind === 'aw.branch-summary');
    expect(summaries.map(entry => entry.data)).toMatchObject([
        { inputId: answer.id, status: 'waiting', requests: ['follow-up'] },
        { inputId: answer.id, status: 'ended', requests: [] },
    ]);
    let rootContext = '';
    faux.setResponses([context => {
        rootContext = JSON.stringify(context.messages);
        return text('Main work continued');
    }]);
    await runtime.deliver(e, { ...input('steer'), kind: 'steering', text: 'Check progress' });
    await runtime.drain(e.sessionId);
    expect(rootContext).toContain('worker-branch-summary');
    expect(rootContext).toContain('Second scope resumed');

});
