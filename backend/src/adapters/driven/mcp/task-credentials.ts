import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { TaskConnectionAuth, TaskConnectionConfig, TaskConnectionInitializer, TaskConnectionStatus } from '../../../application/task-connections';
import { requireRule, RuleError } from '../../../domain/model';
import { databaseAccess, databaseCommit } from '../sqlite/operations';

interface Credential {
    url: string;
    token?: string;
}

function https(value: string) {
    const parsed = URL.parse(value);
    requireRule(parsed?.protocol === 'https:' && !parsed.username && !parsed.password && !parsed.hash, 'invalid');
    return parsed;
}

export class TaskCredentialStore implements TaskConnectionInitializer {
    private readonly allowed: URL[];

    constructor(
        private readonly db: Database.Database,
        private readonly key: Uint8Array,
        allowlist: string[],
        private readonly references: Record<string, string>,
    ) {
        requireRule(key.byteLength === 32, 'invalid');
        this.allowed = allowlist.map(https);
        db.exec(`CREATE TABLE IF NOT EXISTS task_credentials (
            task_id TEXT NOT NULL, connection_id TEXT NOT NULL, policy TEXT NOT NULL,
            ciphertext BLOB NOT NULL, PRIMARY KEY(task_id, connection_id)
        );
        CREATE TABLE IF NOT EXISTS task_credential_commands (
            task_id TEXT NOT NULL, connection_id TEXT NOT NULL, command_key TEXT NOT NULL, fingerprint TEXT NOT NULL,
            PRIMARY KEY(task_id, connection_id, command_key)
        )`);
        if (!db.prepare("SELECT 1 FROM pragma_table_info('task_credentials') WHERE name = 'status'").get()) {
            db.exec("ALTER TABLE task_credentials ADD COLUMN status TEXT NOT NULL DEFAULT 'unchecked' CHECK(status IN ('unchecked','available','unavailable','authorization_failed'))");
        }
    }

    private policy(endpoint: URL) {
        const allowed = this.allowed.find(base => base.origin === endpoint.origin &&
            (endpoint.pathname === base.pathname || endpoint.pathname.startsWith((base.pathname.endsWith('/') ? base.pathname.slice(0, -1) : base.pathname) + '/')));
        requireRule(allowed && !/%(?:2e|2f|5c|25)/i.test(endpoint.pathname), 'forbidden');
        return allowed.origin + allowed.pathname;
    }

    private encode(taskId: string, id: string, policy: string, credential: Credential) {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', this.key, iv);
        cipher.setAAD(Buffer.from(JSON.stringify([taskId, id, policy])));
        const body = Buffer.concat([cipher.update(JSON.stringify(credential), 'utf8'), cipher.final()]);
        return Buffer.concat([iv, cipher.getAuthTag(), body]);
    }

    private token(auth: TaskConnectionAuth | undefined) {
        if (auth?.type !== 'bearer' && auth?.type !== 'secret_ref') return undefined;
        const token = auth.type === 'bearer' ? auth.token : Object.hasOwn(this.references, auth.ref) ? this.references[auth.ref] : undefined;
        requireRule(token && /^[!-~]+$/.test(token), 'invalid');
        return token;
    }

    initialize(taskId: string, connections: TaskConnectionConfig[]) {
        requireRule(new Set(connections.map(c => c.id)).size === connections.length, 'invalid');
        databaseCommit(this.db, () => {
            const insert = this.db.prepare('INSERT OR IGNORE INTO task_credentials (task_id, connection_id, policy, ciphertext) VALUES (?, ?, ?, ?)');
            for (const connection of connections) {
                const url = https(connection.endpoint);
                const policy = this.policy(url);
                const token = this.token(connection.auth);
                insert.run(taskId, connection.id, policy, this.encode(taskId, connection.id, policy, { url: url.href, token }));
            }
        });
    }

    private row(taskId: string, connectionId: string) {
        const row = this.db.prepare('SELECT policy, ciphertext, status FROM task_credentials WHERE task_id = ? AND connection_id = ?')
            .get(taskId, connectionId) as { policy: string; ciphertext: Buffer; status: TaskConnectionStatus } | undefined;
        requireRule(row, 'not-found');
        return row;
    }

    read(taskId: string, connectionId: string): Credential {
        const { revision: _revision, ...credential } = this.lease(taskId, connectionId);
        return credential;
    }

    lease(taskId: string, connectionId: string) {
        return databaseAccess(() => {
            const { policy, ciphertext } = this.row(taskId, connectionId);
            try {
                const decipher = createDecipheriv('aes-256-gcm', this.key, ciphertext.subarray(0, 12));
                decipher.setAAD(Buffer.from(JSON.stringify([taskId, connectionId, policy])));
                decipher.setAuthTag(ciphertext.subarray(12, 28));
                const clear = Buffer.concat([decipher.update(ciphertext.subarray(28)), decipher.final()]).toString();
                const credential = JSON.parse(clear) as Credential;
                requireRule(this.policy(https(credential.url)) === policy, 'forbidden');
                return { ...credential, revision: this.revision(ciphertext) };
            } catch { throw new RuleError('blocked', 'MCP credential unavailable'); }
        });
    }

    private revision(ciphertext: Buffer) { return createHash('sha256').update(ciphertext).digest('hex'); }

    status(taskId: string, connectionId: string) {
        return databaseAccess(() => this.row(taskId, connectionId).status);
    }

    observe(taskId: string, connectionId: string, revision: string, status: TaskConnectionStatus) {
        databaseCommit(this.db, () => {
            if (this.revision(this.row(taskId, connectionId).ciphertext) !== revision) return;
            this.db.prepare('UPDATE task_credentials SET status = ? WHERE task_id = ? AND connection_id = ?')
                .run(status, taskId, connectionId);
        });
    }

    replace(taskId: string, connectionId: string, key: string, auth: TaskConnectionAuth) {
        databaseCommit(this.db, () => {
            const fingerprint = createHmac('sha256', this.key).update(JSON.stringify(auth)).digest('hex');
            const oldCommand = this.db.prepare('SELECT fingerprint FROM task_credential_commands WHERE task_id = ? AND connection_id = ? AND command_key = ?')
                .get(taskId, connectionId, key) as { fingerprint: string } | undefined;
            if (oldCommand) {
                requireRule(oldCommand.fingerprint === fingerprint, 'conflict');
                return;
            }
            const { policy } = this.row(taskId, connectionId);
            const old = this.read(taskId, connectionId);
            const url = auth.type === 'signed_endpoint' ? https(auth.endpoint) : https(old.url);
            requireRule(this.policy(url) === policy, 'forbidden');
            if (auth.type === 'signed_endpoint') {
                const parent = (pathname: string) => pathname.slice(0, pathname.lastIndexOf('/') + 1);
                requireRule(parent(url.pathname) === parent(https(old.url).pathname), 'forbidden');
            }
            const encrypted = this.encode(taskId, connectionId, policy, { url: url.href, token: this.token(auth) });
            this.db.prepare("UPDATE task_credentials SET ciphertext = ?, status = 'unchecked' WHERE task_id = ? AND connection_id = ?")
                .run(encrypted, taskId, connectionId);
            this.db.prepare('INSERT INTO task_credential_commands VALUES (?, ?, ?, ?)').run(taskId, connectionId, key, fingerprint);
        });
    }
}
