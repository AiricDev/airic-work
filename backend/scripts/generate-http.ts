import { writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';
import ts from 'typescript';
import { z } from 'zod';
import { contracts, errorDto, listQuery, methodQuery } from '../src/adapters/driving/http/contracts';

const schemas: Record<string, unknown> = {};
let count = 0;
const cached = { input: new WeakMap<z.ZodType, string>(), output: new WeakMap<z.ZodType, string>() };
const schema = (value: z.ZodType, io: 'input' | 'output' = 'output') => {
    const existing = cached[io].get(value);
    if (existing) return { $ref: `#/components/schemas/${existing}` };
    const name = `Schema${++count}`;
    cached[io].set(value, name);
    const { $schema: _, $defs, ...rest } = z.toJSONSchema(value, { unrepresentable: 'any', io });
    const rewrite = (v: unknown): unknown => {
        if (Array.isArray(v)) return v.map(rewrite);
        if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([key, child]) =>
            [key, key === '$ref' && child === '#' ? `#/components/schemas/${name}` : key === '$ref' && typeof child === 'string' && child.startsWith('#/$defs/') ? `#/components/schemas/${name}_${child.slice(8)}` : rewrite(child)]));
        return v;
    };
    schemas[name] = rewrite(rest);
    for (const [key, definition] of Object.entries($defs ?? {})) schemas[`${name}_${key}`] = rewrite(definition);
    return { $ref: `#/components/schemas/${name}` };
};
const paths: Record<string, Record<string, unknown>> = {};
for (const [id, contract] of Object.entries(contracts)) {
    const path = '/api/v1' + contract.path;
    const parameters: unknown[] = [...contract.path.matchAll(/\{(\w+)\}/g)].map(m => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
    const querySchema = ['projects', 'executions', 'requests', 'executionRequests', 'users'].includes(id) ? listQuery
        : ['methodSnapshot', 'methodTree', 'methodFile', 'methodSearch', 'methodCommit'].includes(id) ? methodQuery
        : id === 'calls' ? z.object({ type: z.enum(['read', 'write', 'unknown']).optional(), cursor: z.string().optional() })
        : id === 'history' ? z.object({ cursor: z.string().optional() }) : undefined;
    if (querySchema) {
        const query = z.toJSONSchema(querySchema);
        for (const [name, value] of Object.entries(query.properties ?? {}))
            parameters.push({ name, in: 'query', required: (id === 'methodFile' && name === 'path') || (id === 'methodSearch' && name === 'q'), schema: value });
    }
    if (['create', 'answer', 'steering'].includes(id)) parameters.push({ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', minLength: 1, maxLength: 200 } });
    (paths[path] ??= {})[contract.method] = {
        operationId: id, parameters,
        security: id === 'login' ? [{ bearerAuth: [] }] : contract.method === 'get' ? [{ bearerAuth: [] }, { cookieAuth: [] }] : [{ bearerAuth: [] }, { cookieAuth: [], csrf: [] }],
        ...('body' in contract ? { requestBody: { required: true, content: { 'application/json': { schema: schema(contract.body, 'input') } } } } : {}),
        ...(id === 'upload' ? { requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } } } } } : {}),
        responses: {
            200: { description: 'Saved or current representation, not proof of background execution', content: { 'application/json': { schema: schema(contract.response) } } },
            default: { description: 'Request failed or outcome unknown', content: { 'application/json': { schema: schema(errorDto) } } },
        },
    };
}
paths['/api/v1/input-files/{id}/content'] = { get: { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: { description: 'Verified fixed file bytes; requires current ownership', content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } } } } } };
paths['/api/v1/stream'] = { get: { responses: { 200: { description: 'Invalidation hints only; reconnect must refresh queries', content: { 'text/event-stream': { schema: { type: 'string' } } } } } } };
const document = { openapi: '3.1.0' as const, info: { title: 'Airic Work HTTP', version: '1.0.0' }, paths, components: { schemas,
    securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer' }, cookieAuth: { type: 'apiKey', in: 'cookie', name: 'airic_session' }, csrf: { type: 'apiKey', in: 'header', name: 'x-csrf-token' } },
}, security: [{ bearerAuth: [] }, { cookieAuth: [] }] };
await writeFile(new URL('../../docs/http-openapi.json', import.meta.url), JSON.stringify(document, null, 2) + '\n');
const types = await openapiTS(document as Parameters<typeof openapiTS>[0], {
    // A named alias avoids TypeScript's circular indexed-property restriction for recursive JSON.
    transform(node) {
        if (node.anyOf?.length === 6 && node.anyOf.some(v => 'type' in v && v.type === 'array'))
            return ts.factory.createTypeReferenceNode('JsonValue');
    },
});
await writeFile(new URL('../../frontend/src/api/schema.ts', import.meta.url),
    'export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };\n' + astToString(types));
await writeFile(new URL('../../frontend/src/api/routes.ts', import.meta.url),
    '// Generated by backend/scripts/generate-http.ts. Do not edit.\n' +
    'export const routes = ' + JSON.stringify(Object.fromEntries(Object.entries(contracts).map(([name, c]) => [name, { path: '/api/v1' + c.path, method: c.method.toUpperCase() }])), null, 2) + ' as const;\n');
