import { dirname, isAbsolute } from 'node:path';
import { closeSync, constants, mkdirSync, openSync } from 'node:fs';
import Database from 'better-sqlite3';
import { requireRule, RuleError } from '../../../domain/model';

/** 每条生产连接使用同一安全/持久性配置；仅 :memory: 例外，不承诺重启恢复。 */
export function openControlDatabase(filename: string): Database.Database {
    requireRule(filename === ':memory:' || isAbsolute(filename), 'invalid', 'absolute database path required');
    let connection: Database.Database | undefined;
    try {
        if (filename !== ':memory:') {
            mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
            // 不截断、不改已有文件权限；新建数据库从第一字节起仅供当前用户读写。
            closeSync(openSync(filename, constants.O_CREAT | constants.O_RDWR, 0o600));
        }
        connection = new Database(filename);
        connection.pragma('busy_timeout = 5000');
        connection.pragma('foreign_keys = ON');
        connection.pragma('journal_mode = WAL');
        connection.pragma('synchronous = FULL');
        requireRule(connection.pragma('journal_mode', { simple: true }) === (filename === ':memory:' ? 'memory' : 'wal'), 'blocked');
        return connection;
    } catch {
        if (connection?.open) connection.close();
        throw new RuleError('blocked', 'database connection unavailable');
    }
}
