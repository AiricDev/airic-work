import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getCACertificates, setDefaultCACertificates } from 'node:tls';
import { createBackend } from '../src/bootstrap/container';
import { createConfiguredModels, createFileStorage, createIdentity, createMcpIntegration, createMethods, createPersistence, createWorker, loadConfiguration } from '../src/bootstrap/bindings';
import { listenConfiguredHttp } from '../src/bootstrap/http';
import { McpCredentialVault } from '../src/adapters/driven/mcp/credentials';
import type { Workspace } from '../src/application/ports';
import { requireRule } from '../src/domain/model';

// Local development only: no shell/file tools or attachment processing are exposed.
const config = loadConfiguration();
requireRule(config.server.host === '127.0.0.1', 'invalid', 'Development worker must bind to loopback');
if (config.identity.ca) setDefaultCACertificates([...getCACertificates('default'), config.identity.ca]);
const workspace: Workspace = {
    async ensure(e) { await mkdir(resolve(config.worker.directory, 'workspaces', e.workspaceId), { recursive: true, mode: 0o700 }); },
    async materialize(_e, files) { requireRule(files.length === 0, 'blocked', 'Local development worker does not support chat attachments; register materials in CertLab'); },
    async stopped() { return true; }, // This host never starts Workspace tool processes.
};
const models = await createConfiguredModels(config);
const persistence = createPersistence(config.persistence);
const { store, support } = persistence;
const { methods } = await createMethods(config.methods);
const { identity } = createIdentity(config.identity);
const { files } = await createFileStorage(config.files);
const mcp = createMcpIntegration(config.mcp, store);
const vault = new McpCredentialVault(config.mcp.directory, config.mcp.key, config.mcp.connections);
let application: ReturnType<typeof createBackend>['application'];
const worker = createWorker({ ...config.worker, models, tools: async e => mcp.tools(application, e) }, store, methods, support);
const backend = createBackend({ ...persistence, identity, files, methods, workspace, runtime: worker.runtime, history: worker.history, mcp: mcp.gateway,
    configurationCatalog: { sources: Object.keys(config.methods.sources), connections: config.mcp.connections.map(c => c.id) } });
application = backend.application;
const runner = worker.runner(application);
const server = await listenConfiguredHttp(config, { application, credentials: mcp.credentials });
const running = new Map<string, Promise<void>>();
const blocked = new Map<string, string>();
let closing = false, scanning = false;

async function scan() {
    if (closing || scanning) return;
    scanning = true;
    try {
        for (const e of await store.executions()) {
            if (closing) break;
            if (running.has(e.id)) continue;
            if (e.phase === 'stopping') {
                try { await application.execution.requestCancellation(e.ownerId, e.id); await application.execution.confirmStopped(e.ownerId, e.id); }
                catch { /* Keep the durable stopping intent until exit is confirmed. */ }
                continue;
            }
            const pending = (await store.inputs(e.id)).filter(i => i.status === 'pending');
            if (e.phase !== 'new' && e.phase !== 'running' && !pending.length) continue;
            const signature = JSON.stringify([e.version, pending.map(i => i.id)]);
            if (blocked.get(e.id) === signature) continue;
            const user = await store.user(e.ownerId);
            if (!user.enabled) continue;
            // Creation and credential connection are separate HTTP calls. Wait for connection before starting.
            try {
                for (const connection of config.mcp.connections)
                    await vault.secret({ userId: user.id, executionId: e.id, connection: connection.id, issuer: user.issuer, subject: user.subject });
            } catch { continue; }
            const admitted = pending.map(i => i.id);
            const task = (async () => {
                console.info(JSON.stringify({ event: 'execution-running', executionId: e.id, sessionId: e.sessionId }));
                try {
                    const result = await runner.run(e.ownerId, e.id);
                    blocked.delete(e.id);
                    console.info(JSON.stringify({ event: 'execution-yielded', executionId: e.id, phase: result.phase, generation: result.generation }));
                } catch (error) {
                    const current = await store.execution(e.id);
                    const queued = (await store.inputs(e.id)).filter(i => i.status === 'pending');
                    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : 'runtime-error';
                    if (current.phase !== 'stopping' && !(current.phase === 'running' && ['blocked', 'conflict'].includes(code) && queued.some(i => !admitted.includes(i.id))))
                        blocked.set(e.id, JSON.stringify([current.version, queued.map(i => i.id)]));
                    console.error(JSON.stringify({ event: 'execution-paused', executionId: e.id, code, phase: current.phase }));
                }
            })().finally(() => { running.delete(e.id); });
            running.set(e.id, task);
        }
    } catch { console.error('Local development input scan failed; inspect local configuration'); }
    finally { scanning = false; }
}
const timer = setInterval(() => { void scan(); }, 500);
async function close() {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    const deadline = setTimeout(() => process.exit(1), 25_000).unref();
    await server.close();
    // Closing Pi preserves unfinished durable tasks; reopening uses the original Session.
    await worker.close();
    await Promise.allSettled([...running.values()]);
    await backend.dispose();
    persistence.close();
    clearTimeout(deadline);
}
process.once('SIGTERM', () => { void close(); });
process.once('SIGINT', () => { void close(); });
console.info(`Local development worker listening on ${config.server.host}:${config.server.port}; MCP and Decision Request continuation enabled; chat attachments unavailable`);
