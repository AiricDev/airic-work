import { active, requireRule, canonical } from '../domain/model';
import type { History, Mcp, ControlStore, Support } from './ports';
import { ApplicationPolicy } from './policy';
/**
 * 动态业务 MCP 能力。按执行用户和运行代次控制派发，Session 先记录发起，业务幂等及原操作核验仍由外部服务合同负责。
 */
export class McpUseCases {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly history: History, private readonly mcp: Mcp, private readonly store: ControlStore, private readonly support: Support, private readonly policy: ApplicationPolicy) { }
    /**
     * 以宿主稳定 callId 执行一次工具调用；原 ID 重放先查已记录结果，不重新派发未知效果。同 ID 不同工具或参数冲突。
     * 先持久保存脱敏发起记录，再复查运行资格并调用；派发或结果保存异常保留 unknown，不自动重试写操作。若记录 unknown 也失败，异常继续传播，不能宣称已保存。
     * @param callId 由可信 Runtime 调用身份提供；重放沿用，只有明确的新尝试才分配新 ID。
     * @param parameters 工具输入；用于执行的原数据与可记录的脱敏数据分开，适配器不得将凭据返回给模型。
     */
    async callMcp(userId: string, id: string, generation: number, connection: string, tool: string, parameters: import('../domain/model').Json, callId: string) {
        requireRule(!!callId, 'invalid');
        const e = await this.policy.owned(userId, id);
        active(e, generation);
        requireRule((await this.store.settings()).connections.includes(connection), 'forbidden');
        const definition = (await this.mcp.tools(userId, connection)).find(t => t.name === tool);
        requireRule(definition, 'invalid');
        const existing = await this.history.call(e.sessionId, callId);
        if (existing) {
            requireRule(existing.connection === connection && existing.tool === tool && canonical(existing.parameters) === canonical(this.mcp.sanitize(connection, parameters)), 'conflict');
            return { callId, status: existing.status === 'calling' ? 'unknown' : existing.status, result: existing.result };
        }
        const call = { id: callId, sessionId: e.sessionId, connection, tool, at: this.support.now(), type: definition.classification ?? 'unknown' as const, classificationSource: definition.classificationSource, schemaRevision: definition.schemaRevision, parameters: this.mcp.sanitize(connection, parameters), status: 'calling' as const };
        await this.history.appendCall(call); // a failed history write MUST prevent external dispatch
        active(await this.policy.owned(userId, id), generation);
        try {
            const result = await this.mcp.call({ userId, executionId: id, generation, sessionId: e.sessionId }, connection, tool, parameters);
            await this.history.finishCall(e.sessionId, call.id, result.status, this.mcp.sanitize(connection, result.result));
            return { callId: call.id, ...result, result: this.mcp.sanitize(connection, result.result) };
        }
        catch {
            await this.history.finishCall(e.sessionId, call.id, 'unknown', { message: 'Result unconfirmed; inspect original call before retry' });
            return { callId: call.id, status: 'unknown' as const };
        }
    }
    /**
     * 只在当前归属/运行代次及已配置连接下发现工具，使用服务声明的 Schema 和分类，不凭工具名推断读写。
     */
    async discoverMcpTools(userId: string, id: string, generation: number, connection: string) { const e = await this.policy.owned(userId, id); active(e, generation); requireRule((await this.store.settings()).connections.includes(connection), 'forbidden'); return this.mcp.tools(userId, connection); }
}
