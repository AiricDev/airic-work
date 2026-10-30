import { active, canonical, own, requireRule, type User, type Project, type Execution, type DecisionRequest, type UserDecision, type SteeringInput, type Input, type Upload, type Settings } from '../../src/domain/model';
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
    async inputs(id: string) { return clone([...this.i.values()].filter(i => i.executionId === id)); }
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
    private inputSave(i: Omit<Input, 'sequence'>) { this.i.set(i.id, clone({ ...i, sequence: [...this.i.values()].filter(x => x.executionId === i.executionId).length + 1 })); }
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
        this.check();
        const project = [...this.p.values()].find(x => x.source === p.source && x.externalId === p.externalId) ?? p;
        this.p.set(project.id, clone(project));
        e = { ...e, projectId: project.id };
        this.e.set(e.id, clone(e));
        return this.remember('create', k, e);
    }
    async prepare(uid: string, expected: number, sv: number, e: Execution, start: Omit<Input, 'sequence'>) { const old = this.owns(uid, e.id); requireRule(old.version === expected && this.config.version === sv, 'conflict'); this.check(); this.e.set(e.id, clone(e)); this.inputSave(start); return clone(e); }
    async createRequest(k: Key, g: number, r: DecisionRequest) {
        const old = this.replayNow<DecisionRequest>('request', k);
        if (old)
            return old;
        active(this.owns(k.userId, r.executionId), g);
        this.check();
        this.r.set(r.id, clone(r));
        return this.remember('request', k, r);
    }
    async refreshContext(uid: string, g: number, v: number, r: DecisionRequest) { active(this.owns(uid, r.executionId), g); requireRule(this.get(this.r, r.id).version === v, 'conflict'); this.check(); this.r.set(r.id, clone(r)); return clone(r); }
    async submitDecision(k: Key, v: number, r: DecisionRequest, d: UserDecision, i: Omit<Input, 'sequence'>) {
        const old = this.replayNow<UserDecision>('decision', k);
        if (old)
            return old;
        this.owns(k.userId, r.executionId);
        requireRule(this.get(this.r, r.id).version === v, 'conflict');
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
        this.owns(k.userId, s.executionId);
        this.check();
        this.s.set(s.id, clone(s));
        this.inputSave(i);
        return this.remember('steering', k, s);
    }
    async markDelivered(uid: string, id: string, receipt: string) { const i = this.get(this.i, id); this.owns(uid, i.executionId); this.check(); this.i.set(id, { ...i, status: 'delivered', receipt }); }
    async transition(uid: string, expected: number, e: Execution, noPending = false) {
        const old = this.owns(uid, e.id);
        requireRule(old.version === expected, 'conflict');
        requireRule(canonical(old.method ?? null) === canonical(e.method ?? null) && old.sessionId === e.sessionId && old.workspaceId === e.workspaceId, 'conflict');
        if (noPending)
            requireRule(![...this.i.values()].some(i => i.executionId === e.id && i.status === 'pending'), 'blocked');
        this.check();
        this.e.set(e.id, clone(e));
        return clone(e);
    }
    async saveUpload(uid: string, f: Upload) { this.owns(uid, f.executionId); this.check(); this.f.set(f.id, clone(f)); return clone(f); }
    async updatePreferences(uid: string, v: number, preferences: import('../../src/domain/model').Preferences) { const u = this.enabled(uid); requireRule(u.version === v, 'conflict'); this.check(); const next = { ...u, preferences: clone(preferences), version: v + 1 }; this.u.set(uid, next); return clone(next); }
    async updateProfile(uid: string, v: number, name: string) { const u = this.enabled(uid); requireRule(u.version === v, 'conflict'); this.check(); const next = { ...u, name, version: v + 1 }; this.u.set(uid, next); return clone(next); }
    async manageUser(actorId: string, v: number, u: User) {
        const actor = this.enabled(actorId);
        requireRule(actor.admin, 'forbidden');
        requireRule(this.get(this.u, u.id).version === v, 'conflict');
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
