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

export interface TaskCreationRecord {
    taskId: string;
    scope: string;
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
        private readonly fingerprint: (payload: string) => string,
        private readonly newId: () => string,
        private readonly now: () => string,
        private readonly bindUploads?: (scope: string, actor: string, taskId: string, ids: string[]) => void,
        private readonly credentials?: TaskConnectionInitializer,
    ) {}

    /** Trusted worker queue. HTTP callers must use the scoped list or get methods. */
    admitted(): TaskCreationRecord[] {
        return this.registry.allReadyIds().map(taskId => this.initializer.read(taskId));
    }

    list(scope: string, actor: string): TaskCreationRecord[] {
        return this.registry.readyIds(scope, actor).map(id => this.get(scope, actor, id));
    }

    /** A notification credential authorizes delivery within its integration scope. */
    notificationTarget(scope: string, taskId: string): TaskCreationRecord {
        requireRule(this.registry.get(taskId)?.state === 'ready', 'not-found');
        const record = this.initializer.read(taskId);
        requireRule(record.scope === scope, 'not-found');
        return record;
    }

    get(scope: string, actor: string, taskId: string): TaskCreationRecord {
        requireRule(this.registry.get(taskId)?.state === 'ready', 'not-found');
        const record = this.initializer.read(taskId);
        requireRule(record.scope === scope && record.actor === actor, 'not-found');
        return record;
    }

    create(scope: string, actor: string, key: string, creation: TaskCreation, connections: TaskConnectionConfig[] = [], fingerprintInput: Omit<TaskCreation, 'om'> = creation): TaskCreationRecord {
        requireRule(!!creation.instruction.trim(), 'invalid');
        requireRule([creation.om.source, creation.om.revision, creation.om.entry].every(value => !!value.trim()), 'invalid');
        runtimePath(creation.om.entry);
        const uploads = creation.materials?.flatMap(material => material.kind === 'upload' ? [material.uploadId] : []) ?? [];
        requireRule(!uploads.length || this.bindUploads, 'blocked', 'upload storage unavailable');
        requireRule(!connections.length || this.credentials, 'blocked', 'MCP credential storage unavailable');
        const reservation = this.registry.reserve(scope, actor, key, this.fingerprint(canonical(
            connections.length ? { creation: fingerprintInput, connections } : fingerprintInput,
        )), this.newId());
        if (reservation.state === 'ready') return this.initializer.read(reservation.taskId);
        if (connections.length) this.credentials!.initialize(reservation.taskId, connections);
        if (uploads.length) this.bindUploads!(scope, actor, reservation.taskId, uploads);
        const record = this.initializer.initialize({ taskId: reservation.taskId, scope, actor, creation, acceptedAt: this.now(),
            ...(connections.length ? { connectionIds: connections.map(connection => connection.id) } : {}), });
        this.registry.markReady(record.taskId);
        return record;
    }
}
