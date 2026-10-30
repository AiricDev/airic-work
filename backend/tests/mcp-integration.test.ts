import { afterAll, beforeAll, beforeEach, afterEach, expect, it } from 'vitest';
import { request } from 'node:https';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { httpsIdentityFixture } from './support/https-identity';
import { harness } from './support/harness';
import { createMcpIntegration } from '../src/bootstrap/bindings';

let fixture: Awaited<ReturnType<typeof httpsIdentityFixture>>;
let directory: string;
let rejectCalls = false;
let wrongSubject = false;
let expiresAt: string;
let writes = 0;
let issuedExecution = '';
beforeAll(async () => { fixture = await httpsIdentityFixture(); });
afterAll(async () => { if (fixture) await fixture.close(); });
beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'airic-mcp-')); rejectCalls = false; wrongSubject = false; writes = 0;
    expiresAt = new Date(Date.now() + 60000).toISOString(); fixture.received.length = 0;
    fixture.handler = (req, res) => {
        const chunks: Buffer[] = [];
        req.on('data', b => chunks.push(Buffer.from(b)));
        req.on('end', () => {
            const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
            res.setHeader('Content-Type', 'application/json');
            if (req.url === '/issue') { issuedExecution = body.execution_id; res.end(JSON.stringify({ access_token: 'clm_synthetic_secret', token_type: 'Bearer', token_id: 'grant-id', user_id: wrongSubject ? 'foreign' : 'owner', execution_id: issuedExecution, expires_at: expiresAt })); return; }
            if (req.url === '/revoke') { rejectCalls = true; res.end(JSON.stringify({ status: 'revoked', user_id: wrongSubject ? 'foreign' : 'owner' })); return; }
            if (req.headers.authorization !== 'Bearer clm_synthetic_secret' || req.headers['x-airic-execution-id'] !== issuedExecution || rejectCalls) { res.statusCode = 401; res.end('{}'); return; }
            if (!body.id) { res.statusCode = 202; res.end(); return; }
            let result: object = {};
            if (body.method === 'initialize') result = { protocolVersion: body.params.protocolVersion, capabilities: { tools: {} }, serverInfo: { name: 'business', version: '1' } };
            if (body.method === 'tools/list') result = { tools: [{ name: 'record.update', description: 'Update', inputSchema: { type: 'object', properties: {} }, _meta: { 'ai.airic/execution': { kind: 'command' } } }] };
            if (body.method === 'tools/call') { writes++; result = { content: [{ type: 'text', text: JSON.stringify({ saved: true, access_token: 'secret-in-content' }) }], structuredContent: { saved: true, token: 'remote-secret', echoed: 'clm_synthetic_secret' } }; }
            res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
        });
    };
});
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
/** Real HTTPS with a private test CA; production TLS validation remains enabled. */
const fetcher: typeof fetch = async (input, init) => new Promise((resolve, reject) => {
    const req = request(String(input), { ca: fixture.options.ca, method: init?.method, headers: Object.fromEntries(new Headers(init?.headers).entries()), signal: init?.signal ?? undefined }, res => {
        const chunks: Buffer[] = []; res.on('data', b => chunks.push(Buffer.from(b))); res.on('end', () => {
            const headers = new Headers(); for (const [k, v] of Object.entries(res.headers)) if (v) headers.set(k, Array.isArray(v) ? v.join(',') : v);
            resolve(new Response(Buffer.concat(chunks).length ? Buffer.concat(chunks) : null, { status: res.statusCode, headers }));
        });
    }); req.on('error', reject); if (init?.body) req.write(init.body); req.end();
});
async function setup() {
    const h = harness(); const { u, e } = await h.running(); const connection = (await h.store.settings()).connections[0];
    const origin = new URL(fixture.options.endpoint).origin;
    const options = { directory, key: randomBytes(32), connections: [{ id: connection, issuer: u.issuer, endpoint: origin + '/mcp', issueEndpoint: origin + '/issue', revokeEndpoint: origin + '/revoke' }], fetch: fetcher };
    const integration = createMcpIntegration(options, h.store);
    h.d.mcp.tools = integration.gateway.tools.bind(integration.gateway);
    h.d.mcp.call = integration.gateway.call.bind(integration.gateway);
    h.d.mcp.sanitize = integration.gateway.sanitize.bind(integration.gateway);
    return { h, u, e, connection, integration, options };
}

