import { nonempty, requireRule, runtimePath } from '../domain/model';
import type { Settings } from '../domain/model';
import type { ConfigurationCatalog, ControlStore } from './ports';
/**
 * 管理员实例配置能力；当前覆盖 OM 来源与业务连接标识。真实连通测试、秘密和运行环境装配由外层落实。
 */
export class SettingsUseCases {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly store: ControlStore, private readonly configurationCatalog?: ConfigurationCatalog) { }
    /**
     * 管理员按预期配置版本保存新设置，校验入口路径和必填来源。只改变未来准备依据；不重写已运行执行的 Method，也不宣称配置已生效或连接测试通过。
     */
    async configure(actorId: string, expected: number, settings: Settings) {
        const actor = await this.store.user(actorId);
        requireRule(actor.enabled && actor.admin, 'forbidden');
        if (this.configurationCatalog) {
            requireRule(this.configurationCatalog.sources.includes(settings.omSource) && settings.connections.every(id => this.configurationCatalog!.connections.includes(id)), 'invalid');
        }
        runtimePath(settings.root);
        nonempty(settings.omSource);
        nonempty(settings.branch);
        return this.store.saveSettings(actorId, expected, { ...settings, version: expected + 1 });
    }
    /**
     * 仅启用管理员读取实例设置，当前类型不承载明文秘密。
     */
    async querySettings(userId: string) { const u = await this.store.user(userId); requireRule(u.enabled && u.admin, 'forbidden'); return this.store.settings(); }
}
