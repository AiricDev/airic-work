import type Database from 'better-sqlite3';
import { RuleError } from '../../../domain/model';

/** SQLite 共用错误边界，不包含任一业务能力的资格、CAS 或提交规则。 */
export function databaseAccess<T>(work: () => T): T {
    try { return work(); }
    catch (error) {
        let cause: unknown = error;
        while (cause instanceof Error) {
            if (cause instanceof RuleError) throw cause;
            const code = 'code' in cause ? String(cause.code) : '';
            if (code.startsWith('SQLITE_CONSTRAINT')) throw new RuleError('conflict');
            if (code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED')) throw new RuleError('blocked', 'database busy');
            cause = cause.cause;
        }
        throw new RuleError('blocked', 'database unavailable');
    }
}

/** 仅供 SQLite adapter 内部使用；同步事务，不能导出给 Application。 */
export function databaseCommit<T>(connection: Database.Database, work: () => T): T {
    return databaseAccess(() => connection.transaction(work).immediate());
}
