import { and, asc, eq, sql } from 'drizzle-orm';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import { active, answer, beginRun, beginStop, canonical, creationValid, endRun, nonempty, own, recordStopped, requireRule, RuleError, runtimePath } from '../../../domain/model';
import type { DecisionRequest, Execution, Input, Preferences, Project, Settings, SteeringInput, Upload, User, UserDecision } from '../../../domain/model';
import type { ControlStore, Key } from '../../../application/ports';
import * as t from './schema';
import { databaseAccess, databaseCommit } from './operations';

/** 移除 SQL NULL；内层仍使用可选属性，不泄漏数据库行类型。 */
function snapshot<T>(row: unknown): T {
    requireRule(row, 'not-found');
    return Object.fromEntries(Object.entries(row).filter(([, value]) => value !== null)) as T;
}
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** 命名提交各自拥有同步 IMMEDIATE 事务；不接受外部事务回调。连接生命周期归组合根。 */
export class SqliteControlStore implements ControlStore {
    private readonly db: BetterSQLite3Database;
    constructor(private readonly connection: Database.Database) {
        this.db = drizzle(connection);
    }

    private access<T>(work: () => T): T {
        return databaseAccess(work);
    }
    private commit<T>(work: () => T): T {
        return databaseCommit(this.connection, work);
    }
    private userNow(id: string): User { return snapshot(this.db.select().from(t.users).where(eq(t.users.id, id)).get()); }
    private executionNow(id: string): Execution { return snapshot(this.db.select().from(t.executions).where(eq(t.executions.id, id)).get()); }
    private requestNow(id: string): DecisionRequest { return snapshot(this.db.select().from(t.requests).where(eq(t.requests.id, id)).get()); }
    private inputNow(id: string): Input { return snapshot(this.db.select().from(t.inputs).where(eq(t.inputs.id, id)).get()); }
    private uploadNow(id: string): Upload { return snapshot(this.db.select().from(t.uploads).where(eq(t.uploads.id, id)).get()); }
    private settingsNow(): Settings {
        const { id: _id, ...value } = snapshot<Settings & { id: number }>(this.db.select().from(t.settings).where(eq(t.settings.id, 1)).get());
        return value;
    }
    private enabled(id: string): User { const u = this.userNow(id); requireRule(u.enabled, 'forbidden'); return u; }
    private owned(userId: string, id: string): Execution { const e = this.executionNow(id); own(this.enabled(userId), e); return e; }
    private admin(id: string): void { requireRule(this.enabled(id).admin, 'forbidden'); }
    private files(userId: string, executionId: string, ids: string[]): void {
        for (const id of ids) {
            const f = this.uploadNow(id);
            requireRule(f.userId === userId && f.executionId === executionId, 'forbidden');
        }
    }
    private replayNow<T>(operation: string, k: Key): T | undefined {
        this.enabled(k.userId);
        const row = this.db.select().from(t.commands).where(and(eq(t.commands.userId, k.userId), eq(t.commands.operation, operation), eq(t.commands.key, k.key))).get();
        if (!row) return;
        this.owned(k.userId, row.executionId);
        requireRule(row.fingerprint === k.fingerprint, 'conflict');
        return row.result as T;
    }
    private remember<T>(operation: string, k: Key, executionId: string, result: T): T {
        nonempty(k.key); nonempty(k.fingerprint);
        this.db.insert(t.commands).values({ ...k, operation, executionId, result }).run();
        return structuredClone(result);
    }
    private saveInput(e: Execution, input: Omit<Input, 'sequence'>, kind: Input['kind'], sourceId: string, files: string[]): void {
        requireRule(input.executionId === e.id && input.userId === e.ownerId && input.sessionId === e.sessionId, 'forbidden');
        requireRule(input.kind === kind && input.sourceId === sourceId && input.status === 'pending' && input.receipt === undefined && same(input.files, files), 'conflict');
        this.files(e.ownerId, e.id, files);
        const { maximum } = this.db.select({ maximum: sql<number>`coalesce(max(${t.inputs.sequence}), 0)` }).from(t.inputs).where(eq(t.inputs.executionId, e.id)).get()!;
        this.db.insert(t.inputs).values({ ...input, sequence: maximum + 1 }).run();
        for (const uploadId of new Set(files))
            this.db.insert(t.inputFiles).values({ inputId: input.id, uploadId, userId: e.ownerId, executionId: e.id }).run();
    }
    private fixed(old: Execution, next: Execution): void {
        requireRule(same(
            [old.id, old.ownerId, old.projectId, old.sessionId, old.workspaceId, old.creation],
            [next.id, next.ownerId, next.projectId, next.sessionId, next.workspaceId, next.creation],
        ), 'conflict');
        requireRule(next.version === old.version + 1, 'conflict');
    }
    private updateExecution(e: Execution): void {
        this.db.update(t.executions).set({ phase: e.phase, generation: e.generation, version: e.version }).where(eq(t.executions.id, e.id)).run();
    }
    private updateRequest(r: DecisionRequest): void {
        this.db.update(t.requests).set({ contexts: r.contexts, status: r.status, answeredAt: r.answeredAt ?? null, version: r.version }).where(eq(t.requests.id, r.id)).run();
    }

