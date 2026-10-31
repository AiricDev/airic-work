import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:https';
import type { RequestListener } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { HttpsUserInfoOptions } from '../../src/adapters/driven/identity/https-user-info';

/** 临时自签测试 CA/证书，私钥仅存在测试临时目录，不关闭生产 TLS 校验。 */
export async function httpsIdentityFixture() {
    const directory = await mkdtemp(join(tmpdir(), 'airic-identity-tls-'));
    try {
        const key = join(directory, 'key.pem');
        const cert = join(directory, 'cert.pem');
        await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', cert, '-days', '1', '-subj', '/CN=Identity test', '-addext', 'subjectAltName=IP:127.0.0.1']);
        const ca = await readFile(cert, 'utf8');
        const received: { method?: string; url?: string; authorization?: string }[] = [];
        const fixture = {
            handler: ((_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ sub: 'external-subject', name: 'External name' })); }) as RequestListener,
            received,
        };
        const server = createServer({ key: await readFile(key), cert: ca }, (req, res) => {
            received.push({ method: req.method, url: req.url, authorization: req.headers.authorization });
            fixture.handler(req, res);
        });
        await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
        const address = server.address();
        if (!address || typeof address === 'string') throw new Error('test HTTPS binding unavailable');
        const options: HttpsUserInfoOptions = {
            issuer: 'trusted-integration',
            endpoint: `https://127.0.0.1:${address.port}/userinfo`, fields: { subject: 'sub', name: 'name' }, ca,
            limits: { timeoutMs: 2000, maxResponseBytes: 8192, maxTokenBytes: 4096 },
        };
        return Object.assign(fixture, {
            options,
            async close() {
                server.closeAllConnections();
                await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
                await rm(directory, { recursive: true, force: true });
            },
        });
    } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}
