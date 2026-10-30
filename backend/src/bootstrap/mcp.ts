import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-durable';
import type { Application } from '../application/application';
import type { ControlStore } from '../application/ports';
import { McpCredentialUseCases } from '../application/mcp-credentials';
import { McpCredentialVault, type McpConnection } from '../adapters/driven/mcp/credentials';
import { HttpMcpGateway } from '../adapters/driven/mcp/http-mcp';
import type { Execution, Json } from '../domain/model';

/** Secrets and transport stay in the host. Discovery runs as an Agent tool, never during Session history reopen. */
export function createMcpIntegration(options: { directory: string; key: Uint8Array; connections: McpConnection[]; fetch?: typeof fetch }, store: ControlStore) {
    const vault = new McpCredentialVault(options.directory, options.key, options.connections, options.fetch);
    const gateway = new HttpMcpGateway(store, vault, options.fetch);
    return { gateway, credentials: new McpCredentialUseCases(store, vault),
        tools: (application: Application, e: Execution) => [
            defineTool({ name: 'work_discover_mcp', description: 'List current business MCP tools and their exact input schemas and revisions. Credentials remain with the host.', parameters: Type.Object({ connection: Type.String() }), replay: 'safe', execute: async ({ connection }) => {
                const current = await application.query.queryExecution(e.ownerId, e.id);
                const definitions = await application.mcpCases.discoverMcpTools(e.ownerId, e.id, current.generation, connection);
                return { output: [{ type: 'text', text: JSON.stringify(definitions) }] };
            } }),
            defineTool({ name: 'work_call_mcp', description: 'Call a discovered business MCP tool using its exact schema/revision. Preserve original business operation identity on recovery.', parameters: Type.Object({ connection: Type.String(), tool: Type.String(), schemaRevision: Type.String(), parameters: Type.Record(Type.String(), Type.Unknown()) }), replay: 'safe', execute: async (args, api) => {
                const current = await application.query.queryExecution(e.ownerId, e.id);
                const result = await application.mcpCases.callMcp(e.ownerId, e.id, current.generation, args.connection, args.tool, args.parameters as Json, `pi:${e.sessionId}:${api.taskId}`, args.schemaRevision);
                return { output: [{ type: 'text', text: JSON.stringify(result) }] };
            } }),
        ],
    };
}
