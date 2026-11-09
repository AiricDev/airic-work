/** Persistent admission of a Task. Payload fingerprints include secrets but never store them. */
export interface TaskReservation {
    taskId: string;
    state: 'reserved' | 'ready';
}

export interface TaskRegistry {
    reserve(scope: string, actor: string, key: string, fingerprint: string, taskId: string): TaskReservation;
    markReady(taskId: string): void;
    get(taskId: string): TaskReservation | undefined;
}
