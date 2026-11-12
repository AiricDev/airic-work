import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { requireRule } from '../../../domain/model';
import type { TaskRegistry, TaskReservation } from '../../../application/task-registry';
import { databaseAccess, databaseCommit } from './operations';

/** Instance-level durable reservations. Task data remains in its own control store. */
export class SqliteTaskRegistry implements TaskRegistry {
    constructor(private readonly db: Database.Database) {
        db.exec(`CREATE TABLE IF NOT EXISTS task_reservations (
            task_id TEXT PRIMARY KEY,
            command_key TEXT NOT NULL UNIQUE,
            fingerprint TEXT NOT NULL,
            state TEXT NOT NULL CHECK (state IN ('reserved', 'ready'))
        )`);
    }

    reserve(key: string, canonicalPayload: string, taskId: string): TaskReservation {
        requireRule([key, canonicalPayload, taskId].every(value => value.trim().length > 0), 'invalid');
        const fingerprint = createHash('sha256').update(canonicalPayload).digest('hex');
        return databaseCommit(this.db, () => {
            const existing = this.db.prepare('SELECT task_id, fingerprint, state FROM task_reservations WHERE command_key = ?').get(key) as { task_id: string; fingerprint: string; state: 'reserved' | 'ready' } | undefined;
            if (existing) {
                requireRule(existing.fingerprint === fingerprint, 'conflict');
                return { taskId: existing.task_id, state: existing.state };
            }
            this.db.prepare('INSERT INTO task_reservations VALUES (?, ?, ?, ?)').run(taskId, key, fingerprint, 'reserved');
            return { taskId, state: 'reserved' };
        });
    }

    markReady(taskId: string): void {
        databaseCommit(this.db, () => {
            const result = this.db.prepare("UPDATE task_reservations SET state = 'ready' WHERE task_id = ?").run(taskId);
            requireRule(result.changes === 1, 'not-found');
        });
    }

    allReadyIds(): string[] {
        return databaseAccess(() => (this.db.prepare(
            "SELECT task_id FROM task_reservations WHERE state = 'ready' ORDER BY rowid",
        ).all() as { task_id: string }[]).map(row => row.task_id));
    }

    get(taskId: string): TaskReservation | undefined {
        return databaseAccess(() => {
            const row = this.db.prepare('SELECT task_id, state FROM task_reservations WHERE task_id = ?').get(taskId) as { task_id: string; state: 'reserved' | 'ready' } | undefined;
            return row && { taskId: row.task_id, state: row.state };
        });
    }
}
