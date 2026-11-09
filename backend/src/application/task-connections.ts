export type TaskConnectionAuth =
    | { type: 'none' }
    | { type: 'bearer'; token: string }
    | { type: 'secret_ref'; ref: string }
    | { type: 'signed_endpoint'; endpoint: string };

export interface TaskConnectionConfig {
    id: string;
    endpoint: string;
    auth?: Exclude<TaskConnectionAuth, { type: 'signed_endpoint' }>;
}

export interface TaskConnectionInitializer {
    initialize(taskId: string, connections: TaskConnectionConfig[]): void;
}
export type TaskConnectionStatus = 'unchecked' | 'available' | 'unavailable' | 'authorization_failed';
