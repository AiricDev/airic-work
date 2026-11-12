import { canonical, requireRule, runtimePath } from '../domain/model';
import type { Json, MaterialReference } from '../domain/model';
import type { TaskConnectionConfig, TaskConnectionInitializer } from './task-connections';
import type { TaskRegistry } from './task-registry';

export interface TaskCreation {
    instruction: string;
    om: { source: string; revision: string; entry: string };
    materials?: ({ kind: 'upload'; uploadId: string } | { kind: 'reference'; source: MaterialReference })[];
    externalRefs?: { system: string; kind: string; id: string }[];
    context?: Record<string, Json>;
}

export const taskStorageScope = 'task-api';

export interface TaskCreationRecord {
    taskId: string;
    actor: string;
    creation: TaskCreation;
    acceptedAt: string;
    connectionIds?: string[];
}

/** Idempotently initializes the private control record and returns the first persisted value. */
export interface TaskInitializer {
    read(taskId: string): TaskCreationRecord;
    initialize(record: TaskCreationRecord): TaskCreationRecord;
}

export class TaskCreationUseCases {
    constructor(
        private readonly registry: TaskRegistry,
        private readonly initializer: TaskInitializer,
        private readonly newId: () => string,
        private readonly now: () => string,
        private readonly bindUploads?: (scope: string, actor: string, taskId: string, ids: string[]) => void,
        private readonly credentials?: TaskConnectionInitializer,
    ) {}

    list(): TaskCreationRecord[] {
        return this.registry.allReadyIds().map(taskId => this.initializer.read(taskId));
    }

    get(taskId: string): TaskCreationRecord {
        requireRule(this.registry.get(taskId)?.state === 'ready', 'not-found');
        return this.initializer.read(taskId);
    }

    create(actor: string, key: string, creation: TaskCreation, connections: TaskConnectionConfig[] = [], fingerprintInput: Omit<TaskCreation, 'om'> = creation): TaskCreationRecord {
        requireRule(!!creation.instruction.trim(), 'invalid');
        requireRule([creation.om.source, creation.om.revision, creation.om.entry].every(value => !!value.trim()), 'invalid');
        runtimePath(creation.om.entry);
        const uploads = creation.materials?.flatMap(material => material.kind === 'upload' ? [material.uploadId] : []) ?? [];
        requireRule(!uploads.length || this.bindUploads, 'blocked', 'upload storage unavailable');
        requireRule(!connections.length || this.credentials, 'blocked', 'MCP credential storage unavailable');
        const payload = canonical({ actor, creation: fingerprintInput, connections });
        const reservation = this.registry.reserve(key, payload, this.newId());
        if (reservation.state === 'ready') return this.initializer.read(reservation.taskId);
        if (connections.length) this.credentials!.initialize(reservation.taskId, connections);
        if (uploads.length) this.bindUploads!(taskStorageScope, actor, reservation.taskId, uploads);
        const record = this.initializer.initialize({ taskId: reservation.taskId, actor, creation, acceptedAt: this.now(),
            ...(connections.length ? { connectionIds: connections.map(connection => connection.id) } : {}), });
        this.registry.markReady(record.taskId);
        return record;
    }
}
