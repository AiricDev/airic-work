import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireRule } from '../../../domain/model';
import type { TaskCreationRecord, TaskInitializer } from '../../../application/task-creation';
import { openSqliteDatabase } from './database';
import { databaseCommit } from './operations';

/** Initializes a task directory without replacing a previously committed creation record. */
export class SqliteTaskInitializer implements TaskInitializer {
    constructor(private readonly directory: string) {}

    read(taskId: string): TaskCreationRecord {
        requireRule(/^[A-Za-z0-9_-]{1,128}$/.test(taskId), 'invalid');
        const db = openSqliteDatabase(resolve(this.directory, taskId, 'control.sqlite'), { fileMustExist: true });
        try {
            const row = db.prepare('SELECT record FROM task_creation WHERE id = 1').get() as { record: string } | undefined;
            requireRule(row, 'not-found');
            return JSON.parse(row.record) as TaskCreationRecord;
        } finally { db.close(); }
    }

    initialize(record: TaskCreationRecord): TaskCreationRecord {
        requireRule(/^[A-Za-z0-9_-]{1,128}$/.test(record.taskId), 'invalid');
        const path = resolve(this.directory, record.taskId);
        mkdirSync(path, { recursive: true, mode: 0o700 });
        const db = openSqliteDatabase(resolve(path, 'control.sqlite'));
        try {
            db.exec('CREATE TABLE IF NOT EXISTS task_creation (id INTEGER PRIMARY KEY CHECK(id = 1), record TEXT NOT NULL)');
            return databaseCommit(db, () => {
                db.prepare('INSERT OR IGNORE INTO task_creation(id, record) VALUES (1, ?)').run(JSON.stringify(record));
                const row = db.prepare('SELECT record FROM task_creation WHERE id = 1').get() as { record: string };
                const persisted = JSON.parse(row.record) as TaskCreationRecord;
                requireRule(persisted.taskId === record.taskId && persisted.scope === record.scope && persisted.actor === record.actor, 'conflict');
                return persisted;
            });
        } finally { db.close(); }
    }
}
