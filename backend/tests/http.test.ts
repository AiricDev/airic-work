import { afterEach, describe, expect, it } from 'vitest';
import { createHttpServer } from '../src/adapters/driving/http/server';
import { harness } from './support/harness';
import type { FastifyInstance } from 'fastify';
import { RuleError } from '../src/domain/model';

const origin = 'https://work.example';
const servers: FastifyInstance[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(s => s.close())); });
async function setup(extra = {}) {
    const h = harness();
    const server = await createHttpServer({ application: h.app, source: 'business', origins: [origin], ...extra });
    servers.push(server);
    return { h, server };
}
async function login(server: FastifyInstance, token = 'owner') {
    const response = await server.inject({ method: 'POST', url: '/api/v1/auth/session', headers: { origin, authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(200);
    return { cookie: response.cookies[0].name + '=' + response.cookies[0].value, csrf: response.json().csrfToken as string, user: response.json().user };
}
const creation = { project_id: 'p', project_name: 'Project', instruction: 'check', task: { id: 'task' } };
describe('HTTP delivery contract', () => {
    it('reports protected account state as a rejected change, not a service outage', async () => {
        const { server, h } = await setup();
        const admin = await h.app.account.ensureUser('admin');
        h.store.u.set(admin.id, { ...admin, admin: true });
        const response = await server.inject({ method: 'PATCH', url: `/api/v1/admin/users/${admin.id}`, headers: { authorization: 'Bearer admin' }, payload: { admin: false } });
        expect(response.statusCode).toBe(409);
        expect(response.json().code).toBe('blocked');
        expect(response.json().message).toContain('当前状态不允许');
        expect((await h.store.user(admin.id)).admin).toBe(true);
        expect(response.body).not.toContain('last administrator');
    });
    it('releases completed HTTP requests instead of exhausting the concurrent-request limit', async () => {
        const { server } = await setup();
        for (let i = 0; i < 70; i++)
            expect((await server.inject({ url: '/api/v1/me', headers: { authorization: 'Bearer owner' } })).statusCode).toBe(200);
    });
    it('streams invalidation only while the current account remains valid and closes on logout', async () => {
        const { server, h } = await setup({ streamIntervalMs: 10 });
        const session = await login(server);
        await server.listen({ host: '127.0.0.1', port: 0 });
        const address = server.server.address();
        if (!address || typeof address === 'string') throw new Error('Missing listener');
        const controller = new AbortController();
        const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/stream`, { headers: { cookie: session.cookie }, signal: controller.signal });
        expect(response.status).toBe(200);
        const reader = response.body!.getReader();
        expect(new TextDecoder().decode((await reader.read()).value)).toContain('event: invalidate');
        h.store.u.set(session.user.id, { ...await h.store.user(session.user.id), enabled: false });
        let text = '';
        const timeout = setTimeout(() => controller.abort(), 2000);
        try {
            while (!text.includes('identity-lost')) {
                const value = await reader.read();
                if (value.done) break;
                text += new TextDecoder().decode(value.value);
            }
            expect(text).toContain('event: identity-lost');
        } finally { clearTimeout(timeout); await reader.cancel(); controller.abort(); }
    });
    it('keeps ordinary API access available while many SSE streams are open', async () => {
        const { server } = await setup({ streamIntervalMs: 60000 });
        await server.listen({ host: '127.0.0.1', port: 0 });
        const address = server.server.address();
        if (!address || typeof address === 'string') throw new Error('Missing listener');
        const url = `http://127.0.0.1:${address.port}`;
        const controllers: AbortController[] = [];
        try {
            for (let i = 0; i < 65; i++) {
                const controller = new AbortController(); controllers.push(controller);
                const response = await fetch(url + '/api/v1/stream', { headers: { authorization: `Bearer stream-${i}` }, signal: controller.signal });
                expect(response.status).toBe(200);
            }
            expect((await fetch(url + '/api/v1/me', { headers: { authorization: 'Bearer owner' } })).status).toBe(200);
        } finally { controllers.forEach(c => c.abort()); }
    });
    it('requires identity, rejects URL credentials and cross-site login', async () => {
        const { server } = await setup();
        expect((await server.inject('/api/v1/me')).statusCode).toBe(401);
        expect((await server.inject('/api/v1/me?token=secret')).statusCode).toBe(400);
        expect((await server.inject({ method: 'POST', url: '/api/v1/auth/session', headers: { authorization: 'Bearer owner', origin: 'https://evil.example' } })).statusCode).toBe(403);
    });
    it('creates an opaque secure cookie and exposes no stable external subject or token', async () => {
        const { server } = await setup();
        const response = await server.inject({ method: 'POST', url: '/api/v1/auth/session', headers: { authorization: 'Bearer owner', origin } });
        expect(response.statusCode).toBe(200);
        expect(response.headers['set-cookie']).toContain('HttpOnly');
        expect(response.headers['set-cookie']).toContain('Secure');
        expect(response.headers['set-cookie']).toContain('SameSite=Lax');
        expect(response.json().user).not.toHaveProperty('subject');
        expect(response.json()).not.toHaveProperty('token');
        expect(response.headers['cache-control']).toBe('no-store');
    });
    it('checks CSRF and origin on every cookie write, and rejects mixed identities', async () => {
        const { server } = await setup();
        const s = await login(server);
        for (const headers of [{ cookie: s.cookie }, { cookie: s.cookie, origin }, { cookie: s.cookie, origin: 'https://evil.example', 'x-csrf-token': s.csrf }]) {
            expect((await server.inject({ method: 'POST', url: '/api/v1/executions', headers, payload: creation })).statusCode).toBe(403);
        }
        expect((await server.inject({ url: '/api/v1/me', headers: { cookie: s.cookie, authorization: 'Bearer owner' } })).statusCode).toBe(400);
        expect((await server.inject({ method: 'PATCH', url: '/api/v1/me', headers: { cookie: s.cookie, origin, 'x-csrf-token': s.csrf }, payload: { name: 'Renamed' } })).json().name).toBe('Renamed');
    });
    it('saves new executions without dispatch, safely replays and rejects injected ownership', async () => {
        const { server, h } = await setup();
        const headers = { authorization: 'Bearer owner', 'idempotency-key': 'create' };
        const result = await server.inject({ method: 'POST', url: '/api/v1/executions', headers, payload: creation });
        expect(result.statusCode).toBe(200);
        expect(result.json().phase).toBe('new');
        expect(result.json()).not.toHaveProperty('workspaceId');
        expect(h.flags.deliverCount).toBe(0);
        expect((await server.inject({ method: 'POST', url: '/api/v1/executions', headers, payload: creation })).json()).toEqual(result.json());
        expect((await server.inject({ method: 'POST', url: '/api/v1/executions', headers, payload: { ...creation, instruction: 'changed' } })).statusCode).toBe(409);
        expect((await server.inject({ method: 'POST', url: '/api/v1/executions', headers, payload: { ...creation, ownerId: 'other' } })).statusCode).toBe(400);
    });
    it('preserves old-context answers, corrections and delivery facts', async () => {
        const { server, h } = await setup();
        const { u, e } = await h.running();
        const r = await h.app.decision.createDecisionRequest(u.id, e.id, e.generation, 'request', 'Question', [], { revision: 1, content: {}, sources: [] });
        await h.app.decision.refreshContext(u.id, r.id, e.generation, { revision: 2, content: {}, sources: [] });
        const response = await server.inject({ method: 'POST', url: `/api/v1/decision-requests/${r.id}/user-decisions`, headers: { authorization: 'Bearer owner', 'idempotency-key': 'answer' }, payload: { text: 'Yes', contextRevision: 1, files: [] } });
        expect(response.statusCode).toBe(200);
        const episode = (await server.inject({ url: `/api/v1/episodes/${r.id}`, headers: { authorization: 'Bearer owner' } })).json();
        expect(episode.request.status).toBe('answered');
        expect(episode.inputs[0].status).toBe('pending');
        expect(episode.inputs[0]).not.toHaveProperty('receipt');
    });
    it('does not let administrators read another user or distinguish missing scoped objects', async () => {
        const { server, h } = await setup();
        const { e } = await h.running();
        const u = await h.app.account.ensureUser('admin'); h.store.u.set(u.id, { ...u, admin: true });
        for (const id of [e.id, 'missing']) {
            const response = await server.inject({ url: `/api/v1/executions/${id}`, headers: { authorization: 'Bearer admin' } });
            expect(response.statusCode).toBe(404); expect(response.json().code).toBe('not-found');
        }
        expect((await server.inject({ url: '/api/v1/projects', headers: { authorization: 'Bearer admin' } })).json().items).toEqual([]);
    });
    it('binds cursors to the current user and rejects malformed cursors without leaking parser errors', async () => {
        const { server, h } = await setup();
        const { u, e } = await h.running();
        await h.app.execution.createExecution(u.id, 'second', e.creation);
        const page = (await server.inject({ url: '/api/v1/executions?limit=1', headers: { authorization: 'Bearer owner' } })).json();
        expect(page.items).toHaveLength(1); expect(page.cursor).toBeTypeOf('string');
        const response = await server.inject({ url: `/api/v1/executions?cursor=${page.cursor}`, headers: { authorization: 'Bearer other' } });
        expect(response.statusCode).toBe(400);
    });
    it('expires idle and absolute sessions, revalidates identity and distinguishes disabled users', async () => {
        let time = 0;
        const { server, h } = await setup({ now: () => time, session: { idleMs: 50, absoluteMs: 100, capacity: 2 } });
        const s = await login(server);
        time = 51;
        const expired = await server.inject({ url: '/api/v1/me', headers: { cookie: s.cookie } });
        expect(expired.statusCode).toBe(401);
        expect(expired.cookies[0].value).toBe('');
        const t = await login(server);
        h.store.u.set(t.user.id, { ...await h.store.user(t.user.id), enabled: false });
        expect((await server.inject({ url: '/api/v1/me', headers: { cookie: t.cookie } })).json().code).toBe('account-disabled');
        const other = await login(server, 'other');
        h.d.identity.verify = async () => { throw new RuleError('blocked', 'secret upstream URL'); };
        const response = await server.inject({ url: '/api/v1/me', headers: { cookie: other.cookie } });
        expect(response.statusCode).toBe(503);
        expect(response.body).not.toContain('secret');
    });
    it('logs out, limits sessions and requires a command key', async () => {
        const { server } = await setup({ session: { idleMs: 10000, absoluteMs: 20000, capacity: 1 } });
        const s = await login(server);
        expect((await server.inject({ method: 'POST', url: '/api/v1/auth/session', headers: { origin, authorization: 'Bearer other' } })).statusCode).toBe(503);
        expect((await server.inject({ method: 'POST', url: '/api/v1/executions', headers: { authorization: 'Bearer owner' }, payload: creation })).statusCode).toBe(400);
        expect((await server.inject({ method: 'DELETE', url: '/api/v1/auth/session', headers: { cookie: s.cookie, origin, 'x-csrf-token': s.csrf } })).statusCode).toBe(200);
        expect((await server.inject({ url: '/api/v1/me', headers: { cookie: s.cookie } })).statusCode).toBe(401);
    });
});
