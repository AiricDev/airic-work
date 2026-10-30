import { z } from 'zod';
import type { Application } from '../../../application/application';
import { createExecutionSchema, userDecisionSchema, steeringSchema, profileSchema, preferencesSchema, manageUserSchema, configureSchema, } from './schemas';
/** 可映射为 HTTP/MCP 输入错误的结构化问题，不包含输入原文或秘密值。 */
export class InputValidationError extends Error {
    readonly code = 'invalid-input';
    constructor(public readonly issues: {
        path: string;
        message: string;
    }[]) {
        super('输入格式不合法');
    }
}
/** Zod 只在边缘使用。用例继续接收普通 TypeScript 值，避免依赖库错误进入领域合同。 */
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
    const result = schema.safeParse(value);
    if (!result.success)
        throw new InputValidationError(result.error.issues.map(issue => ({
            path: issue.path.map(String).join('.'), message: issue.message,
        })));
    return result.data;
}
/** 验证过的入口身份；必须由认证中间件构造，不能直接将请求正文 cast 为此类型。 */
export interface VerifiedActor {
    userId: string;
    source: string;
}
/**
 * 框架无关的入口映射：未知正文 → Zod → 普通应用命令。
 * 每个请求显式传 actor；不捕获某个用户为全局单例状态，不替代认证或领域授权。
 * 这里只提供已建立的命令入口，不宣称已启动 HTTP 或真实认证服务。
 */
export class ValidatedCommands {
    /** 注入应用能力；每次调用显式接收可信 actor，不捕获当前用户。 */
    constructor(private readonly app: Application) { }
    createExecution(actor: VerifiedActor, key: string, body: unknown) {
        const creation = parseInput(createExecutionSchema, body);
        return this.app.execution.createExecution(actor.userId, key, { ...creation, source: actor.source });
    }
    submitUserDecision(actor: VerifiedActor, requestId: string, key: string, body: unknown) {
        const data = parseInput(userDecisionSchema, body);
        return this.app.decision.submitUserDecision(actor.userId, requestId, key, {
            text: data.text, contextRevision: data.contextRevision, files: data.files,
            ...(data.optionId === undefined ? {} : { optionId: data.optionId }),
            ...(data.correctionOf === undefined ? {} : { correctionOf: data.correctionOf }),
        });
    }
    submitSteering(actor: VerifiedActor, executionId: string, key: string, body: unknown) {
        const data = parseInput(steeringSchema, body);
        return this.app.input.submitSteering(actor.userId, executionId, key, data.text, data.files);
    }
    updateProfile(actor: VerifiedActor, body: unknown) {
        return this.app.account.updateProfile(actor.userId, parseInput(profileSchema, body).name);
    }
    updatePreferences(actor: VerifiedActor, body: unknown) {
        return this.app.account.updatePreferences(actor.userId, parseInput(preferencesSchema, body));
    }
    manageUser(actor: VerifiedActor, targetId: string, body: unknown) {
        return this.app.account.manageUser(actor.userId, targetId, parseInput(manageUserSchema, body));
    }
    configure(actor: VerifiedActor, body: unknown) {
        const { expected, ...settings } = parseInput(configureSchema, body);
        return this.app.settings.configure(actor.userId, expected, { ...settings, version: expected });
    }
    /** 来源仅取受控配置，不接收外部 URL、目录或 remote 参数。 */
    syncMethod(actor: VerifiedActor) { return this.app.method.syncMethod(actor.userId); }
}
