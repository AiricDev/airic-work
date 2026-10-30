import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMethods } from '../src/bootstrap/bindings';
import { createPersistence } from '../src/bootstrap/bindings';
import { ExecutionUseCases } from '../src/application/execution';
import { MethodUseCases } from '../src/application/method';
import { ApplicationPolicy } from '../src/application/policy';
import type { Methods, Runtime, Workspace } from '../src/application/ports';
import { options, repository, configuration } from './support/git-methods';
import { user } from './contracts/control-store';

const unexpected = async (): Promise<never> => { throw new Error('Agent is not part of Methods preparation'); };
const runtime: Runtime = { ensure: unexpected, start: unexpected, accepted: unexpected, deliver: unexpected, stop: unexpected, stopped: unexpected };
const workspace: Workspace = { ensure: unexpected, materialize: unexpected, stopped: unexpected };

describe('Methods with real execution preparation', () => {
    let directory: string;
    let source: string;
    let resources: ReturnType<typeof createPersistence>;
    let methods: Methods;
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-method-application-'));
        source = await repository(directory);
        ({ methods } = await createMethods(options(directory, source)));
        resources = createPersistence({ filename: join(directory, 'control.sqlite'), initialSettings: configuration });
        await resources.store.ensureUser(user('owner'));
        await resources.store.ensureUser(user('admin', true));
    });
    afterEach(async () => { resources.close(); await rm(directory, { recursive: true, force: true }); });
    function service(adapter = methods) {
        return new ExecutionUseCases(adapter, runtime, resources.store, resources.support, workspace, new ApplicationPolicy(resources.store, resources.support));
    }
    const creation = { source: 'business', project_id: 'project', project_name: 'Project', task: {}, instruction: 'follow fixed method' };

    it('pins real Git output and one durable start input without activating an Agent', async () => {
        const execution = service();
        const initial = await execution.createExecution('owner', 'create', creation);
        const prepared = await execution.prepareExecution('owner', initial.id);
        expect(prepared.method).toMatchObject({ source: 'repo', root: 'om.md' });
        expect(prepared.phase).toBe('new');
        expect(prepared.generation).toBe(0);
        expect(await resources.store.inputs(initial.id)).toMatchObject([{ kind: 'start', text: creation.instruction, status: 'pending' }]);
        expect(await execution.prepareExecution('owner', initial.id)).toEqual(prepared);
        expect(await resources.store.inputs(initial.id)).toHaveLength(1);
    });

    it('does not pin a stale preparation if configuration changes after Git confirmation', async () => {
        const adapter: Methods = {
            status: methods.status.bind(methods), sync: methods.sync.bind(methods),
            latest: async settings => {
                const result = await methods.latest(settings);
                await resources.store.saveSettings('admin', 0, { ...configuration, version: 1, branch: 'next' });
                return result;
            },
            read: methods.read.bind(methods), search: methods.search.bind(methods), history: methods.history.bind(methods),
        };
        const execution = service(adapter);
        const initial = await execution.createExecution('owner', 'create', creation);
        await expect(execution.prepareExecution('owner', initial.id)).rejects.toMatchObject({ code: 'conflict' });
        expect((await resources.store.execution(initial.id)).method).toBeUndefined();
        expect(await resources.store.inputs(initial.id)).toEqual([]);
    });

    it('prepares a real execution from a local repository even when sync is disabled', async () => {
        const { methods: local } = await createMethods({ ...options(directory, source), sources: { repo: source } });
        const om = new MethodUseCases(local, resources.store);
        expect(await om.methodStatus('owner')).toMatchObject({ kind: 'local', sync: { enabled: false, reason: 'no-remote' } });
        const execution = service(local);
        const initial = await execution.createExecution('owner', 'local-create', creation);
        expect((await execution.prepareExecution('owner', initial.id)).method).toMatchObject({ source: 'repo', root: 'om.md' });
        expect(await resources.store.inputs(initial.id)).toHaveLength(1);
        await expect(om.syncMethod('owner')).rejects.toMatchObject({ code: 'blocked' });
    });
});
