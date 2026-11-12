import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { openSqliteDatabase } from '../src/adapters/driven/sqlite/database';
import { SqliteTaskRegistry } from '../src/adapters/driven/sqlite/task-registry';

it('retains a unique reservation and readiness across reopening', () => {
    const directory = mkdtempSync(join(tmpdir(), 'airic-task-registry-'));
    const path = join(directory, 'registry.sqlite');
    try {
        const secret = 'credential-example';
        let db = openSqliteDatabase(path);
        let registry = new SqliteTaskRegistry(db);
        expect(registry.reserve('key', secret, 'task-1')).toEqual({ taskId: 'task-1', state: 'reserved' });
        db.close();
        db = openSqliteDatabase(path);
        registry = new SqliteTaskRegistry(db);
        expect(registry.reserve('key', secret, 'task-2')).toEqual({ taskId: 'task-1', state: 'reserved' });
        expect(() => registry.reserve('key', 'different', 'task-3')).toThrow();
        registry.markReady('task-1');
        expect(registry.get('task-1')).toEqual({ taskId: 'task-1', state: 'ready' });
        expect(JSON.stringify(db.prepare('SELECT * FROM task_reservations').all())).not.toContain(secret);
        db.close();
    } finally { rmSync(directory, { recursive: true, force: true }); }
});
