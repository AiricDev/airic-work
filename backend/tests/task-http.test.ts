import { taskContract, validateContractExamples } from './support/task-contract';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { expect, it } from 'vitest';
import { TaskCredentialStore } from '../src/adapters/driven/mcp/task-credentials';
import { openSqliteDatabase } from '../src/adapters/driven/sqlite/database';
import { SqliteTaskInitializer } from '../src/adapters/driven/sqlite/task-initializer';
import { SqliteTaskRegistry, taskFingerprint } from '../src/adapters/driven/sqlite/task-registry';
import { createTaskServer } from '../src/adapters/driving/http/task-server';
import { TaskCreationUseCases } from '../src/application/task-creation';

it('validates the examples for the public OpenAPI contract', validateContractExamples);

it('authenticates task creation and returns the original receipt on retry', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'airic-task-http-'));
    const db = openSqliteDatabase(join(directory, 'registry.sqlite'));
    const credentials = new TaskCredentialStore(db, Buffer.alloc(32, 2), ['https://example.invalid/mcp'], {});
    const tasks = new TaskCreationUseCases(
        new SqliteTaskRegistry(db), new SqliteTaskInitializer(join(directory, 'tasks')),
        payload => taskFingerprint(Buffer.alloc(32, 1), payload), randomUUID, () => new Date().toISOString(), undefined, credentials,
    );
    const bearerToken = 'test-token-with-at-least-32-characters';
    const defaultOm = { source: 'local', revision: 'a'.repeat(40), entry: 'om.md' };
    const contract = taskContract();
    const server = createTaskServer(tasks, { bearerToken, scope: 'test', actor: 'engineer' }, undefined, undefined, credentials, undefined, async () => ({ source: 'local', kind: 'local', state: 'available', revision: 'a'.repeat(40) }), defaultOm);
    const request = {
        method: 'POST' as const,
        url: '/api/v1/tasks',
        headers: { authorization: `Bearer ${bearerToken}`, 'idempotency-key': 'create-one' },
        payload: {
            instruction: 'Review',
            connections: [{ id: 'business', endpoint: 'https://example.invalid/mcp', auth: { type: 'bearer', token: 'secret-initial' } }],
        },
    };
    try {
        expect((await contract.inject(server, { ...request, headers: {} })).statusCode).toBe(401);
        expect((await contract.inject(server, { url: '/api/v1/om/status' })).statusCode).toBe(401);
        expect((await contract.inject(server, { url: '/api/v1/om/status', headers: request.headers })).json())
            .toEqual({ source: 'local', kind: 'local', state: 'available', revision: 'a'.repeat(40) });
        const created = await contract.inject(server, request);
        expect(created.statusCode).toBe(201);
        expect(created.json()).toMatchObject({ phase: 'queued', pinnedOm: defaultOm });
        const firstOm = { ...defaultOm };
        defaultOm.revision = 'b'.repeat(40);
        expect((await contract.inject(server, request)).json()).toEqual(created.json());
        expect((await contract.inject(server, { ...request, payload: { ...request.payload, instruction: 'Other' } })).statusCode).toBe(409);
        const detail = await contract.inject(server, { url: created.headers.location as string, headers: request.headers });
        expect(detail.statusCode).toBe(200);
        const { taskId } = created.json();
        expect(detail.json().connections).toEqual([{ id: 'business', status: 'unchecked' }]);
        expect(detail.body).not.toContain('secret-initial');
        expect(JSON.stringify(tasks.get('test', 'engineer', taskId))).not.toContain('secret-initial');
        expect(credentials.read(taskId, 'business').token).toBe('secret-initial');
        const rotate = {
            method: 'PUT' as const, url: `/api/v1/tasks/${taskId}/connections/business/credential`,
            headers: { ...request.headers, 'idempotency-key': 'rotate' },
            payload: { type: 'bearer', token: 'secret-new' },
        };
        expect((await contract.inject(server, rotate)).statusCode).toBe(204);
        expect((await contract.inject(server, rotate)).statusCode).toBe(204);
        expect((await contract.inject(server, { ...rotate, payload: { ...rotate.payload, token: 'secret-conflict' } })).statusCode).toBe(409);
        expect((await contract.inject(server, request)).statusCode).toBe(201);
        expect(credentials.read(taskId, 'business').token).toBe('secret-new');
        expect((await contract.inject(server, {
            ...rotate, headers: { ...rotate.headers, 'idempotency-key': 'outside' },
            payload: { type: 'signed_endpoint', endpoint: 'https://outside.invalid/mcp' },
        })).statusCode).toBe(403);
        expect(detail.json()).toMatchObject({ taskId: created.json().taskId, requestedOm: firstOm, phase: 'queued' });
        contract.expectCoverage({ only: ['createTask', 'getTask', 'replaceConnectionCredential', 'getOmStatus'] });
    } finally {
        await server.close();
        db.close();
        rmSync(directory, { recursive: true, force: true });
    }
});
