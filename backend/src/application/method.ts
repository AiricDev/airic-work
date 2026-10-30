import { nonempty, requireRule, runtimePath } from '../domain/model';
import type { Method } from '../domain/model';
import type { Methods, ControlStore } from './ports';
/**
 * OM 文件能力：阅读指定修订、版本内搜索及当前来源历史；不构造或采纳方法，不操作 .ome/ 作者材料。
 */
export class MethodUseCases {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly methods: Methods, private readonly store: ControlStore) { }
    /**
     * 校验用户启用及运行文件路径后读取指定 Method。快照来源合法性和实际路径隔离由 Methods 适配器兑现，不把 source 当任意宿主路径。
     */
    async readMethod(userId: string, method: Method, path: string) { requireRule((await this.store.user(userId)).enabled, 'forbidden'); runtimePath(path); return this.methods.read(method, path); }
    /**
     * 在指定 Method 中搜索并剔除越界/作者路径结果。适配器还须在索引阶段限定来源/SHA，不能靠结果过滤掩盖跨版本检索。
     */
    async searchMethod(userId: string, method: Method, query: string) {
        requireRule((await this.store.user(userId)).enabled, 'forbidden');
        nonempty(query);
        return (await this.methods.search(method, query)).filter(r => {
            try {
                runtimePath(r.path);
                return true;
            }
            catch {
                return false;
            }
        });
    }
    /**
     * 读取当前配置 OM 来源的 Git 历史，不修改任何执行的固定 Method。
     */
    async methodHistory(userId: string) { requireRule((await this.store.user(userId)).enabled, 'forbidden'); return this.methods.history((await this.store.settings()).omSource); }
    /** 查询当前来源的同步能力及提示，供入口禁用不可用操作；不探测网络。 */
    async methodStatus(userId: string) { requireRule((await this.store.user(userId)).enabled, 'forbidden'); return this.methods.status(await this.store.settings()); }
    /** 按当前配置显式同步 OM，不改变任何已有执行的固定版本；适配器必须保护本地工作区。 */
    async syncMethod(userId: string) { requireRule((await this.store.user(userId)).enabled, 'forbidden'); return this.methods.sync(await this.store.settings()); }
}
