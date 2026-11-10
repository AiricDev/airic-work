import type { Application } from '../../../application/application';
import type { ControlStore } from '../../../application/ports';
import { PiRuntime } from '../../driven/runtime/pi-runtime';
import { requireRule } from '../../../domain/model';

/** Explicit host pump. Durable pending inputs survive process exit; no detached unobserved async loop. */
export class ExecutionRunner {
    constructor(private readonly application: Application, private readonly store: ControlStore, private readonly runtime: PiRuntime) {}
    async run(userId: string, executionId: string, revision?: string) {
        let e = await this.application.query.queryExecution(userId, executionId);
        requireRule(e.phase !== 'stopping', 'blocked', 'execution is stopping');
        await this.application.execution.prepareExecution(userId, executionId, revision);
        e = await this.application.query.queryExecution(userId, executionId);
        await this.runtime.ensure(e);
        if (e.phase === 'running') await this.runtime.cancelQuiesce(e);
        const drain = async () => {
            try { await this.runtime.drain(e.sessionId); }
            catch (error) {
                const failed = await this.application.query.queryExecution(userId, executionId);
                if (failed.phase === 'stopping' || failed.phase === 'stopped') return false;
                if (failed.phase === 'running') {
                    await this.runtime.stop(failed);
                    await this.application.execution.failExecution(userId, executionId, failed.generation);
                }
                throw error;
            }
            return true;
        };
        if (!await drain()) return this.application.query.queryExecution(userId, executionId);
        for (let input = await this.application.input.nextReadyInput(e); input; input = await this.application.input.nextReadyInput(e)) {
            await this.application.input.dispatchInput(userId, input.id);
            if (!await drain()) return this.application.query.queryExecution(userId, executionId);
        }
        e = await this.application.query.queryExecution(userId, executionId);
        if (e.phase === 'running' && !(await this.store.inputs(e.id)).some(input => input.status === 'pending')) {
            await this.runtime.quiesce(e);
            try { await this.application.execution.finishExecution(userId, e.id, e.generation); }
            catch (error) {
                const current = await this.application.query.queryExecution(userId, executionId);
                if (current.phase === 'stopping' || current.phase === 'stopped') return current;
                await this.runtime.cancelQuiesce(e);
                if (!(await this.store.inputs(e.id)).some(input => input.status === 'pending')) throw error;
            }
        }
        return this.application.query.queryExecution(userId, executionId);
    }
}
