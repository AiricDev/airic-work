import { z } from 'zod';
import { createExecutionSchema, userDecisionSchema, steeringSchema, profileSchema, preferencesSchema, manageUserSchema, configureSchema } from '../validation/schemas';

const text = z.string();
const json = z.json();
export const userDto = z.strictObject({
    id: text, name: text, enabled: z.boolean(), admin: z.boolean(), version: z.number(),
    preferences: preferencesSchema.optional(),
});
export const methodDto = z.strictObject({ source: text, sha: text, root: text, runtimeVersion: text, skillVersion: text });
export const executionDto = z.strictObject({
    id: text, projectId: text, ownerId: text, creation: createExecutionSchema.extend({ source: text }),
    sessionId: text, method: methodDto.optional(),
    phase: z.enum(['new', 'running', 'ended', 'stopping', 'stopped', 'failed']), generation: z.number(), version: z.number(),
});
export const projectDto = z.strictObject({ id: text, source: text, externalId: text, name: text, executionCount: z.number() });
export const contextDto = z.strictObject({
    revision: z.number(), content: json,
    sources: z.array(z.strictObject({ system: text, objectId: text, version: text.optional(), location: text.optional() })),
});
export const requestDto = z.strictObject({
    id: text, executionId: text, summary: text.optional(), question: text,
    options: z.array(z.strictObject({ id: text, label: text, description: text })),
    contexts: z.array(contextDto), status: z.enum(['pending', 'answered']),
    createdAt: text, answeredAt: text.optional(), version: z.number(),
});
export const decisionDto = z.strictObject({
    id: text, requestId: text, userId: text, text, optionId: text.optional(), contextRevision: z.number(),
    files: z.array(text), correctionOf: text.optional(), at: text,
});
export const steeringDto = z.strictObject({ id: text, executionId: text, userId: text, text, files: z.array(text), at: text });
export const inputDto = z.strictObject({
    id: text, executionId: text, sourceId: text, kind: z.enum(['start', 'user-decision', 'steering']),
    sequence: z.number(), status: z.enum(['pending', 'delivered']), files: z.array(text),
});
export const uploadDto = z.strictObject({ id: text, executionId: text, name: text, size: z.number(), hash: text });
export const sessionDto = z.strictObject({
    items: z.array(z.object({ id: text, at: text, kind: text, data: json, inputId: text.optional(), requestId: text.optional(), userDecisionId: text.optional() })),
    cursor: text.optional(), complete: z.boolean(), limitations: z.array(text),
});
export const episodeDto = z.strictObject({
    id: text, request: requestDto, decisions: z.array(decisionDto), inputs: z.array(inputDto),
    sessionId: text, method: methodDto.optional(),
});
export const sessionAuthDto = z.strictObject({ user: userDto, csrfToken: text });
export const settingsDto = configureSchema.omit({ expected: true }).extend({ version: z.number() });
export const errorDto = z.strictObject({ code: text, message: text, requestId: text, issues: z.array(z.object({ path: text, message: text })).optional() });
export const pageDto = <T extends z.ZodType>(item: T) => z.strictObject({ items: z.array(item), cursor: text.optional() });
export const callDto = z.strictObject({
    id: text, connection: text, tool: text, at: text, type: z.enum(['read', 'write', 'unknown']),
    classificationSource: text.optional(), schemaRevision: text, parameters: json, result: json.optional(),
    status: z.enum(['calling', 'success', 'failed', 'unknown']), retryOf: text.optional(), requestId: text.optional(), userDecisionId: text.optional(),
});
export const methodQuery = z.strictObject({ sha: z.string().max(64).optional(), executionId: text.optional(), path: text.optional(), q: text.optional() });
export const listQuery = z.strictObject({
    cursor: z.string().max(4096).optional(), limit: z.coerce.number().int().min(1).max(100).default(30),
    projectId: text.optional(), status: z.enum(['pending', 'answered']).optional(),
});

