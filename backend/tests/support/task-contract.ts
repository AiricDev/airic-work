import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse } from 'yaml';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { expect } from 'vitest';

type Schema = Record<string, unknown>;
type Content = Record<string, { schema: Schema; example?: unknown; examples?: Record<string, { value: unknown }> }>;
type Response = { $ref?: string; content?: Content; headers?: Record<string, { schema: Schema }> };
type Parameter = { name: string; in: 'path' | 'query' | 'header'; required?: boolean; style?: string; schema: Schema };
type ParameterEntry = Parameter | { $ref: string };
type Operation = { operationId: string; parameters?: ParameterEntry[]; requestBody?: { content: Content }; responses: Record<string, Response> };

const spec = parse(readFileSync(new URL('../../../docs/openapi.yaml', import.meta.url), 'utf8')) as {
    servers: { url: string }[];
    paths: Record<string, { parameters?: ParameterEntry[] } & Partial<Record<'get' | 'post' | 'put', Operation>>>;
    components: { responses: Record<string, Response>; parameters: Record<string, Parameter> };
};
const ajv = new Ajv2020({ strict: false, allErrors: true });
addFormats(ajv);
ajv.addFormat('binary', true);
ajv.addFormat('password', true);
const validators = new WeakMap<Schema, ReturnType<typeof ajv.compile>>();
function validate(schema: Schema, value: unknown, label: string) {
    let validator = validators.get(schema);
    if (!validator) {
        validator = ajv.compile({ ...schema, components: spec.components });
        validators.set(schema, validator);
    }
    expect(validator(value), `${label}: ${ajv.errorsText(validator.errors)}`).toBe(true);
}
const operations = Object.entries(spec.paths).flatMap(([path, pathItem]) => {
    const route = new RegExp('^' + spec.servers[0].url + path.replace(/\{([^}]+)\}/g, '(?<$1>[^/]+)') + '$');
    return (['get', 'post', 'put'] as const).flatMap(method => {
        const operation = pathItem[method];
        return operation ? [{ method, route, operation, parameters: [...pathItem.parameters ?? [], ...operation.parameters ?? []] }] : [];
    });
});

export function validateContractExamples() {
    function visit(value: unknown) {
        if (!value || typeof value !== 'object') return;
        const node = value as Record<string, unknown>;
        if (node.schema && typeof node.schema === 'object') {
            const schema = node.schema as Schema;
            if (Object.hasOwn(node, 'example')) validate(schema, node.example, 'OpenAPI example');
            if (node.examples && typeof node.examples === 'object') {
                for (const [name, example] of Object.entries(node.examples)) {
                    if (example && Object.hasOwn(example, 'value')) validate(schema, example.value, name);
                }
            }
        }
        if (node.type && Object.hasOwn(node, 'example')) validate(node, node.example, 'Schema example');
        if (node.type && Array.isArray(node.examples)) {
            for (const example of node.examples) validate(node, example, 'Schema example');
        }
        for (const nested of Object.values(node)) visit(nested);
    }
    visit(spec);
    expect(new Set(operations.map(({ operation }) => operation.operationId)).size).toBe(16);
    expect(operations).toHaveLength(16);
}

export function taskContract() {
    const covered = new Set<string>();
    return {
        async inject(server: FastifyInstance, request: InjectOptions) {
            const url = new URL(String(request.url), 'http://localhost');
            const method = (request.method ?? 'GET').toLowerCase();
            const { operation, parameters, route } = operations.find(item => item.method === method && item.route.test(url.pathname))!;
            const response = await server.inject(request);
            const label = operation.operationId;
            const entry = operation.responses[response.statusCode] ?? operation.responses.default;
            expect(entry, label).toBeDefined();
            const contract = entry.$ref ? spec.components.responses[entry.$ref.split('/').at(-1)!] : entry;
            if (contract.content) {
                const media = response.headers['content-type']?.split(';')[0] ?? '';
                const content = contract.content[media];
                expect(content, `${label} response media type ${media}`).toBeDefined();
                validate(content.schema, media === 'application/json' ? response.json() : response.body, `${label} response`);
            } else {
                expect(response.body, `${label} response body`).toBe('');
            }
            for (const [name, header] of Object.entries(contract.headers ?? {})) {
                validate(header.schema, response.headers[name.toLowerCase()], `${label} header ${name}`);
            }
            if (response.statusCode < 300) {
                expect(operation.responses[response.statusCode], `${label} success status`).toBeDefined();
                const pathParameters = route.exec(url.pathname)?.groups;
                for (const entry of parameters) {
                    const parameter = '$ref' in entry ? spec.components.parameters[entry.$ref.split('/').at(-1)!] : entry;
                    const { name, schema } = parameter;
                    let value: unknown;
                    if (parameter.in === 'path') value = pathParameters?.[name];
                    else if (parameter.in === 'header') value = request.headers?.[name.toLowerCase()];
                    else if (parameter.style === 'deepObject') {
                        const pairs = [...url.searchParams].filter(([key]) => key.startsWith(`${name}[`) && key.endsWith(']'));
                        if (pairs.length) value = Object.fromEntries(pairs.map(([key, item]) => [key.slice(name.length + 1, -1), item]));
                    } else {
                        const raw = url.searchParams.get(name);
                        if (raw !== null) value = schema.type === 'integer' ? Number(raw) : raw;
                    }
                    if (value !== undefined || parameter.required) validate(schema, value, `${label} parameter ${name}`);
                }
                const requestBody = operation.requestBody?.content;
                if (requestBody?.['application/json']) {
                    validate(requestBody['application/json'].schema, request.payload, `${label} request`);
                } else if (requestBody?.['multipart/form-data']) {
                    const part = typeof request.payload === 'string' && /name="file"; filename="[^"]+"[\s\S]*?\r\n\r\n([\s\S]+?)\r\n--/.exec(request.payload);
                    expect(part, `${label} multipart file`).toBeTruthy();
                    validate(requestBody['multipart/form-data'].schema, { file: part && part[1] }, `${label} request`);
                }
                covered.add(label);
            }
            return response;
        },
        expectCoverage({ only, except }: { only?: string[]; except?: string[] }) {
            const expected = only ?? operations.map(({ operation }) => operation.operationId).filter(id => !except?.includes(id));
            expect(covered).toEqual(new Set(expected));
        },
    };
}
