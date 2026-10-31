import Fastify, { type FastifyRequest } from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { z } from 'zod';
import type { Application } from '../../../application/application';
import { DisabledAccountError } from '../../../application/account';
import type { McpCredentialUseCases } from '../../../application/mcp-credentials';
import { RuleError, type User } from '../../../domain/model';
import { InputValidationError, parseInput, ValidatedCommands } from '../validation/commands';
import { contracts, listQuery, methodQuery, projectDtoValue } from './contracts';
import { equalSecret, HttpError, Sessions } from './session';
import { createHash } from 'node:crypto';

export interface HttpOptions {
    application: Application;
    /** Trusted deployment identifier, never inferred from a caller-controlled header. */
    source: string;
    origins: string[];
    secureCookies?: boolean;
    session?: { idleMs: number; absoluteMs: number; capacity: number };
    uploadBytes?: number;
    now?: () => number;
    credentials?: McpCredentialUseCases;
    streamIntervalMs?: number;
}
interface Actor { user: User; token: string; sessionId?: string; csrf?: string }
const cookieName = 'airic_session';
const write = (method: string) => !['GET', 'HEAD', 'OPTIONS'].includes(method);
const idOf = (request: FastifyRequest) => parseInput(z.object({ id: z.string().min(1).max(200) }), request.params).id;
const keyOf = (request: FastifyRequest) => parseInput(z.string().trim().min(1).max(200), request.headers['idempotency-key']);

