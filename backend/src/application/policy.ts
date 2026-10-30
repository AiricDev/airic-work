/**
 * 应用内共享政策，不含基础设施实现。资格预检降低错误调用，但不消除提交和网络派发前的竞态。
 */
import { canonical, nonempty, own, requireRule } from '../domain/model';
import type { Execution, Input } from '../domain/model';
import type { Key, ControlStore, Support } from './ports';
/**
 * 当前应用能力共享的资格、文件归属和输入构造规则。只复用已有政策，不拥有数据库事务，也不提供全系统任意操作入口。
 */
export class ApplicationPolicy {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly store: ControlStore, private readonly support: Support) { }
    /**
     * 构造同一用户和命令内容的幂等比较数据；操作类型由具体 Store 方法区分，不把业务任务标识当命令键。
     */
    key(userId: string, key: string, value: unknown): Key { nonempty(key); return { userId, key, fingerprint: canonical(value) }; }
    /**
     * 加载 Execution 并核验当前本地用户资格及唯一归属。返回预检快照，不代替提交时 Store 或派发前宿主的复查。
     */
    async owned(userId: string, executionId: string) { const e = await this.store.execution(executionId); own(await this.store.user(userId), e); return e; }
    /**
     * 读取并核验每份固定上传内容都属于当前用户和当前 Execution；不实际搬运字节或解析文件。
     */
    async files(userId: string, e: Execution, ids: string[]) {
        const files = await Promise.all(ids.map(id => this.store.upload(id)));
        requireRule(files.every(f => f.userId === userId && f.executionId === e.id), 'forbidden');
        return files;
    }
    /**
     * 为已接受输入构造稳定 Session 投递描述。sequence 留给 Store 在提交事务中分配，此时 pending 不代表 Runtime 已收到。
     */
    envelope(e: Execution, sourceId: string, kind: Input['kind'], text: string, files: string[]): Omit<Input, 'sequence'> {
        return { id: this.support.id(), executionId: e.id, sessionId: e.sessionId, userId: e.ownerId, kind, sourceId, text, files, status: 'pending' };
    }
}
