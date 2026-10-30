import { requireRule } from '../domain/model';
import type { History, ControlStore } from './ports';
import { ApplicationPolicy } from './policy';
/**
 * 客户端可见查询的政策入口。底层 Reads 可读全局，所有返回内容必须经过启用/归属过滤；管理员无旁路，派生视图不建立新权威记录。
 */
export class QueryUseCases {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly history: History, private readonly store: ControlStore, private readonly policy: ApplicationPolicy) { }
    /**
     * 读取本人当前可访问 Execution；不因管理员身份扩大范围。
     */
    async queryExecution(userId: string, id: string) { return this.policy.owned(userId, id); }
    /**
     * 只返回包含本人可见执行的分组，数量也仅统计本人执行，不泄露同项目其他人的工作。
     */
    async queryProjects(userId: string) { requireRule((await this.store.user(userId)).enabled, 'forbidden'); const executions = (await this.store.executions()).filter(e => e.ownerId === userId); return (await this.store.projects()).filter(p => executions.some(e => e.projectId === p.id)).map(p => ({ ...p, executionCount: executions.filter(e => e.projectId === p.id).length })); }
    /**
     * 沿所属 Execution 校验归属后返回请求及阅读资料；Brief 由呈现适配器组织。
     */
    async queryDecisionRequest(userId: string, id: string) { const r = await this.store.request(id); await this.policy.owned(userId, r.executionId); return r; }
    /**
     * 以请求 ID 组合生命周期、UserDecision 与该请求的输入消息，并关联原 Session/Method。它不查询或推断其他自主判断，也不把消息交付描述为业务成功。
     */
    async queryEpisode(userId: string, requestId: string) {
        const request = await this.queryDecisionRequest(userId, requestId);
        const execution = await this.policy.owned(userId, request.executionId);
        const decisions = await this.store.decisions(requestId);
        return { id: request.id, request, decisions, inputs: (await this.store.inputs(execution.id)).filter(i => i.kind === 'user-decision' && decisions.some(d => d.id === i.sourceId)), sessionId: execution.sessionId, method: execution.method };
    }
    /**
     * 验证归属后读取同一 Session 的分页历史。cursor 与覆盖限制由 History 兑现，每次调用仍需当前资格。
     */
    async querySession(userId: string, id: string, cursor?: string) { const e = await this.policy.owned(userId, id); return this.history.page(e.sessionId, cursor); }
    /**
     * 读取 Session 的操作查询视图；过滤写操作也必须保留未知分类数量/覆盖限制，不推断工具结果。
     */
    async queryMcpCalls(userId: string, id: string, type?: 'read' | 'write' | 'unknown', cursor?: string) { const e = await this.policy.owned(userId, id); return this.history.calls(e.sessionId, type, cursor); }
    /**
     * 启用用户只能列出本人执行，不能直接把全局 Store 列表透传出去。
     */
    async queryExecutions(userId: string) { requireRule((await this.store.user(userId)).enabled, 'forbidden'); return (await this.store.executions()).filter(e => e.ownerId === userId); }
    /**
     * 从本人可见执行汇总待回答请求；已经提交的 UserDecision 不因后台未继续而重新进入待回答列表。
     */
    async queryPending(userId: string) { const executions = await this.queryExecutions(userId); const all = await Promise.all(executions.map(e => this.store.requests(e.id))); return all.flat().filter(r => r.status === 'pending'); }
    /**
     * 沿所属执行和上传者双重校验后返回固定文件描述；返回内容引用不等于已取得真实文件字节。
     */
    async queryUpload(userId: string, id: string) { const file = await this.store.upload(id); await this.policy.owned(userId, file.executionId); requireRule(file.userId === userId, 'forbidden'); return file; }
    /**
     * 在本人 Execution 的 Session 范围查单次调用；不存在时返回规则失败，不跨会话查找同名标识。
     */
    async queryMcpCall(userId: string, id: string, callId: string) { const e = await this.policy.owned(userId, id); const call = await this.history.call(e.sessionId, callId); requireRule(call, 'not-found'); return call; }
}
