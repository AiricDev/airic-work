import type { ControlStore, McpCredentials } from './ports';
import { own, requireRule } from '../domain/model';

/** Execution owner alone can connect/disconnect credentials. The login token is transient, not an Input. */
export class McpCredentialUseCases {
    constructor(private readonly store: ControlStore, private readonly credentials: McpCredentials) {}
    private async scope(userId: string, executionId: string, connection: string) {
        const e = await this.store.execution(executionId);
        const user = await this.store.user(userId);
        own(user, e);
        requireRule((await this.store.settings()).connections.includes(connection), 'forbidden');
        return { userId, executionId, connection, issuer: user.issuer, subject: user.subject };
    }
    async connect(userId: string, executionId: string, connection: string, loginToken: string) {
        return this.credentials.connect(await this.scope(userId, executionId, connection), loginToken);
    }
    async disconnect(userId: string, executionId: string, connection: string, loginToken: string) {
        await this.credentials.disconnect(await this.scope(userId, executionId, connection), loginToken);
    }
}
