import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import type { McpCredentials } from '../../../application/ports';
import { canonical, requireRule, RuleError } from '../../../domain/model';

export interface CredentialScope { userId: string; executionId: string; connection: string; issuer: string; subject: string }
export interface McpConnection { id: string; /** Trusted Airic identity source (User.issuer), not a response-provided claim. */ issuer: string; endpoint: string; issueEndpoint: string; revokeEndpoint: string }
interface Secret { token: string; tokenId: string; expiresAt: string }
/** Encrypted per-execution credential vault. The key is host configuration, never persisted alongside ciphertext. */
export class McpCredentialVault implements McpCredentials {
    private readonly key: Buffer;
    constructor(private readonly directory: string, key: Uint8Array, private readonly connections: McpConnection[], private readonly fetcher: typeof fetch = fetch) {
        requireRule(isAbsolute(directory), 'invalid', 'absolute credential directory required');
        requireRule(key.length === 32, 'invalid', '32-byte encryption key required');
        this.key = Buffer.from(key);
        this.connections = connections.map(c => Object.freeze({ ...c }));
        requireRule(new Set(connections.map(c => c.id)).size === connections.length, 'invalid');
        for (const c of connections) for (const value of [c.endpoint, c.issueEndpoint, c.revokeEndpoint]) {
            const url = new URL(value);
            requireRule(url.protocol === 'https:' && !url.username && !url.password && !url.hash && !url.search, 'invalid', 'HTTPS endpoints required');
        }
    }
    connection(id: string) { const c = this.connections.find(c => c.id === id); requireRule(c, 'forbidden'); return c; }
    private binding(s: CredentialScope) { return canonical({ scope: s, connection: this.connection(s.connection) }); }
    private path(s: CredentialScope) { return resolve(this.directory, createHash('sha256').update(this.binding(s)).digest('hex') + '.enc'); }
    private async save(s: CredentialScope, secret: Secret) {
        await mkdir(this.directory, { recursive: true, mode: 0o700 });
        const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.key, iv);
        cipher.setAAD(Buffer.from(this.binding(s)));
        const encrypted = Buffer.concat([cipher.update(JSON.stringify(secret), 'utf8'), cipher.final()]);
        const temporary = this.path(s) + '.' + randomBytes(12).toString('hex');
        try { await writeFile(temporary, Buffer.concat([iv, cipher.getAuthTag(), encrypted]), { mode: 0o600, flag: 'wx' }); await rename(temporary, this.path(s)); }
        finally { await unlink(temporary).catch(() => {}); }
    }
    private async read(s: CredentialScope, active = true): Promise<Secret> {
        try {
            const bytes = await readFile(this.path(s));
            const decipher = createDecipheriv('aes-256-gcm', this.key, bytes.subarray(0, 12));
            decipher.setAuthTag(bytes.subarray(12, 28)); decipher.setAAD(Buffer.from(this.binding(s)));
            const secret = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString()) as Secret;
            requireRule(typeof secret.token === 'string' && Number.isFinite(Date.parse(secret.expiresAt)) && (!active || Date.parse(secret.expiresAt) > Date.now()), 'blocked');
            return secret;
        } catch { throw new RuleError('blocked', 'MCP credential missing, expired or unreadable; reconnect required'); }
    }
    async secret(s: CredentialScope) { return this.read(s); }
    private async request(endpoint: string, token: string, body: object) {
        try {
            const response = await this.fetcher(endpoint, { method: 'POST', redirect: 'error', credentials: 'omit', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
            requireRule(response.ok, 'blocked');
            return await response.json() as Record<string, unknown>;
        } catch { throw new RuleError('blocked', 'MCP credential service rejected or unavailable'); }
    }
    async connect(s: CredentialScope, loginToken: string) {
        const c = this.connection(s.connection); requireRule(c.issuer === s.issuer && !!loginToken, 'forbidden');
        const result = await this.request(c.issueEndpoint, loginToken, { execution_id: s.executionId });
        requireRule(result.user_id === s.subject && result.execution_id === s.executionId && result.token_type === 'Bearer' && typeof result.access_token === 'string' && result.access_token.length > 0 && typeof result.token_id === 'string' && result.token_id.length > 0 && typeof result.expires_at === 'string' && Date.parse(result.expires_at) > Date.now(), 'forbidden', 'MCP credential identity or expiry mismatch');
        const secret = { token: result.access_token, tokenId: result.token_id, expiresAt: result.expires_at };
        await this.save(s, secret);
        return { tokenId: secret.tokenId, expiresAt: secret.expiresAt };
    }
    async revoke(s: CredentialScope, loginToken: string) {
        const c = this.connection(s.connection); requireRule(c.issuer === s.issuer, 'forbidden');
        const secret = await this.read(s, false);
        // Disable local use before attempting remote revoke. Retry remote revocation by its stable token ID.
        await this.save(s, { ...secret, expiresAt: new Date(0).toISOString() });
        const result = await this.request(c.revokeEndpoint, loginToken, { token_id: secret.tokenId });
        requireRule(result.user_id === s.subject && result.status === 'revoked', 'forbidden', 'revocation identity mismatch');
    }
}
