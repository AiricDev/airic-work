import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import { requireRule } from '../../../domain/model';

const initial = `
CREATE TABLE users (
    id TEXT PRIMARY KEY NOT NULL, issuer TEXT NOT NULL, subject TEXT NOT NULL, name TEXT NOT NULL,
    enabled INTEGER NOT NULL CHECK(enabled IN (0,1)), admin INTEGER NOT NULL CHECK(admin IN (0,1)),
    version INTEGER NOT NULL CHECK(version >= 0),
    preferences TEXT CHECK(preferences IS NULL OR json_valid(preferences)),
    UNIQUE(issuer, subject)
) STRICT;
CREATE TABLE projects (
    id TEXT PRIMARY KEY NOT NULL, source TEXT NOT NULL, external_id TEXT NOT NULL, name TEXT NOT NULL,
    UNIQUE(source, external_id)
) STRICT;
CREATE TABLE executions (
    id TEXT PRIMARY KEY NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id),
    owner_id TEXT NOT NULL REFERENCES users(id), session_id TEXT NOT NULL UNIQUE, workspace_id TEXT NOT NULL UNIQUE,
    creation TEXT NOT NULL CHECK(json_valid(creation)), method TEXT CHECK(method IS NULL OR json_valid(method)),
    phase TEXT NOT NULL CHECK(phase IN ('new','running','ended','stopping','stopped','failed')),
    generation INTEGER NOT NULL CHECK(generation >= 0), version INTEGER NOT NULL CHECK(version >= 0),
    UNIQUE(id, owner_id), UNIQUE(id, owner_id, session_id),
    CHECK(phase != 'running' OR (method IS NOT NULL AND generation > 0))
) STRICT;
CREATE INDEX executions_owner ON executions(owner_id, phase);
CREATE TABLE decision_requests (
    id TEXT PRIMARY KEY NOT NULL, execution_id TEXT NOT NULL REFERENCES executions(id),
    question TEXT NOT NULL, options TEXT NOT NULL CHECK(json_valid(options)), contexts TEXT NOT NULL CHECK(json_valid(contexts)),
    status TEXT NOT NULL CHECK(status IN ('pending','answered')), created_at TEXT NOT NULL, answered_at TEXT,
    version INTEGER NOT NULL CHECK(version >= 0),
    CHECK((status = 'answered') = (answered_at IS NOT NULL))
) STRICT;
CREATE INDEX requests_execution ON decision_requests(execution_id, status);
CREATE TABLE uploads (
    id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, execution_id TEXT NOT NULL, name TEXT NOT NULL,
    hash TEXT NOT NULL CHECK(length(hash) = 64 AND hash NOT GLOB '*[^0-9a-f]*'),
    size INTEGER NOT NULL CHECK(size >= 0), content_ref TEXT NOT NULL,
    UNIQUE(id, user_id, execution_id),
    FOREIGN KEY(execution_id, user_id) REFERENCES executions(id, owner_id)
) STRICT;
CREATE TABLE user_decisions (
    id TEXT PRIMARY KEY NOT NULL, request_id TEXT NOT NULL REFERENCES decision_requests(id),
    user_id TEXT NOT NULL REFERENCES users(id), text TEXT NOT NULL, option_id TEXT,
    context_revision INTEGER NOT NULL CHECK(context_revision > 0), files TEXT NOT NULL CHECK(json_valid(files)),
    correction_of TEXT REFERENCES user_decisions(id), at TEXT NOT NULL
) STRICT;
CREATE INDEX decisions_request ON user_decisions(request_id);
CREATE TABLE steering_inputs (
    id TEXT PRIMARY KEY NOT NULL, execution_id TEXT NOT NULL, user_id TEXT NOT NULL,
    text TEXT NOT NULL, files TEXT NOT NULL CHECK(json_valid(files)), at TEXT NOT NULL,
    FOREIGN KEY(execution_id, user_id) REFERENCES executions(id, owner_id)
) STRICT;
CREATE TABLE inputs (
    id TEXT PRIMARY KEY NOT NULL, execution_id TEXT NOT NULL, session_id TEXT NOT NULL, user_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK(kind IN ('start','user-decision','steering')), source_id TEXT NOT NULL,
    text TEXT NOT NULL, files TEXT NOT NULL CHECK(json_valid(files)),
    sequence INTEGER NOT NULL CHECK(sequence > 0), status TEXT NOT NULL CHECK(status IN ('pending','delivered')),
    receipt TEXT, UNIQUE(execution_id, sequence), UNIQUE(kind, source_id),
    UNIQUE(id, user_id, execution_id),
    FOREIGN KEY(execution_id, user_id, session_id) REFERENCES executions(id, owner_id, session_id),
    CHECK((status = 'delivered' AND receipt IS NOT NULL AND length(receipt) > 0) OR (status = 'pending' AND receipt IS NULL))
) STRICT;
CREATE INDEX inputs_pending ON inputs(execution_id, sequence) WHERE status = 'pending';
CREATE TABLE input_files (
    input_id TEXT NOT NULL, upload_id TEXT NOT NULL, user_id TEXT NOT NULL, execution_id TEXT NOT NULL,
    PRIMARY KEY(input_id, upload_id),
    FOREIGN KEY(input_id, user_id, execution_id) REFERENCES inputs(id, user_id, execution_id),
    FOREIGN KEY(upload_id, user_id, execution_id) REFERENCES uploads(id, user_id, execution_id)
) STRICT;
CREATE TABLE command_results (
    user_id TEXT NOT NULL, operation TEXT NOT NULL CHECK(operation IN ('create','request','decision','steering')),
    key TEXT NOT NULL, fingerprint TEXT NOT NULL, execution_id TEXT NOT NULL, result TEXT NOT NULL CHECK(json_valid(result)),
    PRIMARY KEY(user_id, operation, key),
    FOREIGN KEY(execution_id, user_id) REFERENCES executions(id, owner_id)
) STRICT;
CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK(id = 1), version INTEGER NOT NULL CHECK(version >= 0),
    om_source TEXT NOT NULL, branch TEXT NOT NULL, root TEXT NOT NULL,
    connections TEXT NOT NULL CHECK(json_valid(connections))
) STRICT;
CREATE TRIGGER immutable_user_identity BEFORE UPDATE OF id, issuer, subject ON users
BEGIN SELECT RAISE(ABORT, 'immutable user identity'); END;
CREATE TRIGGER immutable_execution_binding BEFORE UPDATE OF id, owner_id, project_id, session_id, workspace_id, creation ON executions
BEGIN SELECT RAISE(ABORT, 'immutable execution binding'); END;
CREATE TRIGGER fixed_execution_method BEFORE UPDATE OF method ON executions
WHEN OLD.method IS NOT NULL AND NEW.method IS NOT OLD.method
BEGIN SELECT RAISE(ABORT, 'fixed execution method'); END;
CREATE TRIGGER immutable_decision BEFORE UPDATE ON user_decisions
BEGIN SELECT RAISE(ABORT, 'immutable decision'); END;
CREATE TRIGGER immutable_upload BEFORE UPDATE ON uploads
BEGIN SELECT RAISE(ABORT, 'immutable upload'); END;
`;

const migrations = [initial];

/** 带摘要的顺序迁移；未知或被改写的迁移必须阻塞，不能重置现有数据库。 */
export function migrate(connection: Database.Database): void {
    connection.transaction(() => {
        connection.exec('CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, hash TEXT NOT NULL) STRICT');
        const applied = connection.prepare('SELECT version, hash FROM schema_migrations ORDER BY version').all() as { version: number; hash: string }[];
        requireRule(applied.length <= migrations.length, 'blocked', 'unsupported database version');
        for (let index = 0; index < migrations.length; index++) {
            const version = index + 1;
            const hash = createHash('sha256').update(migrations[index]).digest('hex');
            if (index < applied.length) {
                requireRule(applied[index].version === version && applied[index].hash === hash, 'blocked', 'migration mismatch');
            } else {
                connection.exec(migrations[index]);
                connection.prepare('INSERT INTO schema_migrations(version, hash) VALUES (?, ?)').run(version, hash);
            }
        }
    }).immediate();
}
