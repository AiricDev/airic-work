import { taskContract } from './support/task-contract';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createModels, fauxProvider, fauxAssistantMessage, fauxText, fauxToolCall } from '@earendil-works/pi-ai';
import { expect, it } from 'vitest';
import { openTaskRuntime } from '../src/bootstrap/task-runtime';
import { TaskCreationUseCases } from '../src/application/task-creation';
import { LocalBlobFiles } from '../src/adapters/driven/files/local-blob-files';
import { SqliteTaskUploads } from '../src/adapters/driven/sqlite/task-uploads';
import { SqliteTaskInitializer } from '../src/adapters/driven/sqlite/task-initializer';
import { SqliteTaskRegistry, taskFingerprint } from '../src/adapters/driven/sqlite/task-registry';
import { openSqliteDatabase } from '../src/adapters/driven/sqlite/database';
import { TaskDispatcher } from '../src/bootstrap/task-dispatcher';
import type { TaskAction } from '../src/adapters/driving/http/task-auth';
import { createTaskServer } from '../src/adapters/driving/http/task-server';
import { harness } from './support/harness';
import type { TaskCreationRecord } from '../src/application/task-creation';

it('dispatches a new Task while another runs without admitting that Task twice', async () => {
    const first: TaskCreationRecord = {
        taskId: 'first', scope: 'local', actor: 'operator', acceptedAt: '2026-11-09T00:00:00Z',
        creation: { instruction: 'Review', om: { source: 'repo', revision: 'v1', entry: 'om.md' } },
    };
    const tasks = [first];
    const started: string[] = [];
    let signalFirstRunning!: () => void;
    let releaseFirst!: () => void;
    const firstRunning = new Promise<void>(resolve => { signalFirstRunning = resolve; });
    const firstReleased = new Promise<void>(resolve => { releaseFirst = resolve; });
    const dispatcher = new TaskDispatcher(() => tasks, async record => ({
        async settleCancellation() {},
        async needsRun() { return true; },
        async run() {
            started.push(record.taskId);
            if (record.taskId === first.taskId) {
                signalFirstRunning();
                await firstReleased;
            }
        },
        async close() {},
    }), () => { throw new Error('unexpected Worker failure'); });
    const firstScan = dispatcher.pump();
    try {
        await firstRunning;
        tasks.push({ ...first, taskId: 'second' });
        await dispatcher.pump();
        expect(started).toEqual(['first', 'second']);
    } finally {
        releaseFirst();
        await firstScan;
        await dispatcher.close();
    }
});

