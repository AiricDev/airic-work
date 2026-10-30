import { beginRun, active, nonempty, requireRule } from '../domain/model';
import type { Files, Runtime, ControlStore, Support, Workspace } from './ports';
import { ApplicationPolicy } from './policy';
/**
 * 工作消息、上传和 Session 投递能力。接收与交付分别持久化，原执行续行沿用同一 Session/Workspace；不把文件或消息等同业务完成。
 */
export class InputUseCases {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly files: Files, private readonly runtime: Runtime, private readonly store: ControlStore, private readonly support: Support, private readonly workspace: Workspace, private readonly policy: ApplicationPolicy) { }
    /**
     * 保存 DecisionRequest 流程外的一般输入及交付意图。允许已结束或取消中的 Execution 接收消息，后者等待停止确认；不改变任何请求的已回答状态。
     */
    async submitSteering(userId: string, id: string, key: string, text: string, files: string[] = []) {
        const e = await this.policy.owned(userId, id);
        requireRule(text.trim() || files.length, 'invalid');
        await this.policy.files(userId, e, files);
        const k = this.policy.key(userId, key, { id, text, files });
        const old = await this.store.replay<import('../domain/model').SteeringInput>('steering', k);
        if (old)
            return old;
        const input = { id: this.support.id(), executionId: id, userId, text, files, at: this.support.now() };
        return this.store.submitSteering(k, input, this.policy.envelope(e, input.id, 'steering', text, files));
    }
    /**
     * 先固定真实字节，再保存当前用户/执行范围的 Upload。存储失败可能留下可清理孤立 Blob，不能绑定不存在内容；本用例不解析文件或登记外部业务资料。
     */
    async upload(userId: string, id: string, name: string, bytes: Uint8Array) {
        await this.policy.owned(userId, id);
        nonempty(name);
        const content = await this.files.put(bytes);
        return this.store.saveUpload(userId, { ...content, id: this.support.id(), executionId: id, userId, name });
    }
    /**
     * 按持久序号交付同一 Session 的输入：先检查文件就绪，再确认运行实例，结束后需确认旧进程退出才递增代次。
     * 先查 inputId 的持久接收结果再决定发送，接收状态未知必须失败而非当作未接收。Runtime 已接收而本地确认失败时，重试查回同一消息，不重复追加；最后写 delivered 不代表 Agent 已采纳。
     */
    async dispatchInput(userId: string, inputId: string) {
        let input = await this.store.input(inputId);
        let e = await this.policy.owned(userId, input.executionId);
        if (input.status === 'delivered')
            return input;
        requireRule(e.method && e.phase !== 'stopping', 'blocked');
        const queue = await this.store.inputs(e.id);
        requireRule(!queue.some(i => i.sequence < input.sequence && i.status !== 'delivered'), 'blocked', 'earlier input pending');
        await this.workspace.ensure(e);
        await this.workspace.materialize(e, await this.policy.files(userId, e, input.files));
        await this.runtime.ensure(e);
        if (e.phase !== 'running') {
            requireRule(await this.runtime.stopped(e) && await this.workspace.stopped(e), 'blocked');
            e = await this.store.transition(userId, e.version, beginRun(e));
        }
        // start is idempotent per generation; reattempt after a crash must repair the same binding.
        await this.runtime.start(e);
        await this.policy.owned(userId, e.id);
        const current = await this.store.execution(e.id);
        active(current, e.generation);
        const receipt = await this.runtime.accepted(e.sessionId, input.id) ?? await this.runtime.deliver(current, input);
        await this.store.markDelivered(userId, input.id, receipt);
        input = await this.store.input(inputId);
        return input;
    }
}
