import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import type Database from 'better-sqlite3';
import type { LocalAccountAdministration } from '../../../application/ports';
import { nonempty, requireRule } from '../../../domain/model';
import { databaseCommit } from './operations';
import { verifyMigrations } from './migrations';
import { users } from './schema';

/** OS 操作员专用写入边界，与需要 actor 管理员资格的 ControlStore.manageUser 分离。 */
export class SqliteAccountAdministration implements LocalAccountAdministration {
    constructor(private readonly connection: Database.Database) { }
    async grantAdministrator(userId: string): Promise<void> {
        nonempty(userId);
        databaseCommit(this.connection, () => {
            verifyMigrations(this.connection);
            const db = drizzle(this.connection);
            const user = db.select().from(users).where(eq(users.id, userId)).get();
            requireRule(user, 'not-found');
            requireRule(user.enabled, 'forbidden', 'disabled user');
            if (!user.admin) db.update(users).set({ admin: true, version: user.version + 1 }).where(eq(users.id, userId)).run();
        });
    }
}
