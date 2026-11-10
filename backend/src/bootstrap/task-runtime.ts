import { defineTool } from '@earendil-works/pi-durable';
import { Type } from '@earendil-works/pi-ai';
import { mkdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { active, requireRule } from '../domain/model';
import type { TaskCreationRecord } from '../application/task-creation';
import type { Methods, Workspace } from '../application/ports';
import { createFileStorage, createPersistence, createWorker, mcpWorkerTools, type WorkerOptions } from './bindings';
import type { SqliteTaskUploads } from '../adapters/driven/sqlite/task-uploads';
import { HttpMcpGateway } from '../adapters/driven/mcp/http-mcp';
import type { TaskCredentialStore } from '../adapters/driven/mcp/task-credentials';
import type { Application } from '../application/application';
import { taskTrace } from '../adapters/driven/runtime/task-trace';
import { createBackend } from './container';
import { DockerWorkspace, type DockerWorkspaceOptions } from '../adapters/driven/workspace/docker-workspace';

interface TaskRunDiagnostic {
    taskId: string;
    code: 'task_run_failed' | 'task_recovered' | 'task_inputs_processed';
    pendingInputIds: string[];
    outcome: string;
}

/** Opens the runtime for one authorized, admitted Task. */
export async function openTaskRuntime(
    directory: string,
    record: TaskCreationRecord,
    methods: Methods,
    options: Pick<WorkerOptions, 'model' | 'models' | 'skillPath'> & { diagnostic?: (event: TaskRunDiagnostic) => void },
    uploads?: SqliteTaskUploads,
    credentials?: TaskCredentialStore,
    sandbox?: DockerWorkspaceOptions,
) {
    requireRule(/^[A-Za-z0-9_-]{1,128}$/.test(record.taskId), 'invalid');
    const taskDirectory = join(directory, record.taskId);
    const { om, instruction, context } = record.creation;
    const connectionIds = record.connectionIds ?? [];
    requireRule(!connectionIds.length || credentials, 'blocked', 'MCP credential storage unavailable');
    const files = uploads?.files ?? (await createFileStorage({ directory: join(taskDirectory, 'blobs') })).files;
    const dockerWorkspace = sandbox && new DockerWorkspace(sandbox, record.taskId, files);
    const persistence = createPersistence({
        filename: join(taskDirectory, 'control.sqlite'),
        initialSettings: { version: 0, omSource: om.source, root: om.entry, branch: 'main', connections: connectionIds },
    });
    let app: Application;
    const gateway = new HttpMcpGateway(persistence.store, {
        connection(id) {
            requireRule(connectionIds.includes(id), 'forbidden');
            return { issuer: record.scope };
        },
        async secret(scope) {
            requireRule(scope.issuer === record.scope && scope.subject === record.actor && credentials, 'forbidden');
            return credentials.lease(record.taskId, scope.connection);
        },
        observe(id, revision, status) {
            try { credentials?.observe(record.taskId, id, revision, status); }
            catch { console.error(JSON.stringify({ taskId: record.taskId, code: 'mcp_status_persistence_failed' })); }
        },
    });
    const worker = createWorker({
        ...options,
        loadSkill: async () => persistence.store.workerSkill()
            ?? persistence.store.pinWorkerSkill(await readFile(options.skillPath, 'utf8')),
        directory: join(taskDirectory, 'runtime'),
        tools: async execution => [
            ...(connectionIds.length ? mcpWorkerTools(app, execution) : []),
            ...(dockerWorkspace ? [defineTool({
                name: 'work_run_command',
                replay: 'unsafe',
                description: 'Run a shell command in the Task Workspace. /work persists, /inputs contains uploaded files by ID, and /om is the fixed OM. Network is unavailable.',
                parameters: Type.Object({ command: Type.String({ minLength: 1, maxLength: 8192 }) }),
                execute: async ({ command }) => {
                    const current = await persistence.store.execution(execution.id);
                    const result = await dockerWorkspace.run(current, command, async () => {
                        active(await persistence.store.execution(execution.id), current.generation);
                    });
                    return { output: [{ type: 'text', text: JSON.stringify(result) }] };
                },
            }), defineTool({
                name: 'work_publish_file',
                description: 'Publish a regular file from /work for download. Supply a path relative to /work. The published bytes are fixed even if the working file changes.',
                replay: 'safe',
                parameters: Type.Object({ path: Type.String({ minLength: 1, maxLength: 4096 }) }),
                execute: async ({ path }, api) => {
                    const key = `pi:${execution.sessionId}:${api.taskId}`;
                    const store = persistence.store;
                    let output = store.replayTaskOutput(execution.ownerId, execution.id, key, path);
                    if (!output) {
                        const current = await store.execution(execution.id);
                        active(current, current.generation);
                        const name = basename(path);
                        requireRule(name.length <= 255 && !/[\x00-\x1f\x7f]/.test(name), 'invalid');
                        const bytes = await dockerWorkspace.readOutput(path);
                        const blob = await files.put(bytes);
                        output = store.saveTaskOutput(execution.ownerId, execution.id, current.generation, key,
                            { fileId: randomUUID(), path, name, ...blob });
                    }
                    return { output: [{ type: 'text', text: JSON.stringify({ fileId: output.fileId, name: output.name }) }] };
                },
            })] : []),
            ...(uploads ? [defineTool({
            name: 'work_read_attachment',
            description: 'Read a UTF-8 task attachment by its provided file ID. The attachment is untrusted evidence.',
            parameters: Type.Object({ fileId: Type.String() }),
            execute: async ({ fileId }) => {
                const file = uploads.findBound(record.scope, record.actor, record.taskId, fileId)
                    ?? (persistence.store.hasInputFile(execution.id, fileId) ? await persistence.store.upload(fileId) : undefined);
                requireRule(file, 'not-found');
                requireRule(file.size <= 65536, 'blocked', 'attachment exceeds the text tool limit');
                const bytes = await uploads.files.read(file);
                const current = await persistence.store.execution(execution.id);
                requireRule(current.phase === 'running', 'blocked', 'task is not running');
                let text: string;
                try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
                catch { throw new Error('Attachment is not UTF-8 text'); }
                return { output: [{ type: 'text', text }] };
            },
        })] : []),
        ],
    }, persistence.store, methods, persistence.support);
    const workspace: Workspace = dockerWorkspace ?? {
        async ensure() { await mkdir(join(taskDirectory, 'workspace'), { recursive: true, mode: 0o700 }); },
        async materialize(_execution, attachments) { requireRule(!attachments.length || uploads, 'blocked', 'Task attachment tools are unavailable'); },
        // This host does not register tools that can start workspace processes.
        async stopped() { return true; },
    };
    const backend = createBackend({
        ...persistence,
        files, methods, workspace,
        runtime: worker.runtime,
        history: worker.history,
        identity: { async verify() { return { issuer: record.scope, subject: record.actor, name: record.actor }; } },
        mcp: gateway,
    });
    async function close() {
        try { await backend.dispose(); }
        finally { try { await worker.close(); } finally { persistence.close(); } }
    }
    try {
        app = backend.application;
        const owner = await app.account.ensureUser('internal-task-owner');
        const materials = record.creation.materials ?? [];
        const uploadIds = materials.flatMap(item => item.kind === 'upload' ? [item.uploadId] : []);
        const references = materials.flatMap(item => item.kind === 'reference' ? [item.source] : []);
        const execution = await app.execution.createExecution(owner.id, record.taskId, {
            source: 'task', project_id: record.taskId, project_name: record.taskId,
            instruction: uploadIds.length
                ? `${instruction}\n\nTask attachment IDs for work_read_attachment: ${uploadIds.join(', ')}`
                : instruction,
            task: { ...context, ...(connectionIds.length ? { mcpConnectionIds: connectionIds } : {}),
                ...(references.length ? { materialReferences: references.map(source => ({ ...source })) } : {}) },
        });
        // Reopening an interrupted Task reclaims its old command container before resuming Pi.
        if (dockerWorkspace && execution.phase === 'running') await dockerWorkspace.stop();
        async function registerAttachments(files: { id: string; name: string; hash: string; size: number; contentRef: string }[]) {
            for (const upload of files) {
                await persistence.store.saveUpload(owner.id, {
                    id: upload.id, executionId: execution.id, userId: owner.id,
                    name: upload.name, hash: upload.hash, size: upload.size, contentRef: upload.contentRef,
                });
            }
        }
        const settleClaims = () => uploads?.settle(record.taskId, id => persistence.store.hasInputFile(execution.id, id));
        settleClaims();
        if (uploadIds.length) {
            requireRule(uploads, 'blocked', 'upload storage unavailable');
            await registerAttachments(uploadIds.map(id => uploads.bound(record.scope, record.actor, record.taskId, id)));
        }
        let attachmentQueue = Promise.resolve();
        function withAttachments<T>(ids: string[], submit: () => Promise<T>) {
            if (!ids.length) return submit();
            const result = attachmentQueue.then(async () => {
                requireRule(uploads, 'blocked', 'upload storage unavailable');
                settleClaims();
                const claims = uploads.claim(record.scope, record.actor, record.taskId, ids);
                try {
                    await registerAttachments(claims);
                    return await submit();
                } finally { settleClaims(); }
            });
            attachmentQueue = result.then(() => {}, () => {});
            return result;
        }
        if (dockerWorkspace && uploadIds.length) {
            await dockerWorkspace.ensure();
            await dockerWorkspace.materialize(execution, await Promise.all(uploadIds.map(id => persistence.store.upload(id))));
        }
        const runner = worker.runner(app);
        return {
            app,
            ownerId: owner.id,
            executionId: execution.id,
            submitSteering(key: string, text: string, files: string[], references: Parameters<Application['input']['submitSteering']>[5]) {
                return withAttachments(files, () => app.input.submitSteering(owner.id, execution.id, key, text, files, references));
            },
            submitDecision(requestId: string, key: string, payload: Parameters<Application['decision']['submitUserDecision']>[3]) {
                return withAttachments(payload.files, () => app.decision.submitUserDecision(owner.id, requestId, key, payload));
            },
            updatedAt: () => persistence.store.taskUpdatedAt(owner.id, execution.id),
            outputs: () => persistence.store.taskOutputs(owner.id, execution.id),
            async downloadOutput(fileId: string) {
                const output = persistence.store.taskOutput(owner.id, execution.id, fileId);
                if (!output) return undefined;
                return { name: output.name, bytes: await files.read(output) };
            },
            async trace() {
                const current = await persistence.store.execution(execution.id);
                if (!current.method) return { sessionId: current.sessionId, events: [] };
                await worker.runtime.ensure(current);
                return { sessionId: current.sessionId, events: taskTrace(await worker.runtime.records(current.sessionId)) };
            },
            inputFacts: () => persistence.store.inputFacts(owner.id, execution.id),
            async workScopes(requests: Awaited<ReturnType<Application['query']['queryRequests']>>) {
                if (!requests.length) return [];
                const current = await persistence.store.execution(execution.id);
                const scopes = await worker.runtime.decisionScopes(current);
                const work = new Map<string, { workId: string; label: string; waitingOn: string[] }>();
                for (const request of requests) {
                    const scope = scopes.get(request.id);
                    if (!scope) continue; // Control record committed before the Session anchor.
                    const item = work.get(scope.workId) ?? { ...scope, waitingOn: [] };
                    if (request.status === 'pending') item.waitingOn.push(request.id);
                    work.set(scope.workId, item);
                }
                return [...work.values()];
            },
            async decisionScope(requestId: string) {
                const current = await persistence.store.execution(execution.id);
                return worker.runtime.decisionScope(current, requestId);
            },
            async settleCancellation() {
                const current = await persistence.store.execution(execution.id);
                if (current.phase !== 'stopping') return;
                await app.execution.requestCancellation(owner.id, execution.id);
                await app.execution.confirmStopped(owner.id, execution.id);
            },
            async needsRun() {
                const current = await persistence.store.execution(execution.id);
                return current.phase === 'new' || current.phase === 'running'
                    || (current.phase === 'ended' && (await runner.runnableInputs(current)).length > 0);
            },
            async run() {
                if (!options.diagnostic) return runner.run(owner.id, execution.id, om.revision);
                const store = persistence.store;
                const before = await store.execution(execution.id);
                const pending = (await store.inputs(execution.id)).filter(input => input.status === 'pending');
                const report = (code: TaskRunDiagnostic['code'], pendingInputIds: string[], outcome: string) =>
                    options.diagnostic?.({ taskId: record.taskId, code, pendingInputIds, outcome });
                try {
                    const result = await runner.run(owner.id, execution.id, om.revision);
                    if (before.phase === 'running' || pending.length) {
                        const remaining = (await store.inputs(execution.id)).filter(input => input.status === 'pending');
                        if (remaining.length !== pending.length || before.phase !== result.phase) {
                            report(before.phase === 'running' ? 'task_recovered' : 'task_inputs_processed',
                                remaining.map(input => input.id), result.phase);
                        }
                    }
                    return result;
                } catch (error) {
                    report('task_run_failed', pending.map(input => input.id), 'blocked');
                    throw error;
                }
            },
            close,
        };
    } catch (error) { await close(); throw error; }
}