it('runs a Task and resumes its persisted Session after a UserDecision', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'airic-task-runtime-'));
    const { methods } = harness().d;
    methods.pinRevision = async ({ source, entry }) => ({
        source, root: entry, sha: 'a'.repeat(40), runtimeVersion: 'test', skillVersion: 'test',
    });
    const faux = fauxProvider();
    const models = createModels();
    models.setProvider(faux.provider);
    const db = openSqliteDatabase(join(directory, 'registry.sqlite'));
    const taskDirectory = join(directory, 'tasks');
    const uploads = new SqliteTaskUploads(db, await LocalBlobFiles.open(join(directory, 'uploads')));
    let taskCount = 0;
    const tasks = new TaskCreationUseCases(
        new SqliteTaskRegistry(db), new SqliteTaskInitializer(taskDirectory),
        value => taskFingerprint(Buffer.alloc(32, 2), value), () => taskCount++ === 0 ? 'review' : 'local-review', () => '2026-11-09T00:00:00Z',
        (scope, actor, taskId, ids) => uploads.bind(scope, actor, taskId, ids),
    );
    const options = {
        models, model: { provider: 'faux', modelId: 'faux-1' },
        skillPath: join(directory, 'worker-skill.md'),
    };
    await writeFile(options.skillPath, 'Pinned worker skill for this fixture');
    const bearerToken = 'task-test-token-with-at-least-32-characters';
    const keys = generateKeyPairSync('ed25519');
    const integration = {
        bearerToken: 'integration-token-with-at-least-32-characters',
        callerId: 'certlab-test', issuer: 'test-issuer', audience: 'airic', scope: 'test-org',
        publicKeyPem: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString(),
    };
    function delegatedHeaders(sub: string, audience = integration.audience, grant?: { taskId: string; action: TaskAction }) {
        const now = Math.floor(Date.now() / 1000);
        const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
        const payload = `${encode({ alg: 'EdDSA' })}.${encode({
            iss: integration.issuer, aud: audience, sub, scope: integration.scope, iat: now, exp: now + 60, grant,
        })}`;
        return {
            authorization: `Bearer ${integration.bearerToken}`,
            'x-airic-actor-assertion': `${payload}.${sign(null, Buffer.from(payload), keys.privateKey).toString('base64url')}`,
        };
    }
    const headers = delegatedHeaders('owner');
    const reference = { kind: 'reference', source: { object: { system: 'certlab', kind: 'report', id: 'report-demo' }, revision: 'rev-1' } };
    const startDispatcher = () => new TaskDispatcher(
        () => tasks.admitted(),
        record => openTaskRuntime(taskDirectory, record, methods, options, uploads),
        () => { throw new Error('unexpected Worker failure'); },
    );
    let dispatcher = startDispatcher();
    const defaultOm = { source: 'local', revision: 'a'.repeat(40), entry: 'om.md' };
    const contract = taskContract();
    const server = createTaskServer(tasks, { bearerToken, scope: 'local', actor: 'owner' }, dispatcher, uploads, undefined, integration, undefined, defaultOm);
    try {
        const payload = '--boundary\r\nContent-Disposition: form-data; name="file"; filename="evidence.txt"\r\n'
            + 'Content-Type: text/plain\r\n\r\nPersisted evidence\r\n--boundary--\r\n';
        const upload = {
            method: 'POST' as const, url: '/api/v1/uploads',
            headers: { ...headers, 'idempotency-key': 'upload', 'content-type': 'multipart/form-data; boundary=boundary' },
            payload,
        };
        const staged = await contract.inject(server, upload);
        expect(staged.statusCode).toBe(201);
        const { uploadId } = staged.json();
        expect((await contract.inject(server, upload)).json()).toEqual(staged.json());
        expect((await contract.inject(server, { ...upload, payload: payload.replace('Persisted', 'Different') })).statusCode).toBe(409);
        const oversized = await contract.inject(server, {
            ...upload, headers: { ...upload.headers, 'idempotency-key': 'oversized' },
            payload: payload.replace('Persisted evidence', 'x'.repeat(10 * 1024 * 1024 + 1)),
        });
        expect(oversized.statusCode).toBe(413);
        expect(oversized.json().code).toBe('file_too_large');
        const created = await contract.inject(server, {
            method: 'POST', url: '/api/v1/tasks',
            headers: { ...headers, 'idempotency-key': 'create-review' },
            payload: {
                instruction: 'Review',
                materials: [{ kind: 'upload', uploadId }, reference],
                externalRefs: [{ system: 'certlab', kind: 'project', id: 'project-review' }],
            },
        });
        expect(created.statusCode).toBe(201);
        faux.setResponses([
            fauxAssistantMessage([fauxToolCall('work_request_decision', { question: 'Confirm?', scope: 'review' }, { id: 'question' })], { stopReason: 'toolUse' }),
            fauxAssistantMessage([fauxText('Waiting')]),
        ]);
        await dispatcher.pump();
        const taskUrl = '/api/v1/tasks/review';
        const completion = {
            method: 'POST' as const, url: `${taskUrl}/notify`,
            headers: { authorization: `Bearer ${bearerToken}`, 'idempotency-key': 'event-1' },
            payload: { eventId: 'event-1', type: 'invoice.paid', revision: 'rev-2', object: { system: 'billing', kind: 'invoice', id: 'inv-1' } },
        };
        expect((await contract.inject(server, { ...completion, url: `${taskUrl}-missing/notify` })).statusCode).toBe(404);
        expect((await contract.inject(server, { ...completion, headers })).statusCode).toBe(403);
        expect((await contract.inject(server, completion)).statusCode).toBe(404);
        expect((await contract.inject(server, { ...completion, headers: {} })).statusCode).toBe(401);

        const detail = (await contract.inject(server, { url: taskUrl, headers })).json();
        expect(detail).toMatchObject({ phase: 'waiting', pendingRequestCount: 1 });
        expect(Date.parse(detail.updatedAt)).toBeGreaterThan(Date.parse(detail.createdAt));
        expect((await contract.inject(server, { url: taskUrl, headers: delegatedHeaders('other') })).statusCode).toBe(404);
        expect((await contract.inject(server, { url: taskUrl, headers: delegatedHeaders('owner', 'wrong') })).statusCode).toBe(401);
        expect((await contract.inject(server, { url: taskUrl, headers: { authorization: headers.authorization } })).statusCode).toBe(401);
        expect((await contract.inject(server, { url: taskUrl, headers: { authorization: `Bearer ${bearerToken}` } })).statusCode).toBe(404);
        const questions = (await contract.inject(server, { url: `${taskUrl}/decision-requests`, headers })).json();
        expect(questions.items).toMatchObject([{ title: "Confirm?" }]);
        expect(detail.work).toEqual([{ workId: questions.items[0].requestId, label: 'review', waitingOn: [questions.items[0].requestId] }]);
        const filter = new URLSearchParams({
            'externalRef[system]': 'certlab', 'externalRef[kind]': 'project', 'externalRef[id]': 'project-review',
        });
        const taskList = await contract.inject(server, { url: `/api/v1/tasks?${filter}`, headers });
        expect(taskList.json().items).toMatchObject([{ taskId: 'review', phase: 'waiting' }]);
        const inbox = await contract.inject(server, { url: `/api/v1/decision-requests?${filter}`, headers });
        expect(inbox.json().items).toEqual(questions.items);
        filter.set('externalRef[id]', 'other-project');
        expect((await contract.inject(server, { url: `/api/v1/decision-requests?${filter}`, headers })).json().items).toEqual([]);
        const question = await contract.inject(server, { url: `/api/v1/decision-requests/${questions.items[0].requestId}`, headers });
        expect(question.statusCode).toBe(200);
        expect(question.json()).toMatchObject({
            canAnswer: true, context: { question: 'Confirm?', revision: 1, affectedWork: [{ label: 'review' }] },
        });
        const reviewerRead = delegatedHeaders('reviewer', integration.audience, { taskId: 'review', action: 'read' });
        const reviewerAnswer = delegatedHeaders('reviewer', integration.audience, { taskId: 'review', action: 'answer' });
        expect((await contract.inject(server, { url: taskUrl, headers: reviewerRead })).statusCode).toBe(200);
        expect((await contract.inject(server, { url: taskUrl, headers: reviewerAnswer })).statusCode).toBe(404);
        expect((await contract.inject(server, { url: `${taskUrl}-other`, headers: reviewerRead })).statusCode).toBe(404);
        const reviewerUpload = await contract.inject(server, {
            ...upload, headers: { ...upload.headers, ...reviewerAnswer },
            payload: payload.replace('Persisted evidence', 'Reviewer evidence'),
        });
        expect(reviewerUpload.statusCode).toBe(201);
        const reviewerFileId = reviewerUpload.json().uploadId;
        const answer = {
            method: 'POST' as const, url: `/api/v1/decision-requests/${questions.items[0].requestId}/user-decisions`,
            headers: { ...headers, 'idempotency-key': 'answer' },
            payload: { text: 'Confirmed', contextRevision: 1, materials: [{ kind: 'upload', uploadId }, reference] },
        };
        const orphan = (await contract.inject(server, { ...upload, headers: { ...upload.headers, 'idempotency-key': 'unattached' } })).json();
        const invalid = await contract.inject(server, {
            ...answer, headers: { ...answer.headers, 'idempotency-key': 'invalid-answer' },
            payload: { text: 'Confirmed', contextRevision: 99, materials: [{ kind: 'upload', uploadId: orphan.uploadId }] },
        });
        expect(invalid.json().code).toBe('context_revision_unknown');
        expect(db.prepare('SELECT taskId FROM task_uploads WHERE id = ?').get(orphan.uploadId)).toEqual({ taskId: null });
        const sharedAnswer = {
            ...answer, headers: { ...answer.headers, ...reviewerAnswer },
            payload: { ...answer.payload, materials: [{ kind: 'upload', uploadId: reviewerFileId }, reference] },
        };
        expect((await contract.inject(server, {
            ...sharedAnswer, headers: { ...sharedAnswer.headers, ...reviewerRead },
        })).statusCode).toBe(404);
        const receipt = await contract.inject(server, sharedAnswer);
        expect(receipt.statusCode).toBe(201);
        expect(receipt.json()).toMatchObject({ callerId: 'certlab-test', actorId: 'reviewer' });
        expect((await contract.inject(server, sharedAnswer)).json()).toEqual(receipt.json());
        const saved = await contract.inject(server, { url: `${taskUrl}/inputs?inputId=${receipt.json().inputId}`, headers });
        expect(saved.json().items).toMatchObject([{ kind: 'decision', delivery: { state: 'pending' }, continuations: [{ workId: questions.items[0].requestId, state: 'waiting' }] }]);
        const notify = {
            ...completion,
            headers: { ...completion.headers,
                ...delegatedHeaders('certlab:completion-worker', integration.audience, { taskId: 'review', action: 'notify' }) },
        };
        const notified = await contract.inject(server, notify);
        expect(notified.statusCode).toBe(201);
        expect((await contract.inject(server, notify)).json()).toEqual(notified.json());
        let steeringContext = '';
        uploads.claim(integration.scope, 'owner', 'review', [orphan.uploadId]);
        await dispatcher.close();
        await writeFile(options.skillPath, 'Different worker skill after deployment');
        dispatcher = startDispatcher();
        faux.setResponses([
            fauxAssistantMessage([fauxToolCall('work_read_attachment', { fileId: reviewerFileId }, { id: 'read-file' })], { stopReason: 'toolUse' }),
            fauxAssistantMessage([fauxText('Continued')]),
            context => {
                steeringContext = JSON.stringify(context.messages);
                return fauxAssistantMessage([fauxText('Steering applied')]);
            },
        ]);
        await dispatcher.pump();
        expect(db.prepare('SELECT taskId FROM task_uploads WHERE id = ?').get(orphan.uploadId)).toEqual({ taskId: null });
        const worker = await dispatcher.runtime(tasks.get(integration.scope, 'owner', 'review'));
        const resumed = await worker.app.query.queryExecution(worker.ownerId, worker.executionId);
        expect(resumed.sessionId).toBe(detail.sessionId);
        expect(resumed.method?.sha).toBe(detail.pinnedOm.resolvedRevision);
        const session = JSON.stringify(await worker.app.query.querySession(worker.ownerId, worker.executionId));
        expect(session).toContain('Continued');
        expect(steeringContext).toContain('worker-branch-summary');
        expect(steeringContext).toContain('Continued');
        expect(steeringContext).toContain('invoice.paid');
        expect(session).toContain('Reviewer evidence');
        expect(session).toContain('report-demo');
        const reopened = createTaskServer(tasks, { bearerToken, scope: 'local', actor: 'owner' }, dispatcher, uploads, undefined, integration, undefined, defaultOm);
        try {
            const download = await contract.inject(reopened, { url: `${taskUrl}/files/${uploadId}`, headers });
            expect(download.statusCode).toBe(200);
            expect(download.body).toBe('Persisted evidence');
            expect((await contract.inject(reopened, { url: `/api/v1/tasks/other/files/${uploadId}`, headers })).statusCode).toBe(404);
            const delivered = await contract.inject(reopened, { url: `${taskUrl}/inputs?inputId=${receipt.json().inputId}`, headers });
            expect(delivered.json().items).toMatchObject([{
                delivery: { state: 'delivered' },
                continuations: [{ workId: questions.items[0].requestId, state: 'resumed' }],
            }]);
            const trace = await contract.inject(reopened, {
                url: `${taskUrl}/session?limit=100`, headers,
            });
            expect(trace.statusCode).toBe(200);
            expect(trace.json()).toMatchObject({
                sessionId: detail.sessionId,
                items: expect.arrayContaining([
                    expect.objectContaining({ kind: 'continuation', inputId: receipt.json().inputId, requestIds: [questions.items[0].requestId] }),
                    expect.objectContaining({ kind: 'message', role: 'agent', text: 'Continued' }),
                ]),
            });
            const episode = await contract.inject(reopened, {
                url: `/api/v1/decision-requests/${questions.items[0].requestId}/episode`, headers,
            });
            expect(episode.statusCode).toBe(200);
            expect(episode.json().items[1].receipt).toMatchObject({ callerId: 'certlab-test', actorId: 'reviewer' });
            expect(episode.json().items[1].files).toEqual([{ fileId: reviewerFileId, name: 'evidence.txt' }]);
            expect(episode.json().items[1].answer.materials).toEqual([{ kind: 'upload', uploadId: reviewerFileId }, reference]);
            expect(episode.json().items.map((item: { kind: string }) => item.kind))
                .toEqual(['context', 'answer', 'input', 'session_event']);
            const followUp = { ...answer, headers: { ...headers, 'idempotency-key': 'decision-supplement' } };
            const unrelated = await contract.inject(reopened, followUp);
            expect(unrelated.statusCode).toBe(409);
            expect(unrelated.json().code).toBe('decision_already_answered');
            const supplement = { ...followUp, payload: { contextRevision: 1, intent: 'investigate', supplements: receipt.json().decisionId } };
            const savedSupplement = await contract.inject(reopened, supplement);
            expect(savedSupplement.statusCode).toBe(201);
            expect((await contract.inject(reopened, supplement)).json()).toEqual(savedSupplement.json());
            const steering = {
                method: 'POST' as const, url: `${taskUrl}/steering`,
                headers: { ...headers, 'idempotency-key': 'follow-up' }, payload: { materials: [reference] },
            };
            const queued = await contract.inject(reopened, steering);
            expect(queued.statusCode).toBe(201);
            const cancel = { method: 'POST' as const, url: `${taskUrl}/cancel`, headers };
            const [accepted, racedAnswer] = await Promise.all([
                contract.inject(reopened, cancel),
                contract.inject(reopened, { ...supplement, headers: { ...headers, 'idempotency-key': 'raced-answer' } }),
            ]);
            expect(accepted.json()).toMatchObject({ taskId: 'review', state: 'accepted' });
            await dispatcher.pump();
            const stopped = await contract.inject(reopened, cancel);
            expect(stopped.json()).toMatchObject({ state: 'confirmed', requestedAt: accepted.json().requestedAt });
            expect((await contract.inject(reopened, steering)).json()).toEqual(queued.json());
            const late = await contract.inject(reopened, { ...steering, headers: { ...headers, 'idempotency-key': 'late' } });
            expect(late.statusCode).toBe(409);
            expect(late.json().code).toBe('task_stopped');
            const paused = await contract.inject(reopened, { url: `${taskUrl}/inputs?inputId=${queued.json().inputId}`, headers });
            expect(paused.json().items).toMatchObject([{ kind: 'steering', delivery: { state: 'paused' } }]);
            if (racedAnswer.statusCode === 201) {
                const saved = await contract.inject(reopened, { url: `${taskUrl}/inputs?inputId=${racedAnswer.json().inputId}`, headers });
                expect(saved.json().items).toMatchObject([{ kind: 'decision', delivery: { state: 'paused' } }]);
            } else {
                expect(racedAnswer.statusCode).toBe(409);
                expect(racedAnswer.json().code).toBe('task_stopped');
            }
            await dispatcher.close();
            dispatcher = startDispatcher();
            await dispatcher.pump();
            const restored = await dispatcher.runtime(tasks.get(integration.scope, 'owner', 'review'));
            expect((await restored.app.query.queryExecution(restored.ownerId, restored.executionId)).phase).toBe('stopped');
            expect(restored.inputFacts().find(item => item.inputId === queued.json().inputId)?.delivery.state).toBe('paused');
            const localHeaders = { authorization: `Bearer ${bearerToken}` };
            const localTask = await contract.inject(reopened, {
                method: 'POST', url: '/api/v1/tasks',
                headers: { ...localHeaders, 'idempotency-key': 'local-create' },
                payload: { instruction: 'Review locally' },
            });
            expect(localTask.statusCode).toBe(201);
            const localNotice = await contract.inject(reopened, {
                ...completion, url: `/api/v1/tasks/${localTask.json().taskId}/notify`,
                headers: { ...completion.headers, ...localHeaders },
            });
            expect(localNotice.statusCode).toBe(201);
            expect((await contract.inject(reopened, {
                ...completion, url: `/api/v1/tasks/${localTask.json().taskId}/notify`,
            })).json()).toEqual(localNotice.json());
            contract.expectCoverage({ except: ['replaceConnectionCredential', 'getOmStatus'] });
        } finally { await reopened.close(); }
    } finally {
        await server.close();
        await dispatcher.close();
        db.close();
        await rm(directory, { recursive: true, force: true });
    }
});
