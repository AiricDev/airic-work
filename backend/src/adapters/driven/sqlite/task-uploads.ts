import type Database from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { LocalBlobFiles } from '../files/local-blob-files';
import { requireRule } from '../../../domain/model';
import { databaseAccess, databaseCommit } from './operations';

interface StagedUpload {
    id: string;
    name: string;
    hash: string;
    size: number;
    contentRef: string;
    expiresAt: string;
    taskId: string | null;
}

export class SqliteTaskUploads {
    constructor(private readonly db: Database.Database, readonly files: LocalBlobFiles) {
        db.exec(`CREATE TABLE IF NOT EXISTS task_uploads (
            id TEXT PRIMARY KEY, scope TEXT NOT NULL, actor TEXT NOT NULL, command_key TEXT NOT NULL,
            name TEXT NOT NULL, hash TEXT NOT NULL, size INTEGER NOT NULL,
            contentRef TEXT NOT NULL, expiresAt TEXT NOT NULL, taskId TEXT,
            UNIQUE(scope, actor, command_key)
        )`);
        db.exec(`CREATE TABLE IF NOT EXISTS task_upload_claims (
            upload_id TEXT PRIMARY KEY REFERENCES task_uploads(id), task_id TEXT NOT NULL
        )`);
    }

    async stage(scope: string, actor: string, key: string, name: string, bytes: Uint8Array) {
        requireRule(name.length > 0 && name.length <= 255 && !/[\\/\x00-\x1f\x7f]/.test(name), 'invalid');
        const blob = await this.files.put(bytes);
        return databaseCommit(this.db, () => {
            const old = this.db.prepare('SELECT * FROM task_uploads WHERE scope = ? AND actor = ? AND command_key = ?')
                .get(scope, actor, key) as StagedUpload | undefined;
            if (old) {
                requireRule(old.name === name && old.hash === blob.hash, 'conflict');
                return old;
            }
            const row = { id: randomUUID(), name, ...blob, expiresAt: new Date(Date.now() + 86400000).toISOString(), taskId: null };
            this.db.prepare('INSERT INTO task_uploads VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)')
                .run(row.id, scope, actor, key, name, row.hash, row.size, row.contentRef, row.expiresAt);
            return row;
        });
    }

    private reserve(scope: string, actor: string, taskId: string, ids: readonly string[], pending: boolean) {
        const now = new Date().toISOString();
        const find = this.db.prepare('SELECT * FROM task_uploads WHERE id = ? AND scope = ? AND actor = ?');
        const bind = this.db.prepare('UPDATE task_uploads SET taskId = ? WHERE id = ?');
        const claim = this.db.prepare('INSERT INTO task_upload_claims VALUES (?, ?)');
        return [...new Set(ids)].map(id => {
            const upload = find.get(id, scope, actor) as StagedUpload | undefined;
            requireRule(upload && (upload.taskId === taskId || (upload.taskId === null && upload.expiresAt > now)), 'not-found');
            if (upload.taskId === null) {
                bind.run(taskId, id);
                if (pending) claim.run(id, taskId);
            }
            return upload;
        });
    }

    bind(scope: string, actor: string, taskId: string, ids: readonly string[]) {
        databaseCommit(this.db, () => this.reserve(scope, actor, taskId, ids, false));
    }

    claim(scope: string, actor: string, taskId: string, ids: readonly string[]) {
        return databaseCommit(this.db, () => this.reserve(scope, actor, taskId, ids, true));
    }

    settle(taskId: string, attached: (id: string) => boolean) {
        databaseCommit(this.db, () => {
            const rows = this.db.prepare('SELECT upload_id FROM task_upload_claims WHERE task_id = ?').all(taskId) as { upload_id: string }[];
            const release = this.db.prepare('UPDATE task_uploads SET taskId = NULL WHERE id = ? AND taskId = ?');
            const clear = this.db.prepare('DELETE FROM task_upload_claims WHERE upload_id = ?');
            for (const { upload_id } of rows) {
                if (!attached(upload_id)) release.run(upload_id, taskId);
                clear.run(upload_id);
            }
        });
    }

    bound(scope: string, actor: string, taskId: string, id: string): StagedUpload {
        const upload = this.findBound(scope, actor, taskId, id);
        requireRule(upload, 'not-found');
        return upload;
    }

    findBound(scope: string, actor: string, taskId: string, id: string) {
        return databaseAccess(() => this.db.prepare(`SELECT * FROM task_uploads WHERE id = ? AND scope = ? AND actor = ? AND taskId = ?
            AND NOT EXISTS (SELECT 1 FROM task_upload_claims WHERE upload_id = task_uploads.id)`)
            .get(id, scope, actor, taskId) as StagedUpload | undefined);
    }
}