    async user(id: string) { return this.access(() => this.userNow(id)); }
    async users(): Promise<User[]> { return this.access(() => this.db.select().from(t.users).orderBy(asc(t.users.id)).all().map(row => snapshot<User>(row))); }
    async execution(id: string) { return this.access(() => this.executionNow(id)); }
    async executions(): Promise<Execution[]> { return this.access(() => this.db.select().from(t.executions).orderBy(asc(t.executions.id)).all().map(row => snapshot<Execution>(row))); }
    async projects(): Promise<Project[]> { return this.access(() => this.db.select().from(t.projects).orderBy(asc(t.projects.id)).all()); }
    async request(id: string) { return this.access(() => this.requestNow(id)); }
    async requests(executionId: string): Promise<DecisionRequest[]> { return this.access(() => this.db.select().from(t.requests).where(eq(t.requests.executionId, executionId)).orderBy(sql`rowid`).all().map(row => snapshot<DecisionRequest>(row))); }
    async decisions(requestId: string): Promise<UserDecision[]> { return this.access(() => this.db.select().from(t.decisions).where(eq(t.decisions.requestId, requestId)).orderBy(sql`rowid`).all().map(row => snapshot<UserDecision>(row))); }
    async input(id: string) { return this.access(() => this.inputNow(id)); }
    async inputs(executionId: string): Promise<Input[]> { return this.access(() => this.db.select().from(t.inputs).where(eq(t.inputs.executionId, executionId)).orderBy(asc(t.inputs.sequence)).all().map(row => snapshot<Input>(row))); }
    async upload(id: string) { return this.access(() => this.uploadNow(id)); }
    async settings() { return this.access(() => this.settingsNow()); }
    async replay<T>(operation: string, k: Key): Promise<T | undefined> { return this.commit(() => this.replayNow<T>(operation, k)); }

