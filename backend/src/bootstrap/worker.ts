import type { ToolRegistration } from '@earendil-works/pi-durable';
import { requireRule } from '../domain/model';
import type { Execution } from '../domain/model';
import { ExecutionRunner } from '../adapters/driving/worker/execution-runner';
import type { Application } from '../application/application';
import type { Models } from '@earendil-works/pi-ai';
import { ApplicationWorkerHost } from '../adapters/driven/runtime/application-worker-host';
import { PiRuntime } from '../adapters/driven/runtime/pi-runtime';
import { PiHistory } from '../adapters/driven/runtime/pi-history';
import { DecisionUseCases } from '../application/decision';
import { ApplicationPolicy } from '../application/policy';
import type { ControlStore, Methods, Support } from '../application/ports';

/** Composition boundary: callers supply models/credentials and already configured infrastructure. */
export function createWorker(options: { directory: string; models: Models; model: { provider: string; modelId: string }; skillPath: string; tools?: (e: Execution) => Promise<ToolRegistration[]> }, store: ControlStore, methods: Methods, support: Support) {
    const decisions = new DecisionUseCases(store, support, new ApplicationPolicy(store, support));
    const host = new ApplicationWorkerHost(store, methods, decisions, options.skillPath, options.tools);
    const runtime = new PiRuntime(options.directory, options.models, options.model, host);
    return { runtime, history: new PiHistory(runtime, async sessionId => { const e = (await store.executions()).find(e => e.sessionId === sessionId); requireRule(e, 'not-found'); await runtime.ensure(e); }), runner: (application: Application) => new ExecutionRunner(application, store, runtime), close: () => runtime.close() };
}