// Runtime schema and generated OpenAPI share this registry. Responses are projected onto explicit DTO fields.
export const contracts = {
    session: { method: 'get', path: '/auth/session', response: sessionAuthDto },
    login: { method: 'post', path: '/auth/session', response: sessionAuthDto },
    logout: { method: 'delete', path: '/auth/session', response: z.strictObject({ ok: z.literal(true) }) },
    me: { method: 'get', path: '/me', response: userDto },
    profile: { method: 'patch', path: '/me', body: profileSchema, response: userDto },
    preferences: { method: 'put', path: '/me/preferences', body: preferencesSchema, response: userDto },
    projects: { method: 'get', path: '/projects', response: pageDto(projectDto) },
    project: { method: 'get', path: '/projects/{id}', response: projectDto.extend({ executions: z.array(executionDto) }) },
    executions: { method: 'get', path: '/executions', response: pageDto(executionDto) },
    create: { method: 'post', path: '/executions', body: createExecutionSchema, response: executionDto },
    execution: { method: 'get', path: '/executions/{id}', response: executionDto },
    cancel: { method: 'post', path: '/executions/{id}/cancel', response: executionDto },
    steering: { method: 'post', path: '/executions/{id}/steering', body: steeringSchema, response: steeringDto },
    requests: { method: 'get', path: '/decision-requests', response: pageDto(requestDto) },
    executionRequests: { method: 'get', path: '/executions/{id}/decision-requests', response: pageDto(requestDto) },
    request: { method: 'get', path: '/decision-requests/{id}', response: requestDto },
    decisions: { method: 'get', path: '/decision-requests/{id}/user-decisions', response: z.array(decisionDto) },
    answer: { method: 'post', path: '/decision-requests/{id}/user-decisions', body: userDecisionSchema, response: decisionDto },
    inputs: { method: 'get', path: '/executions/{id}/inputs', response: z.array(inputDto) },
    upload: { method: 'post', path: '/executions/{id}/uploads', response: uploadDto },
    file: { method: 'get', path: '/input-files/{id}', response: uploadDto },
    history: { method: 'get', path: '/executions/{id}/session', response: sessionDto },
    episode: { method: 'get', path: '/episodes/{id}', response: episodeDto },
    users: { method: 'get', path: '/admin/users', response: pageDto(userDto) },
    user: { method: 'get', path: '/admin/users/{id}', response: userDto },
    manage: { method: 'patch', path: '/admin/users/{id}', body: manageUserSchema, response: userDto },
    settings: { method: 'get', path: '/admin/settings', response: settingsDto },
    configure: { method: 'put', path: '/admin/settings', body: configureSchema, response: settingsDto },
    calls: { method: 'get', path: '/executions/{id}/mcp-calls', response: pageDto(callDto).extend({ complete: z.boolean(), limitations: z.array(text), unknownCount: z.number().nullable() }) },
    call: { method: 'get', path: '/executions/{id}/mcp-calls/{callId}', response: callDto },
    methodStatus: { method: 'get', path: '/om/status', response: z.strictObject({ source: text, kind: z.enum(['managed', 'local']), sync: z.strictObject({ enabled: z.boolean(), remote: text.optional(), branch: text.optional(), reason: text.optional(), message: text.optional() }) }) },
    methodSnapshot: { method: 'get', path: '/om/snapshot', response: methodDto },
    methodTree: { method: 'get', path: '/om/tree', response: z.strictObject({ method: methodDto, files: z.array(z.strictObject({ path: text, size: z.number(), text: z.boolean() })) }) },
    methodFile: { method: 'get', path: '/om/file', response: z.strictObject({ method: methodDto, path: text, content: text }) },
    methodSearch: { method: 'get', path: '/om/search', response: z.strictObject({ method: methodDto, items: z.array(z.strictObject({ path: text, excerpt: text })) }) },
    methodHistory: { method: 'get', path: '/om/history', response: z.strictObject({ source: text, scope: text, commits: z.array(z.strictObject({ sha: text, parents: z.array(text), at: text, subject: text })), complete: z.boolean(), limitations: z.array(text) }) },
    methodCommit: { method: 'get', path: '/om/commits/{sha}', response: z.strictObject({ sha: text, parents: z.array(text), at: text, subject: text, files: z.array(text), diff: text }) },
    methodSync: { method: 'post', path: '/om/sync', response: methodDto },
    connect: { method: 'post', path: '/executions/{id}/connections/{connection}/credential', response: z.strictObject({ expiresAt: text }) },
    revoke: { method: 'delete', path: '/executions/{id}/connections/{connection}/credential', response: z.strictObject({ ok: z.literal(true) }) },
    connections: { method: 'get', path: '/executions/{id}/connections', response: z.array(text) },
} as const;

export function projectDtoValue<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
    // Strip unknown fields recursively, then validate. Never serialize an application object directly.
    function pick(s: z.ZodType, v: unknown): unknown {
        if (s instanceof z.ZodOptional) return v === undefined ? undefined : pick(s.unwrap() as z.ZodType, v);
        if (s instanceof z.ZodObject && v && typeof v === 'object')
            return Object.fromEntries(Object.entries(s.shape).map(([key, child]) => [key, pick(child as z.ZodType, (v as Record<string, unknown>)[key])]));
        if (s instanceof z.ZodArray && Array.isArray(v)) return v.map(item => pick(s.element as z.ZodType, item));
        return v;
    }
    return schema.parse(pick(schema, value));
}
