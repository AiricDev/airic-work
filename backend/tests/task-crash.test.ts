import { fork } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import type { openTaskRuntime } from '../src/bootstrap/task-runtime';
import type { DecisionRequest, UserDecision } from '../src/domain/model';

type Runtime = Awaited<ReturnType<typeof openTaskRuntime>>;
type Snapshot = {
    requests: DecisionRequest[];
    decisions: UserDecision[];
    scope?: Awaited<ReturnType<Runtime['workScopes']>>[number];
    trace: Awaited<ReturnType<Runtime['trace']>>;
    inputs: ReturnType<Runtime['inputFacts']>;
    diagnostics: unknown[];
};

function child(directory: string, step: string, crashes: true): Promise<void>;
function child(directory: string, step: string): Promise<Snapshot>;
function child(directory: string, step: string, crashes = false): Promise<Snapshot | void> {
    return new Promise((resolve, reject) => {
        const process = fork(join(import.meta.dirname, 'fixtures/task-crash.mjs'), [directory, step], {
            stdio: ['ignore', 'ignore', 'pipe', 'ipc'],
        });
        let diagnostic = '';
        let result: Snapshot | undefined;
        let timeout = false;
        process.stderr?.on('data', chunk => { diagnostic += String(chunk); });
        process.on('message', message => { result = message as Snapshot; });
        const timer = setTimeout(() => { timeout = true; process.kill('SIGKILL'); }, 8000);
        process.once('error', error => { clearTimeout(timer); reject(error); });
        process.once('close', (code, signal) => {
            clearTimeout(timer);
            if (!timeout && crashes && signal === 'SIGKILL') resolve();
            else if (!crashes && code === 0 && result) resolve(result);
            else reject(new Error(`${step}: ${timeout ? 'timeout' : signal ?? code}\n${diagnostic}`));
        });
    });
}

it('recovers all three Task commit gaps after abrupt process death', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'airic-task-crash-'));
    try {
        await child(directory, 'question-crash', true);
        const unanchored = await child(directory, 'inspect');
        expect(unanchored.requests).toHaveLength(1);
        expect(unanchored.scope).toBeUndefined();
        const recovered = await child(directory, 'question-recover');
        const [request] = unanchored.requests;
        expect(recovered.requests.map(item => item.id)).toEqual([request.id]);
        expect(recovered.scope).toEqual({ workId: request.id, label: 'review', waitingOn: [request.id] });

        await child(directory, 'answer-crash', true);
        const answered = await child(directory, 'inspect');
        expect(answered.requests[0].status).toBe('answered');
        expect(answered.decisions).toHaveLength(1);
        expect(answered.inputs).toMatchObject([{ delivery: { state: 'pending' } }]);
        await child(directory, 'receipt-crash', true);
        const unconfirmed = await child(directory, 'inspect');
        expect(unconfirmed.inputs).toEqual(answered.inputs);
        const finished = await child(directory, 'finish');
        expect(finished.requests.map(item => item.id)).toEqual([request.id]);
        expect(finished.decisions).toHaveLength(1);
        expect(finished.inputs).toHaveLength(1);
        const [input] = finished.inputs;
        expect(input.inputId).toBe(answered.inputs[0].inputId);
        expect(input.delivery.state).toBe('delivered');
        expect(finished.trace.sessionId).toBe(recovered.trace.sessionId);
        expect(finished.diagnostics).toEqual([{ taskId: 'crash-test', code: 'task_recovered', pendingInputIds: [], outcome: 'ended' }]);
        expect(finished.trace.events.filter(event => event.kind === 'continuation')).toMatchObject([
            { inputId: input.inputId, requestIds: [request.id] },
        ]);
    } finally { await rm(directory, { recursive: true, force: true }); }
}, 25000);
