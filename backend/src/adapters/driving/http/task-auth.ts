import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { requireRule } from '../../../domain/model';

export type TaskAction = "read" | "answer" | "notify" | "credential";

export interface TaskActor {
    actor: string;
    grant?: { taskId: string; action: TaskAction };
}

const actorId = z.string().regex(/^[!-~]{1,200}$/);
const taskGrant = z.strictObject({
    taskId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
    action: z.enum(['read', 'answer', 'notify', 'credential']),
});
const requestIdentity = z.strictObject({
    actor: actorId.default("operator"),
    grant: taskGrant.optional(),
});

const digest = (value: string) => createHash('sha256').update(value).digest();
const validToken = (token: string) => token.length >= 32 && /^[!-~]+$/.test(token);

export function taskAuthenticator(bearerToken: string) {
    requireRule(validToken(bearerToken), 'invalid');
    const expected = digest(`Bearer ${bearerToken}`);
    return (authorization: string | undefined, actor: unknown, taskId: unknown, action: unknown): TaskActor | undefined => {
        if (!timingSafeEqual(digest(authorization ?? ''), expected)) return undefined;
        const grant = taskId !== undefined || action !== undefined ? { taskId, action } : undefined;
        const parsed = requestIdentity.safeParse({ actor, grant });
        return parsed.success ? parsed.data : undefined;
    };
}
