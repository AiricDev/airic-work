import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createHttpServer } from '../src/adapters/driving/http/server';
import { harness } from './support/harness';

it('serves only public build artifacts and HTML deep links without bypassing API authentication', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'airic-public-'));
    await mkdir(join(directory, 'assets'));
    await writeFile(join(directory, 'index.html'), '<html>workbench</html>');
    await writeFile(join(directory, 'assets/app.js'), 'console.log("workbench")');
    const server = await createHttpServer({ application: harness().app, source: 'business', origins: ['https://work.example'], publicDirectory: directory });
    try {
        for (const url of ['/', '/projects/p/executions/e']) {
            const response = await server.inject({ url, headers: { accept: 'text/html' } });
            expect(response.statusCode).toBe(200);
            expect(response.headers['content-type']).toContain('text/html');
            expect(response.body).toBe('<html>workbench</html>');
        }
        expect((await server.inject('/assets/app.js')).headers['content-type']).toContain('text/javascript');
        expect((await server.inject({ method: 'HEAD', url: '/assets/app.js' })).body).toBe('');
        expect((await server.inject('/healthz')).json()).toEqual({ status: 'ok', scope: 'control-plane', agentExecution: 'unavailable' });
        expect((await server.inject('/api/v1/me')).statusCode).toBe(401);
        for (const url of ['/api/v1/missing', '/api', '/api/healthz', '/.env', '/assets/missing.js', '/%2e%2e/.env']) {
            const response = await server.inject({ url, headers: { accept: 'text/html' } });
            expect(response.statusCode, url).toBe(404);
            expect(response.body).not.toContain('<html>');
        }
        expect((await server.inject({ method: 'POST', url: '/', payload: {} })).statusCode).toBe(404);
    } finally { await server.close(); await rm(directory, { recursive: true, force: true }); }
});
