import { resolve } from 'node:path';
import { createConfiguredBackend, loadConfiguration } from './bindings';
import { listenHttp } from './http';
import type { Workspace } from '../application/ports';
import { RuleError } from '../domain/model';

// A release preview must never substitute an in-memory workspace or claim tool exit.
const unavailableWorkspace: Workspace = {
    async ensure() { throw new RuleError('blocked', 'Production Workspace is not available in this preview'); },
    async materialize() { throw new RuleError('blocked', 'Production Workspace is not available in this preview'); },
    async stopped() { return false; },
};

async function main() {
    const config = loadConfiguration();
    if (!config.http) throw new Error('HTTP configuration required');
    const backend = await createConfiguredBackend(config, unavailableWorkspace);
    try {
        const server = await listenHttp({ ...config.http, application: backend.application, credentials: backend.credentials,
            publicDirectory: resolve(import.meta.dirname, '../../../frontend/dist') }, config.server);
        let closing = false;
        const close = async () => {
            if (closing) return;
            closing = true;
            const deadline = setTimeout(() => process.exit(1), 25_000).unref();
            try { await server.close(); await backend.close(); }
            catch { process.exitCode = 1; }
            finally { clearTimeout(deadline); }
        };
        process.once('SIGTERM', close);
        process.once('SIGINT', close);
        console.info('Airic Work control-plane preview listening; Agent execution unavailable');
    } catch (error) { await backend.close(); throw error; }
}

main().catch(error => {
    const variable = error instanceof Error ? /^Invalid configuration: (AIRIC_[A-Z0-9_]+(?:\/AIRIC_[A-Z0-9_]+)?)$/.exec(error.message)?.[1] : undefined;
    console.error(variable ? `Airic Work startup failed: check ${variable}` : 'Airic Work startup failed; verify configuration, build assets and data permissions');
    process.exitCode = 1;
});
