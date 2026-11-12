import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { requireRule } from '../../../domain/model';

export type TaskAction = "read" | "answer" | "notify" | "credential";

export interface TaskActor {
    scope: string;
    actor: string;
    callerId: string;
    grant?: { taskId: string; action: TaskAction };
}

export interface TaskServiceIdentity {
    bearerToken: string;
    callerId: string;
    scope: string;
}

const actorId = z.string().regex(/^[!-~]{1,200}$/);
const taskGrant = z.strictObject({
    taskId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    action: z.enum(['read', 'answer', 'notify', 'credential']),
});
const requestIdentity = z.strictObject({
    actor: actorId,
    grant: taskGrant.optional(),
});

const digest = (value: string) => createHash('sha256').update(value).digest();
const validToken = (token: string) => token.length >= 32 && /^[!-~]+$/.test(token);

export function taskAuthenticator(direct: { bearerToken: string; scope: string; actor: string }, integration?: TaskServiceIdentity) {
    requireRule(validToken(direct.bearerToken), 'invalid');
    const directDigest = digest(`Bearer ${direct.bearerToken}`);
    const integrationDigest = integration && digest(`Bearer ${integration.bearerToken}`);
    if (integration) {
        requireRule(validToken(integration.bearerToken) && integration.bearerToken !== direct.bearerToken
            && integration.scope !== direct.scope, 'invalid');
    }
    return (authorization: string | undefined, actor: unknown, taskId: unknown, action: unknown): TaskActor | undefined => {
        const received = digest(authorization ?? '');
        const scoped = taskId !== undefined || action !== undefined;
        if (timingSafeEqual(received, directDigest)) {
            return actor === undefined && !scoped
                ? { scope: direct.scope, actor: direct.actor, callerId: direct.actor }
                : undefined;
        }
        if (!integration || !integrationDigest || !timingSafeEqual(received, integrationDigest)) return undefined;
        const parsed = requestIdentity.safeParse({ actor, grant: scoped ? { taskId, action } : undefined });
        if (!parsed.success) return undefined;
        return { scope: integration.scope, callerId: integration.callerId, ...parsed.data };
    };
}
