import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { createBackend } from '../src/bootstrap/container';
import { createFileStorage, createPersistence } from '../src/bootstrap/bindings';
import { createHttpServer } from '../src/adapters/driving/http/server';
import { harness } from './support/harness';

it('saves and downloads fixed bytes through HTTP with real SQLite and Blob adapters, preserving identity scope across reopen', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'airic-http-storage-'));
    const settings = { version: 0, omSource: 'repo', branch: 'main', root: 'om.md', connections: [] };
    const filename = join(directory, 'control.sqlite');
    const persistence = createPersistence({ filename, initialSettings: settings });
    const { files } = await createFileStorage({ directory: join(directory, 'blobs') });
    const h = harness();
    const backend = createBackend({ ...h.d, ...persistence, files });
    const server = await createHttpServer({ application: backend.application, source: 'business', origins: ['https://work.example'], uploadBytes: 1024 });
    const headers = { authorization: 'Bearer owner' };
    try {
        const created = await server.inject({ method: 'POST', url: '/api/v1/executions', headers: { ...headers, 'idempotency-key': 'create' }, payload: { project_id: 'p', project_name: 'P', task: {}, instruction: 'Check' } });
        expect(created.statusCode).toBe(200);
        const e = created.json();
        const bytes = Buffer.from([0, 255, 128, 65]);
        const multipart = (names: string[]) => Buffer.concat(names.flatMap(name => [Buffer.from(`--boundary\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/octet-stream\r\n\r\n`), bytes, Buffer.from('\r\n')]).concat([Buffer.from('--boundary--\r\n')]));
        const upload = await server.inject({ method: 'POST', url: `/api/v1/executions/${e.id}/uploads`, headers: { ...headers, 'content-type': 'multipart/form-data; boundary=boundary' }, payload: multipart(['test.bin']) });
        expect(upload.statusCode).toBe(200);
        const file = upload.json();
        expect(file.size).toBe(bytes.length);
        expect(file).not.toHaveProperty('contentRef');
        const download = await server.inject({ url: `/api/v1/input-files/${file.id}/content`, headers });
        expect(download.statusCode).toBe(200); expect(download.rawPayload).toEqual(bytes);
        expect(download.headers['content-disposition']).toContain('attachment');
        expect((await server.inject({ url: `/api/v1/input-files/${file.id}/content`, headers: { authorization: 'Bearer other' } })).statusCode).toBe(404);
        const multiple = await server.inject({ method: 'POST', url: `/api/v1/executions/${e.id}/uploads`, headers: { ...headers, 'content-type': 'multipart/form-data; boundary=boundary' }, payload: multipart(['one.bin', 'two.bin']) });
        expect(multiple.statusCode).toBeGreaterThanOrEqual(400);
        const response = await server.inject({ method: 'POST', url: `/api/v1/executions/${e.id}/steering`, headers: { ...headers, 'idempotency-key': 'message' }, payload: { text: 'Read file', files: [file.id] } });
        expect(response.statusCode).toBe(200);
        expect((await backend.application.query.queryInputs(e.ownerId, e.id))[0].status).toBe('pending');
        const reopened = createPersistence({ filename, initialSettings: settings });
        try { expect((await reopened.store.upload(file.id)).hash).toBe(file.hash); expect((await reopened.store.inputs(e.id))).toHaveLength(1); }
        finally { reopened.close(); }
    } finally { await server.close(); await backend.dispose(); persistence.close(); await rm(directory, { recursive: true, force: true }); }
});