it('issues for the creator, encrypts/reopens the grant, discovers schemas and calls with only the MCP credential', async () => {
    const { h, u, e, connection, integration, options } = await setup();
    const metadata = await integration.credentials.connect(u.id, e.id, connection, 'web-access');
    expect(metadata).toEqual({ tokenId: 'grant-id', expiresAt });
    const bytes = await readFile(join(directory, (await readdir(directory))[0]));
    expect(bytes.toString()).not.toContain('clm_synthetic_secret');
    const reopened = createMcpIntegration(options, h.store);
    const definitions = await reopened.gateway.tools(u.id, connection, { executionId: e.id, sessionId: e.sessionId, generation: e.generation });
    expect(definitions[0]).toMatchObject({ name: 'record.update', classification: 'write', inputSchema: { type: 'object' } });
    const result = await h.app.mcpCases.callMcp(u.id, e.id, e.generation, connection, definitions[0].name, {}, 'call-1', definitions[0].schemaRevision);
    expect(result.status).toBe('unknown');
    expect(JSON.stringify(result)).not.toContain('synthetic_secret');
    expect(JSON.stringify(result)).not.toContain('remote-secret');
    expect(JSON.stringify(result)).not.toContain('secret-in-content');
    await h.app.mcpCases.callMcp(u.id, e.id, e.generation, connection, definitions[0].name, {}, 'call-1', definitions[0].schemaRevision);
    expect(writes).toBe(1);
    expect(fixture.received.filter(r => r.url === '/mcp').every(r => r.authorization === 'Bearer clm_synthetic_secret')).toBe(true);
});

it('rejects foreign ownership, grant subject, expiry, disabled users and stopped generations', async () => {
    const { h, u, e, connection, integration } = await setup();
    wrongSubject = true;
    await expect(integration.credentials.connect(u.id, e.id, connection, 'web')).rejects.toMatchObject({ code: 'forbidden' });
    wrongSubject = false; expiresAt = new Date(0).toISOString();
    await expect(integration.credentials.connect(u.id, e.id, connection, 'web')).rejects.toThrow();
    expiresAt = new Date(Date.now() + 60000).toISOString();
    await integration.credentials.connect(u.id, e.id, connection, 'web');
    const foreign = await h.app.account.ensureUser('foreign');
    await expect(integration.credentials.revoke(foreign.id, e.id, connection, 'web')).rejects.toMatchObject({ code: 'forbidden' });
    h.store.u.set(u.id, { ...u, enabled: false });
    await expect(integration.gateway.tools(u.id, connection, { executionId: e.id, sessionId: e.sessionId, generation: e.generation })).rejects.toThrow();
    h.store.u.set(u.id, u);
    await expect(integration.gateway.call({ userId: u.id, executionId: e.id, sessionId: e.sessionId, generation: e.generation - 1 }, connection, 'record.update', {})).rejects.toThrow();
    expect(writes).toBe(0);
});

it('revokes locally before remote acknowledgement and never retries a rejected write', async () => {
    const { u, e, connection, integration } = await setup();
    await integration.credentials.connect(u.id, e.id, connection, 'web');
    rejectCalls = true;
    await expect(integration.gateway.call({ userId: u.id, executionId: e.id, sessionId: e.sessionId, generation: e.generation }, connection, 'record.update', {})).rejects.toThrow();
    expect(writes).toBe(0);
    rejectCalls = false;
    await integration.credentials.revoke(u.id, e.id, connection, 'web');
    await expect(integration.gateway.tools(u.id, connection, { executionId: e.id, sessionId: e.sessionId, generation: e.generation })).rejects.toThrow();
    // Revocation can be retried by the same stable token ID even though local use is disabled.
    await integration.credentials.revoke(u.id, e.id, connection, 'web');
});

