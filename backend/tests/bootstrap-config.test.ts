import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { createConfiguredModels, loadConfiguration } from '../src/bootstrap/bindings';

let directory: string;
let file: string;
const key = 'ab'.repeat(32);
const base = `AIRIC_IDENTITY_ISSUER=business
AIRIC_IDENTITY_ENDPOINT=https://identity.example/userinfo
AIRIC_OM_SOURCES='{"local":{"kind":"local","directory":"../om"}}'
AIRIC_MCP_ENCRYPTION_KEY=${key}
`;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'airic-env-')); file = join(directory, '.env'); await writeFile(file, base); });
afterEach(async () => { await rm(directory, { recursive: true, force: true }); });
it('maps dotenv into adapter options with paths relative to its own directory and environment overrides', () => {
    const config = loadConfiguration(file, { AIRIC_DATA_DIR: 'data', AIRIC_PORT: '9020', AIRIC_IDENTITY_NAME_FIELD: 'display_name' });
    expect(config.server.port).toBe(9020);
    expect(config.persistence.filename).toBe(join(directory, 'data/db/airic.sqlite'));
    expect(config.identity.fields.name).toBe('display_name');
    expect(config.methods.sources.local).toEqual({ kind: 'local', directory: join(directory, '../om') });
    expect(Buffer.from(config.mcp.key).toString('hex')).toBe(key);
    expect(config.persistence.initialSettings).toEqual({ version: 0, omSource: 'local', branch: 'main', root: 'om.md', connections: [] });
});
it('requires an explicit HTTP origin and source, validates session limits, and never changes production cookie security implicitly', () => {
    expect(loadConfiguration(file, {}).http).toBeUndefined();
    const config = loadConfiguration(file, { AIRIC_HTTP_SOURCE: 'business-prod', AIRIC_HTTP_ORIGINS: '["https://work.example"]' });
    expect(config.http?.secureCookies).toBe(true);
    expect(config.http?.session).toEqual({ idleMs: 1800000, absoluteMs: 28800000, capacity: 1000 });
    expect(() => loadConfiguration(file, { AIRIC_HTTP_SOURCE: 'business-prod' })).toThrow('AIRIC_HTTP_ORIGINS');
    expect(() => loadConfiguration(file, { AIRIC_HTTP_ORIGINS: '["https://work.example"]' })).toThrow('AIRIC_HTTP_SOURCE');
    expect(() => loadConfiguration(file, { AIRIC_HTTP_SOURCE: 'x', AIRIC_HTTP_ORIGINS: '["http://work.example"]' })).toThrow('AIRIC_HTTP_ORIGINS');
    expect(() => loadConfiguration(file, { AIRIC_HTTP_SOURCE: 'x', AIRIC_HTTP_ORIGINS: '["https://work.example"]', AIRIC_HTTP_SESSION_IDLE_MS: '0' })).toThrow('AIRIC_HTTP_SESSION_IDLE_MS');
});
it('maps fixed MCP endpoints, CA, provider credentials and all resource limits without changing global environment', async () => {
    await writeFile(join(directory, 'ca.pem'), 'private-ca');
    const before = process.env.AIRIC_MODEL_API_KEY;
    const config = loadConfiguration(file, {
        AIRIC_IDENTITY_CA_FILE: 'ca.pem', AIRIC_GIT_TIMEOUT_MS: '1200', AIRIC_MODEL_API_KEY: 'synthetic-key',
        AIRIC_MCP_CONNECTIONS: JSON.stringify([{ id: 'business', issuer: 'business', endpoint: 'https://business.example/mcp', issueEndpoint: 'https://business.example/issue', revokeEndpoint: 'https://business.example/revoke' }]),
    });
    expect(config.identity.ca).toBe('private-ca');
    expect(config.methods.limits.commandTimeoutMs).toBe(1200);
    expect(config.persistence.initialSettings.connections).toEqual(['business']);
    const models = await createConfiguredModels(config);
    expect(models.getModel(config.worker.model.provider, config.worker.model.modelId)).toBeDefined();
    expect((await models.getAuth(config.worker.model.provider))?.auth.apiKey).toBe('synthetic-key');
    expect(process.env.AIRIC_MODEL_API_KEY).toBe(before);
});
it.each([
    ['AIRIC_PORT', '65536'], ['AIRIC_IDENTITY_ENDPOINT', 'http://untrusted.example'], ['AIRIC_IDENTITY_ENDPOINT', 'private-not-a-url'],
    ['AIRIC_MCP_ENCRYPTION_KEY', 'secret-that-must-not-be-printed'], ['AIRIC_OM_SOURCES', '{invalid-json-secret'],
    ['AIRIC_OM_SOURCE', 'missing'], ['AIRIC_OM_ROOT', '.ome/private.md'], ['AIRIC_GIT_TIMEOUT_MS', '0'],
    ['AIRIC_MCP_CONNECTIONS', '[{"id":"secret","issuer":"x","endpoint":"http://x","issueEndpoint":"http://x","revokeEndpoint":"http://x"}]'],
])('rejects invalid %s without echoing its contents', (name, value) => {
    try { loadConfiguration(file, { [name]: value }); throw new Error('expected rejection'); }
    catch (error) { expect((error as Error).message).toContain(name); expect((error as Error).message).not.toContain(value); }
});
it('rejects duplicate connection IDs and missing explicit dotenv files', () => {
    const c = { id: 'same', issuer: 'business', endpoint: 'https://x/mcp', issueEndpoint: 'https://x/issue', revokeEndpoint: 'https://x/revoke' };
    expect(() => loadConfiguration(file, { AIRIC_MCP_CONNECTIONS: JSON.stringify([c, c]) })).toThrow('AIRIC_MCP_CONNECTIONS');
    expect(() => loadConfiguration(join(directory, 'missing'), {})).toThrow('DOTENV_FILE');
});
it('documents a parseable example whose required key must be provisioned explicitly', async () => {
    const example = await readFile(join(import.meta.dirname, '../../.env.example'), 'utf8');
    await writeFile(file, example);
    expect(() => loadConfiguration(file, {})).toThrow('AIRIC_MCP_ENCRYPTION_KEY');
    expect(loadConfiguration(file, { AIRIC_MCP_ENCRYPTION_KEY: key }).worker.model.provider).toBe('openai');
});

