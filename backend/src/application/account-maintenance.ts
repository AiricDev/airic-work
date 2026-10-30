import { nonempty } from '../domain/model';
import type { LocalAccountAdministration } from './ports';

/** 本机操作员显式提升用户，不要求已有管理员；不属于普通 Application 的用户请求表面。 */
export class AccountMaintenanceUseCases {
    constructor(private readonly administration: LocalAccountAdministration) { }
    async grantAdministrator(userId: string): Promise<void> {
        nonempty(userId);
        await this.administration.grantAdministrator(userId);
    }
}
