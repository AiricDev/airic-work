/** Persistent admission of a Task. The adapter compares retries using a digest of the canonical payload. */
export interface TaskReservation {
    taskId: string;
    state: 'reserved' | 'ready';
}

export interface TaskRegistry {
    reserve(key: string, canonicalPayload: string, taskId: string): TaskReservation;
    markReady(taskId: string): void;
    allReadyIds(): string[];
    get(taskId: string): TaskReservation | undefined;
}
