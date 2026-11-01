import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { Type, type Models } from '@earendil-works/pi-ai';
import { Harness, createRegistry, defineDoc, defineExtension, defineTool, defineTask, section, configure, type ConversationId, type EntryId, type TaskId, type Cursor, type Tx, type ToolRegistration } from '@earendil-works/pi-durable';
import type { Execution, Input, Context, Option, Json } from '../../../domain/model';
import { canonical, requireRule } from '../../../domain/model';
import type { Runtime } from '../../../application/ports';

/** Trusted host capabilities. Payloads and scope come from application policy, never model-supplied user IDs. */
export interface WorkerHost {
    assembly(e: Execution): Promise<{ worker: string; root: string; version: string }>;
    check(e: Execution): Promise<void>;
    input(e: Execution, input: Input): Promise<{ content: string; requestId?: string }>;
    request(e: Execution, key: string, question: string, options?: Option[], decisionContext?: Context, summary?: string): Promise<string>;
    tools?(e: Execution): Promise<ToolRegistration[]>;
}
type SliceInput = { target: ConversationId; content: string; kind: string; scope: string; generation: number };
type Link = { parent?: string; source: ConversationId; at?: EntryId; target?: ConversationId; scope: string };
const State = defineDoc<{
    execution: string; assembly: string; generation: number; stopped: boolean; quiescing: boolean;
    active: TaskId | null; receipts: Record<string, { digest: string; task: TaskId }>;
    links: Record<string, Link>; intents: Record<string, { wait: boolean; requests: string[] }>;
}>({ kind: 'aw.runtime', version: 1, scope: 'session', checkpointWhen: () => false,
    initial: () => ({ execution: '', assembly: '', generation: 0, stopped: true, quiescing: false, active: null, receipts: {}, links: {}, intents: {} }) });
const Anchor = defineTask<null, { phase: 'done' }, null>({ name: 'aw.anchor', version: 1, initial: () => ({ phase: 'done' }),
    phases: { done: (_t, api, c) => api.commit(() => ({ status: 'terminal', outcome: { status: 'completed', result: null } }), c) },
    abort: (_t, api, c) => api.commit(() => ({ status: 'terminal', outcome: { status: 'aborted' } }), c) });

