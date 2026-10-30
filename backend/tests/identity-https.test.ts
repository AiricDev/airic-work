import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createIdentity } from '../src/bootstrap/identity';
import { httpsIdentityFixture } from './support/https-identity';

describe('HTTPS user information identity', () => {
    let fixture: Awaited<ReturnType<typeof httpsIdentityFixture>>;
    beforeAll(async () => { fixture = await httpsIdentityFixture(); });
    afterAll(async () => { await fixture.close(); });
    beforeEach(() => {
        fixture.received.length = 0;
        fixture.handler = (_req, res) => {
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(JSON.stringify({ sub: 'external-subject', name: '外部姓名', issuer: 'untrusted', admin: true, token: 'not-returned' }));
        };
    });
    const identity = () => createIdentity(fixture.options).identity;

    it('uses one fixed HTTPS GET with Bearer token and returns only trusted identity fields', async () => {
        expect(await identity().verify('opaque.token+/==')).toEqual({ issuer: 'trusted-integration', subject: 'external-subject', name: '外部姓名' });
        expect(fixture.received).toEqual([{ method: 'GET', url: '/userinfo', authorization: 'Bearer opaque.token+/==' }]);
    });
    it('supports explicitly mapped top-level JSON fields', async () => {
        fixture.handler = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ user_id: 'stable-id', display_name: 'Name' })); };
        const adapter = createIdentity({ ...fixture.options, fields: { subject: 'user_id', name: 'display_name' } }).identity;
        expect(await adapter.verify('opaque')).toEqual({ issuer: 'trusted-integration', subject: 'stable-id', name: 'Name' });
    });
    it.each(['', ' ', 'Bearer token', 'a\r\nX-Injected: value', '非ASCII', 'a'.repeat(4097)])('rejects malformed or oversized token before networking (%#)', async token => {
        await expect(identity().verify(token)).rejects.toMatchObject({ code: 'forbidden', message: 'identity token rejected' });
        expect(fixture.received).toEqual([]);
    });
    it.each([401, 403, 429, 500])('rejects HTTP %s without retries or leaking response details', async status => {
        fixture.handler = (_req, res) => { res.writeHead(status); res.end('private token or diagnostic'); };
        await expect(identity().verify('opaque')).rejects.toMatchObject({ code: status === 401 || status === 403 ? 'forbidden' : 'blocked' });
        expect(fixture.received).toHaveLength(1);
    });
    it('does not follow redirects or forward credentials to another path', async () => {
        fixture.handler = (_req, res) => { res.writeHead(302, { Location: `${fixture.options.endpoint}/other` }); res.end(); };
        await expect(identity().verify('opaque')).rejects.toMatchObject({ code: 'blocked' });
        expect(fixture.received).toHaveLength(1);
        expect(fixture.received[0].url).toBe('/userinfo');
    });
    it.each(['not JSON', 'null', '[]', '{}', '{"sub":42,"name":"Name"}', '{"sub":"id","name":{}}', '{"sub":" ","name":"Name"}', '{"email":"a@example.test","name":"Name"}'])('rejects malformed identity body (%#)', async body => {
        fixture.handler = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(body); };
        await expect(identity().verify('opaque')).rejects.toMatchObject({ code: 'blocked', message: 'identity response unavailable' });
    });
    it('rejects invalid UTF-8 rather than changing a stable subject', async () => {
        fixture.handler = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(Buffer.from([255])); };
        await expect(identity().verify('opaque')).rejects.toMatchObject({ code: 'blocked' });
    });
    it.each([false, true])('enforces response byte bounds, declared=%s', async declared => {
        fixture.handler = (_req, res) => {
            res.setHeader('Content-Type', 'application/json');
            if (declared) res.setHeader('Content-Length', '9000');
            res.write('x'.repeat(9000)); res.end();
        };
        await expect(identity().verify('opaque')).rejects.toMatchObject({ code: 'blocked' });
    });
    it.each(['text/html', 'application/json+wrong'])('rejects unsupported response media type %s', async type => {
        fixture.handler = (_req, res) => { res.setHeader('Content-Type', type); res.end('{"sub":"id","name":"name"}'); };
        await expect(identity().verify('opaque')).rejects.toMatchObject({ code: 'blocked' });
    });
    it('rejects compressed and incomplete responses', async () => {
        fixture.handler = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.setHeader('Content-Encoding', 'gzip'); res.end('not compressed'); };
        await expect(identity().verify('opaque')).rejects.toMatchObject({ code: 'blocked' });
        fixture.handler = (_req, res) => { res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': '1000' }); res.write('{"sub":'); res.socket?.destroy(); };
        await expect(identity().verify('opaque')).rejects.toMatchObject({ code: 'blocked' });
    });
    it('enforces a total deadline even when body bytes continue arriving', async () => {
        fixture.handler = (_req, res) => {
            res.writeHead(200, { 'Content-Type': 'application/json' }); res.write(' ');
            const timer = setInterval(() => res.write(' '), 30);
            res.once('close', () => clearInterval(timer));
        };
        const adapter = createIdentity({ ...fixture.options, limits: { ...fixture.options.limits, timeoutMs: 200 } }).identity;
        const started = performance.now();
        await expect(adapter.verify('opaque')).rejects.toMatchObject({ code: 'blocked' });
        expect(performance.now() - started).toBeLessThan(1500);
    });
    it('rejects untrusted TLS certificates rather than turning verification off', async () => {
        const adapter = createIdentity({ ...fixture.options, ca: undefined }).identity;
        await expect(adapter.verify('opaque')).rejects.toMatchObject({ code: 'blocked', message: 'identity service unavailable' });
        expect(fixture.received).toHaveLength(0);
    });
    it('never caches acceptance across revocation', async () => {
        const adapter = identity();
        await adapter.verify('same-token');
        fixture.handler = (_req, res) => { res.writeHead(401); res.end(); };
        await expect(adapter.verify('same-token')).rejects.toMatchObject({ code: 'forbidden' });
        expect(fixture.received).toHaveLength(2);
    });
    it('copies configuration and does not expose raw service errors', async () => {
        const config = structuredClone(fixture.options);
        const adapter = createIdentity(config).identity;
        config.issuer = 'changed'; config.fields.subject = 'missing';
        expect((await adapter.verify('opaque')).issuer).toBe('trusted-integration');
        fixture.handler = (_req, res) => { res.writeHead(500); res.end('opaque /private/host diagnostic'); };
        await expect(adapter.verify('opaque')).rejects.toMatchObject({ message: 'identity service unavailable' });
    });
    it.each(['http://example.test/userinfo', 'file:///private/userinfo', 'https://user:secret@example.test/userinfo', 'https://example.test/userinfo?token=secret', 'https://example.test/userinfo#fragment'])('rejects unsafe endpoint (%#)', endpoint => {
        expect(() => createIdentity({ ...fixture.options, endpoint })).toThrow();
    });
});
