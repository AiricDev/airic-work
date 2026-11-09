import type Database from 'better-sqlite3';
import { createHmac } from 'node:crypto';
import { requireRule } from '../../../domain/model';
import type { TaskRegistry, TaskReservation } from '../../../application/task-registry';
import { databaseAccess, databaseCommit } from './operations';

/** Instance-level durable reservations. Task data remains in its own control store. */
export class SqliteTaskRegistry implements TaskRegistry {
    constructor(private readonly db: Database.Database) {
        db.exec(`CREATE TABLE IF NOT EXISTS task_reservations (
            task_id TEXT PRIMARY KEY,
            scope TEXT NOT NULL,
            actor TEXT NOT NULL,
            command_key TEXT NOT NULL,
            fingerprint TEXT NOT NULL,
            state TEXT NOT NULL CHECK (state IN ('reserved', 'ready')),
            UNIQUE(scope, actor, command_key)
        )`);
    }

    reserve(scope: string, actor: string, key: string, fingerprint: string, taskId: string): TaskReservation {
        requireRule([scope, actor, key, fingerprint, taskId].every(value => value.trim().length > 0), 'invalid');
        return databaseCommit(this.db, () => {
            const existing = this.db.prepare('SELECT task_id, fingerprint, state FROM task_reservations WHERE scope = ? AND actor = ? AND command_key = ?').get(scope, actor, key) as { task_id: string; fingerprint: string; state: 'reserved' | 'ready' } | undefined;
            if (existing) {
                requireRule(existing.fingerprint === fingerprint, 'conflict');
                return { taskId: existing.task_id, state: existing.state };
            }
            this.db.prepare('INSERT INTO task_reservations VALUES (?, ?, ?, ?, ?, ?)').run(taskId, scope, actor, key, fingerprint, 'reserved');
            return { taskId, state: 'reserved' };
        });
    }

    markReady(taskId: string): void {
        databaseCommit(this.db, () => {
            const result = this.db.prepare("UPDATE task_reservations SET state = 'ready' WHERE task_id = ?").run(taskId);
            requireRule(result.changes === 1, 'not-found');
        });
    }

    get(taskId: string): TaskReservation | undefined {
        return databaseAccess(() => {
            const row = this.db.prepare('SELECT task_id, state FROM task_reservations WHERE task_id = ?').get(taskId) as { task_id: string; state: 'reserved' | 'ready' } | undefined;
            return row && { taskId: row.task_id, state: row.state };
        });
    }
}

/** Keyed digest prevents secrets in command payloads being stored as plaintext fingerprints. */
export function taskFingerprint(key: Uint8Array, canonicalPayload: string): string {
    requireRule(key.byteLength >= 32, 'invalid');
    return createHmac('sha256', key).update(canonicalPayload).digest('hex');
}
