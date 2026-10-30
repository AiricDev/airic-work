import { request } from 'node:https';
import type { ClientRequest } from 'node:http';
import type { Identity } from '../../../application/ports';
import { nonempty, requireRule, RuleError } from '../../../domain/model';

export interface HttpsUserInfoOptions {
    issuer: string;
    endpoint: string;
    /** 顶层 JSON 字段，不执行 JSONPath，不回退到姓名/邮箱识别身份。 */
    fields: { subject: string; name: string };
    limits: { timeoutMs: number; maxResponseBytes: number; maxTokenBytes: number };
    /** 可选可信 CA（如企业内部 CA）；仍启用证书和主机名验证。 */
    ca?: string;
}

/** 仅向固定可信 HTTPS 端点发送 Bearer token，不持久化、不重定向、不缓存或自动重试认证。 */
export class HttpsUserInfoIdentity implements Identity {
    private readonly options: HttpsUserInfoOptions;
    private readonly endpoint: URL;
    constructor(options: HttpsUserInfoOptions) {
        nonempty(options.issuer); nonempty(options.fields.subject); nonempty(options.fields.name);
        try { this.endpoint = new URL(options.endpoint); }
        catch { throw new RuleError('invalid', 'invalid identity endpoint'); }
        requireRule(this.endpoint.protocol === 'https:' && !!this.endpoint.hostname && !this.endpoint.username && !this.endpoint.password && !this.endpoint.search && !this.endpoint.hash, 'invalid', 'invalid identity endpoint');
        for (const name of ['timeoutMs', 'maxResponseBytes', 'maxTokenBytes'] as const) {
            const value = options.limits[name];
            requireRule(Number.isSafeInteger(value) && value > 0 && value <= 2147483647, 'invalid');
        }
        this.options = structuredClone(options);
    }
    async verify(token: string): Promise<{ issuer: string; subject: string; name: string }> {
        requireRule(typeof token === 'string' && Buffer.byteLength(token) <= this.options.limits.maxTokenBytes && /^[A-Za-z0-9._~+/-]+=*$/.test(token), 'forbidden', 'identity token rejected');
        const bytes = await this.body(token);
        try {
            const data: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
            requireRule(data !== null && typeof data === 'object' && !Array.isArray(data), 'blocked');
            const fields = data as Record<string, unknown>;
            const subject = Object.hasOwn(fields, this.options.fields.subject) ? fields[this.options.fields.subject] : undefined;
            const name = Object.hasOwn(fields, this.options.fields.name) ? fields[this.options.fields.name] : undefined;
            requireRule(typeof subject === 'string' && subject.trim().length > 0 && typeof name === 'string' && name.trim().length > 0, 'blocked');
            return { issuer: this.options.issuer, subject, name };
        } catch { throw new RuleError('blocked', 'identity response unavailable'); }
    }
    private body(token: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            let req: ClientRequest | undefined;
            let finished = false;
            const end = (error?: RuleError, bytes?: Buffer) => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                if (error) { req?.destroy(); reject(error); }
                else resolve(bytes!);
            };
            const unavailable = () => end(new RuleError('blocked', 'identity service unavailable'));
            // 覆盖 DNS、TLS、响应头和整个响应正文，而不是仅 socket 空闲时间。
            const timer = setTimeout(unavailable, this.options.limits.timeoutMs);
            try {
                req = request(this.endpoint, {
                    method: 'GET', ca: this.options.ca, rejectUnauthorized: true,
                    headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'cache-control': 'no-store' },
                }, response => {
                    response.on('error', unavailable);
                    response.on('aborted', unavailable);
                    if (finished) { response.destroy(); return; }
                    if (response.statusCode === 401 || response.statusCode === 403) {
                        end(new RuleError('forbidden', 'identity token rejected')); return;
                    }
                    const type = response.headers['content-type'] ?? '';
                    const encoding = response.headers['content-encoding'];
                    const length = response.headers['content-length'];
                    if (response.statusCode !== 200 || !/^application\/(?:json|[a-z0-9!#$&^_.+-]+\+json)(?:\s*;.*)?$/i.test(type)
                        || (encoding !== undefined && encoding !== 'identity')
                        || (length !== undefined && (!/^\d+$/.test(length) || Number(length) > this.options.limits.maxResponseBytes))) {
                        unavailable(); return;
                    }
                    const chunks: Buffer[] = [];
                    let size = 0;
                    response.on('data', (chunk: Buffer) => {
                        size += chunk.length;
                        if (size > this.options.limits.maxResponseBytes) unavailable();
                        else if (!finished) chunks.push(chunk);
                    });
                    response.on('end', () => {
                        if (!response.complete) unavailable();
                        else end(undefined, Buffer.concat(chunks));
                    });
                });
                req.on('error', unavailable);
                req.end();
            } catch { unavailable(); }
        });
    }
}
