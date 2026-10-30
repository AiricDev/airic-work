import { Application } from '../../src/application/application';
import { ApplicationPolicy } from '../../src/application/policy';
import type { CallRecord, SessionRecord, Page } from '../../src/application/ports';
import { MemoryStore } from './memory-store';
import type { AdapterBindings } from '../../src/bootstrap/bindings';
import { AccountUseCases } from '../../src/application/account';
import { ExecutionUseCases } from '../../src/application/execution';
import { DecisionUseCases } from '../../src/application/decision';
import { InputUseCases } from '../../src/application/input';
import { QueryUseCases } from '../../src/application/query';
import { MethodUseCases } from '../../src/application/method';
import { SettingsUseCases } from '../../src/application/settings';
import { McpUseCases } from '../../src/application/mcp';
export function harness() {
    const store = new MemoryStore();
    let id = 0;
    const accepted = new Map<string, string>();
    const calls: CallRecord[] = [];
    const messages: SessionRecord[] = [];
    const flags = { deliverFail: false, materializeFail: false, gitFail: false, historyFail: false, callFail: false, stopped: true, callCount: 0, deliverCount: 0 };
    const page = <T>(items: T[]): Page<T> => ({ items: structuredClone(items), complete: true, limitations: [] });
    const d: AdapterBindings = { store, support: { id: () => `id-${++id}`, now: () => new Date(0).toISOString() }, identity: { verify: async (token) => ({ issuer: 'test', subject: token, name: token }) },
        runtime: { ensure: async () => { }, start: async () => { }, stopped: async () => flags.stopped, stop: async () => { }, accepted: async (_s, id) => accepted.get(id), deliver: async (_e, input) => {
                if (flags.deliverFail)
                    throw Error('runtime unavailable');
                if (!accepted.has(input.id)) {
                    flags.deliverCount++;
                    accepted.set(input.id, `receipt-${input.id}`);
                    messages.push({ id: input.id, at: 'now', kind: input.kind, inputId: input.id, data: input.text });
                }
                return accepted.get(input.id)!;
            } },
        workspace: { ensure: async () => { }, materialize: async () => {
                if (flags.materializeFail)
                    throw Error('file unavailable');
            }, stopped: async () => flags.stopped },
        files: { put: async (bytes) => ({ hash: `hash-${bytes.length}`, size: bytes.length, contentRef: 'blob' }) },
        methods: { status: async (s) => ({ source: s.omSource, kind: 'managed', sync: { enabled: true } }), sync: async s => d.methods.latest(s), latest: async (s) => {
                if (flags.gitFail)
                    throw Error('git unavailable');
                return { source: s.omSource, sha: 'fixed-sha', root: s.root, runtimeVersion: 'test-runtime', skillVersion: 'test-skill' };
            }, read: async () => 'method', search: async () => [{ path: '.ome/private.md', excerpt: 'excluded' }, { path: 'om.md', excerpt: 'allowed' }], history: async () => [] },
        history: { call: async (s, id) => structuredClone(calls.find(c => c.sessionId === s && c.id === id)), page: async () => page(messages), calls: async (s, type) => ({ ...page(calls.filter(c => c.sessionId === s && (!type || c.type === type))), unknownCount: calls.filter(c => c.sessionId === s && c.type === 'unknown').length }), appendCall: async (c) => {
                if (flags.historyFail)
                    throw Error('history unavailable');
                if (calls.some(x => x.sessionId === c.sessionId && x.id === c.id))
                    throw Error('duplicate call');
                calls.push(structuredClone(c));
            }, finishCall: async (_s, id, status, result) => { Object.assign(calls.find(c => c.id === id)!, { status, result }); } },
        mcp: { tools: async () => [{ name: 'tool', schemaRevision: '1' }], sanitize: (_c, value) => {
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    const result = { ...value };
                    delete result.token;
                    return result;
                }
                return value;
            }, call: async () => {
                flags.callCount++;
                if (flags.callFail)
                    throw Error('timeout');
                return { status: 'success', result: { message: 'ok' } };
            } }
    };
    const policy = new ApplicationPolicy(d.store, d.support);
    const app = new Application(new AccountUseCases(d.identity, d.store, d.support), new ExecutionUseCases(d.methods, d.runtime, d.store, d.support, d.workspace, policy), new DecisionUseCases(d.store, d.support, policy), new InputUseCases(d.files, d.runtime, d.store, d.support, d.workspace, policy), new QueryUseCases(d.history, d.store, policy), new MethodUseCases(d.methods, d.store), new SettingsUseCases(d.store), new McpUseCases(d.history, d.mcp, d.store, d.support, policy));
    async function running() { const u = await app.account.ensureUser('owner'); let e = await app.execution.createExecution(u.id, 'create', { source: 'business', project_id: 'p', project_name: 'Project', task: { id: 'task' }, instruction: 'check' }); e = await app.execution.prepareExecution(u.id, e.id); const start = (await store.inputs(e.id))[0]; await app.input.dispatchInput(u.id, start.id); return { u, e: await store.execution(e.id) }; }
    return { app, store, d, flags, calls, accepted, messages, running };
}
