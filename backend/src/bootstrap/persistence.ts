import { drizzle } from 'drizzle-orm/better-sqlite3';
import { requireRule, RuleError, runtimePath, type Settings } from '../domain/model';
import type { ControlStore, Support } from '../application/ports';
import { openControlDatabase } from '../adapters/driven/sqlite/database';
import { migrate } from '../adapters/driven/sqlite/migrations';
import { SqliteControlStore } from '../adapters/driven/sqlite/store';
import { settings } from '../adapters/driven/sqlite/schema';
import { SystemSupport } from '../adapters/driven/support/system-support';

export interface PersistenceOptions {
    /** 生产使用绝对文件路径；:memory: 仅用于隔离测试，不具备重启持久性。 */
    filename: string;
    /** 仅空库初始化时使用；重开绝不覆盖已有设置，也不创建管理员。 */
    initialSettings: Settings;
}

export interface PersistenceResources {
    store: ControlStore;
    support: Support;
    close(): void;
}

/** 仅创建本批拥有的资源，不伪造其他 AdapterBindings 或启动后台工作。调用方必须关闭。 */
export function createPersistence(options: PersistenceOptions): PersistenceResources {
    requireRule(options.initialSettings.version === 0, 'invalid', 'initial settings version must be zero');
    runtimePath(options.initialSettings.root);
    const connection = openControlDatabase(options.filename);
    try {
        migrate(connection);
        drizzle(connection).insert(settings).values({ id: 1, ...options.initialSettings }).onConflictDoNothing().run();
        const store = new SqliteControlStore(connection);
        return {
            store, support: new SystemSupport(),
            close() { if (connection.open) connection.close(); },
        };
    } catch (error) {
        connection.close();
        if (error instanceof RuleError) throw error;
        throw new RuleError('blocked', 'persistence initialization unavailable');
    }
}
