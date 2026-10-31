import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export class HttpError extends Error {
    constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
interface Session {
    token: string; userId: string; csrf: string; created: number; touched: number;
    listeners: Set<() => void>;
}
const random = () => randomBytes(32).toString('base64url');
const digest = (id: string) => createHash('sha256').update(id).digest('hex');
export function equalSecret(a: string, b: string) {
    const x = Buffer.from(a), y = Buffer.from(b);
    return x.length === y.length && timingSafeEqual(x, y);
}
/** Single-process BFF only. Expiry and restart both require another handoff; no token is written to disk. */
export class Sessions {
    private readonly values = new Map<string, Session>();
    constructor(private readonly now: () => number, private readonly idleMs: number, private readonly absoluteMs: number, private readonly capacity: number) {}
    get(id: string | undefined): Session | undefined {
        if (!id || !/^[A-Za-z0-9_-]{43}$/.test(id)) return undefined;
        const s = this.values.get(digest(id));
        if (s && (this.now() - s.created >= this.absoluteMs || this.now() - s.touched >= this.idleMs)) {
            this.delete(id); return undefined;
        }
        return s;
    }
    touch(id: string) { const s = this.get(id); if (s) s.touched = this.now(); }
    create(token: string, userId: string) {
        for (const [key, value] of this.values) {
            if (this.now() - value.created >= this.absoluteMs || this.now() - value.touched >= this.idleMs) this.remove(key);
        }
        if (this.values.size >= this.capacity) throw new HttpError(503, 'session-capacity', '会话容量暂不可用');
        const id = random();
        const session: Session = { token, userId, csrf: random(), created: this.now(), touched: this.now(), listeners: new Set() };
        this.values.set(digest(id), session);
        return { id, session };
    }
    private remove(key: string) {
        const s = this.values.get(key);
        this.values.delete(key);
        if (s) { s.token = ''; for (const close of s.listeners) close(); s.listeners.clear(); }
    }
    delete(id: string) { this.remove(digest(id)); }
    close() { for (const key of this.values.keys()) this.remove(key); }
}