/** HTTP is a delivery adapter. It owns sessions and DTOs, never the worker's lifecycle or policy. */
export async function createHttpServer(options: HttpOptions) {
    const app = options.application;
    const commands = new ValidatedCommands(app);
    const now = options.now ?? Date.now;
    const sessionOptions = options.session ?? { idleMs: 30 * 60_000, absoluteMs: 8 * 60 * 60_000, capacity: 1000 };
    const uploadBytes = options.uploadBytes ?? 20 * 1024 * 1024;
    if (!options.source.trim() || !options.origins.length || [sessionOptions.idleMs, sessionOptions.absoluteMs, sessionOptions.capacity, uploadBytes].some(n => !Number.isSafeInteger(n) || n < 1))
        throw new Error('Invalid HTTP configuration');
    const origins = new Set(options.origins.map(origin => {
        const url = new URL(origin);
        if (!['https:', 'http:'].includes(url.protocol) || url.origin !== origin) throw new Error('Invalid HTTP origin');
        if (options.secureCookies !== false && url.protocol !== 'https:') throw new Error('Secure cookies require HTTPS origins');
        return origin;
    }));
    const sessions = new Sessions(now, sessionOptions.idleMs, sessionOptions.absoluteMs, sessionOptions.capacity);
    const actors = new WeakMap<FastifyRequest, Actor>();
    const attempts = new Map<string, { count: number; reset: number }>();
    const requests = new Map<string, { count: number; reset: number }>();
    let activeRequests = 0;
    const server = Fastify({ logger: false, bodyLimit: 1024 * 1024, requestTimeout: 30_000, connectionTimeout: 30_000, trustProxy: false });
    await server.register(cookie);
    await server.register(multipart, { limits: { fileSize: uploadBytes, files: 1, fields: 0, parts: 1 } });
    const cookieOptions = { httpOnly: true, secure: options.secureCookies !== false, sameSite: 'lax' as const, path: '/api/v1' };
    function origin(request: FastifyRequest) {
        if (typeof request.headers.origin !== 'string' || !origins.has(request.headers.origin))
            throw new HttpError(403, 'invalid-origin', '请求来源不被允许');
    }
    function bearer(request: FastifyRequest) {
        const value = request.headers.authorization;
        if (value === undefined) return undefined;
        const match = /^Bearer ([A-Za-z0-9._~+/-]+=*)$/.exec(value);
        if (!match || match[1].length > 16384) throw new HttpError(401, 'invalid-identity', '身份无效，请重新接入');
        return match[1];
    }
    async function verify(token: string) {
        try { return await app.account.ensureUser(token); }
        catch (error) {
            if (error instanceof DisabledAccountError) throw new HttpError(403, 'account-disabled', '账户已停用');
            if (error instanceof RuleError && error.code === 'forbidden') throw new HttpError(401, 'invalid-identity', '身份无效，请重新接入');
            throw new HttpError(503, 'identity-unavailable', '身份认证服务暂不可用');
        }
    }
    function limitLogin(request: FastifyRequest) {
        for (const [ip, item] of attempts) if (item.reset <= now()) attempts.delete(ip);
        const item = attempts.get(request.ip) ?? { count: 0, reset: now() + 60_000 };
        if (attempts.size >= 10_000 || ++item.count > 30) throw new HttpError(429, 'rate-limited', '请求过于频繁，请稍后再试');
        attempts.set(request.ip, item);
    }
    server.addHook('onRequest', async (request, reply) => {
        reply.header('cache-control', 'no-store').header('x-content-type-options', 'nosniff').header('referrer-policy', 'no-referrer');
        if (!request.routeOptions.url) throw new HttpError(404, 'not-found', '接口不存在');
        for (const [ip, item] of requests) if (item.reset <= now()) requests.delete(ip);
        const window = requests.get(request.ip) ?? { count: 0, reset: now() + 60_000 };
        if (requests.size >= 10000 || ++window.count > 6000 || activeRequests >= 64)
            throw new HttpError(429, 'rate-limited', '请求过于频繁，请稍后再试');
        requests.set(request.ip, window);
        if (request.routeOptions.url !== '/api/v1/stream') {
            activeRequests++;
            reply.raw.once('close', () => activeRequests--);
        }
        // Query strings must never be used for identity handoff.
        if (/[?&](?:token|access_token|ticket)=/i.test(request.url)) throw new HttpError(400, 'invalid-input', '不允许通过 URL 提交身份凭据');
        const token = bearer(request);
        const sessionId = request.cookies[cookieName];
        if (token && sessionId) {
            if (!sessions.get(sessionId)) reply.clearCookie(cookieName, cookieOptions);
            throw new HttpError(400, 'ambiguous-identity', '请只使用一种身份凭据');
        }
        const login = request.method === 'POST' && request.url.split('?')[0] === '/api/v1/auth/session';
        if (request.headers.origin && !origins.has(request.headers.origin)) throw new HttpError(403, 'invalid-origin', '请求来源不被允许');
        if (login) {
            origin(request); limitLogin(request);
            if (!token) throw new HttpError(401, 'invalid-identity', '需要集成方身份凭据');
            actors.set(request, { user: await verify(token), token });
            return;
        }
        const session = sessions.get(sessionId);
        if (!token && !session) {
            if (sessionId) reply.clearCookie(cookieName, cookieOptions);
            throw new HttpError(401, 'session-required', '请从业务系统重新进入工作台');
        }
        if (session && write(request.method)) {
            origin(request);
            const csrf = request.headers['x-csrf-token'];
            if (typeof csrf !== 'string' || !equalSecret(csrf, session.csrf)) throw new HttpError(403, 'invalid-csrf', '请求校验失败，请刷新后重试');
        }
        try {
            const user = await verify(token ?? session!.token);
            if (session && user.id !== session.userId) throw new HttpError(401, 'invalid-identity', '身份已变化，请重新接入');
            if (sessionId && session) sessions.touch(sessionId);
            actors.set(request, { user, token: token ?? session!.token, ...(session ? { sessionId, csrf: session.csrf } : {}) });
        } catch (error) {
            if (sessionId && error instanceof HttpError && error.status !== 503) { sessions.delete(sessionId); reply.clearCookie(cookieName, cookieOptions); }
            throw error;
        }
    });
    server.setErrorHandler((error, request, reply) => {
        const framework = error && typeof error === 'object' ? error as { statusCode?: number; code?: string } : {};
        let status = 500, code = 'internal-error', message = '服务暂不可用';
        if (error instanceof HttpError) { status = error.status; code = error.code; message = error.message; }
        else if (error instanceof InputValidationError) { status = 400; code = error.code; message = error.message; }
        else if (error instanceof RuleError) {
            const scoped = /^\/api\/v1\/(?:executions\/|decision-requests\/|episodes\/|projects\/|input-files\/)/.test(request.url)
                || (request.url.startsWith('/api/v1/om/') && !!(request.query as Record<string, unknown>).executionId);
            status = error.code === 'invalid' ? 400 : error.code === 'not-found' || (error.code === 'forbidden' && scoped) ? 404 : error.code === 'forbidden' ? 403 : error.code === 'conflict' || error.code === 'blocked' ? 409 : 503;
            code = status === 404 ? 'not-found' : error.code;
            message = status === 404 ? '记录不存在或不可访问' : error.code === 'blocked' ? '当前状态不允许此操作，请刷新记录并检查前置条件' : status === 409 ? '请求内容或版本冲突' : status === 403 ? '没有操作权限' : status === 400 ? '请求内容无效' : error.code === 'unknown' ? '操作结果尚未确认，请查询原记录' : '所需能力暂不可用';
        } else if (framework.statusCode === 413 || framework.code === 'FST_REQ_FILE_TOO_LARGE') { status = 413; code = 'too-large'; message = '内容超过允许大小'; }
        else if (framework.statusCode && framework.statusCode >= 400 && framework.statusCode < 500) { status = framework.statusCode; code = 'invalid-input'; message = '请求格式无效'; }
        reply.status(status).send({ code, message, requestId: request.id, ...(error instanceof InputValidationError ? { issues: error.issues } : {}) });
    });
    const actor = (request: FastifyRequest) => actors.get(request)!;
    const identity = (request: FastifyRequest) => ({ userId: actor(request).user.id, source: options.source });
    function page<T extends { id: string }>(request: FastifyRequest, items: T[]) {
        const q = parseInput(listQuery, request.query);
        const scope = createHash('sha256').update(JSON.stringify([actor(request).user.id, request.routeOptions.url, request.params, q.projectId, q.status])).digest('hex');
        let after: string | undefined;
        if (q.cursor) {
            try {
                const cursor = JSON.parse(Buffer.from(q.cursor, 'base64url').toString('utf8'));
                if (cursor.scope !== scope || typeof cursor.after !== 'string') throw new Error();
                after = cursor.after;
            } catch { throw new HttpError(400, 'invalid-cursor', '分页游标无效'); }
        }
        const sorted = items.slice().sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0).filter(item => !after || item.id > after);
        const selected = sorted.slice(0, q.limit);
        return { items: selected, ...(sorted.length > q.limit ? { cursor: Buffer.from(JSON.stringify({ scope, after: selected.at(-1)!.id })).toString('base64url') } : {}) };
    }
    type ContractName = keyof typeof contracts;
    const handlers: Record<ContractName, (request: FastifyRequest) => Promise<unknown>> = {
        session: async r => {
            if (!actor(r).sessionId) throw new HttpError(401, 'session-required', '需要工作台会话');
            return { user: actor(r).user, csrfToken: actor(r).csrf };
        },
        login: async r => {
            const a = actor(r), created = sessions.create(a.token, a.user.id);
            // Cookie emission is handled below to keep application handlers framework-independent.
            actors.set(r, { ...a, sessionId: created.id, csrf: created.session.csrf });
            return { user: a.user, csrfToken: created.session.csrf };
        },
        logout: async r => { if (actor(r).sessionId) sessions.delete(actor(r).sessionId!); return { ok: true }; },
        me: async r => app.account.profile(actor(r).user.id),
        profile: async r => commands.updateProfile(identity(r), r.body),
        preferences: async r => commands.updatePreferences(identity(r), r.body),
        projects: async r => page(r, await app.query.queryProjects(actor(r).user.id)),
        project: async r => app.query.queryProject(actor(r).user.id, idOf(r)),
        executions: async r => { const q = parseInput(listQuery, r.query); return page(r, (await app.query.queryExecutions(actor(r).user.id)).filter(e => !q.projectId || e.projectId === q.projectId)); },
        create: async r => commands.createExecution(identity(r), keyOf(r), r.body),
        execution: async r => app.query.queryExecution(actor(r).user.id, idOf(r)),
        cancel: async r => app.execution.requestCancellation(actor(r).user.id, idOf(r)),
        steering: async r => commands.submitSteering(identity(r), idOf(r), keyOf(r), r.body),
        requests: async r => { const q = parseInput(listQuery, r.query); return page(r, (await app.query.queryRequests(actor(r).user.id, undefined, q.projectId)).filter(item => !q.status || item.status === q.status)); },
        executionRequests: async r => { const q = parseInput(listQuery, r.query); return page(r, (await app.query.queryRequests(actor(r).user.id, idOf(r))).filter(item => !q.status || item.status === q.status)); },
        request: async r => app.query.queryDecisionRequest(actor(r).user.id, idOf(r)),
        decisions: async r => app.query.queryDecisions(actor(r).user.id, idOf(r)),
        answer: async r => commands.submitUserDecision(identity(r), idOf(r), keyOf(r), r.body),
        inputs: async r => app.query.queryInputs(actor(r).user.id, idOf(r)),
        upload: async r => {
            // Authorize before consuming file bytes.
            await app.query.queryExecution(actor(r).user.id, idOf(r));
            let upload: { name: string; bytes: Buffer } | undefined;
            for await (const part of r.parts()) {
                if (part.type !== 'file' || upload) throw new HttpError(400, 'invalid-input', '需要且只允许一个文件');
                const name = parseInput(z.string().min(1).max(255).refine(s => !/[\u0000-\u001f/\\]/.test(s)), part.filename);
                const bytes = await part.toBuffer();
                if (part.file.truncated) throw new HttpError(413, 'too-large', '文件超过允许大小');
                upload = { name, bytes };
            }
            if (!upload) throw new HttpError(400, 'invalid-input', '需要一个文件');
            return app.input.upload(actor(r).user.id, idOf(r), upload.name, upload.bytes);
        },
        file: async r => app.query.queryUpload(actor(r).user.id, idOf(r)),
        history: async r => {
            const q = parseInput(z.strictObject({ cursor: z.string().max(4096).optional() }), r.query);
            return app.query.querySession(actor(r).user.id, idOf(r), q.cursor);
        },
        episode: async r => app.query.queryEpisode(actor(r).user.id, idOf(r)),
        users: async r => page(r, await app.account.listUsers(actor(r).user.id)),
        user: async r => {
            const user = (await app.account.listUsers(actor(r).user.id)).find(u => u.id === idOf(r));
            if (!user) throw new HttpError(404, 'not-found', '记录不存在或不可访问');
            return user;
        },
        manage: async r => commands.manageUser(identity(r), idOf(r), r.body),
        settings: async r => app.settings.querySettings(actor(r).user.id),
        configure: async r => commands.configure(identity(r), r.body),
        connections: async r => app.query.queryConnections(actor(r).user.id, idOf(r)),
        calls: async r => {
            const q = parseInput(z.strictObject({ type: z.enum(['read', 'write', 'unknown']).optional(), cursor: z.string().max(4096).optional() }), r.query);
            return app.query.queryMcpCalls(actor(r).user.id, idOf(r), q.type, q.cursor);
        },
        call: async r => {
            const { callId } = parseInput(z.object({ callId: z.string().min(1).max(200) }), r.params);
            return app.query.queryMcpCall(actor(r).user.id, idOf(r), callId);
        },
        methodStatus: async r => app.method.methodStatus(actor(r).user.id),
        methodSnapshot: async r => { const q = parseInput(methodQuery, r.query); return app.method.browseMethod(actor(r).user.id, q.sha, q.executionId); },
        methodTree: async r => { const q = parseInput(methodQuery, r.query); return app.method.methodTree(actor(r).user.id, q.sha, q.executionId); },
        methodFile: async r => {
            const q = parseInput(methodQuery.required({ path: true }), r.query);
            const method = await app.method.browseMethod(actor(r).user.id, q.sha, q.executionId);
            return { method, path: q.path, content: await app.method.readMethod(actor(r).user.id, method, q.path) };
        },
        methodSearch: async r => {
            const q = parseInput(methodQuery.required({ q: true }), r.query);
            const method = await app.method.browseMethod(actor(r).user.id, q.sha, q.executionId);
            return { method, items: await app.method.searchMethod(actor(r).user.id, method, q.q) };
        },
        methodHistory: async r => app.method.cachedMethodHistory(actor(r).user.id),
        methodCommit: async r => {
            const { sha } = parseInput(z.object({ sha: z.string().regex(/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/) }), r.params);
            const q = parseInput(methodQuery, r.query);
            return app.method.methodCommit(actor(r).user.id, sha, q.executionId);
        },
        methodSync: async r => commands.syncMethod(identity(r)),
        connect: async r => {
            const { connection } = parseInput(z.object({ connection: z.string().min(1).max(200) }), r.params);
            if (!options.credentials) throw new HttpError(503, 'capability-unavailable', '后台凭据能力未装配');
            return options.credentials.connect(actor(r).user.id, idOf(r), connection, actor(r).token);
        },
        revoke: async r => {
            const { connection } = parseInput(z.object({ connection: z.string().min(1).max(200) }), r.params);
            if (!options.credentials) throw new HttpError(503, 'capability-unavailable', '后台凭据能力未装配');
            await options.credentials.revoke(actor(r).user.id, idOf(r), connection, actor(r).token);
            return { ok: true };
        },
    };
    for (const [name, contract] of Object.entries(contracts)) {
        server.route({
            method: contract.method.toUpperCase() as 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
            url: '/api/v1' + contract.path.replace(/\{(\w+)\}/g, ':$1'),
            handler: async (request, reply) => {
                const value = await handlers[name as ContractName](request);
                if (name === 'login') reply.setCookie(cookieName, actor(request).sessionId!, { ...cookieOptions, maxAge: Math.floor(sessionOptions.absoluteMs / 1000) });
                if (name === 'logout') reply.clearCookie(cookieName, cookieOptions);
                return projectDtoValue(contract.response, value);
            },
        });
    }
    server.get('/api/v1/input-files/:id/content', async (request, reply) => {
        const file = await app.query.queryUpload(actor(request).user.id, idOf(request));
        if (file.size > uploadBytes) throw new HttpError(413, 'too-large', '文件超过当前下载大小限制');
        const result = await app.input.readUpload(actor(request).user.id, file.id);
        const filename = encodeURIComponent(file.name).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16));
        return reply.header('content-type', 'application/octet-stream').header('content-disposition', `attachment; filename="download"; filename*=UTF-8''${filename}`)
            .header('content-security-policy', "sandbox; default-src 'none'").send(Buffer.from(result.bytes));
    });
    const streams = new Set<() => void>();
    const streamUsers = new Map<string, number>();
    server.get('/api/v1/stream', async (request, reply) => {
        const a = actor(request);
        if (streams.size >= 1000 || (streamUsers.get(a.user.id) ?? 0) >= 3) throw new HttpError(429, 'stream-capacity', '更新连接数量超过上限');
        const session = a.sessionId ? sessions.get(a.sessionId) : undefined;
        reply.hijack();
        reply.raw.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', 'x-accel-buffering': 'no', 'x-content-type-options': 'nosniff' });
        let closed = false, running = false, previous: string | undefined;
        const send = (event: string) => { if (!closed && !reply.raw.write(`event: ${event}\ndata: {}\n\n`)) close(); };
        const close = () => {
            if (closed) return;
            closed = true; clearInterval(timer); streams.delete(close); session?.listeners.delete(close);
            streamUsers.set(a.user.id, Math.max(0, (streamUsers.get(a.user.id) ?? 1) - 1));
            if (streamUsers.get(a.user.id) === 0) streamUsers.delete(a.user.id);
            reply.raw.end();
        };
        async function tick() {
            if (closed || running) return;
            running = true;
            try {
                if (a.sessionId && !sessions.get(a.sessionId)) throw new HttpError(401, 'session-required', '');
                await verify(a.token);
                const executions = await app.query.queryExecutions(a.user.id);
                const requests = await app.query.queryRequests(a.user.id);
                const inputs = await Promise.all(executions.map(e => app.query.queryInputs(a.user.id, e.id)));
                const marker = JSON.stringify([executions.map(e => [e.id, e.version]), requests.map(r => [r.id, r.version]), inputs.flat().map(i => [i.id, i.status])]);
                if (marker !== previous) { previous = marker; send('invalidate'); }
                else if (!closed && !reply.raw.write(': heartbeat\n\n')) close();
            } catch (error) {
                send(error instanceof HttpError && [401, 403].includes(error.status) ? 'identity-lost' : 'unavailable');
                close();
            } finally { running = false; }
        }
        const timer = setInterval(() => void tick(), options.streamIntervalMs ?? 10000);
        timer.unref();
        streams.add(close); streamUsers.set(a.user.id, (streamUsers.get(a.user.id) ?? 0) + 1);
        session?.listeners.add(close);
        request.raw.on('close', close);
        reply.raw.on('close', close);
        send('invalidate'); void tick();
    });
    server.addHook('preClose', async () => { for (const close of streams) close(); });
    server.addHook('onClose', async () => { sessions.close(); attempts.clear(); requests.clear(); });
    return server;
}
