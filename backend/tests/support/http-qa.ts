/** Contract QA only: real HTTP/TLS identity, SQLite, Blob and Git; Runtime/Workspace are explicit test doubles.
 * Never use this host, its synthetic accounts, or its control fixtures in a deployment.
 */
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createBackend } from '../../src/bootstrap/container';
import { createAccountMaintenance, createFileStorage, createIdentity, createMethods, createPersistence } from '../../src/bootstrap/bindings';
import { createHttpServer } from '../../src/adapters/driving/http/server';
import { httpsIdentityFixture } from './https-identity';
import { harness } from './harness';
import { configuration, options, repository } from './git-methods';

const directory = await mkdtemp(join(tmpdir(), 'airic-browser-qa-'));
const identityServer = await httpsIdentityFixture();
identityServer.handler = (req, res) => {
    identityServer.received.length = 0;
    const subject = req.headers.authorization === 'Bearer qa-owner' ? 'qa-owner' : req.headers.authorization === 'Bearer qa-other' ? 'qa-other' : undefined;
    if (!subject) { res.writeHead(401); res.end(); return; }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ sub: subject, name: subject === 'qa-owner' ? 'QA Owner' : 'QA Other' }));
};
const source = await repository(directory);
const methodOptions = options(directory, source);
methodOptions.sources = { repo: { kind: 'local', directory: source } };
const persistence = createPersistence({ filename: join(directory, 'control.sqlite'), initialSettings: configuration });
const { methods } = await createMethods(methodOptions);
const { files } = await createFileStorage({ directory: join(directory, 'blobs') });
const { identity } = createIdentity(identityServer.options);
const backend = createBackend({ ...harness().d, ...persistence, methods, files, identity, configurationCatalog: { sources: ['repo'], connections: [] } });
const owner = await backend.application.account.ensureUser('qa-owner');
const maintenance = createAccountMaintenance(join(directory, 'control.sqlite'));
try { await maintenance.administration.grantAdministrator(owner.id); } finally { maintenance.close(); }
const execution = await backend.application.execution.createExecution(owner.id, 'qa-create', { source: 'business', project_id: 'qa-project', project_name: 'QA Project', task: { scope: 'contract QA' }, instruction: 'Verify HTTP and workbench contracts; no real Agent is running.' });
await backend.application.execution.prepareExecution(owner.id, execution.id);
const start = (await persistence.store.inputs(execution.id))[0];
await backend.application.input.dispatchInput(owner.id, start.id);
const running = await persistence.store.execution(execution.id);
await backend.application.decision.createDecisionRequest(owner.id, execution.id, running.generation, 'qa-question', 'Is the contract evidence sufficient?', [{ id: 'yes', label: 'Within the stated scope', description: 'This is a contract test, not proof of real Agent execution.' }], { revision: 1, content: { scope: 'HTTP / UI contract test', limits: 'Runtime and Workspace are test doubles.' }, sources: [] });
const port = Number(process.env.AIRIC_QA_PORT ?? 8018);
const origin = process.env.AIRIC_QA_ORIGIN ?? 'http://127.0.0.1:5187';
const server = await createHttpServer({ application: backend.application, source: 'business', origins: [origin], secureCookies: false, streamIntervalMs: 500 });
let closing = false;
async function close() {
    if (closing) return;
    closing = true;
    try { await server.close(); await backend.dispose(); persistence.close(); await identityServer.close(); }
    finally { await rm(directory, { recursive: true, force: true }); }
}
process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());
try { await server.listen({ host: '127.0.0.1', port }); console.log(`Contract QA host ready on loopback port ${port}`); }
catch (error) { await close(); throw error; }
