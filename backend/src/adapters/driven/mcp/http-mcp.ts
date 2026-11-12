import { createHash } from 'node:crypto';
import { McpClient, StreamableHttpTransport } from '@earendil-works/pi-mcp';
import type { ControlStore, Mcp } from '../../../application/ports';
import { active, own, requireRule, RuleError, canonical, type Json } from '../../../domain/model';
import type { CredentialScope } from './credentials';
import type { TaskConnectionStatus } from '../../../application/task-connections';

type Scope = { userId: string; executionId: string; sessionId: string; generation: number };
export interface McpEndpointCredentials {
    connection(id: string): { issuer: string; endpoint?: string };
    secret(scope: CredentialScope): Promise<{ url: string; token?: string; revision?: string }>;
    observe?(connection: string, revision: string, status: TaskConnectionStatus): void;
}
/** Per-operation client, per-request identity checks, no shared-user sessions or automatic write retries. */
export class HttpMcpGateway implements Mcp {
    constructor(private readonly store: ControlStore, private readonly vault: McpEndpointCredentials, private readonly fetcher: typeof fetch = fetch, private readonly taskId?: string) {}
    private async check(scope: Scope, connection: string): Promise<CredentialScope> {
        const e = await this.store.execution(scope.executionId); const user = await this.store.user(scope.userId);
        own(user, e); active(e, scope.generation);
        requireRule(e.sessionId === scope.sessionId && (await this.store.settings()).connections.includes(connection), 'forbidden');
        return { userId: user.id, executionId: e.id, connection, issuer: user.issuer, subject: user.subject };
    }
    private async client<T>(scope: Scope, connection: string, run: (client: McpClient) => Promise<T>) {
        const config = this.vault.connection(connection);
        const secrets = new Set<string>();
        const identity = await this.check(scope, connection);
        const initial = await this.vault.secret(identity);
        const endpoint = new URL(initial.url);
        if (config.endpoint) {
            const base = new URL(config.endpoint);
            requireRule(endpoint.origin === base.origin && endpoint.pathname.startsWith(base.pathname.replace(/\/$/, '') + '/'), 'forbidden');
        }
        secrets.add(initial.url);
        const pathParts = endpoint.pathname.split('/').filter(Boolean);
        const pathSecret = config.endpoint || (!initial.token && pathParts.length >= 3) ? pathParts.at(-1) : undefined;
        for (const value of [initial.token, pathSecret, ...endpoint.searchParams.values()])
            if (value) secrets.add(value);
        const client = new McpClient({ name: 'airic-work', version: '1.0.0', requestTimeoutMs: 15000 });
        let connected = false;
        let authorizationFailed = false;
        const observe = (status: TaskConnectionStatus) => {
            if (initial.revision) this.vault.observe?.(connection, initial.revision, status);
        };
        try {
            await client.connect(new StreamableHttpTransport({ url: endpoint.href, openGetStream: false, reconnect: { maxRetries: 0 }, fetch: async (url, init) => {
                requireRule(new URL(String(url)).href === endpoint.href, 'forbidden');
                const identity = await this.check(scope, connection);
                requireRule(identity.issuer === config.issuer, 'forbidden');
                const secret = await this.vault.secret(identity);
                requireRule(secret.url === endpoint.href && secret.token === initial.token && secret.revision === initial.revision, 'forbidden');
                const headers = new Headers(init?.headers);
                if (secret.token) headers.set('Authorization', `Bearer ${secret.token}`);
                let body = init?.body;
                if (this.taskId && typeof body === 'string') {
                    const message = JSON.parse(body);
                    if (typeof message.method === 'string' && message.id !== undefined) {
                        message.params = { ...message.params, _meta: { ...message.params?._meta, 'ai.airic/task_id': this.taskId } };
                        body = JSON.stringify(message);
                    }
                }
                const response = await this.fetcher(url, { ...init, body, headers, redirect: 'error', credentials: 'omit', signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) });
                if (response.status === 401 || (!connected && response.status === 403)) authorizationFailed = true;
                return response;
            } }));
            connected = true;
            const redact = (value: Json): Json => {
                if (typeof value === 'string') { for (const secret of secrets) value = value.replaceAll(secret, '[REDACTED]'); return value; }
                if (Array.isArray(value)) return value.map(redact);
                if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v)]));
                return value;
            };
            const result = redact(JSON.parse(JSON.stringify(await run(client))) as Json) as T;
            observe('available');
            return result;
        } catch (error) {
            if (error instanceof RuleError) throw error;
            observe(authorizationFailed ? 'authorization_failed' : 'unavailable');
            throw new RuleError('blocked', 'MCP authentication or transport failed; no automatic write retry');
        }
        finally { await client.close().catch(() => {}); }
    }
    /** Transfer bytes through the same scoped connection as the prepared CertLab operation. */
    async transferFile(scope: Scope, connection: string, transfer: {
        path: string; size: number; sha256: string;
    }, upload?: Buffer) {
        requireRule(/^\/api\/v1\/asset-transfers\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/content$/.test(transfer.path)
            && /^[0-9a-f]{64}$/.test(transfer.sha256)
            && Number.isSafeInteger(transfer.size) && transfer.size > 0
            && transfer.size <= 10 * 1024 * 1024, 'invalid', 'Invalid file transfer descriptor');
        const verified = (bytes: Buffer) => bytes.length === transfer.size
            && createHash('sha256').update(bytes).digest('hex') === transfer.sha256;
        if (upload) requireRule(verified(upload), 'invalid', 'File differs from the prepared transfer');
        const identity = await this.check(scope, connection);
        const secret = await this.vault.secret(identity);
        const endpoint = new URL(secret.url);
        requireRule(endpoint.protocol === 'https:' && secret.token, 'forbidden');
        const target = new URL(transfer.path, endpoint.origin);
        const headers = new Headers({ Authorization: `Bearer ${secret.token}` });
        if (upload) headers.set('Content-Type', 'application/octet-stream');
        let response: Response;
        try {
            response = await this.fetcher(target, {
                method: upload ? 'PUT' : 'GET', headers,
                ...(upload ? { body: new Uint8Array(upload) } : {}),
                redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(15000),
            });
        } catch {
            throw new RuleError('blocked', 'File transfer connection unavailable');
        }
        if (!response.ok || upload) {
            await response.body?.cancel();
            if (secret.revision && response.status === 401)
                this.vault.observe?.(connection, secret.revision, 'authorization_failed');
            requireRule(response.ok, 'blocked', 'File transfer rejected by the application');
            return undefined;
        }
        requireRule(response.body, 'blocked', 'File transfer returned no content');
        const chunks: Buffer[] = [];
        let count = 0;
        const reader = response.body.getReader();
        try {
            for (;;) {
                const { done, value } = await reader.read();
                if (done) break;
                count += value.length;
                requireRule(count <= transfer.size, 'blocked', 'File exceeds the prepared size');
                chunks.push(Buffer.from(value));
            }
        } finally {
            await reader.cancel().catch(() => {});
            reader.releaseLock();
        }
        const bytes = Buffer.concat(chunks);
        requireRule(verified(bytes), 'blocked', 'File differs from the prepared transfer');
        return bytes;
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
