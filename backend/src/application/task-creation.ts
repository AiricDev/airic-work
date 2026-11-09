import { canonical, requireRule } from '../domain/model';
import type { Json } from '../domain/model';
import type { TaskRegistry } from './task-registry';

export interface TaskCreation {
    instruction: string;
    om: { source: string; revision: string; entry: string };
    context?: Record<string, Json>;
}

export interface TaskCreationRecord {
    taskId: string;
    scope: string;
    actor: string;
    creation: TaskCreation;
    acceptedAt: string;
}

/** Idempotently initializes the private control record and returns the first persisted value. */
export interface TaskInitializer {
    initialize(record: TaskCreationRecord): TaskCreationRecord;
}

export class TaskCreationUseCases {
    constructor(
        private readonly registry: TaskRegistry,
        private readonly initializer: TaskInitializer,
        private readonly fingerprint: (payload: string) => string,
        private readonly newId: () => string,
        private readonly now: () => string,
    ) {}

    create(scope: string, actor: string, key: string, creation: TaskCreation): TaskCreationRecord {
        requireRule(!!creation.instruction.trim(), 'invalid');
        requireRule([creation.om.source, creation.om.revision, creation.om.entry].every(value => !!value.trim()), 'invalid');
        const reservation = this.registry.reserve(scope, actor, key, this.fingerprint(canonical(creation)), this.newId());
        const record = this.initializer.initialize({ taskId: reservation.taskId, scope, actor, creation, acceptedAt: this.now() });
        this.registry.markReady(record.taskId);
        return record;
    }
}
