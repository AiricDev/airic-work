import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { TaskCredentialStore } from '../adapters/driven/mcp/task-credentials';
import { resolve } from 'node:path';
import { openSqliteDatabase } from '../adapters/driven/sqlite/database';
import { SqliteTaskInitializer } from '../adapters/driven/sqlite/task-initializer';
import { SqliteTaskRegistry } from '../adapters/driven/sqlite/task-registry';
import { createTaskServer } from '../adapters/driving/http/task-server';
import { SqliteTaskUploads } from '../adapters/driven/sqlite/task-uploads';
import { createConfiguredModels, createMethods, createFileStorage, loadTaskWorkerConfiguration } from './bindings';
import { TaskDispatcher } from './task-dispatcher';
import { openTaskRuntime } from './task-runtime';
import { TaskCreationUseCases } from '../application/task-creation';

async function main() {
    const { AIRIC_TASK_DATA, AIRIC_SECRET_KEY } = process.env;
    const host = process.env.AIRIC_TASK_HOST ?? '127.0.0.1';
    const port = Number(process.env.AIRIC_TASK_PORT ?? 8080);
    if (!AIRIC_TASK_DATA || !AIRIC_SECRET_KEY
        || !Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Invalid Task HTTP configuration');
    }
    const directory = resolve(AIRIC_TASK_DATA);
    const db = openSqliteDatabase(resolve(directory, 'registry.sqlite'));
    let ownership: ReturnType<typeof openSqliteDatabase> | undefined;
    try {
        ownership = openSqliteDatabase(resolve(directory, 'instance-ownership.sqlite'));
        ownership.exec('PRAGMA busy_timeout = 0; BEGIN IMMEDIATE');
        const { files } = await createFileStorage({ directory: resolve(directory, 'uploads') });
        const uploads = new SqliteTaskUploads(db, files);
        const credentials = new TaskCredentialStore(
            db,
            z.array(z.string()).parse(JSON.parse(process.env.AIRIC_TASK_MCP_ALLOWLIST ?? '[]')),
            z.record(z.string(), z.string()).parse(JSON.parse(process.env.AIRIC_TASK_MCP_SECRETS ?? '{}')),
        );
        const tasks = new TaskCreationUseCases(
            new SqliteTaskRegistry(db),
            new SqliteTaskInitializer(resolve(directory, 'tasks')),
            randomUUID,
            () => new Date().toISOString(),
            (scope, actor, taskId, ids) => uploads.bind(scope, actor, taskId, ids),
            credentials,
        );
        let dispatcher: TaskDispatcher | undefined;
        let omStatus: Parameters<typeof createTaskServer>[5];
        const config = loadTaskWorkerConfiguration(directory);
        const { methods } = await createMethods(config.methods);
        const pinned = await methods.pinHead('local', process.env.AIRIC_OM_ENTRY ?? 'om.md');
        const defaultOm = { source: pinned.source, revision: pinned.sha, entry: pinned.root };
        omStatus = async () => ({ source: pinned.source,
            kind: (await methods.headStatus('local')).kind, state: 'available', revision: pinned.sha });
        if (process.env.AIRIC_TASK_WORKER === '1') {
            const models = await createConfiguredModels(config);
            const hostDirectory = process.env.AIRIC_WORKSPACE_HOST_DATA;
            const sandbox = hostDirectory ? {
                socketPath: process.env.AIRIC_WORKSPACE_DOCKER_SOCKET ?? '/var/run/docker.sock',
                image: process.env.AIRIC_WORKSPACE_IMAGE ?? 'airic-work:task',
                dataDirectory: directory,
                hostDirectory,
                user: `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
                methodDirectory: methods.runtimeDirectory.bind(methods),
            } : undefined;
            dispatcher = new TaskDispatcher(
                () => tasks.list(),
                record => openTaskRuntime(resolve(directory, 'tasks'), record, methods, {
                    ...config.worker, models, diagnostic: event => console.log(JSON.stringify(event)),
                }, uploads, credentials, sandbox),
                taskId => console.error(JSON.stringify({ taskId, code: 'task_worker_failed' })),
            );
        }
        const server = createTaskServer(tasks, AIRIC_SECRET_KEY, dispatcher, uploads, credentials, omStatus, defaultOm);
        const tick = () => { void dispatcher?.pump().catch(() => console.error('Unable to scan Task registry')); };
        const timer = dispatcher ? setInterval(tick, 1000).unref() : undefined;
        server.addHook('onClose', async () => {
            clearInterval(timer);
            try { await dispatcher?.close(); } finally { ownership?.close(); db.close(); }
        });
        try { await server.listen({ host, port }); }
        catch (error) { await server.close(); throw error; }
        tick();
        const close = () => { void server.close().catch(() => { process.exitCode = 1; }); };
        process.once('SIGINT', close);
        process.once('SIGTERM', close);
        console.log(`Task HTTP listening on ${host}:${port}`);
    } catch (error) {
        if (ownership?.open) ownership.close();
        if (db.open) db.close();
        throw error;
    }
}

void main().catch(() => {
    console.error('Unable to start Task HTTP');
    process.exitCode = 1;
});