it('connects a real Pi Worker through discovery and the gateway without exposing credentials to its Session', async () => {
    const { createModels, fauxProvider, fauxAssistantMessage, fauxToolCall, fauxText } = await import('@earendil-works/pi-ai');
    const { createWorker } = await import('../src/bootstrap/bindings');
    const { createBackend } = await import('../src/bootstrap/container');
    const { h, u, e, connection, integration } = await setup();
    await integration.credentials.connect(u.id, e.id, connection, 'web-access');
    const [definition] = await integration.gateway.tools(u.id, connection, { executionId: e.id, sessionId: e.sessionId, generation: e.generation });
    const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
    let application!: import('../src/application/application').Application;
    const worker = createWorker({ directory: join(directory, 'runtime'), models, model: { provider: 'faux', modelId: 'faux-1' }, skillPath: join(import.meta.dirname, '../skills/airic-work-worker/SKILL.md'), tools: async execution => integration.tools(application, execution) }, h.store, h.d.methods, h.d.support);
    const backend = createBackend({ ...h.d, runtime: worker.runtime, history: worker.history, mcp: integration.gateway }); application = backend.application;
    try {
        faux.setResponses([
            fauxAssistantMessage([fauxToolCall('work_discover_mcp', { connection }, { id: 'discover' })], { stopReason: 'toolUse' }),
            fauxAssistantMessage([fauxToolCall('work_call_mcp', { connection, tool: 'record.update', schemaRevision: definition.schemaRevision, parameters: {} }, { id: 'write' })], { stopReason: 'toolUse' }),
            fauxAssistantMessage([fauxText('Business response received')]),
        ]);
        await application.input.submitSteering(u.id, e.id, 'continue', 'Continue business work');
        expect((await worker.runner(application).run(u.id, e.id)).phase).toBe('ended');
        expect(writes).toBe(1);
        expect((await application.query.queryMcpCalls(u.id, e.id, 'write')).items).toHaveLength(1);
        const history = JSON.stringify(await application.query.querySession(u.id, e.id));
        expect(history).not.toContain('web-access');
        expect(history).not.toContain('clm_synthetic_secret');
        expect(history).toContain('Business response received');
    } finally { await worker.close(); await backend.dispose(); }
});


it('does not reuse encrypted credentials after changing connection authority or the encryption key', async () => {
    const { u, e, connection, integration, options } = await setup();
    await integration.credentials.connect(u.id, e.id, connection, 'web');
    // Use the original owner/store with a changed key, and verify no HTTP credential is sent.
    const { McpCredentialVault } = await import('../src/adapters/driven/mcp/credentials');
    const identity = { userId: u.id, executionId: e.id, connection, issuer: u.issuer, subject: u.subject };
    await expect(new McpCredentialVault(directory, randomBytes(32), options.connections, fetcher).secret(identity)).rejects.toThrow();
    await expect(new McpCredentialVault(directory, options.key, options.connections.map(c => ({ ...c, endpoint: c.endpoint + '-other' })), fetcher).secret(identity)).rejects.toThrow();
});

it('keeps local credentials disabled when remote revocation responds with another identity', async () => {
    const { u, e, connection, integration } = await setup();
    await integration.credentials.connect(u.id, e.id, connection, 'web');
    wrongSubject = true;
    await expect(integration.credentials.revoke(u.id, e.id, connection, 'foreign-web')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(integration.gateway.tools(u.id, connection, { executionId: e.id, sessionId: e.sessionId, generation: e.generation })).rejects.toThrow();
    wrongSubject = false;
    await integration.credentials.revoke(u.id, e.id, connection, 'owner-web');
});
