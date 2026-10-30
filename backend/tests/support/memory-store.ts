import { active, answer, beginRun, beginStop, endRun, recordStopped, canonical, own, requireRule, type User, type Project, type Execution, type DecisionRequest, type UserDecision, type SteeringInput, type Input, type Upload, type Settings } from '../../src/domain/model';
import type { ControlStore, Key } from '../../src/application/ports';
const clone = <T>(v: T): T => structuredClone(v);
export class MemoryStore implements ControlStore {
    u = new Map<string, User>();
    p = new Map<string, Project>();
    e = new Map<string, Execution>();
    r = new Map<string, DecisionRequest>();
    d = new Map<string, UserDecision>();
    i = new Map<string, Input>();
    f = new Map<string, Upload>();
    s = new Map<string, SteeringInput>();
    commands = new Map<string, {
        fingerprint: string;
        result: unknown;
    }>();
    config: Settings = { version: 0, omSource: 'repo', branch: 'main', root: 'om.md', connections: ['business'] };
    fail = false;
    private get<T>(map: Map<string, T>, id: string): T { const value = map.get(id); requireRule(value, 'not-found'); return clone(value); }
    async user(id: string) { return this.get(this.u, id); }
    async users() { return clone([...this.u.values()]); }
    async execution(id: string) { return this.get(this.e, id); }
    async executions() { return clone([...this.e.values()]); }
    async projects() { return clone([...this.p.values()]); }
    async request(id: string) { return this.get(this.r, id); }
    async requests(id: string) { return clone([...this.r.values()].filter(r => r.executionId === id)); }
    async decisions(id: string) { return clone([...this.d.values()].filter(d => d.requestId === id)); }
    async input(id: string) { return this.get(this.i, id); }
    async inputs(id: string) { return clone([...this.i.values()].filter(i => i.executionId === id).sort((a, b) => a.sequence - b.sequence)); }
    async upload(id: string) { return this.get(this.f, id); }
    async settings() { return clone(this.config); }
    private enabled(id: string) { const u = this.get(this.u, id); requireRule(u.enabled, 'forbidden'); return u; }
    private owns(id: string, eid: string) { const e = this.get(this.e, eid); own(this.enabled(id), e); return e; }
    private check() {
        if (this.fail) {
            this.fail = false;
            throw new Error('injected commit failure');
        }
    }
    private replayNow<T>(op: string, k: Key): T | undefined {
        this.enabled(k.userId);
        const c = this.commands.get(`${k.userId}:${op}:${k.key}`);
        if (!c)
            return;
        requireRule(c.fingerprint === k.fingerprint, 'conflict');
        return clone(c.result as T);
    }
    async replay<T>(op: string, k: Key): Promise<T | undefined> { return this.replayNow<T>(op, k); }
    private remember<T>(op: string, k: Key, value: T) { this.commands.set(`${k.userId}:${op}:${k.key}`, { fingerprint: k.fingerprint, result: clone(value) }); return clone(value); }
    private files(uid: string, eid: string, ids: string[]) {
        for (const id of ids) {
            const f = this.get(this.f, id);
            requireRule(f.userId === uid && f.executionId === eid, 'forbidden');
        }
    }
    private inputCheck(e: Execution, i: Omit<Input, 'sequence'>, kind: Input['kind'], sourceId: string, files: string[]) {
        requireRule(i.userId === e.ownerId && i.executionId === e.id && i.sessionId === e.sessionId, 'forbidden');
        requireRule(i.kind === kind && i.sourceId === sourceId && i.status === 'pending' && !i.receipt && canonical(i.files) === canonical(files), 'conflict');
        requireRule(!this.i.has(i.id) && ![...this.i.values()].some(x => x.kind === kind && x.sourceId === sourceId), 'conflict');
        this.files(e.ownerId, e.id, files);
    }
    private fixed(old: Execution, e: Execution) {
        requireRule(canonical([old.ownerId, old.projectId, old.sessionId, old.workspaceId, old.creation]) === canonical([e.ownerId, e.projectId, e.sessionId, e.workspaceId, e.creation]) && e.version === old.version + 1, 'conflict');
    }
    private inputSave(i: Omit<Input, 'sequence'>) { this.i.set(i.id, clone({ ...i, sequence: Math.max(0, ...[...this.i.values()].filter(x => x.executionId === i.executionId).map(x => x.sequence)) + 1 })); }
    async ensureUser(u: User) {
        const old = [...this.u.values()].find(x => x.issuer === u.issuer && x.subject === u.subject);
        if (old)
            return clone(old);
        if (!u.enabled) {
            requireRule(![...this.e.values()].some(e => e.ownerId === u.id && ['new', 'running', 'stopping'].includes(e.phase)), 'blocked');
            requireRule(![...this.r.values()].some(r => r.status === 'pending' && this.e.get(r.executionId)?.ownerId === u.id), 'blocked');
        }
        this.check();
        this.u.set(u.id, clone(u));
        return clone(u);
    }
    async createExecution(k: Key, p: Project, e: Execution) {
        const old = this.replayNow<Execution>('create', k);
        if (old)
            return old;
        requireRule(e.ownerId === k.userId, 'forbidden');
        requireRule(!this.e.has(e.id), 'conflict');
        this.check();
        const project = [...this.p.values()].find(x => x.source === p.source && x.externalId === p.externalId) ?? p;
        this.p.set(project.id, clone(project));
        e = { ...e, projectId: project.id };
        this.e.set(e.id, clone(e));
        return this.remember('create', k, e);
    }
    async prepare(uid: string, expected: number, sv: number, e: Execution, start: Omit<Input, 'sequence'>) {
        const old = this.owns(uid, e.id);
        requireRule(old.version === expected && this.config.version === sv && !old.method, 'conflict');
        this.fixed(old, e);
        requireRule(e.method && e.method.source === this.config.omSource && e.method.root === this.config.root && old.phase === e.phase && old.generation === e.generation, 'conflict');
        this.inputCheck(e, start, 'start', e.id, []);
        this.check(); this.e.set(e.id, clone(e)); this.inputSave(start); return clone(e);
    }
    async createRequest(k: Key, g: number, r: DecisionRequest) {
        const old = this.replayNow<DecisionRequest>('request', k);
        if (old)
            return old;
        active(this.owns(k.userId, r.executionId), g);
        requireRule(!this.r.has(r.id), 'conflict');
        this.check();
        this.r.set(r.id, clone(r));
        return this.remember('request', k, r);
    }
    async refreshContext(uid: string, g: number, v: number, r: DecisionRequest) {
        const old = this.get(this.r, r.id);
        active(this.owns(uid, old.executionId), g);
        requireRule(old.version === v, 'conflict');
        const context = r.contexts.at(-1)!;
        requireRule(context.revision === old.contexts.at(-1)!.revision + 1 && canonical(r) === canonical({ ...old, contexts: [...old.contexts, context], version: old.version + 1 }), 'conflict');
        this.check(); this.r.set(r.id, clone(r)); return clone(r);
    }
    async submitDecision(k: Key, v: number, r: DecisionRequest, d: UserDecision, i: Omit<Input, 'sequence'>) {
        const old = this.replayNow<UserDecision>('decision', k);
        if (old)
            return old;
        const previous = this.get(this.r, r.id);
        const e = this.owns(k.userId, previous.executionId);
        requireRule(d.userId === k.userId, 'forbidden');
        requireRule(previous.version === v && d.requestId === r.id && !this.d.has(d.id), 'conflict');
        requireRule(canonical(r) === canonical(answer(previous, d)), 'conflict');
        if (d.correctionOf) requireRule(this.d.get(d.correctionOf)?.requestId === r.id, 'invalid');
        this.inputCheck(e, i, 'user-decision', d.id, d.files);
        this.check();
        this.r.set(r.id, clone(r));
        this.d.set(d.id, clone(d));
        this.inputSave(i);
        return this.remember('decision', k, d);
    }
    async submitSteering(k: Key, s: SteeringInput, i: Omit<Input, 'sequence'>) {
        const old = this.replayNow<SteeringInput>('steering', k);
        if (old)
            return old;
        const e = this.owns(k.userId, s.executionId);
        requireRule(s.userId === k.userId, 'forbidden');
        requireRule(!this.s.has(s.id), 'conflict');
        this.inputCheck(e, i, 'steering', s.id, s.files);
        this.check();
        this.s.set(s.id, clone(s));
        this.inputSave(i);
        return this.remember('steering', k, s);
    }
    async markDelivered(uid: string, id: string, receipt: string) {
        const i = this.get(this.i, id); this.owns(uid, i.executionId);
        requireRule(!!receipt.trim(), 'invalid');
        requireRule(i.status !== 'delivered' || i.receipt === receipt, 'conflict');
        this.check(); this.i.set(id, { ...i, status: 'delivered', receipt });
    }
    async transition(uid: string, expected: number, e: Execution, noPending = false) {
        const old = this.owns(uid, e.id);
        requireRule(old.version === expected, 'conflict');
        this.fixed(old, e);
        requireRule(canonical(old.method ?? null) === canonical(e.method ?? null), 'conflict');
        requireRule(e.generation === old.generation || (e.phase === 'running' && e.generation === old.generation + 1), 'conflict');
        let next: Execution;
        switch (e.phase) {
            case 'running': next = beginRun(old); break;
            case 'ended': next = endRun(old, e.generation); break;
            case 'stopping': next = beginStop(old); break;
            case 'stopped': next = recordStopped(old); break;
            case 'failed': next = { ...old, phase: 'failed', version: old.version + 1 }; break;
            default: requireRule(false, 'blocked');
        }
        requireRule(canonical(next) === canonical(e), 'conflict');
        if (noPending)
            requireRule(![...this.i.values()].some(i => i.executionId === e.id && i.status === 'pending'), 'blocked');
        this.check();
        this.e.set(e.id, clone(e));
        return clone(e);
    }
    async saveUpload(uid: string, f: Upload) {
        this.owns(uid, f.executionId);
        requireRule(f.userId === uid, 'forbidden');
        const old = this.f.get(f.id);
        if (old) { requireRule(canonical(old) === canonical(f), 'conflict'); return clone(old); }
        this.check(); this.f.set(f.id, clone(f)); return clone(f);
    }
    async updatePreferences(uid: string, v: number, preferences: import('../../src/domain/model').Preferences) { const u = this.enabled(uid); requireRule(u.version === v, 'conflict'); this.check(); const next = { ...u, preferences: clone(preferences), version: v + 1 }; this.u.set(uid, next); return clone(next); }
    async updateProfile(uid: string, v: number, name: string) { const u = this.enabled(uid); requireRule(u.version === v, 'conflict'); this.check(); const next = { ...u, name, version: v + 1 }; this.u.set(uid, next); return clone(next); }
    async manageUser(actorId: string, v: number, u: User) {
        const actor = this.enabled(actorId);
        requireRule(actor.admin, 'forbidden');
        const old = this.get(this.u, u.id);
        requireRule(old.version === v && u.version === v + 1, 'conflict');
        requireRule(canonical([old.issuer, old.subject, old.preferences ?? null]) === canonical([u.issuer, u.subject, u.preferences ?? null]), 'conflict');
        requireRule(!(actorId === u.id && !u.enabled), 'invalid');
        if (!u.enabled || !u.admin)
            requireRule([...this.u.values()].some(x => x.id !== u.id && x.enabled && x.admin) || !this.get(this.u, u.id).admin, 'blocked', 'last administrator');
        if (!u.enabled) {
            requireRule(![...this.e.values()].some(e => e.ownerId === u.id && ['new', 'running', 'stopping'].includes(e.phase)), 'blocked');
            requireRule(![...this.r.values()].some(r => r.status === 'pending' && this.e.get(r.executionId)?.ownerId === u.id), 'blocked');
        }
        this.check();
        this.u.set(u.id, clone(u));
        return clone(u);
    }
    async saveSettings(actorId: string, v: number, s: Settings) { requireRule(this.enabled(actorId).admin, 'forbidden'); requireRule(this.config.version === v, 'conflict'); this.check(); this.config = clone(s); return clone(s); }
}
