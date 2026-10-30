import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { parseEnv } from 'node:util';
import { z } from 'zod';
import { methodSource } from '../adapters/driven/methods/repositories';
import { type ControlStore, type Support, type Identity, type Runtime, type Workspace, type Files, type Methods, type History, type Mcp } from '../application/ports';
import { LocalBlobFiles } from '../adapters/driven/files/local-blob-files';
import { HttpsUserInfoIdentity, type HttpsUserInfoOptions } from '../adapters/driven/identity/https-user-info';
import { GitMethods, type GitMethodsOptions } from '../adapters/driven/methods/git-methods';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { requireRule, RuleError, runtimePath, type Settings, type Execution, type Json } from '../domain/model';
import { openControlDatabase, openSqliteDatabase } from '../adapters/driven/sqlite/database';
import { migrate } from '../adapters/driven/sqlite/migrations';
import { SqliteControlStore } from '../adapters/driven/sqlite/store';
import { settings } from '../adapters/driven/sqlite/schema';
import { SystemSupport } from '../adapters/driven/support/system-support';
import { type ToolRegistration, defineTool } from '@earendil-works/pi-durable';
import { ExecutionRunner } from '../adapters/driving/worker/execution-runner';
import { type Application } from '../application/application';
import { type Models, Type } from '@earendil-works/pi-ai';
import { ApplicationWorkerHost } from '../adapters/driven/runtime/application-worker-host';
import { PiRuntime } from '../adapters/driven/runtime/pi-runtime';
import { PiHistory } from '../adapters/driven/runtime/pi-history';
import { DecisionUseCases } from '../application/decision';
import { ApplicationPolicy } from '../application/policy';
import { McpCredentialUseCases } from '../application/mcp-credentials';
import { McpCredentialVault, type McpConnection } from '../adapters/driven/mcp/credentials';
import { HttpMcpGateway } from '../adapters/driven/mcp/http-mcp';
import { AccountMaintenanceUseCases } from '../application/account-maintenance';
import { SqliteAccountAdministration } from '../adapters/driven/sqlite/account-maintenance';

/** 仅组合根使用的适配器注册表；不作为业务能力的服务定位器。 */
export interface AdapterBindings {
    store: ControlStore;
    support: Support;
    identity: Identity;
    runtime: Runtime;
    workspace: Workspace;
    files: Files;
    methods: Methods;
    history: History;
    mcp: Mcp;
}

export interface FileStorageOptions {
    /** 可信宿主配置的绝对目录，不接受请求体路径；不与 Workspace/Agent 共享。 */
    directory: string;
}

/** 没有常驻句柄或后台进程，无须空的 close/dispose；每次操作自行关闭文件。 */
export async function createFileStorage(options: FileStorageOptions): Promise<{ files: Files }> {
    return { files: await LocalBlobFiles.open(options.directory) };
}

/** 认证配置来自可信宿主；不启动 HTTP、不保存 token、不创建本地用户或管理员。 */
export function createIdentity(options: HttpsUserInfoOptions): { identity: Identity } {
    return { identity: new HttpsUserInfoIdentity(options) };
}

/** 宿主配置 URL 受管 clone 或直接复用本地 Git 目录；不自动同步本地仓库，不装配 Agent/控制记录或持有常驻句柄。 */
export async function createMethods(options: GitMethodsOptions): Promise<{ methods: Methods }> {
    return { methods: await GitMethods.open(options) };
}

export interface PersistenceOptions {
    /** 生产使用绝对文件路径；:memory: 仅用于隔离测试，不具备重启持久性。 */
    filename: string;
    /** 仅空库初始化时使用；重开绝不覆盖已有设置，也不创建管理员。 */
    initialSettings: Settings;
}

export interface PersistenceResources {
    store: ControlStore;
    support: Support;
    close(): void;
}

