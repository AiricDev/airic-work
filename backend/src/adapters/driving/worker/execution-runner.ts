import type { Application } from '../../../application/application';
import type { ControlStore } from '../../../application/ports';
import { PiRuntime } from '../../driven/runtime/pi-runtime';
import { requireRule } from '../../../domain/model';

/** Explicit host pump. Durable pending inputs survive process exit; no detached unobserved async loop. */
export class ExecutionRunner {
    constructor(private readonly application: Application, private readonly store: ControlStore, private readonly runtime: PiRuntime) {}
    async run(userId: string, executionId: string) {
        let e = await this.application.query.queryExecution(userId, executionId);
        requireRule(e.phase !== 'stopping', 'blocked', 'execution is stopping');
        await this.application.execution.prepareExecution(userId, executionId);
        e = await this.application.query.queryExecution(userId, executionId);
        await this.runtime.ensure(e);
        if (e.phase === 'running') await this.runtime.cancelQuiesce(e);
        const pending = (await this.store.inputs(e.id)).filter(i => i.status === 'pending').sort((a, b) => a.sequence - b.sequence);
        const deliveryFailures: unknown[] = [];
        for (const input of pending) {
            try { await this.application.input.dispatchInput(userId, input.id); }
            catch (error) { deliveryFailures.push(error); }
        }
        try { await this.runtime.drain(e.sessionId); }
        catch (error) {
            const failed = await this.application.query.queryExecution(userId, executionId);
            if (failed.phase === 'running') {
                await this.runtime.stop(failed);
                await this.application.execution.failExecution(userId, executionId, failed.generation);
            }
            throw error;
        }
        if (deliveryFailures.length) throw deliveryFailures[0];
        e = await this.application.query.queryExecution(userId, executionId);
        if (e.phase === 'running') {
            await this.runtime.quiesce(e);
            try { await this.application.execution.finishExecution(userId, e.id, e.generation); }
            catch (error) { await this.runtime.cancelQuiesce(e); throw error; }
        }
        return this.application.query.queryExecution(userId, executionId);
    }
}
