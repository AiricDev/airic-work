import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { TaskCreationUseCases } from '../src/application/task-creation';
import { openSqliteDatabase } from '../src/adapters/driven/sqlite/database';
import { SqliteTaskRegistry } from '../src/adapters/driven/sqlite/task-registry';
import { SqliteTaskInitializer } from '../src/adapters/driven/sqlite/task-initializer';

it('repairs an interrupted task reservation and preserves the first creation receipt', () => {
    const directory = mkdtempSync(join(tmpdir(), 'airic-task-create-'));
    const db = openSqliteDatabase(join(directory, 'registry.sqlite'));
    try {
        const registry = new SqliteTaskRegistry(db);
        const initializer = new SqliteTaskInitializer(join(directory, 'tasks'));
        let attempts = 0;
        let ids = 0;
        const service = new TaskCreationUseCases(registry, {
            read: taskId => initializer.read(taskId),
            initialize(record) {
                const result = initializer.initialize(record);
                if (attempts++ === 0) throw new Error('interrupted after commit');
                return result;
            },
        }, () => `task-${++ids}`, () => `time-${attempts}`);
        const creation = { instruction: 'Review', om: { source: 'local', revision: 'v1', entry: 'om.md' } };
        expect(() => service.create('engineer', 'key', creation)).toThrow('interrupted');
        expect(registry.get('task-1')?.state).toBe('reserved');
        const result = service.create('engineer', 'key', creation);
        expect(result).toMatchObject({ taskId: 'task-1', acceptedAt: 'time-0' });
        expect(registry.get('task-1')?.state).toBe('ready');
        expect(service.create('engineer', 'key', creation)).toEqual(result);
        expect(service.get(result.taskId)).toEqual(result);
        expect(() => service.create('other', 'key', creation)).toThrow();
        expect(() => service.create('engineer', 'key', { ...creation, instruction: 'Changed' })).toThrow();
    } finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
