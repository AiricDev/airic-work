import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
import { DockerWorkspace } from '/app/backend/src/adapters/driven/workspace/docker-workspace.ts';

const directory = process.env.AIRIC_TASK_DATA;
const method = directory + '/methods/smoke';
await mkdir(method, { recursive: true });
await writeFile(method + '/om.md', 'fixed OM');
await mkdir(directory + '/tasks/smoke', { recursive: true });
await mkdir(directory + '/tasks/other', { recursive: true });
await writeFile(directory + '/tasks/other/private', 'other task');
const workspace = new DockerWorkspace({
    socketPath: '/var/run/docker.sock',
    hostDirectory: process.env.AIRIC_WORKSPACE_HOST_DATA, user: `${process.getuid()}:${process.getgid()}`,
    image: process.env.AIRIC_WORKSPACE_IMAGE || 'airic-work:task',
    dataDirectory: directory,
    methodDirectory: async () => method,
}, 'smoke', { read: async () => Buffer.from([0, 1, 255]) });
const execution = { id: 'smoke-execution', ownerId: 'smoke-owner', method: {} };
const admit = async () => {};
try {
    await workspace.ensure();
    await workspace.materialize(execution, [{ id: 'upload', executionId: execution.id, userId: execution.ownerId }]);
    const checked = await workspace.run(execution, [
        'set -eu',
        'test "$(cat /om/om.md)" = "fixed OM"',
        'test "$(wc -c </inputs/upload)" = 3',
        'if touch /om/write || touch /inputs/write; then exit 1; fi',
        'test ! -e /var/run/docker.sock || { echo "Docker socket visible"; exit 1; }',
        'test ! -e /var/lib/airic-work/tasks/other/private || { echo "Other task visible"; exit 1; }',
        'test -z "${AIRIC_TASK_TOKEN-}" || { echo "Worker credentials visible"; exit 1; }',
        `node -e 'if (Object.values(require("node:os").networkInterfaces()).flat().some(i => !i.internal)) throw Error("External network interface visible")'`,
        'printf persisted > /work/file',
    ].join('\n'), admit);
    assert.equal(checked.exitCode, 0, checked.output);
    assert.deepEqual(await workspace.run(execution, 'cat /work/file', admit), { exitCode: 0, output: 'persisted' });
    assert.equal(await workspace.stopped(), true);
    const command = workspace.run(execution, 'touch /work/started; sleep 30', admit).catch(() => {});
    const marker = directory + '/tasks/smoke/workspace/work/started';
    for (let attempt = 0; attempt < 100 && !await stat(marker).catch(() => false); attempt++) await setTimeout(50);
    assert.ok(await stat(marker));
    assert.equal(await workspace.stopped(), false);
    await workspace.stop();
    assert.equal(await workspace.stopped(), true);
    await command;
    console.log('Workspace smoke passed: scoped mounts, no network or host credentials, persistent work and stop');
} finally {
    await workspace.stop();
}

