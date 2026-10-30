import { defineTool, type ToolRegistration } from '@earendil-works/pi-durable';
import type { TSchema } from '@earendil-works/pi-ai';
import type { Application } from '../../../application/application';
import type { Execution, Json } from '../../../domain/model';

export interface WorkerMcpDefinition {
    /** Collision-free name exposed to the model; source names remain exact in the MCP call record. */
    modelName: string;
    connection: string;
    tool: string;
    description: string;
    schemaRevision: string;
    parameters: TSchema;
}
/** MCP schema-to-Pi bridge; all effects pass through McpUseCases and its durable-before-network contract. */
export class McpWorkerTools {
    constructor(private readonly application: Application) {}
    create(e: Execution, definitions: WorkerMcpDefinition[]): ToolRegistration[] {
        return definitions.map(definition => defineTool({ name: definition.modelName, description: definition.description, parameters: definition.parameters,
            // Safe only for replay of the SAME host tool identity: the application returns recorded/unknown effects without resending.
            replay: 'safe', execute: async (parameters, api) => {
                const current = await this.application.query.queryExecution(e.ownerId, e.id);
                const result = await this.application.mcpCases.callMcp(e.ownerId, e.id, current.generation, definition.connection, definition.tool, parameters as Json,
                    `pi:${e.sessionId}:${api.taskId}`, definition.schemaRevision);
                return { output: [{ type: 'text', text: JSON.stringify(result) }] };
            } }));
    }
}