/** 仅创建本批拥有的资源，不伪造其他 AdapterBindings 或启动后台工作。调用方必须关闭。 */
export function createPersistence(options: PersistenceOptions): PersistenceResources {
    requireRule(options.initialSettings.version === 0, 'invalid', 'initial settings version must be zero');
    runtimePath(options.initialSettings.root);
    const connection = openControlDatabase(options.filename);
    try {
        migrate(connection);
        drizzle(connection).insert(settings).values({ id: 1, ...options.initialSettings }).onConflictDoNothing().run();
        const store = new SqliteControlStore(connection);
        return {
            store, support: new SystemSupport(),
            close() { if (connection.open) connection.close(); },
        };
    } catch (error) {
        connection.close();
        if (error instanceof RuleError) throw error;
        throw new RuleError('blocked', 'persistence initialization unavailable');
    }
}

/** Worker 的宿主配置；模型凭据、Skill 位置和工具能力由调用方提供。 */
export interface WorkerOptions {
    directory: string;
    models: Models;
    model: { provider: string; modelId: string };
    skillPath: string;
    tools?: (e: Execution) => Promise<ToolRegistration[]>;
}

/** 业务 MCP 的固定连接及凭据存储配置，不接受模型或请求体覆盖 URL/密钥。 */
export interface McpIntegrationOptions {
    directory: string;
    key: Uint8Array;
    connections: McpConnection[];
    fetch?: typeof fetch;
}

// 宿主配置从这一入口导入；具体 adapter 仍拥有自身构造参数类型。
export type { HttpsUserInfoOptions, GitMethodsOptions, McpConnection };

/** Composition boundary: callers supply models/credentials and already configured infrastructure. */
export function createWorker(options: WorkerOptions, store: ControlStore, methods: Methods, support: Support) {
    const decisions = new DecisionUseCases(store, support, new ApplicationPolicy(store, support));
    const host = new ApplicationWorkerHost(store, methods, decisions, options.skillPath, options.tools);
    const runtime = new PiRuntime(options.directory, options.models, options.model, host);
    return { runtime, history: new PiHistory(runtime, async sessionId => { const e = (await store.executions()).find(e => e.sessionId === sessionId); requireRule(e, 'not-found'); await runtime.ensure(e); }), runner: (application: Application) => new ExecutionRunner(application, store, runtime), close: () => runtime.close() };
}

