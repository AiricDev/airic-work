import { createHttpServer, type HttpOptions } from '../adapters/driving/http/server';
import type { BootstrapConfiguration } from './bindings';
import { requireRule } from '../domain/model';

/** Does not manufacture Workspace, start dispatch loops, or own injected backend resources. */
export { createHttpServer };
export type { HttpOptions };
export async function listenHttp(options: HttpOptions, address: { host: string; port: number }) {
    const server = await createHttpServer(options);
    try { await server.listen(address); return server; }
    catch (error) { await server.close(); throw error; }
}
export async function listenConfiguredHttp(config: BootstrapConfiguration, backend: Pick<HttpOptions, 'application' | 'credentials'>) {
    requireRule(config.http, 'blocked', 'HTTP configuration required');
    return listenHttp({ ...config.http, ...backend }, config.server);
}
