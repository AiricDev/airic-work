import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Database from 'better-sqlite3';
import { createBackend } from '../src/bootstrap/container';
import { createPersistence } from '../src/bootstrap/bindings';
import { harness } from './support/harness';

it('migrates existing questions intact and persists a separate summary with its own idempotency fingerprint', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'aw-summary-'));
    const options = { filename: join(dir, 'control.sqlite'), initialSettings: { version: 0, omSource: 'repo', branch: 'main', root: 'om.md', connections: [] } };
    let p = createPersistence(options);
    let backend = createBackend({ ...harness().d, ...p });
    try {
        const app = backend.application;
        const u = await app.account.ensureUser('owner');
        let e = await app.execution.createExecution(u.id, 'create', { source: 'test', project_id: 'p', project_name: 'P', task: {}, instruction: 'review' });
        await app.execution.prepareExecution(u.id, e.id);
        await app.input.dispatchInput(u.id, (await p.store.inputs(e.id))[0].id);
        e = await p.store.execution(e.id);
        const context = { revision: 1, content: {}, sources: [] };
        const question = '## 完整问题\n\n- 第一项\n- 第二项';
        const old = await app.decision.createDecisionRequest(u.id, e.id, e.generation, 'old', question, [], context);
        await backend.dispose(); p.close();
        const raw = new Database(options.filename);
        raw.exec('ALTER TABLE decision_requests DROP COLUMN summary; DELETE FROM schema_migrations WHERE version=2;'); raw.close();
        p = createPersistence(options); backend = createBackend({ ...harness().d, ...p });
        expect((await p.store.request(old.id)).question).toBe(question);
        const r = await backend.application.decision.createDecisionRequest(u.id, e.id, e.generation, 'new', question, [], context, '  维护任务分类  ');
        expect(r.summary).toBe('维护任务分类');
        await expect(backend.application.decision.createDecisionRequest(u.id, e.id, e.generation, 'new', question, [], context, '其他问题')).rejects.toMatchObject({ code: 'conflict' });
        await expect(backend.application.decision.createDecisionRequest(u.id, e.id, e.generation, 'blank', question, [], context, ' ')).rejects.toMatchObject({ code: 'invalid' });
        await expect(backend.application.decision.createDecisionRequest(u.id, e.id, e.generation, 'long', question, [], context, '长'.repeat(81))).rejects.toMatchObject({ code: 'invalid' });
        await backend.dispose(); p.close();
        p = createPersistence(options); backend = createBackend({ ...harness().d, ...p });
        expect(await p.store.request(r.id)).toMatchObject({ summary: '维护任务分类', question });
        expect((await p.store.request(old.id)).question).toBe(question);
    } finally { await backend.dispose(); p.close(); await rm(dir, { recursive: true, force: true }); }
});
