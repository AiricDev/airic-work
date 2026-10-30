import { describe, expect, it } from 'vitest';
import { createBackend } from '../src/bootstrap/container';
import { InputValidationError, parseInput, ValidatedCommands } from '../src/adapters/driving/validation/commands';
import { bootstrapConfigSchema, createExecutionSchema, userDecisionSchema } from '../src/adapters/driving/validation/schemas';
import { harness } from './support/harness';
const body = { project_id: 'p', project_name: 'Project', task: { id: 'task', custom: { values: [true, null, 3] } }, instruction: 'check' };
describe('Zod at the input boundary', () => {
    it('preserves caller-defined task JSON and the original instruction', () => {
        const value = { ...body, instruction: '  preserve input  ' };
        expect(parseInput(createExecutionSchema, value)).toEqual(value);
    });
    it('rejects unknown identity/source fields instead of silently stripping them', () => {
        for (const extra of [{ userId: 'other' }, { source: 'other-system' }, { ownerId: 'other' }]) {
            expect(() => parseInput(createExecutionSchema, { ...body, ...extra })).toThrow(InputValidationError);
        }
    });
    it('reports field paths and rejects empty instructions and non-JSON task data', () => {
        expect(() => parseInput(createExecutionSchema, { ...body, instruction: ' ' })).toThrow(InputValidationError);
        expect(() => parseInput(createExecutionSchema, { ...body, task: { invalid: undefined } })).toThrow(InputValidationError);
        try {
            parseInput(createExecutionSchema, { ...body, project_id: 1 });
        }
        catch (error) {
            expect((error as InputValidationError).issues).toContainEqual(expect.objectContaining({ path: 'project_id' }));
        }
    });
    it('requires meaningful feedback while keeping attachments and text optional independently', () => {
        expect(() => parseInput(userDecisionSchema, { contextRevision: 1 })).toThrow();
        expect(parseInput(userDecisionSchema, { contextRevision: 1, files: ['file'] })).toEqual({ contextRevision: 1, text: '', files: ['file'] });
        expect(parseInput(userDecisionSchema, { contextRevision: 1, text: 'observation' }).files).toEqual([]);
    });
    it('maps trusted actor identity into an application command and keeps domain idempotency', async () => {
        const h = harness();
        const user = await h.app.account.ensureUser('owner');
        const commands = new ValidatedCommands(h.app);
        const actor = { userId: user.id, source: 'verified-system' };
        const first = await commands.createExecution(actor, 'k', body);
        expect(first.ownerId).toBe(user.id);
        expect(first.creation.source).toBe(actor.source);
        expect((await commands.createExecution(actor, 'k', body)).id).toBe(first.id);
        await expect(commands.createExecution(actor, 'k', { ...body, instruction: 'changed' })).rejects.toMatchObject({ code: 'conflict' });
    });
    it('shape validation cannot bypass domain ownership, even for administrators', async () => {
        const h = harness();
        const { e } = await h.running();
        const admin = await h.app.account.ensureUser('admin');
        h.store.u.set(admin.id, { ...admin, admin: true });
        await expect(new ValidatedCommands(h.app).submitSteering({ userId: admin.id, source: 'business' }, e.id, 's', { text: 'continue' })).rejects.toMatchObject({ code: 'forbidden' });
    });
    it('does not copy rejected credentials into validation error messages', () => {
        const secret = 'this-value-must-not-be-returned';
        try {
            parseInput(createExecutionSchema, { ...body, token: secret });
        }
        catch (error) {
            expect(JSON.stringify(error)).not.toContain(secret);
        }
    });
    it('rejects invalid configuration instead of coercing ambiguous port values', () => {
        expect(parseInput(bootstrapConfigSchema, {})).toEqual({ host: '127.0.0.1', port: 8010 });
        expect(() => parseInput(bootstrapConfigSchema, { port: '8010' })).toThrow();
        expect(() => parseInput(bootstrapConfigSchema, { port: 65536 })).toThrow();
    });
});
describe('Awilix composition root', () => {
    it('assembles existing explicit factories without exposing the container to callers', async () => {
        const h = harness();
        const backend = createBackend(h.d);
        try {
            expect(Object.keys(backend).sort()).toEqual(['application', 'commands', 'dispose']);
            const user = await backend.application.account.ensureUser('owner');
            const result = await backend.commands.createExecution({ userId: user.id, source: 'business' }, 'c', body);
            expect(result.ownerId).toBe(user.id);
            expect(await backend.application.query.queryExecution(user.id, result.id)).toEqual(result);
        }
        finally {
            await backend.dispose();
        }
    });
    it('does not share singletons or current-user state between independent instances', async () => {
        const a = harness();
        const b = harness();
        const first = createBackend(a.d);
        const second = createBackend(b.d);
        try {
            expect(first.application).not.toBe(second.application);
            await first.application.account.ensureUser('only-in-a');
            expect(a.store.u.size).toBe(1);
            expect(b.store.u.size).toBe(0);
        }
        finally {
            await first.dispose();
            await second.dispose();
        }
    });
    it('serves different actors through the same application without swapping a global user', async () => {
        const h = harness();
        const backend = createBackend(h.d);
        try {
            const a = await backend.application.account.ensureUser('a');
            const b = await backend.application.account.ensureUser('b');
            const execution = await backend.commands.createExecution({ userId: a.id, source: 'business' }, 'k', body);
            expect(await backend.application.query.queryExecutions(b.id)).toEqual([]);
            await expect(backend.commands.submitSteering({ userId: b.id, source: 'business' }, execution.id, 's', { text: 'continue' })).rejects.toMatchObject({ code: 'forbidden' });
        }
        finally {
            await backend.dispose();
        }
    });
});
