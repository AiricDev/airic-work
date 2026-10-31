import { Application } from '../application/application';
import { ApplicationPolicy } from '../application/policy';
import { asClass, asValue, createContainer, InjectionMode } from 'awilix';
import type { AdapterBindings } from './bindings';
import { ValidatedCommands } from '../adapters/driving/validation/commands';
import { AccountUseCases } from '../application/account';
import { ExecutionUseCases } from '../application/execution';
import { DecisionUseCases } from '../application/decision';
import { InputUseCases } from '../application/input';
import { QueryUseCases } from '../application/query';
import { MethodUseCases } from '../application/method';
import { SettingsUseCases } from '../application/settings';
import { McpUseCases } from '../application/mcp';
interface Registrations extends AdapterBindings {
    application: Application;
    policy: ApplicationPolicy;
    account: AccountUseCases;
    execution: ExecutionUseCases;
    decision: DecisionUseCases;
    input: InputUseCases;
    query: QueryUseCases;
    method: MethodUseCases;
    settings: SettingsUseCases;
    mcpCases: McpUseCases;
}
/**
 *  组合根分别注册能力。服务仅通过构造函数接收所需端口；用户身份按调用传入，不进入单例。
 * 调用方仍负责关闭传入的适配器资源，dispose 只释放容器自身拥有的注册实例。
 */
export function createBackend(dependencies: AdapterBindings) {
    const container = createContainer<Registrations>({ injectionMode: InjectionMode.CLASSIC, strict: true });
    container.register({
        policy: asClass(ApplicationPolicy).singleton(),
        application: asClass(Application).singleton(),
        store: asValue(dependencies.store),
        configurationCatalog: asValue(dependencies.configurationCatalog),
        support: asValue(dependencies.support),
        identity: asValue(dependencies.identity),
        runtime: asValue(dependencies.runtime),
        workspace: asValue(dependencies.workspace),
        files: asValue(dependencies.files),
        methods: asValue(dependencies.methods),
        history: asValue(dependencies.history),
        mcp: asValue(dependencies.mcp),
        account: asClass(AccountUseCases).singleton(),
        execution: asClass(ExecutionUseCases).singleton(),
        decision: asClass(DecisionUseCases).singleton(),
        input: asClass(InputUseCases).singleton(),
        query: asClass(QueryUseCases).singleton(),
        method: asClass(MethodUseCases).singleton(),
        settings: asClass(SettingsUseCases).singleton(),
        mcpCases: asClass(McpUseCases).singleton(),
    });
    const application = container.resolve('application');
    return { application, commands: new ValidatedCommands(application), dispose: () => container.dispose() };
}