/** One exclusively opened Pi SQLite per Execution. No implicit local Bash or network tools are installed. */
export class PiRuntime implements Runtime {
    private readonly sessions = new Map<string, { h: Harness; e: Execution; release: () => Promise<void>; enqueue: (tx: Tx, input: SliceInput) => Promise<TaskId> }>();
    constructor(private readonly directory: string, private readonly models: Models, private readonly model: { provider: string; modelId: string }, private readonly host: WorkerHost) {}
    private path(id: string) { return resolve(this.directory, createHash('sha256').update(id).digest('hex')); }
    private session(id: string) { const s = this.sessions.get(id); requireRule(s, 'blocked', 'runtime must be ensured'); return s; }
    /** Opens without scheduling. An exclusive lock prevents competing hosts from owning this storage. */
    async ensure(e: Execution) {
        const existing = this.sessions.get(e.sessionId);
        if (existing) { requireRule(existing.e.id === e.id && existing.e.ownerId === e.ownerId, 'conflict', 'Session binding mismatch'); return; }
        const dir = this.path(e.sessionId);
        await mkdir(dir, { recursive: true, mode: 0o700 });
        // A separate SQLite exclusive transaction is an OS-backed lifetime lock.
        // Process death releases it automatically; never unlink another process's lock file.
        const { DatabaseSync } = await import('node:sqlite');
        const { openNodeSqliteStorage } = await import('@earendil-works/pi-durable/storage/sqlite/node');
        const lock = new DatabaseSync(resolve(dir, 'ownership.sqlite'));
        try { lock.exec('PRAGMA busy_timeout=0; BEGIN EXCLUSIVE'); }
        catch (error) { lock.close(); throw error; }
        const release = async () => { lock.exec('ROLLBACK'); lock.close(); };
        try {
            const assembly = await this.host.assembly(e);
            const digest = createHash('sha256').update(canonical({ ...assembly, model: this.model, runtime: 'pi-durable@1.4.0' })).digest('hex');
            const registry = createRegistry();
            const extraTools = await this.host.tools?.(e) ?? [];
            requireRule(!extraTools.some(t => t.name.startsWith('work_request_decision') || t.name === 'work_yield'), 'invalid');
            let h!: Harness;
            const current = () => this.session(e.sessionId).e;
            const guard = async () => {
                const state = await h.snapshot(State, context);
                requireRule(state && !state.stopped && state.generation === current().generation, 'blocked', 'stale runtime');
                await this.host.check(current());
            };
            const Slice = defineTask<SliceInput, { phase: 'acquire' | 'run' | 'finalize' }, null>({
                name: 'aw.run-slice', version: 1, initial: () => ({ phase: 'acquire' }),
                phases: {
                    acquire: async (t, api, c) => {
                        await guard();
                        await api.commit(async tx => {
                            const s = await tx.doc(State);
                            requireRule(s.generation === t.input.generation, 'blocked');
                            if (s.active && s.active !== t.id) {
                                const other = await tx.task(s.active);
                                if (other?.state.status !== 'terminal') return { status: 'waiting', checkpoint: { phase: 'acquire' }, on: [s.active], policy: 'allSettled' } as const;
                            }
                            s.active = t.id;
                            return { status: 'running', checkpoint: { phase: 'run' } } as const;
                        }, c);
                    },
                    run: async (t, api, c) => {
                        await guard();
                        const target = (await api.conversation(t.input.target, c))!;
                        const submission = await target.submit({ type: 'input', content: t.input.content, requestId: `aw-slice:${t.id}`, whenBusy: 'reject', entry: { kind: t.input.kind, data: { scope: t.input.scope } } }, c);
                        const settled = await submission.wait(c);
                        requireRule(settled.status === 'done', 'blocked', 'model run unanswered');
                        await api.commit(() => ({ status: 'running', checkpoint: { phase: 'finalize' } }), c);
                    },
                    finalize: async (t, api, c) => {
                        await guard();
                        await api.commit(async tx => {
                            const s = await tx.doc(State);
                            const tail = await tx.scanEntries({ conversationId: t.input.target, order: 'descending' }, 1);
                            const intent = s.intents[String(t.input.target)];
                            const at = (await tx.appendEntry(t.input.target, { kind: 'aw.anchor', data: { slice: t.id } })).id;
                            for (const id of intent?.requests ?? []) s.links[id].at = at;
                            delete s.intents[String(t.input.target)];
                            s.active = null;
                            if (tail.items[0]?.kind === 'pi.tool-result' && !intent?.wait) {
                                await tx.createTask(Slice, { ...t.input, content: 'Continue the current scope. Do not repeat completed operations.', kind: 'aw.continue' }, { conversationId: 1 as ConversationId, ownership: { kind: 'conversation' }, background: true });
                            }
                            return { status: 'terminal', outcome: { status: 'completed', result: null } } as const;
                        }, c);
                    },
                },
                abort: (t, api, c) => api.commit(async tx => { const s = await tx.doc(State); if (s.active === t.id) s.active = null; return { status: 'terminal', outcome: { status: 'aborted' } } as const; }, c),
            });
            registry.install(defineExtension({ name: 'airic-work', tasks: [Anchor, Slice], sections: [section('worker', () => assembly.worker), section('om', () => assembly.root), section('execution', () => JSON.stringify({ executionId: current().id, generation: current().generation, task: current().creation.task, instruction: current().creation.instruction, method: current().method }))], tools: [
                defineTool({ name: 'work_request_decision', description: 'Ask the owner. Supply a concise summary (ideally 12-30 characters, at most 80) for list titles. Keep question to one direct question (one or two sentences). Put only decision-relevant context in 2-4 short points; retain source/version references separately. Do not copy the question, standards or OM into the context or ask approval for routine follow-up work. Defer only the described scope; continue unaffected work.', parameters: Type.Object({ summary: Type.Optional(Type.String({ minLength: 1, maxLength: 80 })), question: Type.String(), scope: Type.String(), wait: Type.Optional(Type.Boolean()), continuationId: Type.Optional(Type.String()), options: Type.Optional(Type.Array(Type.Object({ id: Type.String(), label: Type.String(), description: Type.String() }))), decisionContext: Type.Optional(Type.Object({ revision: Type.Literal(1), content: Type.Unknown(), sources: Type.Array(Type.Object({ system: Type.String(), objectId: Type.String(), version: Type.Optional(Type.String()), location: Type.Optional(Type.String()) })) })) }), replay: 'safe',
                    execute: async (args, api) => {
                        await guard();
                        // Reject invalid routing before the application persists a question. A failed tool must not leave an unrouteable DecisionRequest.
                        if (args.continuationId) {
                            const state = await h.snapshot(State, context);
                            requireRule(state?.links[args.continuationId], 'invalid', 'unknown continuation');
                        }
                        const id = await this.host.request(current(), `pi:${e.sessionId}:${api.taskId}`, args.question, args.options, args.decisionContext as Context | undefined, args.summary);
                        await api.commit(async tx => {
                            const s = await tx.doc(State);
                            if (args.continuationId) requireRule(s.links[args.continuationId], 'invalid', 'unknown continuation');
                            s.links[id] ??= { source: api.conversationId, scope: args.scope, ...(args.continuationId ? { parent: s.links[args.continuationId].parent ?? args.continuationId } : {}) };
                            s.intents[String(api.conversationId)] ??= { wait: false, requests: [] };
                            const intent = s.intents[String(api.conversationId)];
                            if (!intent.requests.includes(id)) intent.requests.push(id);
                            intent.wait ||= args.wait ?? false;
                        }, context);
                        return { output: [{ type: 'text', text: JSON.stringify({ decisionRequestId: id, continuationId: args.continuationId ?? id }) }], control: { terminate: true } };
                    } }),
                defineTool({ name: 'work_yield', description: 'Yield this scope. Waiting does not block other scopes.', parameters: Type.Object({ summary: Type.String() }), replay: 'safe', execute: async (args, api) => {
                    await guard();
                    await api.commit(async tx => { const s = await tx.doc(State); s.intents[String(api.conversationId)] ??= { wait: false, requests: [] };
                            const intent = s.intents[String(api.conversationId)]; intent.wait = true; }, context);
                    return { output: [{ type: 'text', text: args.summary }], control: { terminate: true } };
                } }),
            ...extraTools.map(tool => ({ ...tool, execute: async (...args: Parameters<typeof tool.execute>) => { await guard(); const result = await tool.execute(...args); return { ...result, control: { ...result.control, terminate: true } }; } })),
            ] }));
            h = await Harness.open(await openNodeSqliteStorage(resolve(dir, 'pi.sqlite')), { models: this.models, registry, settings: { toolExecution: 'sequential' } }, context);
            try {
                await h.root(context, { agent: { model: this.model } });
                await h.commit(async tx => { const s = await tx.doc(State); requireRule(!s.execution || s.execution === e.id && s.assembly === digest, 'conflict', 'assembly changed'); if (!s.execution) await tx.appendEntry(1 as ConversationId, { kind: 'aw.assembly', data: { assemblyDigest: digest, model: this.model, omSha: e.method?.sha ?? null, runtimeVersion: 'pi-durable@1.4.0', workerDigest: createHash('sha256').update(assembly.worker).digest('hex') } }); s.execution = e.id; s.assembly = digest; }, context);
                this.sessions.set(e.sessionId, { h, e, release, enqueue: (tx, input) => tx.createTask(Slice, input, { conversationId: 1 as ConversationId, ownership: { kind: 'conversation' }, background: true }) });
            } catch (error) { await h.close(context); throw error; }
        } catch (error) { await release(); throw error; }
    }
    async independentAnswers(e: Execution, earlier: Input, later: Input) {
        await this.ensure(e);
        const a = await this.host.input(e, earlier);
        const b = await this.host.input(e, later);
        const state = await this.session(e.sessionId).h.snapshot(State, context);
        if (!a.requestId || !b.requestId || !state?.links[a.requestId] || !state.links[b.requestId]) return false;
        return (state.links[a.requestId].parent ?? a.requestId) !== (state.links[b.requestId].parent ?? b.requestId);
    }
    /** 同代次幂等恢复；新代次才可越过成功收尾栅栏，旧工具仍受应用当前代次复查。 */
    async start(e: Execution) {
        await this.ensure(e);
        const session = this.session(e.sessionId);
        session.e = e;
        await this.host.check(e);
        await session.h.commit(async tx => { const s = await tx.doc(State); requireRule(e.generation >= s.generation && (!s.quiescing || e.generation > s.generation), 'blocked'); s.quiescing = false; s.generation = e.generation; s.stopped = false; }, context);
        session.h.resume();
    }
    /** 查 Session 级接收记录；读取错误直接传播，不能解释成未接收。 */
    async accepted(sessionId: string, inputId: string) {
        const s = await this.session(sessionId).h.snapshot(State, context);
        return s?.receipts[inputId] ? String(s.receipts[inputId].task) : undefined;
    }
    /** 原 inputId、目标分支与原生任务同事务固定；分支创建和首次 submit 的窗口由稳定任务键恢复。 */
    async deliver(e: Execution, input: Input) {
        const { h } = this.session(e.sessionId);
        await this.host.check(e);
        const envelope = await this.host.input(e, input);
        const digest = canonical(input);
        // A fork restores historical context, not the world. Supply bounded current progress with exact entry references.
        const updates = envelope.requestId ? (await this.records(e.sessionId)).slice(-30).map(entry => ({
            entryId: entry.id, conversationId: entry.conversationId,
            text: (entry.model ?? []).filter(m => m.role !== 'system').map(m => typeof m.content === 'string' ? m.content : m.content.filter(part => part.type === 'text').map(part => part.text).join('')).join('\n').slice(0, 2000),
        })) : [];
        const content = JSON.stringify({ input: envelope.content, recentProgress: updates, limitations: updates.length ? ['Bounded recent progress only; recheck current business state before effects.'] : [] });
        const root = await h.root(context);
        const task = await root.commit(async tx => {
            const s = await tx.doc(State);
            requireRule(!s.stopped && !s.quiescing && s.generation === e.generation, 'blocked');
            const old = s.receipts[input.id];
            if (old) { requireRule(old.digest === digest, 'conflict'); return old.task; }
            let target = root.id;
            let scope = e.creation.instruction;
            if (envelope.requestId) {
                const origin = s.links[envelope.requestId];
                const link = origin?.parent ? s.links[origin.parent] : origin;
                requireRule(link?.at, 'blocked', 'question anchor not ready');
                scope = link.scope;
                if (!link.target) {
                    const anchor = await tx.createTask(Anchor, null, { ownership: { kind: 'conversation' }, background: true });
                    const branch = await tx.forkConversation(link.source, link.at, { ownership: { kind: 'task', taskId: anchor } });
                    await configure(tx, branch.id, { instructions: `Continue ONLY this scope: ${scope}. Recheck current business facts; history does not roll back external effects.` });
                    link.target = branch.id;
                }
                target = link.target;
            }
            const id = await this.session(e.sessionId).enqueue(tx, { target, scope, content, kind: `aw.${input.kind}`, generation: e.generation });
            s.receipts[input.id] = { task: id, digest };
            return id;
        }, context);
        h.resume();
        return String(task);
    }
    /** Freeze admission before the application's end CAS; does not cancel business work. */
    async quiesce(e: Execution) {
        const { h } = this.session(e.sessionId);
        requireRule(!(await h.inspect(context)).tasks.length, 'blocked', 'work remains');
        await h.commit(async tx => { const s = await tx.doc(State); requireRule(!s.active && s.generation === e.generation, 'conflict'); s.quiescing = true; s.stopped = true; }, context);
    }
    async cancelQuiesce(e: Execution) {
        await this.host.check(e);
        await this.session(e.sessionId).h.commit(async tx => { const s = await tx.doc(State); requireRule(s.generation <= e.generation, 'blocked'); s.quiescing = false; }, context);
    }
    /** 先关闭准入再穿过后台 ownership 边界取消；外部副作用不回滚。 */
    async stop(e: Execution) {
        await this.ensure(e);
        const { h } = this.session(e.sessionId);
        await h.commit(async tx => { (await tx.doc(State)).stopped = true; }, context);
        await (await h.root(context)).abort(context, { background: true });
    }
    async stopped(e: Execution) { const s = this.sessions.get(e.sessionId); if (!s) return true; const state = await s.h.snapshot(State, context); return !!state?.stopped && (await s.h.inspect(context)).tasks.every(t => t.record.state.status === 'terminal'); }
    /** Await all background slices for diagnostics/tests, not a wait for user decisions. */
    async drain(sessionId: string) { const { h } = this.session(sessionId); for (;;) { const tasks = (await h.inspect(context)).tasks; if (!tasks.length) return; const blocked = tasks.find(t => t.state.kind === 'blocked'); requireRule(!blocked, 'blocked', 'runtime task blocked'); const settled = await Promise.all(tasks.map(t => h.waitForTask(t.record.id, context))); requireRule(settled.every(t => t.state.outcome.status === 'completed'), 'blocked', 'worker slice failed'); } }
    async close() { for (const [id, s] of this.sessions) { await s.h.close(context); await s.release(); this.sessions.delete(id); } }
    /** Read all Session entries, not the root's fork-expanded history. */
    async append(sessionId: string, kind: string, data: Json, uniqueId?: string) {
        const h = this.session(sessionId).h;
        return (await h.root(context)).commit(async tx => {
            if (uniqueId) {
                let cursor: Cursor | undefined;
                do {
                    const page = await tx.scanEntries({ conversationId: 1 as ConversationId, order: 'ascending' }, 100, cursor);
                    requireRule(!page.items.some(e => e.kind === kind && (e.data as { id?: string })?.id === uniqueId), 'conflict');
                    cursor = page.next;
                } while (cursor);
            }
            return tx.appendEntry(1 as ConversationId, { kind, data });
        }, context);
    }
    async records(sessionId: string) {
        const { h } = this.session(sessionId);
        return h.commit(async tx => {
            const records = new Map<number, import('@earendil-works/pi-durable').EntryRecord>();
            let cursor: Cursor | undefined;
            do {
                const conversations = await tx.scanConversations({}, 100, cursor);
                for (const conversation of conversations.items) {
                    let next: Cursor | undefined;
                    do {
                        const page = await tx.scanEntries({ conversationId: conversation.id, order: 'ascending' }, 100, next);
                        for (const entry of page.items) records.set(entry.id, entry);
                        next = page.next;
                    } while (next);
                }
                cursor = conversations.next;
            } while (cursor);
            return [...records.values()].sort((a, b) => a.id - b.id);
        }, context);
    }
}
// Keep production skill loading explicit; consumers may pass an immutable release copy instead.
export async function readWorkerSkill(path: string) { return readFile(path, 'utf8'); }
export type WorkerPayload = Json;
