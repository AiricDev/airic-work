import { AccountMaintenanceUseCases } from '../application/account-maintenance';
import { SqliteAccountAdministration } from '../adapters/driven/sqlite/account-maintenance';
import { openSqliteDatabase } from '../adapters/driven/sqlite/database';

/** 仅现存文件；不执行 migrate、初始化 Settings、注册到普通容器或提供服务入口。 */
export function createAccountMaintenance(filename: string) {
    const connection = openSqliteDatabase(filename, { fileMustExist: true });
    return {
        administration: new AccountMaintenanceUseCases(new SqliteAccountAdministration(connection)),
        close() { if (connection.open) connection.close(); },
    };
}
