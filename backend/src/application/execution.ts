import { beginStop, endRun, recordStopped, active, creationValid, requireRule, runtimePath } from '../domain/model';
import type { Creation, Execution } from '../domain/model';
import type { Methods, Runtime, ControlStore, Support, Workspace } from './ports';
import { ApplicationPolicy } from './policy';
/**
 * 执行控制能力：按需建组、固定输入/方法、结束与取消。后台进程和文件机制经端口实现，业务完成状态不由本能力管理。
 */
export class ExecutionUseCases {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly methods: Methods, private readonly runtime: Runtime, private readonly store: ControlStore, private readonly support: Support, private readonly workspace: Workspace, private readonly policy: ApplicationPolicy) { }
    /**
     * 以可信入口传入的 userId/source 创建执行，发起用户即归属人。先查本地创建幂等结果；Store 原子复用/创建分组并保存输入，不按 task.id 去重。
     * 入口负责从认证上下文注入身份与来源，不可把用户任意填写的值直接传入。
     */
    async createExecution(userId: string, key: string, creation: Creation) {
        requireRule((await this.store.user(userId)).enabled, 'forbidden');
        creationValid(creation);
        const k = this.policy.key(userId, key, creation);
        const replay = await this.store.replay<Execution>('create', k);
        if (replay)
            return replay;
        const project = { id: this.support.id(), source: creation.source, externalId: creation.project_id, name: creation.project_name };
        return this.store.createExecution(k, project, { id: this.support.id(), projectId: project.id, ownerId: userId, creation, sessionId: this.support.id(), workspaceId: this.support.id(), phase: 'new', generation: 0, version: 0 });
    }
    /**
     * 事务外确认最新 OM，再通过执行版本和设置版本 CAS 固定 Method 与开始输入。已固定的方法直接沿用，不重新解析最新版本；此步骤不等于 Runtime 已实际启动。
     */
    async prepareExecution(userId: string, id: string) {
        const e = await this.policy.owned(userId, id);
        if (e.method)
            return e;
        const settings = await this.store.settings();
        const method = await this.methods.latest(settings);
        runtimePath(method.root);
        requireRule(method.source === settings.omSource && !!method.sha, 'blocked', 'unconfirmed OM');
        return this.store.prepare(userId, e.version, settings.version, { ...e, method, version: e.version + 1 }, this.policy.envelope(e, e.id, 'start', e.creation.instruction, []));
    }
    /**
     * 仅当前代次可显式结束。Store 必须把版本比较及“无未交付输入”作为同一提交条件；新消息仍可续行原执行，不检查业务任务正式完成。
     */
    async finishExecution(userId: string, id: string, generation: number) {
        const e = await this.policy.owned(userId, id);
        active(e, generation);
        return this.store.transition(userId, e.version, endRun(e, generation), true);
    }
    /**
     * 先持久设置停止栅栏，再调用可重试 stop。stop 失败保留 stopping 供恢复；请求被接受不等于停止完成，也不回滚已有业务效果。
     */
    async requestCancellation(userId: string, id: string) {
        let e = await this.policy.owned(userId, id);
        if (e.phase !== 'stopping' && e.phase !== 'stopped')
            e = await this.store.transition(userId, e.version, beginStop(e));
        if (e.phase === 'stopped')
            return e;
        await this.runtime.stop(e); // repeat-safe; phase is the durable stop intent if the call fails
        return e;
    }
    /**
     * 同时取得 Runtime 与 Workspace 工具退出确认后，以 CAS 记录 stopped。任一未确认则保持 stopping，不提前让新运行进入。
     */
    async confirmStopped(userId: string, id: string) {
        const e = await this.policy.owned(userId, id);
        requireRule(e.phase === 'stopping', 'conflict');
        requireRule(await this.runtime.stopped(e) && await this.workspace.stopped(e), 'blocked');
        return this.store.transition(userId, e.version, recordStopped(e));
    }
}
