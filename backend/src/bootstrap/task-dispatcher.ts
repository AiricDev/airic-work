import type { TaskCreationRecord } from '../application/task-creation';
import type { openTaskRuntime } from './task-runtime';

type TaskRuntime = Awaited<ReturnType<typeof openTaskRuntime>>;
type DispatchRuntime = Pick<TaskRuntime, 'settleCancellation' | 'needsRun' | 'close'> & { run(): Promise<unknown> };

export class TaskDispatcher<Runtime extends DispatchRuntime = TaskRuntime> {
    private readonly runtimes = new Map<string, Promise<Runtime>>();
    private readonly failures = new Set<string>();
    private readonly active = new Map<string, Promise<void>>();
    private readonly stopping = new Map<string, Promise<void>>();
    private closed = false;

    constructor(
        private readonly list: () => TaskCreationRecord[],
        private readonly open: (record: TaskCreationRecord) => Promise<Runtime>,
        private readonly onError: (taskId: string) => void,
    ) {}

    runtime(record: TaskCreationRecord) {
        const existing = this.runtimes.get(record.taskId);
        if (existing) return existing;
        const runtime = this.open(record).catch(error => {
            this.runtimes.delete(record.taskId);
            throw error;
        });
        this.runtimes.set(record.taskId, runtime);
        return runtime;
    }

    blocked(taskId: string) { return this.failures.has(taskId); }

    settleCancellation(record: TaskCreationRecord) {
        const existing = this.stopping.get(record.taskId);
        if (existing) return existing;
        const stop = this.runtime(record).then(runtime => runtime.settleCancellation())
            .finally(() => this.stopping.delete(record.taskId));
        this.stopping.set(record.taskId, stop);
        return stop;
    }

    async pump() {
        if (this.closed) return;
        const scheduled = [];
        for (const record of this.list()) {
            if (this.active.has(record.taskId)) continue;
            const work = this.runPending(record).finally(() => this.active.delete(record.taskId));
            this.active.set(record.taskId, work);
            scheduled.push(work);
        }
        await Promise.all(scheduled);
    }

    private async runPending(record: TaskCreationRecord) {
        try {
            const runtime = await this.runtime(record);
            await this.settleCancellation(record);
            if (!this.closed && !this.failures.has(record.taskId) && await runtime.needsRun()) await runtime.run();
        } catch {
            const firstFailure = !this.failures.has(record.taskId);
            this.failures.add(record.taskId);
            if (firstFailure) this.onError(record.taskId);
        }
    }

    async close() {
        this.closed = true;
        try { await Promise.allSettled([...this.active.values(), ...this.stopping.values()]); }
        finally {
            await Promise.all([...this.runtimes.values()].map(async runtime => {
                try { await (await runtime).close(); } catch { /* report via the task diagnostic */ }
            }));
        }
    }
}
