import './load-typescript.mjs';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { createModels, fauxProvider, fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
const { openTaskRuntime } = await import('../../src/bootstrap/task-runtime.ts');
const { SqliteControlStore } = await import('../../src/adapters/driven/sqlite/store.ts');

const [directory, step] = process.argv.slice(2);
const record = {
    taskId: 'crash-test', scope: 'test', actor: 'owner', acceptedAt: '2026-11-10T00:00:00Z',
    creation: { instruction: 'Check evidence', om: { source: 'local', revision: 'v1', entry: 'om.md' } },
};
const methods = {
    async pinRevision({ source, entry }) { return { source, root: entry, sha: 'a'.repeat(40), runtimeVersion: 'test', skillVersion: 'test' }; },
    async read() { return 'Fixture OM'; },
};
const faux = fauxProvider();
const models = createModels();
models.setProvider(faux.provider);
const text = value => fauxAssistantMessage([fauxText(value)]);
const ask = fauxAssistantMessage([fauxToolCall('work_request_decision', { question: 'Confirm evidence?', scope: 'review' }, { id: 'ask' })], { stopReason: 'toolUse' });
const kill = () => process.kill(process.pid, 'SIGKILL');
if (step === 'question-crash') {
    const save = SqliteControlStore.prototype.createRequest;
    SqliteControlStore.prototype.createRequest = async function (...args) {
        await save.apply(this, args);
        kill();
    };
}
if (step === 'receipt-crash') {
    SqliteControlStore.prototype.markDelivered = async function (_owner, inputId, receipt) {
        const input = await this.input(inputId);
        assert.equal(input.kind, 'user-decision');
        assert.equal(input.status, 'pending');
        assert.ok(receipt);
        kill();
    };
}
const diagnostics = [];
const runtime = await openTaskRuntime(directory, record, methods, {
    models, model: { provider: 'faux', modelId: 'faux-1' },
    skillPath: join(import.meta.dirname, '../../prompts/worker.md'),
    diagnostic: event => diagnostics.push(event),
});
try {
    const { app, ownerId, executionId } = runtime;
    if (step === 'question-crash') {
        faux.setResponses([ask]);
        await runtime.run();
    } else if (step === 'question-recover') {
        faux.setResponses([text('Waiting for answer')]);
        await runtime.run();
    } else if (step === 'answer-crash') {
        const [request] = await app.query.queryRequests(ownerId, executionId);
        await app.decision.submitUserDecision(ownerId, request.id, 'answer', { text: 'Confirmed', contextRevision: 1, files: [] });
        kill();
    } else if (step !== 'inspect') {
        faux.setResponses([text('Confirmed work continued')]);
        await runtime.run();
    }
    const requests = await app.query.queryRequests(ownerId, executionId);
    const episode = await app.query.queryEpisode(ownerId, requests[0].id);
    const scope = (await runtime.workScopes(requests))[0];
    const trace = await runtime.trace();
    process.send({ requests, decisions: episode.decisions, scope, trace, inputs: runtime.inputFacts(), diagnostics });
} finally { await runtime.close(); }