/** Secrets and transport stay in the host. Discovery runs as an Agent tool, never during Session history reopen. */
export function createMcpIntegration(options: McpIntegrationOptions, store: ControlStore) {
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

/** 仅现存文件；不执行 migrate、初始化 Settings、注册到普通容器或提供服务入口。 */
export function createAccountMaintenance(filename: string) {
    const connection = openSqliteDatabase(filename, { fileMustExist: true });
    return {
        administration: new AccountMaintenanceUseCases(new SqliteAccountAdministration(connection)),
        close() { if (connection.open) connection.close(); },
    };
}

/** 部署配置只在组合根读取。路径相对于 .env 所在目录，系统环境变量优先；不修改 process.env。 */
export interface BootstrapConfiguration {
    server: { host: string; port: number };
    persistence: PersistenceOptions;
    files: FileStorageOptions;
    identity: HttpsUserInfoOptions;
    methods: GitMethodsOptions;
    worker: Omit<WorkerOptions, 'models' | 'tools'>;
    modelCredentials: { apiKey: string; environment: Record<string, string> };
    mcp: McpIntegrationOptions;
}

/** 错误只包含变量名，不输出原始配置、URL、JSON 或秘密值。 */
export function loadConfiguration(file?: string, environment: NodeJS.ProcessEnv = process.env): BootstrapConfiguration {
    const filename = resolve(file ?? resolve(import.meta.dirname, '../../../.env'));
    let contents = '';
    try { contents = readFileSync(filename, 'utf8'); }
    catch (error) { if (file !== undefined || !(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw new RuleError('invalid', 'Cannot read DOTENV_FILE'); }
    let values: Record<string, string>;
    try { values = {}; for (const [key, value] of Object.entries(parseEnv(contents))) if (value !== undefined) values[key] = value; }
    catch { throw new RuleError('invalid', 'Invalid DOTENV_FILE'); }
    for (const [key, value] of Object.entries(environment)) if (value !== undefined) values[key] = value;
    const base = dirname(filename);
    const value = (key: string, fallback = '') => values[key] ?? fallback;
    const fail = (key: string): never => { throw new RuleError('invalid', `Invalid configuration: ${key}`); };
    const parse = <T>(key: string, schema: z.ZodType<T>, fallback?: string): T => {
        const result = schema.safeParse(value(key, fallback));
        return result.success ? result.data : fail(key);
    };
    const json = <T>(key: string, schema: z.ZodType<T>, fallback?: string): T => {
        let data: unknown;
        try { data = JSON.parse(value(key, fallback)); } catch { return fail(key); }
        const result = schema.safeParse(data);
        return result.success ? result.data : fail(key);
    };
    const text = z.string().trim().min(1);
    const number = (key: string, fallback: number, max = Number.MAX_SAFE_INTEGER - 1) => parse(key, z.coerce.number().int().positive().max(max), String(fallback));
    const path = (key: string, fallback: string) => resolve(base, parse(key, text, fallback));
    const https = z.string().url().refine(s => { try { const u = new URL(s); return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash; } catch { return false; } });
    const data = path('AIRIC_DATA_DIR', '.airic-data');
    const sources = json('AIRIC_OM_SOURCES', z.record(text, z.union([text,
        z.strictObject({ kind: z.literal('local'), directory: text, remote: text.optional() }),
        z.strictObject({ kind: z.literal('managed'), repository: text }),
    ])));
    if (!Object.keys(sources).length) fail('AIRIC_OM_SOURCES');
    for (const [id, source] of Object.entries(sources)) {
        if (typeof source !== 'string' && source.kind === 'local') source.directory = resolve(base, source.directory);
        else if (typeof source === 'string' && (source.startsWith('./') || source.startsWith('../'))) sources[id] = resolve(base, source);
        try { methodSource(sources[id]); } catch { fail('AIRIC_OM_SOURCES'); }
    }
    const omSource = parse('AIRIC_OM_SOURCE', text, Object.keys(sources)[0]);
    if (!Object.hasOwn(sources, omSource)) fail('AIRIC_OM_SOURCE');
    const root = parse('AIRIC_OM_ROOT', text, 'om.md');
    try { runtimePath(root); } catch { fail('AIRIC_OM_ROOT'); }
    const connections = json('AIRIC_MCP_CONNECTIONS', z.array(z.strictObject({ id: text, issuer: text, endpoint: https, issueEndpoint: https, revokeEndpoint: https })), '[]');
    if (new Set(connections.map(c => c.id)).size !== connections.length) fail('AIRIC_MCP_CONNECTIONS');
    const key = parse('AIRIC_MCP_ENCRYPTION_KEY', z.string().regex(/^[a-fA-F0-9]{64}$/));
    let ca: string | undefined;
    if (value('AIRIC_IDENTITY_CA_FILE')) { try { ca = readFileSync(path('AIRIC_IDENTITY_CA_FILE', ''), 'utf8'); } catch { fail('AIRIC_IDENTITY_CA_FILE'); } }
    return {
        server: { host: parse('AIRIC_HOST', text, '127.0.0.1'), port: number('AIRIC_PORT', 8010, 65535) },
        persistence: { filename: path('AIRIC_DATABASE_PATH', resolve(data, 'db/airic.sqlite')), initialSettings: {
            version: 0, omSource, branch: parse('AIRIC_OM_BRANCH', text, 'main'), root, connections: connections.map(c => c.id),
        } },
        files: { directory: path('AIRIC_BLOB_DIRECTORY', resolve(data, 'blobs')) },
        identity: {
            issuer: parse('AIRIC_IDENTITY_ISSUER', text), endpoint: parse('AIRIC_IDENTITY_ENDPOINT', https),
            fields: { subject: parse('AIRIC_IDENTITY_SUBJECT_FIELD', text, 'sub'), name: parse('AIRIC_IDENTITY_NAME_FIELD', text, 'name') },
            limits: { timeoutMs: number('AIRIC_IDENTITY_TIMEOUT_MS', 10000, 2147483647), maxResponseBytes: number('AIRIC_IDENTITY_MAX_RESPONSE_BYTES', 65536, 2147483647), maxTokenBytes: number('AIRIC_IDENTITY_MAX_TOKEN_BYTES', 16384, 2147483647) },
            ...(ca ? { ca } : {}),
        },
        methods: { directory: path('AIRIC_METHOD_DIRECTORY', resolve(data, 'methods')), sources,
            runtimeVersion: parse('AIRIC_RUNTIME_VERSION', text, 'pi-durable@1.4.0'), skillVersion: parse('AIRIC_WORKER_SKILL_VERSION', text, '0.2.0'),
            limits: { commandTimeoutMs: number('AIRIC_GIT_TIMEOUT_MS', 30000, 2147483647), maxTreeBytes: number('AIRIC_OM_MAX_TREE_BYTES', 10485760), maxFileBytes: number('AIRIC_OM_MAX_FILE_BYTES', 10485760), maxSnapshotBytes: number('AIRIC_OM_MAX_SNAPSHOT_BYTES', 134217728), historyEntries: number('AIRIC_OM_HISTORY_ENTRIES', 50) },
        },
        worker: { directory: path('AIRIC_RUNTIME_DIRECTORY', resolve(data, 'executions')), skillPath: path('AIRIC_WORKER_SKILL_PATH', 'backend/skills/airic-work-worker/SKILL.md'),
            model: { provider: parse('AIRIC_MODEL_PROVIDER', text, 'openai'), modelId: parse('AIRIC_MODEL_ID', text, 'gpt-6.1-sol') } },
        modelCredentials: { apiKey: value('AIRIC_MODEL_API_KEY'), environment: json('AIRIC_MODEL_ENV', z.record(z.string(), z.string()), '{}') },
        mcp: { directory: path('AIRIC_CREDENTIAL_DIRECTORY', resolve(data, 'credentials')), key: Buffer.from(key, 'hex'), connections },
    };
}

/** 从显式配置建立模型集合；不把 .env 写进全局环境，也不从宿主其他登录文件隐式取得身份。 */
export async function createConfiguredModels(config: BootstrapConfiguration): Promise<Models> {
    const { builtinModels } = await import('@earendil-works/pi-ai/providers/all');
    const { InMemoryCredentialStore } = await import('@earendil-works/pi-ai');
    requireRule(!!config.modelCredentials.apiKey.trim(), 'invalid', 'Invalid configuration: AIRIC_MODEL_API_KEY');
    const credentials = new InMemoryCredentialStore();
    await credentials.modify(config.worker.model.provider, async () => ({ type: 'api_key', key: config.modelCredentials.apiKey, env: config.modelCredentials.environment }));
    const models = builtinModels({ credentials, authContext: { env: async () => undefined, fileExists: async () => false } });
    requireRule(models.getModel(config.worker.model.provider, config.worker.model.modelId), 'invalid', 'Invalid configuration: AIRIC_MODEL_PROVIDER/AIRIC_MODEL_ID');
    return models;
}

/** dotenv → adapter → 应用容器。Workspace 是能力实现而非配置值，当前仍由宿主提供。 */
export async function createConfiguredBackend(config: BootstrapConfiguration, workspace: Workspace, models?: Models) {
    const modelRegistry = models ?? await createConfiguredModels(config);
    const persistence = createPersistence(config.persistence);
    let worker: ReturnType<typeof createWorker> | undefined;
    let backend: Awaited<ReturnType<typeof import('./container').createBackend>> | undefined;
    try {
        const { identity } = createIdentity(config.identity);
        const { files } = await createFileStorage(config.files);
        const { methods } = await createMethods(config.methods);
        const mcp = createMcpIntegration(config.mcp, persistence.store);
        let application!: Application;
        worker = createWorker({ ...config.worker, models: modelRegistry, tools: async e => mcp.tools(application, e) }, persistence.store, methods, persistence.support);
        const { createBackend } = await import('./container');
        backend = createBackend({ ...persistence, identity, files, methods, workspace, runtime: worker.runtime, history: worker.history, mcp: mcp.gateway });
        application = backend.application;
        const resources = worker;
        return { ...backend, credentials: mcp.credentials, runner: resources.runner(application),
            async close() { try { await backend!.dispose(); } finally { try { await resources.close(); } finally { persistence.close(); } } },
        };
    } catch (error) {
        try { await backend?.dispose(); } finally { try { await worker?.close(); } finally { persistence.close(); } }
        throw error;
    }
}
