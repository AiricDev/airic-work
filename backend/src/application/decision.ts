import { active, answer, nonempty, requireRule } from '../domain/model';
import type { Context, Option } from '../domain/model';
import type { ControlStore, Support } from './ports';
import { ApplicationPolicy } from './policy';
/**
 * 人工协作能力：问题、阅读修订、回答与更正。Decision Episode 随请求一一关联，平台不计算专业充分性或建立采纳状态机。
 */
export class DecisionUseCases {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly store: ControlStore, private readonly support: Support, private readonly policy: ApplicationPolicy) { }
    /**
     * 仅当前运行代次可提出需要用户回应的问题。初始 Context 修订为 1、选项 ID 不重复，命令重试返回原请求；请求 ID 同时作为 Episode 查询身份。
     */
    async createDecisionRequest(userId: string, id: string, generation: number, key: string, question: string, options: Option[], context: Context) {
        const e = await this.policy.owned(userId, id);
        active(e, generation);
        nonempty(question);
        requireRule(context.revision === 1 && new Set(options.map(o => o.id)).size === options.length, 'invalid');
        const k = this.policy.key(userId, key, { id, question, options, context });
        const old = await this.store.replay<Awaited<ReturnType<typeof this.store.request>>>('request', k);
        if (old)
            return old;
        return this.store.createRequest(k, generation, { id: this.support.id(), executionId: id, question, options, contexts: [context], status: 'pending', createdAt: this.support.now(), version: 0 });
    }
    /**
     * 当前代次追加下一份 Context 修订，保留此前阅读版本及已回答事实。它不撤销回答，也不负责跨业务系统强一致性。
     */
    async refreshContext(userId: string, requestId: string, generation: number, context: Context) {
        const r = await this.store.request(requestId);
        const e = await this.policy.owned(userId, r.executionId);
        active(e, generation);
        requireRule(context.revision === r.contexts.at(-1)!.revision + 1, 'conflict');
        return this.store.refreshContext(userId, generation, r.version, { ...r, contexts: [...r.contexts, context], version: r.version + 1 });
    }
    /**
     * 检查归属、阅读版本、选项、文件和更正关联，再原子保存 UserDecision、已回答请求及待投递消息。
     * 旧 Context 修订仍可回答；同键重试返回原提交，更正追加历史。失败不能留下“已回答但没有消息”的部分写入，后台交付失败不撤销已回答。
     */
    async submitUserDecision(userId: string, requestId: string, key: string, payload: {
        text: string;
        optionId?: string;
        contextRevision: number;
        files: string[];
        correctionOf?: string;
    }) {
        const r = await this.store.request(requestId);
        const e = await this.policy.owned(userId, r.executionId);
        const k = this.policy.key(userId, key, { requestId, ...payload });
        const old = await this.store.replay<Awaited<ReturnType<typeof this.store.decisions>>[number]>('decision', k);
        if (old)
            return old;
        await this.policy.files(userId, e, payload.files);
        if (payload.correctionOf)
            requireRule((await this.store.decisions(r.id)).some(d => d.id === payload.correctionOf), 'invalid');
        const decision = { ...payload, id: this.support.id(), requestId, userId, at: this.support.now() };
        return this.store.submitDecision(k, r.version, answer(r, decision), decision, this.policy.envelope(e, decision.id, 'user-decision', payload.text || payload.optionId || '', payload.files));
    }
}