    async ensureUser(candidate: User): Promise<User> {
        return this.commit(() => {
            nonempty(candidate.issuer); nonempty(candidate.subject);
            const old = this.db.select().from(t.users).where(and(eq(t.users.issuer, candidate.issuer), eq(t.users.subject, candidate.subject))).get();
            if (old) return snapshot<User>(old);
            requireRule(candidate.version === 0, 'conflict');
            this.db.insert(t.users).values(candidate).run();
            return this.userNow(candidate.id);
        });
    }
    async createExecution(k: Key, project: Project, execution: Execution): Promise<Execution> {
        return this.commit(() => {
            const replay = this.replayNow<Execution>('create', k);
            if (replay) return replay;
            requireRule(execution.ownerId === k.userId, 'forbidden');
            creationValid(execution.creation);
            requireRule(execution.phase === 'new' && execution.version === 0 && execution.generation === 0 && !execution.method, 'conflict');
            requireRule(project.id === execution.projectId && project.source === execution.creation.source && project.externalId === execution.creation.project_id && project.name === execution.creation.project_name, 'conflict');
            const old = this.db.select().from(t.projects).where(and(eq(t.projects.source, project.source), eq(t.projects.externalId, project.externalId))).get();
            if (!old) this.db.insert(t.projects).values(project).run();
            const saved = { ...execution, projectId: old?.id ?? project.id };
            this.db.insert(t.executions).values(saved).run();
            return this.remember('create', k, saved.id, saved);
        });
    }
    async prepare(userId: string, expected: number, settingsVersion: number, e: Execution, start: Omit<Input, 'sequence'>): Promise<Execution> {
        return this.commit(() => {
            const old = this.owned(userId, e.id);
            const config = this.settingsNow();
            requireRule(old.version === expected && config.version === settingsVersion && !old.method, 'conflict');
            this.fixed(old, e);
            requireRule(e.method && e.method.source === config.omSource && e.method.root === config.root && !!e.method.sha, 'conflict');
            runtimePath(e.method.root);
            requireRule(old.phase === e.phase && old.generation === e.generation, 'conflict');
            requireRule(start.text === e.creation.instruction && !start.files.length, 'conflict');
            this.db.update(t.executions).set({ method: e.method, version: e.version }).where(eq(t.executions.id, e.id)).run();
            this.saveInput(e, start, 'start', e.id, []);
            return this.executionNow(e.id);
        });
    }
    async createRequest(k: Key, generation: number, r: DecisionRequest): Promise<DecisionRequest> {
        return this.commit(() => {
            const replay = this.replayNow<DecisionRequest>('request', k);
            if (replay) return replay;
            active(this.owned(k.userId, r.executionId), generation);
            nonempty(r.question);
            requireRule(r.status === 'pending' && r.version === 0 && !r.answeredAt && r.contexts.length === 1 && r.contexts[0].revision === 1 && new Set(r.options.map(o => o.id)).size === r.options.length, 'invalid');
            this.db.insert(t.requests).values(r).run();
            return this.remember('request', k, r.executionId, this.requestNow(r.id));
        });
    }
    async refreshContext(userId: string, generation: number, expected: number, r: DecisionRequest): Promise<DecisionRequest> {
        return this.commit(() => {
            const old = this.requestNow(r.id);
            active(this.owned(userId, old.executionId), generation);
            requireRule(old.version === expected, 'conflict');
            const addition = r.contexts.at(-1)!;
            requireRule(r.contexts.length === old.contexts.length + 1 && addition.revision === old.contexts.at(-1)!.revision + 1 && same(r, { ...old, contexts: [...old.contexts, addition], version: old.version + 1 }), 'conflict');
            this.updateRequest(r);
            return this.requestNow(r.id);
        });
    }
    async submitDecision(k: Key, expected: number, r: DecisionRequest, d: UserDecision, input: Omit<Input, 'sequence'>): Promise<UserDecision> {
        return this.commit(() => {
            const replay = this.replayNow<UserDecision>('decision', k);
            if (replay) return replay;
            const old = this.requestNow(r.id);
            const e = this.owned(k.userId, old.executionId);
            requireRule(d.userId === k.userId, 'forbidden');
            requireRule(old.version === expected && d.requestId === old.id, 'conflict');
            this.files(k.userId, e.id, d.files);
            if (d.correctionOf) {
                const original = this.db.select().from(t.decisions).where(eq(t.decisions.id, d.correctionOf)).get();
                requireRule(original?.requestId === r.id, 'invalid');
            }
            requireRule(same(r, answer(old, d)), 'conflict');
            requireRule(input.text === (d.text || d.optionId || ''), 'conflict');
            this.db.insert(t.decisions).values(d).run();
            this.updateRequest(r);
            this.saveInput(e, input, 'user-decision', d.id, d.files);
            return this.remember('decision', k, e.id, snapshot<UserDecision>(this.db.select().from(t.decisions).where(eq(t.decisions.id, d.id)).get()));
        });
    }
    async submitSteering(k: Key, s: SteeringInput, input: Omit<Input, 'sequence'>): Promise<SteeringInput> {
        return this.commit(() => {
            const replay = this.replayNow<SteeringInput>('steering', k);
            if (replay) return replay;
            const e = this.owned(k.userId, s.executionId);
            requireRule(s.userId === k.userId, 'forbidden');
            requireRule(s.text.trim() || s.files.length, 'invalid');
            requireRule(input.text === s.text, 'conflict');
            this.files(k.userId, e.id, s.files);
            this.db.insert(t.steering).values(s).run();
            this.saveInput(e, input, 'steering', s.id, s.files);
            return this.remember('steering', k, e.id, s);
        });
    }
    async markDelivered(userId: string, inputId: string, receipt: string): Promise<void> {
        this.commit(() => {
            const input = this.inputNow(inputId);
            this.owned(userId, input.executionId);
            nonempty(receipt);
            if (input.status === 'delivered') {
                requireRule(input.receipt === receipt, 'conflict');
                return;
            }
            this.db.update(t.inputs).set({ status: 'delivered', receipt }).where(eq(t.inputs.id, inputId)).run();
        });
    }
    async transition(userId: string, expected: number, e: Execution, requireNoPending = false): Promise<Execution> {
        return this.commit(() => {
            const old = this.owned(userId, e.id);
            requireRule(old.version === expected, 'conflict');
            this.fixed(old, e);
            requireRule(same(old.method ?? null, e.method ?? null), 'conflict');
            requireRule(e.generation === old.generation || (e.phase === 'running' && e.generation === old.generation + 1), 'conflict');
            let next: Execution;
            switch (e.phase) {
                case 'running': next = beginRun(old); break;
                case 'ended': next = endRun(old, e.generation); break;
                case 'stopping': next = beginStop(old); break;
                case 'stopped': next = recordStopped(old); break;
                case 'failed': next = { ...old, phase: 'failed', version: old.version + 1 }; break;
                default: throw new RuleError('blocked');
            }
            requireRule(same(next, e), 'conflict');
            if (requireNoPending) requireRule(!this.db.select({ id: t.inputs.id }).from(t.inputs).where(and(eq(t.inputs.executionId, e.id), eq(t.inputs.status, 'pending'))).get(), 'blocked');
            this.updateExecution(e);
            return this.executionNow(e.id);
        });
    }
    async saveUpload(userId: string, f: Upload): Promise<Upload> {
        return this.commit(() => {
            this.owned(userId, f.executionId);
            requireRule(f.userId === userId, 'forbidden');
            const old = this.db.select().from(t.uploads).where(eq(t.uploads.id, f.id)).get();
            if (old) { requireRule(same(old, f), 'conflict'); return old; }
            this.db.insert(t.uploads).values(f).run();
            return this.uploadNow(f.id);
        });
    }
    async updatePreferences(userId: string, expected: number, preferences: Preferences): Promise<User> {
        return this.commit(() => {
            const u = this.enabled(userId);
            requireRule(u.version === expected, 'conflict');
            this.db.update(t.users).set({ preferences, version: expected + 1 }).where(eq(t.users.id, userId)).run();
            return this.userNow(userId);
        });
    }
    async updateProfile(userId: string, expected: number, name: string): Promise<User> {
        return this.commit(() => {
            const u = this.enabled(userId);
            requireRule(u.version === expected, 'conflict'); nonempty(name);
            this.db.update(t.users).set({ name, version: expected + 1 }).where(eq(t.users.id, userId)).run();
            return this.userNow(userId);
        });
    }
    async manageUser(actorId: string, expected: number, u: User): Promise<User> {
        return this.commit(() => {
            this.admin(actorId);
            const old = this.userNow(u.id);
            requireRule(old.version === expected && u.version === expected + 1, 'conflict');
            requireRule(same([old.issuer, old.subject, old.preferences ?? null], [u.issuer, u.subject, u.preferences ?? null]), 'conflict');
            requireRule(!(actorId === u.id && !u.enabled), 'invalid');
            if (old.enabled && old.admin && !(u.enabled && u.admin)) {
                const remaining = this.db.select({ id: t.users.id }).from(t.users).where(and(eq(t.users.enabled, true), eq(t.users.admin, true), sql`${t.users.id} != ${u.id}`)).get();
                requireRule(remaining, 'blocked', 'last administrator');
            }
            if (!u.enabled) {
                const responsibility = this.db.select({ id: t.executions.id }).from(t.executions).where(and(eq(t.executions.ownerId, u.id), sql`${t.executions.phase} in ('new','running','stopping')`)).get();
                const pending = this.db.select({ id: t.requests.id }).from(t.requests).innerJoin(t.executions, eq(t.executions.id, t.requests.executionId)).where(and(eq(t.executions.ownerId, u.id), eq(t.requests.status, 'pending'))).get();
                requireRule(!responsibility && !pending, 'blocked');
            }
            this.db.update(t.users).set({ name: u.name, enabled: u.enabled, admin: u.admin, version: u.version }).where(eq(t.users.id, u.id)).run();
            return this.userNow(u.id);
        });
    }
    async saveSettings(actorId: string, expected: number, config: Settings): Promise<Settings> {
        return this.commit(() => {
            this.admin(actorId);
            requireRule(this.settingsNow().version === expected && config.version === expected + 1, 'conflict');
            runtimePath(config.root);
            this.db.update(t.settings).set(config).where(eq(t.settings.id, 1)).run();
            return this.settingsNow();
        });
    }
}
