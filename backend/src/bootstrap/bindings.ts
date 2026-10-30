import type { ControlStore, Support, Identity, Runtime, Workspace, Files, Methods, History, Mcp } from '../application/ports';
/** 仅组合根使用的适配器注册表；不作为业务能力的服务定位器。 */
export interface AdapterBindings {
    store: ControlStore;
    support: Support;
    identity: Identity;
    runtime: Runtime;
    workspace: Workspace;
    files: Files;
    methods: Methods;
    history: History;
    mcp: Mcp;
}
