import { createHash } from 'node:crypto';
import { McpClient, StreamableHttpTransport } from '@earendil-works/pi-mcp';
import type { ControlStore, Mcp } from '../../../application/ports';
import { active, own, requireRule, RuleError, canonical, type Json } from '../../../domain/model';
import { McpCredentialVault, type CredentialScope } from './credentials';

type Scope = { userId: string; executionId: string; sessionId: string; generation: number };
/** Per-operation client, per-request identity checks, no shared-user sessions or automatic write retries. */
export class HttpMcpGateway implements Mcp {
    constructor(private readonly store: ControlStore, private readonly vault: McpCredentialVault, private readonly fetcher: typeof fetch = fetch) {}
    private async check(scope: Scope, connection: string): Promise<CredentialScope> {
        const e = await this.store.execution(scope.executionId); const user = await this.store.user(scope.userId);
        own(user, e); active(e, scope.generation);
        requireRule(e.sessionId === scope.sessionId && (await this.store.settings()).connections.includes(connection), 'forbidden');
        return { userId: user.id, executionId: e.id, connection, issuer: user.issuer, subject: user.subject };
    }
    private async client<T>(scope: Scope, connection: string, run: (client: McpClient) => Promise<T>) {
        const config = this.vault.connection(connection);
        const secrets = new Set<string>();
        const client = new McpClient({ name: 'airic-work', version: '1.0.0', requestTimeoutMs: 15000 });
        try {
            await client.connect(new StreamableHttpTransport({ url: config.endpoint, openGetStream: false, reconnect: { maxRetries: 0 }, fetch: async (url, init) => {
                requireRule(new URL(String(url)).origin === new URL(config.endpoint).origin && new URL(String(url)).pathname === new URL(config.endpoint).pathname, 'forbidden');
                const identity = await this.check(scope, connection);
                requireRule(identity.issuer === config.issuer, 'forbidden');
                const secret = await this.vault.secret(identity);
                secrets.add(secret.token);
                const headers = new Headers(init?.headers);
                headers.set('Authorization', `Bearer ${secret.token}`); headers.set('X-Airic-Execution-Id', scope.executionId);
                return this.fetcher(url, { ...init, headers, redirect: 'error', credentials: 'omit', signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
            } }));
            const redact = (value: Json): Json => {
                if (typeof value === 'string') { for (const secret of secrets) value = value.replaceAll(secret, '[REDACTED]'); return value; }
                if (Array.isArray(value)) return value.map(redact);
                if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v)]));
                return value;
            };
            return redact(JSON.parse(JSON.stringify(await run(client))) as Json) as T;
        } catch (error) { if (error instanceof RuleError) throw error; throw new RuleError('blocked', 'MCP authentication or transport failed; no automatic write retry'); }
        finally { await client.close().catch(() => {}); }
    }
    async tools(userId: string, connection: string, scope?: Omit<Scope, 'userId'>) {
        requireRule(scope, 'invalid', 'execution scope required');
        return this.client({ userId, ...scope }, connection, async client => (await client.listTools()).map(t => {
            const kind = (t._meta?.['ai.airic/execution'] as { kind?: string } | undefined)?.kind;
            const classification = kind === 'command' ? 'write' as const : kind === 'query' || t.annotations?.readOnlyHint === true ? 'read' as const : undefined;
            return { name: t.name, description: t.description ?? t.name, inputSchema: t.inputSchema as Json, schemaRevision: createHash('sha256').update(canonical(t)).digest('hex'), ...(classification ? { classification, classificationSource: kind ? 'service.meta.kind' : 'service.readOnlyHint' } : {}) };
        }));
    }
    sanitize(_connection: string, value: Json): Json {
        if (typeof value === 'string') { try { const parsed = JSON.parse(value) as Json; if (parsed && typeof parsed === 'object') return JSON.stringify(this.sanitize(_connection, parsed)); } catch { /* plain text */ } return value; }
        if (Array.isArray(value)) return value.map(v => this.sanitize(_connection, v));
        if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !/^(authorization|access_token|refresh_token|password|secret|token|api_key|client_secret)$/i.test(k)).map(([k, v]) => [k, this.sanitize(_connection, v)]));
        return value;
    }
    async call(scope: Scope, connection: string, tool: string, parameters: Json) {
        const result = await this.client(scope, connection, client => client.callTool(tool, parameters as Record<string, unknown>));
        // Transport success is not proof of business success. Preserve the service result for the Agent/OM.
        return { status: result.isError ? 'failed' as const : 'unknown' as const, result: this.sanitize(connection, JSON.parse(JSON.stringify(result)) as Json) };
    }
}
