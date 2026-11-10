import { createHash, createPublicKey, timingSafeEqual, verify } from 'node:crypto';
import { z } from 'zod';
import { requireRule } from '../../../domain/model';

export type TaskAction = "read" | "answer" | "notify" | "credential";

export interface TaskActor {
    scope: string;
    actor: string;
    callerId: string;
    grant?: { taskId: string; action: TaskAction };
}

export interface TaskDelegation {
    bearerToken: string;
    callerId: string;
    issuer: string;
    audience: string;
    scope: string;
    publicKeyPem: string;
}

const claims = z.strictObject({
    iss: z.string(), aud: z.string(), sub: z.string().trim().min(1).max(200),
    grant: z.strictObject({
        taskId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
        action: z.enum(['read', 'answer', 'notify', 'credential']),
    }).optional(),
    scope: z.string(), iat: z.number().int(), exp: z.number().int(),
});
const header = z.strictObject({ alg: z.literal('EdDSA'), typ: z.literal('JWT').optional() });
const digest = (value: string) => createHash('sha256').update(value).digest();
const validToken = (token: string) => token.length >= 32 && /^[!-~]+$/.test(token);

export function taskAuthenticator(direct: { bearerToken: string; scope: string; actor: string }, integration?: TaskDelegation) {
    requireRule(validToken(direct.bearerToken), 'invalid');
    const directDigest = digest(`Bearer ${direct.bearerToken}`);
    const integrationDigest = integration && digest(`Bearer ${integration.bearerToken}`);
    const publicKey = integration && createPublicKey(integration.publicKeyPem);
    if (integration) {
        requireRule(validToken(integration.bearerToken) && integration.bearerToken !== direct.bearerToken
            && publicKey?.asymmetricKeyType === 'ed25519' && integration.scope !== direct.scope, 'invalid');
    }
    return (authorization: string | undefined, assertion: string | string[] | undefined): TaskActor | undefined => {
        const received = digest(authorization ?? '');
        if (timingSafeEqual(received, directDigest)) {
            return assertion === undefined ? { scope: direct.scope, actor: direct.actor, callerId: direct.actor } : undefined;
        }
        if (!integration || !integrationDigest || !publicKey || !timingSafeEqual(received, integrationDigest)
            || typeof assertion !== 'string' || assertion.length > 4096) return undefined;
        try {
            const segments = assertion.split('.');
            if (segments.length !== 3 || !segments.every(segment => /^[A-Za-z0-9_-]+$/.test(segment))) return undefined;
            const [encodedHeader, encodedClaims, signature] = segments;
            header.parse(JSON.parse(Buffer.from(encodedHeader, 'base64url').toString()));
            if (!verify(null, Buffer.from(`${encodedHeader}.${encodedClaims}`), publicKey, Buffer.from(signature, 'base64url'))) return undefined;
            const value = claims.parse(JSON.parse(Buffer.from(encodedClaims, 'base64url').toString()));
            const now = Math.floor(Date.now() / 1000);
            if (value.iss !== integration.issuer || value.aud !== integration.audience || value.scope !== integration.scope
                || value.iat > now + 5 || value.exp <= now || value.exp <= value.iat || value.exp - value.iat > 300) return undefined;
            return { scope: integration.scope, actor: value.sub, callerId: integration.callerId, grant: value.grant };
        } catch { return undefined; }
    };
}
