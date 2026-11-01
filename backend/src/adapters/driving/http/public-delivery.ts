import { readdir, readFile } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type { FastifyReply, FastifyRequest } from 'fastify';

/** Only immutable build artifacts are public; no filesystem paths come from requests. */
export async function publicDelivery(directory: string) {
    const files = new Map<string, Buffer>();
    async function load(path: string, prefix = '') {
        for (const entry of await readdir(path, { withFileTypes: true })) {
            if (entry.name.startsWith('.') || entry.isSymbolicLink()) throw new Error('Invalid public artifact');
            const name = `${prefix}/${entry.name}`;
            if (entry.isDirectory()) await load(join(path, entry.name), name);
            else if (entry.isFile()) files.set(name, await readFile(join(path, entry.name)));
        }
    }
    await load(directory);
    if (!files.has('/index.html')) throw new Error('Missing frontend build');
    const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.json': 'application/json' };
    return async (request: FastifyRequest, reply: FastifyReply): Promise<boolean> => {
        const path = request.url.split('?')[0];
        if (path === '/api' || path.startsWith('/api/')) return false;
        let decoded: string;
        try { decoded = decodeURIComponent(path); } catch { reply.code(404).send(); return true; }
        if (decoded.split('/').some(segment => segment.startsWith('.')) || decoded.includes('\\')) { reply.code(404).send(); return true; }
        if (!['GET', 'HEAD'].includes(request.method)) { reply.code(404).send(); return true; }
        if (path === '/healthz') {
            reply.send({ status: 'ok', scope: 'control-plane', agentExecution: 'unavailable' });
            return true;
        }
        const file = files.has(path) ? path : !extname(path) && request.headers.accept?.includes('text/html') ? '/index.html' : undefined;
        if (!file) { reply.code(404).send(); return true; }
        reply.type(types[extname(file)] ?? 'application/octet-stream');
        if (request.method === 'HEAD') reply.header('content-length', files.get(file)!.length).send();
        else reply.send(files.get(file));
        return true;
    };
}
