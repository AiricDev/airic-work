import { registerTaskDocs } from './task-docs';
import Fastify, { type FastifyRequest } from 'fastify';
import { taskAuthenticator, type TaskActor, type TaskDelegation } from './task-auth';
import multipart from '@fastify/multipart';
import type { TaskCredentialStore } from '../../driven/mcp/task-credentials';
import type { SqliteTaskUploads } from '../../driven/sqlite/task-uploads';
import { z, ZodError } from 'zod';
import type { TaskDispatcher } from '../../../bootstrap/task-dispatcher';
import type { TaskCreationRecord, TaskCreationUseCases } from '../../../application/task-creation';
import { requireRule, RuleError, type Context, type DecisionRequest, type Execution } from '../../../domain/model';

const text = z.string().trim().min(1);
const externalRef = z.strictObject({ system: text, kind: text, id: text });
const paging = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().regex(/^\d{1,9}$/).optional(),
});
const listQuery = paging.extend({
    'externalRef[system]': text.optional(),
    'externalRef[kind]': text.optional(),
    'externalRef[id]': text.optional(),
});
function paginate<T>(items: T[], query: z.infer<typeof paging>) {
    const start = Number(query.cursor ?? 0);
    const page = items.slice(start, start + query.limit);
    return { items: page, ...(start + page.length < items.length ? { nextCursor: String(start + page.length) } : {}) };
}
function summary(record: TaskCreationRecord, item: DecisionRequest) {
    return {
        requestId: item.id, taskId: record.taskId, status: item.status,
        title: item.summary ?? item.question, createdAt: item.createdAt, externalRefs: record.creation.externalRefs ?? [],
    };
}
function decisionContext(decision: DecisionRequest, context: Context, scope: { workId: string; label: string }) {
    return {
        revision: context.revision, question: decision.question, reason: scope.label,
        evidence: typeof context.content === 'string' ? context.content : JSON.stringify(context.content),
        sources: context.sources.map(source => ({
            object: { system: source.system, kind: 'record', id: source.objectId },
            revision: source.version, location: source.location,
        })),
        affectedWork: [{ ...scope, waitingOn: decision.status === 'pending' ? [decision.id] : [] }],
        options: decision.options.map(option => ({ optionId: option.id, label: option.label, impact: option.description })),
    };
}
function stopReceipt(taskId: string, execution?: Execution) {
    if (!execution?.stopRequestedAt) return null;
    return {
        taskId, state: execution.phase === 'stopped' ? 'confirmed' : 'accepted',
        requestedAt: execution.stopRequestedAt, confirmedAt: execution.stopConfirmedAt,
    };
}
const materials = z.array(z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('upload'), uploadId: z.uuid() }),
    z.strictObject({ kind: z.literal('reference'), source: z.object({
        object: externalRef, revision: z.string().optional(), location: z.string().optional(), label: z.string().optional(),
    }) }),
])).max(32);