const { createModels, fauxProvider, fauxAssistantMessage, fauxText, fauxToolCall } = await import('@earendil-works/pi-ai');
const { openSqliteDatabase } = await import('/app/backend/src/adapters/driven/sqlite/database.ts');
const { SqliteTaskRegistry, taskFingerprint } = await import('/app/backend/src/adapters/driven/sqlite/task-registry.ts');
const { SqliteTaskInitializer } = await import('/app/backend/src/adapters/driven/sqlite/task-initializer.ts');
const { SqliteTaskUploads } = await import('/app/backend/src/adapters/driven/sqlite/task-uploads.ts');
const { LocalBlobFiles } = await import('/app/backend/src/adapters/driven/files/local-blob-files.ts');
const { TaskCreationUseCases } = await import('/app/backend/src/application/task-creation.ts');
const { TaskDispatcher } = await import('/app/backend/src/bootstrap/task-dispatcher.ts');
const { openTaskRuntime } = await import('/app/backend/src/bootstrap/task-runtime.ts');
const { createTaskServer } = await import('/app/backend/src/adapters/driving/http/task-server.ts');
const db = openSqliteDatabase(directory + '/workspace-smoke.sqlite');
const uploads = new SqliteTaskUploads(db, await LocalBlobFiles.open(directory + '/workspace-smoke-blobs'));
const tasks = new TaskCreationUseCases(
    new SqliteTaskRegistry(db), new SqliteTaskInitializer(directory + '/tasks'),
    value => taskFingerprint(Buffer.alloc(32, 1), value), randomUUID, () => new Date().toISOString(),
    (...args) => uploads.bind(...args),
);
const token = randomUUID();
const identity = { bearerToken: token, scope: 'smoke', actor: 'operator' };
const auth = { authorization: 'Bearer ' + token };
const methods = {
    async pinRevision({ source, entry }) {
        return { source, root: entry, sha: 'a'.repeat(40), runtimeVersion: 'smoke', skillVersion: 'smoke' };
    },
    async read() { return 'fixed OM'; },
};
const faux = fauxProvider();
const models = createModels();
models.setProvider(faux.provider);
const dispatcher = new TaskDispatcher(() => tasks.admitted(), record => openTaskRuntime(directory + '/tasks', record, methods, {
    models, model: { provider: 'faux', modelId: 'faux-1' }, skillPath: '/app/backend/prompts/worker.md',
}, uploads, undefined, {
    socketPath: '/var/run/docker.sock', hostDirectory: process.env.AIRIC_WORKSPACE_HOST_DATA, user: `${process.getuid()}:${process.getgid()}`,
    image: process.env.AIRIC_WORKSPACE_IMAGE || 'airic-work:task', dataDirectory: directory, methodDirectory: async () => method,
}), () => { throw Error('Worker smoke failed'); });
const server = createTaskServer(tasks, identity, dispatcher, uploads, undefined, undefined, undefined, { source: 'local', revision: 'a'.repeat(40), entry: 'om.md' });
async function get(url, status = 200) {
    const response = await server.inject({ url, headers: auth });
    assert.equal(response.statusCode, status, response.body);
    return response;
}
async function post(url, key, payload, headers) {
    const response = await server.inject({ url, method: 'POST', headers: { ...auth, 'idempotency-key': key, ...headers }, payload });
    assert.equal(response.statusCode, 201, response.body);
    return response.json();
}
let callNumber = 0;
const tool = (name, args) => fauxAssistantMessage([fauxToolCall(name, args, { id: 'call-' + ++callNumber })], { stopReason: 'toolUse' });
try {
    const upload = await post('/api/v1/uploads', 'upload', '--smoke\r\nContent-Disposition: form-data; name="file"; filename="evidence.txt"\r\n\r\nevidence\r\n--smoke--\r\n', {
        'content-type': 'multipart/form-data; boundary=smoke',
    });
    const task = await post('/api/v1/tasks', 'create', {
        instruction: 'Review',
        materials: [{ kind: 'upload', uploadId: upload.uploadId }],
    });
    const url = '/api/v1/tasks/' + task.taskId;
    faux.setResponses([
        tool('work_request_decision', { question: 'Publish?', scope: 'review' }),
        fauxAssistantMessage([fauxText('Waiting')]),
    ]);
    await dispatcher.pump();
    const waiting = (await get(url)).json();
    assert.equal(waiting.phase, 'waiting');
    const { items: [decision] } = (await get(url + '/decision-requests')).json();
    const receipt = await post('/api/v1/decision-requests/' + decision.requestId + '/user-decisions', 'answer', { text: 'Yes', contextRevision: 1 });
    faux.setResponses([
        tool('work_run_command', { command: 'cp /inputs/' + upload.uploadId + ' report.txt; ln -s /om/om.md link.txt' }),
        tool('work_publish_file', { path: 'link.txt' }),
        tool('work_publish_file', { path: 'report.txt' }),
        tool('work_run_command', { command: 'printf changed > report.txt' }),
        fauxAssistantMessage([fauxText('Published')]),
    ]);
    await dispatcher.pump();
    const done = (await get(url)).json();
    assert.equal(done.sessionId, waiting.sessionId);
    assert.equal(done.phase, 'ended');
    assert.deepEqual(done.outputs.map(({ kind, name }) => ({ kind, name })), [{ kind: 'file', name: 'report.txt' }]);
    const { items: [input] } = (await get(url + '/inputs?inputId=' + receipt.inputId)).json();
    assert.equal(input.delivery.state, 'delivered');
    assert.equal(input.continuations[0].state, 'resumed');
    const download = await get(url + '/files/' + done.outputs[0].fileId);
    assert.equal(download.body, 'evidence');
    assert.match(download.headers['content-disposition'], /report\.txt/);
    const other = await post('/api/v1/tasks', 'create-other', {
        instruction: 'Other work',
    });
    await get('/api/v1/tasks/' + other.taskId + '/files/' + done.outputs[0].fileId, 404);
    console.log('Worker smoke passed: no-MCP upload, Decision Request, answer, same-Session continuation and fixed output download');
} finally {
    await server.close();
    await dispatcher.close();
    db.close();
}
