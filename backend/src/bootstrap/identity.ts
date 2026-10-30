import type { Identity } from '../application/ports';
import { HttpsUserInfoIdentity, type HttpsUserInfoOptions } from '../adapters/driven/identity/https-user-info';

/** 认证配置来自可信宿主；不启动 HTTP、不保存 token、不创建本地用户或管理员。 */
export function createIdentity(options: HttpsUserInfoOptions): { identity: Identity } {
    return { identity: new HttpsUserInfoIdentity(options) };
}