function splitMaterials(attachments: z.infer<typeof materials> = []) {
    return {
        files: attachments.flatMap(item => item.kind === 'upload' ? [item.uploadId] : []),
        references: attachments.flatMap(item => item.kind === 'reference' ? [item.source] : []),
    };
}
const createAuth = z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('none') }),
    z.strictObject({ type: z.literal('bearer'), token: text }),
    z.strictObject({ type: z.literal('secret_ref'), ref: text }),
]);
const replacementAuth = z.union([createAuth, z.strictObject({ type: z.literal('signed_endpoint'), endpoint: text })]);
const body = z.strictObject({
    connections: z.array(z.strictObject({ id: text, endpoint: text, auth: createAuth.optional() })).max(32).optional(),
    materials: materials.optional(),
    instruction: z.string().refine(value => value.trim().length > 0),
    externalRefs: z.array(externalRef).optional(),
});
const key = z.string().min(1).max(200);
const params = z.strictObject({ taskId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/) });
export function createTaskServer(
    tasks: TaskCreationUseCases,
    identity: { bearerToken: string; scope: string; actor: string },
    dispatcher?: TaskDispatcher,
    uploads?: SqliteTaskUploads,
    credentials?: TaskCredentialStore,
    integration?: TaskDelegation,
    omStatus?: () => Promise<{ source: string; kind: 'local' | 'managed'; state: string; revision?: string }>,
    defaultOm?: { source: string; revision: string; entry: string },
) {
    const authenticate = taskAuthenticator(identity, integration);
    const actors = new WeakMap<FastifyRequest, TaskActor>();
    function actorOf(request: FastifyRequest) {
        const actor = actors.get(request);
        requireRule(actor, 'forbidden');
        return actor;
    }
    const server = Fastify({ logger: false, bodyLimit: 1024 * 1024 });
    server.addHook('onRequest', async (request, reply) => {
        reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
        const config = request.routeOptions.config;
        if ('publicTaskEndpoint' in config && config.publicTaskEndpoint === true) return;
        const actor = authenticate(request.headers.authorization, request.headers['x-airic-actor-assertion']);
        if (!actor) return reply.header('WWW-Authenticate', 'Bearer').code(401).send({
            code: 'invalid_identity', message: 'Invalid credentials', retryable: false,
        });
        actors.set(request, actor);
    });
    server.get('/healthz', { config: { publicTaskEndpoint: true } }, () => ({ status: 'ok' }));
    registerTaskDocs(server);
    server.get('/api/v1/om/status', async () => {
        requireRule(omStatus, 'blocked');
        return omStatus();
    });
    server.setErrorHandler((error, request, reply) => {
        const code = error instanceof RuleError ? error.code : undefined;
        if (error instanceof RuleError && code === 'conflict') {
            const reason = error.message === 'task_stopped' || error.message === 'decision_already_answered' ? error.message : 'idempotency_conflict';
            return reply.code(409).send({
                code: reason,
                message: reason === 'task_stopped' ? 'Task was stopped'
                    : reason === 'decision_already_answered' ? 'Specify the answer to supplement or correct' : 'Conflicting request', retryable: false,
            });
        }
        if (error instanceof RuleError && code === 'invalid' && error.message === 'unknown reading version') {
            return reply.code(409).send({ code: 'context_revision_unknown', message: 'Decision context revision is unavailable', retryable: false });
        }
        if (code === 'forbidden') return reply.code(403).send({ code: 'forbidden', message: 'Operation is not authorized', retryable: false });
        if (code === 'not-found') return reply.code(404).send({ code: 'not_found', message: 'Task not found', retryable: false });
        const transportStatus = error instanceof Error && 'statusCode' in error
            && typeof error.statusCode === 'number' ? error.statusCode : undefined;
        const status = error instanceof ZodError || code === 'invalid' ? 400 : transportStatus;
        if (status === 413 && request.routeOptions.url === '/api/v1/uploads') {
            return reply.code(413).send({ code: 'file_too_large', message: 'Upload exceeds the size limit', retryable: false });
        }
        if (status && status >= 400 && status < 500)
            return reply.code(status).send({ code: 'invalid_input', message: 'Invalid request', retryable: false });
        return reply.code(503).send({ code: 'temporarily_unavailable', message: 'Task service unavailable', retryable: true });
    });
    if (uploads) {
        server.register(multipart, { limits: { files: 1, fields: 0, fileSize: 10 * 1024 * 1024 } });
        server.post('/api/v1/uploads', async (request, reply) => {
            const commandKey = key.parse(request.headers['idempotency-key']);
            let file: { name: string; bytes: Buffer } | undefined;
            for await (const part of request.parts()) {
                requireRule(part.type === 'file' && part.fieldname === 'file' && !file, 'invalid');
                file = { name: part.filename, bytes: await part.toBuffer() };
            }
            requireRule(file, 'invalid');
            const upload = await uploads.stage(actorOf(request).scope, actorOf(request).actor, commandKey, file.name, file.bytes);
            return reply.code(201).send({
                uploadId: upload.id, name: upload.name, sizeBytes: upload.size,
                sha256: upload.hash, expiresAt: upload.expiresAt,
            });
        });
        server.get('/api/v1/tasks/:taskId/files/:fileId', async (request, reply) => {
            const { taskId, fileId } = params.extend({ fileId: z.uuid() }).parse(request.params);
            const actor = actorOf(request);
            const record = tasks.get(actor.scope, actor.actor, taskId);
            let upload = uploads.findBound(actor.scope, actor.actor, taskId, fileId);
            const runtime = !upload ? await dispatcher?.runtime(record) : undefined;
            upload ??= uploads.findBound(actor.scope, actor.actor, taskId, fileId);
            const output = upload ? { name: upload.name, bytes: await uploads.files.read(upload) }
                : await runtime?.downloadOutput(fileId);
            requireRule(output, 'not-found');
            const name = encodeURIComponent(output.name).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16));
            return reply.type('application/octet-stream')
                .header('Content-Disposition', `attachment; filename*=UTF-8''${name}`).send(Buffer.from(output.bytes));
        });
    }
    if (credentials) {
        server.put('/api/v1/tasks/:taskId/connections/:connectionId/credential', (request, reply) => {
            const { taskId, connectionId } = params.extend({ connectionId: text }).parse(request.params);
            const record = tasks.get(actorOf(request).scope, actorOf(request).actor, taskId);
            requireRule(record.connectionIds?.includes(connectionId), 'not-found');
            credentials.replace(taskId, connectionId, key.parse(request.headers['idempotency-key']), replacementAuth.parse(request.body));
            return reply.code(204).send();
        });
    }
    server.post('/api/v1/tasks', (request, reply) => {
        const { connections, ...creation } = body.parse(request.body);
        requireRule(defaultOm, 'blocked', 'OM unavailable');
        const record = tasks.create(actorOf(request).scope, actorOf(request).actor, key.parse(request.headers['idempotency-key']),
            { ...creation, om: defaultOm }, connections, creation);
        const { source, revision, entry } = record.creation.om;
        return reply.code(201).header('Location', `/api/v1/tasks/${record.taskId}`).send({
            taskId: record.taskId, acceptedAt: record.acceptedAt, phase: 'queued', pinnedOm: { source, revision, entry },
        });
    });
    const visibleTasks = (actor: TaskActor) => tasks.list(actor.scope, actor.actor).reverse();
    function filteredTasks(actor: TaskActor, query: z.infer<typeof listQuery>) {
        const system = query['externalRef[system]'];
        const kind = query['externalRef[kind]'];
        const id = query['externalRef[id]'];
        if (system === undefined && kind === undefined && id === undefined) return visibleTasks(actor);
        const ref = externalRef.parse({ system, kind, id });
        return visibleTasks(actor).filter(record => record.creation.externalRefs?.some(
            value => value.system === ref.system && value.kind === ref.kind && value.id === ref.id,
        ));
    }
    async function projectTask(record: TaskCreationRecord) {
        const runtime = await dispatcher?.runtime(record).catch(error => {
            if (!dispatcher.blocked(record.taskId)) throw error;
            return undefined;
        });
        const execution = runtime && await runtime.app.query.queryExecution(runtime.ownerId, runtime.executionId);
        const requests = runtime ? await runtime.app.query.queryRequests(runtime.ownerId, runtime.executionId) : [];
        const pending = requests.filter(item => item.status === 'pending').length;
        const stop = stopReceipt(record.taskId, execution);
        const activity = runtime?.updatedAt();
        const phase = stop ? 'ended' : dispatcher?.blocked(record.taskId) ? 'blocked'
            : execution?.phase === 'ended' && pending ? 'waiting'
            : !execution || execution.phase === 'new' ? 'queued' : execution.phase;
        return {
            taskId: record.taskId,
            ...(execution ? { sessionId: execution.sessionId } : {}),
            ...(execution?.method ? { pinnedOm: {
                source: execution.method.source,
                resolvedRevision: execution.method.sha,
                entry: execution.method.root,
                workerSkillVersion: execution.method.skillVersion,
            } } : {}),
            createdAt: record.acceptedAt,
            updatedAt: activity && Date.parse(activity) > Date.parse(record.acceptedAt) ? activity : record.acceptedAt,
            phase,
            stop,
            externalRefs: record.creation.externalRefs ?? [],
            pendingRequestCount: pending,
            instruction: record.creation.instruction,
            requestedOm: record.creation.om,
            blockers: phase === 'blocked' ? [{ code: 'task_worker_failed', message: 'Task Worker could not continue' }] : [],
            work: await runtime?.workScopes(requests) ?? [],
            outputs: runtime?.outputs().map(output => ({ kind: 'file', ...output })) ?? [],
            connections: (record.connectionIds ?? []).map(id => ({ id, status: credentials?.status(record.taskId, id) ?? 'unchecked' })),
        };
    }
    server.get('/api/v1/tasks/:taskId', request => projectTask(
        tasks.get(actorOf(request).scope, actorOf(request).actor, params.parse(request.params).taskId),
    ));
    server.get('/api/v1/tasks', async request => {
        const page = paginate(filteredTasks(actorOf(request), listQuery.parse(request.query)), paging.parse(request.query));
        const items = await Promise.all(page.items.map(async record => {
            const detail = await projectTask(record);
            const { taskId, createdAt, updatedAt, phase, stop, externalRefs, pendingRequestCount } = detail;
            return { taskId, createdAt, updatedAt, phase, stop, externalRefs, pendingRequestCount };
        }));
        return { ...page, items };
    });
    if (dispatcher) {
        async function inputProjection(record: TaskCreationRecord, runtime: Awaited<ReturnType<TaskDispatcher['runtime']>>) {
            const { events } = await runtime.trace();
            const resumed = new Map(events.filter(event => event.kind === 'continuation').map(event => [event.inputId, event]));
            return runtime.inputFacts().map(input => {
                const event = resumed.get(input.inputId);
                return {
                    ...input, taskId: record.taskId,
                    continuations: event ? [{
                        workId: event.workId, state: 'resumed', resumedAt: event.recordedAt, eventId: event.eventId,
                    }] : [],
                };
            });
        }
        server.get('/api/v1/tasks/:taskId/session', async request => {
            const query = paging.extend({ requestId: text.optional() }).parse(request.query);
            const record = tasks.get(actorOf(request).scope, actorOf(request).actor, params.parse(request.params).taskId);
            const runtime = await dispatcher.runtime(record);
            const { sessionId, events } = await runtime.trace();
            return {
                taskId: record.taskId, sessionId,
                ...paginate(events.filter(event => !query.requestId || event.requestIds?.includes(query.requestId)), query),
                limitations: ['This view projects public messages, continuation entries, and MCP call metadata. Tool payloads are omitted.'],
            };
        });
        server.get('/api/v1/tasks/:taskId/inputs', async request => {
            const query = paging.extend({ inputId: text.optional() }).parse(request.query);
            const record = tasks.get(actorOf(request).scope, actorOf(request).actor, params.parse(request.params).taskId);
            const runtime = await dispatcher.runtime(record);
            const items = (await inputProjection(record, runtime)).filter(input => !query.inputId || input.inputId === query.inputId);
            return paginate(items, query);
        });
        server.post('/api/v1/tasks/:taskId/cancel', async request => {
            const record = tasks.get(actorOf(request).scope, actorOf(request).actor, params.parse(request.params).taskId);
            const { app, ownerId, executionId } = await dispatcher.runtime(record);
            const execution = await app.execution.acceptCancellation(ownerId, executionId);
            const stop = stopReceipt(record.taskId, execution);
            requireRule(stop, 'blocked', 'stop timestamp unavailable');
            void dispatcher.settleCancellation(record).catch(() => {
                request.log.warn({ taskId: record.taskId, code: 'task_stop_pending' });
            });
            return stop;
        });
        server.post('/api/v1/tasks/:taskId/steering', async (request, reply) => {
            const record = tasks.get(actorOf(request).scope, actorOf(request).actor, params.parse(request.params).taskId);
            const { text: message, materials: attachments } = z.strictObject({
                text: text.optional(), materials: materials.optional(),
            }).refine(value => Boolean(value.text || value.materials?.length)).parse(request.body);
            const { files, references } = splitMaterials(attachments);
            const commandKey = key.parse(request.headers['idempotency-key']);
            const { app, ownerId, executionId, submitSteering } = await dispatcher.runtime(record);
            const saved = await submitSteering(commandKey, message ?? '', files, references);
            const input = (await app.query.queryInputs(ownerId, executionId))
                .find(item => item.kind === 'steering' && item.sourceId === saved.id);
            requireRule(input, 'blocked');
            return reply.code(201).send({ inputId: input.id, taskId: record.taskId, savedAt: saved.at });
        });
        const decisionParams = z.object({ requestId: text });
        const answer = z.strictObject({
            contextRevision: z.number().int().min(1),
            text: text.optional(),
            optionId: text.optional(),
            corrects: text.optional(),
            supplements: text.optional(),
            intent: z.literal('investigate').optional(),
            materials: materials.optional(),
        }).refine(value => Boolean(value.text || value.optionId || value.intent) && !(value.supplements && value.corrects));
        const decisionList = listQuery.extend({ status: z.enum(['pending', 'answered']).optional() });
        async function locate(actor: TaskActor, requestId: string) {
            for (const record of visibleTasks(actor)) {
                const runtime = await dispatcher!.runtime(record);
                const { app, ownerId, executionId } = runtime;
                const decision = (await app.query.queryRequests(ownerId, executionId)).find(item => item.id === requestId);
                if (decision) return { record, runtime, decision };
            }
            throw new RuleError('not-found');
        }
        server.get('/api/v1/decision-requests', async request => {
            const query = decisionList.parse(request.query);
            const items = [];
            for (const record of filteredTasks(actorOf(request), query)) {
                const { app, ownerId, executionId } = await dispatcher.runtime(record);
                const execution = await app.query.queryExecution(ownerId, executionId);
                if (query.status !== 'answered' && ['stopping', 'stopped'].includes(execution.phase)) continue;
                const requests = await app.query.queryRequests(ownerId, executionId);
                items.push(...requests.filter(item => item.status === (query.status ?? 'pending')).map(item => summary(record, item)));
            }
            items.sort((left, right) => right.createdAt.localeCompare(left.createdAt) || right.requestId.localeCompare(left.requestId));
            return paginate(items, query);
        });
        async function projectDecision(record: TaskCreationRecord, runtime: Awaited<ReturnType<TaskDispatcher['runtime']>>, decision: DecisionRequest) {
            const scope = await runtime.decisionScope(decision.id);
            const execution = await runtime.app.query.queryExecution(runtime.ownerId, runtime.executionId);
            return {
                ...summary(record, decision),
                canAnswer: !['stopping', 'stopped'].includes(execution.phase),
                context: decisionContext(decision, decision.contexts.at(-1)!, scope),
            };
        }
        server.get('/api/v1/decision-requests/:requestId', async request => {
            const { record, runtime, decision } = await locate(actorOf(request), decisionParams.parse(request.params).requestId);
            return projectDecision(record, runtime, decision);
        });
        server.get('/api/v1/decision-requests/:requestId/episode', async request => {
            const query = paging.parse(request.query);
            const { record, runtime, decision } = await locate(actorOf(request), decisionParams.parse(request.params).requestId);
            const { app, ownerId } = runtime;
            const [detail, scope, episode, inputs, trace] = await Promise.all([
                projectDecision(record, runtime, decision), runtime.decisionScope(decision.id),
                app.query.queryEpisode(ownerId, decision.id), inputProjection(record, runtime), runtime.trace(),
            ]);
            const items: { time: string; value: object }[] = [];
            for (const [index, context] of decision.contexts.entries()) {
                const recordedAt = index === 0 ? decision.createdAt : context.recordedAt;
                if (recordedAt) items.push({
                    time: recordedAt,
                    value: { kind: 'context', context: decisionContext(decision, context, scope), recordedAt },
                });
            }
            for (const answer of episode.decisions) {
                const input = inputs.find(item => item.decisionId === answer.id);
                requireRule(input, 'blocked', 'decision input receipt unavailable');
                const files = answer.files.map(fileId => {
                    requireRule(uploads, 'blocked');
                    return { fileId, name: uploads.bound(record.scope, record.actor, record.taskId, fileId).name };
                });
                const materials = [
                    ...files.map(({ fileId }) => ({ kind: 'upload', uploadId: fileId })),
                    ...(answer.references ?? []).map(source => ({ kind: 'reference', source })),
                ];
                items.push({ time: answer.at, value: {
                    kind: 'answer',
                    answer: { contextRevision: answer.contextRevision, text: answer.text || undefined,
                        optionId: answer.optionId, corrects: answer.correctionOf, supplements: answer.supplements, intent: answer.intent,
                        ...(materials.length ? { materials } : {}) },
                    ...(files.length ? { files } : {}),
                    receipt: { inputId: input.inputId, savedAt: input.savedAt, taskId: record.taskId,
                        requestId: decision.id, decisionId: answer.id, callerId: answer.callerId ?? actorOf(request).actor, actorId: actorOf(request).actor },
                } });
                items.push({ time: input.savedAt, value: { kind: 'input', input } });
            }
            for (const event of trace.events.filter(event => event.requestIds?.includes(decision.id))) {
                items.push({ time: event.recordedAt, value: { kind: 'session_event', event } });
            }
            return { request: detail, ...paginate(items.sort((a, b) => a.time.localeCompare(b.time)).map(item => item.value), query) };
        });
        server.get('/api/v1/tasks/:taskId/decision-requests', async request => {
            const query = decisionList.parse(request.query);
            const record = tasks.get(actorOf(request).scope, actorOf(request).actor, params.parse(request.params).taskId);
            const { app, ownerId, executionId } = await dispatcher.runtime(record);
            const requests = (await app.query.queryRequests(ownerId, executionId))
                .filter(item => !query.status || item.status === query.status);
            return paginate(requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
                .map(item => summary(record, item)), query);
        });
        server.post('/api/v1/decision-requests/:requestId/user-decisions', async (request, reply) => {
            const { requestId } = decisionParams.parse(request.params);
            const { corrects, materials: attachments, ...payload } = answer.parse(request.body);
            const { files, references } = splitMaterials(attachments);
            const idempotencyKey = key.parse(request.headers['idempotency-key']);
            const { record, runtime: { app, ownerId, executionId, submitDecision } } = await locate(actorOf(request), requestId);
            const decision = await submitDecision(requestId, idempotencyKey, {
                ...payload, text: payload.text ?? '', files, callerId: actorOf(request).callerId, ...(corrects ? { correctionOf: corrects } : {}),
                ...(references.length ? { references } : {}),
            });
            const input = (await app.query.queryInputs(ownerId, executionId)).find(item => item.kind === 'user-decision' && item.sourceId === decision.id);
            requireRule(input, 'blocked');
            return reply.code(201).send({
                inputId: input.id, taskId: record.taskId, savedAt: decision.at, requestId,
                decisionId: decision.id, callerId: decision.callerId ?? actorOf(request).actor, actorId: actorOf(request).actor,
            });
        });
    }
    return server;
}
