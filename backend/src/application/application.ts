import { AccountUseCases } from './account';
import { ExecutionUseCases } from './execution';
import { DecisionUseCases } from './decision';
import { InputUseCases } from './input';
import { QueryUseCases } from './query';
import { MethodUseCases } from './method';
import { SettingsUseCases } from './settings';
import { McpUseCases } from './mcp';
/** 应用能力的显式门面，仅聚合具名服务，不展开或绑定其方法。 */
export class Application {
    constructor(public readonly account: AccountUseCases, public readonly execution: ExecutionUseCases, public readonly decision: DecisionUseCases, public readonly input: InputUseCases, public readonly query: QueryUseCases, public readonly method: MethodUseCases, public readonly settings: SettingsUseCases, public readonly mcpCases: McpUseCases) { }
}