it('boots all configured adapters, executes with the fixed Git OM and reopens the same Session', async () => {
    const { httpsIdentityFixture } = await import('./support/https-identity');
    const { repository } = await import('./support/git-methods');
    const { harness } = await import('./support/harness');
    const { createConfiguredBackend } = await import('../src/bootstrap/bindings');
    const { createModels, fauxProvider, fauxAssistantMessage, fauxText } = await import('@earendil-works/pi-ai');
    const fixture = await httpsIdentityFixture();
    let backend: Awaited<ReturnType<typeof createConfiguredBackend>> | undefined;
    try {
        const repo = await repository(directory);
        await writeFile(join(directory, 'ca.pem'), fixture.options.ca!);
        const config = loadConfiguration(file, {
            AIRIC_OM_SOURCES: JSON.stringify({ local: { kind: 'local', directory: repo } }),
            AIRIC_IDENTITY_ENDPOINT: fixture.options.endpoint, AIRIC_IDENTITY_CA_FILE: 'ca.pem',
            AIRIC_WORKER_SKILL_PATH: join(import.meta.dirname, '../skills/airic-work-worker/SKILL.md'),
            AIRIC_MODEL_PROVIDER: 'faux', AIRIC_MODEL_ID: 'faux-1',
        });
        const faux = fauxProvider(); const models = createModels(); models.setProvider(faux.provider);
        const workspace = harness().d.workspace;
        backend = await createConfiguredBackend(config, workspace, models);
        const u = await backend.application.account.ensureUser('opaque-session');
        const e = await backend.application.execution.createExecution(u.id, 'create', { source: 'business', project_id: 'p', project_name: 'P', task: {}, instruction: 'Check the method' });
        faux.setResponses([fauxAssistantMessage([fauxText('dotenv bootstrap completed')])]);
        expect((await backend.runner.run(u.id, e.id)).phase).toBe('ended');
        await backend.close(); backend = undefined;
        backend = await createConfiguredBackend(config, workspace, models);
        expect(JSON.stringify(await backend.application.query.querySession(u.id, e.id))).toContain('dotenv bootstrap completed');
    } finally { await backend?.close(); await fixture.close(); }
});
