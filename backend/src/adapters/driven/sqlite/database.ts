import { dirname, isAbsolute } from 'node:path';
import { closeSync, constants, mkdirSync, openSync } from 'node:fs';
import Database from 'better-sqlite3';
import { requireRule, RuleError } from '../../../domain/model';

const busyTimeoutMs = 5000;

/** WAL 首次切换可能不等待 busy_timeout；仅重试连接初始化，不重试应用写入。 */
function configureJournal(connection: Database.Database, memory: boolean): void {
    const desired = memory ? 'memory' : 'wal';
    const deadline = performance.now() + busyTimeoutMs;
    const wait = new Int32Array(new SharedArrayBuffer(4));
    for (;;) {
        try {
            if (connection.pragma('journal_mode', { simple: true }) !== desired)
                connection.pragma('journal_mode = WAL');
            requireRule(connection.pragma('journal_mode', { simple: true }) === desired, 'blocked');
            return;
        } catch (error) {
            const code = error instanceof Error && 'code' in error ? String(error.code) : '';
            if (!(code.startsWith('SQLITE_BUSY') || code.startsWith('SQLITE_LOCKED')) || performance.now() >= deadline) throw error;
            Atomics.wait(wait, 0, 0, 10);
        }
    }
}

/** 每条生产连接使用同一安全/持久性配置；仅 :memory: 例外，不承诺重启恢复。 */
export function openSqliteDatabase(filename: string): Database.Database {
    requireRule(filename === ':memory:' || isAbsolute(filename), 'invalid', 'absolute database path required');
    let connection: Database.Database | undefined;
    try {
        if (filename !== ':memory:') {
            mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
            // 不截断、不改已有文件权限；新建数据库从第一字节起仅供当前用户读写。
            closeSync(openSync(filename, constants.O_CREAT | constants.O_RDWR, 0o600));
        }
        connection = new Database(filename);
        connection.pragma(`busy_timeout = ${busyTimeoutMs}`);
        connection.pragma('foreign_keys = ON');
        configureJournal(connection, filename === ':memory:');
        connection.pragma('synchronous = FULL');
        return connection;
    } catch {
        if (connection?.open) connection.close();
        throw new RuleError('blocked', 'database connection unavailable');
    }
}

// 保持既有内部调用入口兼容；控制库和可重建索引实际共享同一连接配置。
export const openControlDatabase = openSqliteDatabase;
