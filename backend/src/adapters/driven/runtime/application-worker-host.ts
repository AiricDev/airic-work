import { Type } from '@earendil-works/pi-ai';
import { defineTool, type ToolRegistration } from '@earendil-works/pi-durable';
import { readFile } from 'node:fs/promises';
import { active, own, requireRule, type Execution, type Input, type Option, type Context } from '../../../domain/model';
import type { ControlStore, Methods } from '../../../application/ports';
import type { DecisionUseCases } from '../../../application/decision';
import type { WorkerHost } from './pi-runtime';

/** Maps runtime scope to existing use cases; the model never chooses a user or a generation. */
export class ApplicationWorkerHost implements WorkerHost {
    constructor(private readonly store: ControlStore, private readonly methods: Methods, private readonly decisions: DecisionUseCases, private readonly skillPath: string, private readonly capabilities: (e: Execution) => Promise<ToolRegistration[]> = async () => []) {}
    async check(e: Execution) {
        const current = await this.store.execution(e.id);
        own(await this.store.user(e.ownerId), current);
        requireRule(current.sessionId === e.sessionId && current.ownerId === e.ownerId, 'forbidden');
        active(current, e.generation);
    }
    async assembly(e: Execution) {
        requireRule(e.method, 'blocked');
        const worker = await readFile(this.skillPath, 'utf8');
        return { worker, root: await this.methods.read(e.method, e.method.root), version: JSON.stringify(e.method) };
    }
    async input(e: Execution, input: Input) {
        requireRule(input.sessionId === e.sessionId && input.executionId === e.id && input.userId === e.ownerId, 'forbidden');
        if (input.kind !== 'user-decision') return { content: JSON.stringify({ kind: input.kind, task: e.creation.task, instruction: e.creation.instruction, text: input.text, files: input.files }) };
        const requests = await this.store.requests(e.id);
        for (const request of requests) {
            const decision = (await this.store.decisions(request.id)).find(d => d.id === input.sourceId);
            if (!decision) continue;
            const revision = request.contexts.find(c => c.revision === decision.contextRevision);
            requireRule(revision, 'blocked');
            return { requestId: request.id, content: JSON.stringify({ kind: input.kind, decision, question: request.question, context: revision, option: request.options.find(o => o.id === decision.optionId), instruction: e.creation.instruction, files: input.files }) };
        }
        throw new Error('UserDecision source unavailable');
    }
    async tools(e: Execution) {
        return [defineTool({ name: 'work_read_method', description: 'Read a file from this Execution fixed OM revision.', parameters: Type.Object({ path: Type.String() }), replay: 'safe', execute: async ({ path }) => {
            requireRule(e.method, 'blocked');
            return { output: [{ type: 'text' as const, text: await this.methods.read(e.method, path) }] };
        } }), ...await this.capabilities(e)];
    }
    request(e: Execution, key: string, question: string, options: Option[] = [], decisionContext?: Context, summary?: string) {
        return this.decisions.createDecisionRequest(e.ownerId, e.id, e.generation, key, question, options, decisionContext ?? { revision: 1, content: { question }, sources: [] }, summary).then(r => r.id);
    }
}
