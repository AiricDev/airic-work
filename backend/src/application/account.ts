import { nonempty, requireRule, RuleError } from '../domain/model';
import type { Identity, ControlStore, Support } from './ports';
export class DisabledAccountError extends RuleError {
    constructor() { super('forbidden'); }
}
/**
 * 本地账户能力：自动身份接入、管理保护、资料和偏好。外部认证经 Identity，权限变化由命名 Store 提交，不自建注册/密码或业务委托流程。
 */
export class AccountUseCases {
    /** 显式注入此能力所需端口；不持有容器或当前用户。 */
    constructor(private readonly identity: Identity, private readonly store: ControlStore, private readonly support: Support) { }
    /**
     * 先在事务外验证 token，再按 issuer/subject 查找或创建 User。首次候选默认启用但非管理员；已存在用户保留本地状态，停用用户重新认证仍被拒绝。
     */
    async ensureUser(token: string) {
        const identity = await this.identity.verify(token);
        [identity.issuer, identity.subject].forEach(nonempty);
        const user = await this.store.ensureUser({ ...identity, id: this.support.id(), enabled: true, admin: false, version: 0 });
        if (!user.enabled) throw new DisabledAccountError();
        return user;
    }
    /**
     * 仅启用的管理员可管理目标用户。预检自身停用、在途责任，Store 还须原子保护最后管理员和责任状态；不授予管理员他人执行内容权限。
     */
    async manageUser(actorId: string, targetId: string, patch: {
        enabled?: boolean;
        admin?: boolean;
        name?: string;
    }) {
        const actor = await this.store.user(actorId);
        requireRule(actor.enabled && actor.admin, 'forbidden');
        const u = await this.store.user(targetId);
        requireRule(!(u.id === actorId && patch.enabled === false), 'invalid');
        if (patch.enabled === false)
            requireRule(!(await this.store.executions()).some(e => e.ownerId === u.id && (['new', 'running', 'stopping'].includes(e.phase))), 'blocked');
        if (patch.enabled === false)
            for (const e of await this.store.executions())
                if (e.ownerId === u.id)
                    requireRule(!(await this.store.requests(e.id)).some(r => r.status === 'pending'), 'blocked');
        return this.store.manageUser(actorId, u.version, { ...u, ...patch, version: u.version + 1 });
    }
    /**
     * 管理员查看本地账户列表；不据此返回这些用户的执行内容。
     */
    async listUsers(actorId: string) { const actor = await this.store.user(actorId); requireRule(actor.enabled && actor.admin, 'forbidden'); return this.store.users(); }
    /**
     * 读取当前启用用户的本地资料，不读取 token 或扩展业务权限。
     */
    async profile(userId: string) { const u = await this.store.user(userId); requireRule(u.enabled, 'forbidden'); return u; }
    /**
     * 用户仅更新自己的显示名；保留稳定身份、启用状态及管理员权限，按原版本提交。
     */
    async updateProfile(userId: string, name: string) { nonempty(name); const u = await this.profile(userId); return this.store.updateProfile(userId, u.version, name.trim()); }
    /**
     * 用户更新自身显示/提示偏好，使用账户版本防止覆盖。只保存设置，不宣称语言包、通知投递或时区支持已在外层实现。
     */
    async updatePreferences(userId: string, preferences: import('../domain/model').Preferences) { nonempty(preferences.language); nonempty(preferences.timezone); const u = await this.profile(userId); return this.store.updatePreferences(userId, u.version, preferences); }
}
