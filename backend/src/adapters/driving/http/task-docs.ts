import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';

const require = createRequire(import.meta.url);
const { getAbsoluteFSPath } = require('swagger-ui-dist') as { getAbsoluteFSPath(): string };

export function registerTaskDocs(server: FastifyInstance) {
    const config = { publicTaskEndpoint: true };
    const options = { config };
    const specification = readFileSync(new URL('../../../../../docs/openapi.yaml', import.meta.url));
    server.get('/openapi.yaml', options, (_request, reply) => reply.type('application/yaml').send(specification));
    server.get('/docs', options, (_request, reply) => reply.redirect('/docs/'));
    server.get('/docs/', options, (_request, reply) => reply
        .header('Content-Security-Policy', "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'")
        .type('text/html; charset=utf-8').send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Airic Work API</title><link rel="stylesheet" href="swagger-ui.css"></head>
<body><div id="swagger-ui"></div><script src="swagger-ui-bundle.js"></script><script src="initialize.js"></script></body>
</html>`));
    for (const [name, contentType] of [['swagger-ui.css', 'text/css'], ['swagger-ui-bundle.js', 'text/javascript']]) {
        const asset = readFileSync(join(getAbsoluteFSPath(), name));
        server.get(`/docs/${name}`, options, (_request, reply) => reply.type(contentType).send(asset));
    }
    server.get('/docs/initialize.js', options, (_request, reply) => reply.type('text/javascript').send(
        "SwaggerUIBundle({url: '../openapi.yaml', dom_id: '#swagger-ui', validatorUrl: null, persistAuthorization: false});",
    ));
}
