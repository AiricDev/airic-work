import type { Application } from './application';
/** 外部只读能力。认证入口注入稳定用户，每次查询仍校验当前使用资格，无命令入口。 */
export class ReadonlyMcp {
    constructor(private readonly app: Application, private readonly userId: string) { }
    executions() { return this.app.query.queryExecutions(this.userId); }
    session(id: string, cursor?: string) { return this.app.query.querySession(this.userId, id, cursor); }
    episode(requestId: string) { return this.app.query.queryEpisode(this.userId, requestId); }
    operations(id: string, type?: 'read' | 'write' | 'unknown', cursor?: string) { return this.app.query.queryMcpCalls(this.userId, id, type, cursor); }
}
