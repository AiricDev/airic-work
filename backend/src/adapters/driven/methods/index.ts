import { openSqliteDatabase } from '../sqlite/database';
import { databaseAccess, databaseCommit } from '../sqlite/operations';
import { requireRule } from '../../../domain/model';

export interface IndexedFile { path: string; content: string; }

/** 每个来源/SHA 一个可重建索引；数据库操作复用 SQLite 基础设施，不触碰控制记录。 */
export function searchIndex(
    filename: string, identity: { source: string; sha: string; manifestHash: string }, query: string,
    load: () => Promise<IndexedFile[]>,
): Promise<{ path: string; excerpt: string }[]> {
    return (async () => {
        const connection = openSqliteDatabase(filename);
        try {
            const version = databaseAccess(() => connection.pragma('user_version', { simple: true }));
            requireRule(version === 0 || version === 1, 'blocked', 'unsupported method index');
            databaseCommit(connection, () => {
                connection.exec(`CREATE TABLE IF NOT EXISTS snapshot_meta (
                    id INTEGER PRIMARY KEY CHECK(id=1), source TEXT NOT NULL, sha TEXT NOT NULL, manifest_hash TEXT NOT NULL
                ) STRICT;
                CREATE VIRTUAL TABLE IF NOT EXISTS file_search USING fts5(path, content, tokenize='trigram');
                PRAGMA user_version=1;`);
            });
            const existing = databaseAccess(() => connection.prepare('SELECT source, sha, manifest_hash AS manifestHash FROM snapshot_meta WHERE id=1').get()) as typeof identity | undefined;
            if (!existing || existing.source !== identity.source || existing.sha !== identity.sha || existing.manifestHash !== identity.manifestHash) {
                const files = await load();
                databaseCommit(connection, () => {
                    connection.prepare('DELETE FROM file_search').run();
                    const insert = connection.prepare('INSERT INTO file_search(path,content) VALUES (?,?)');
                    for (const file of files) insert.run(file.path, file.content);
                    connection.prepare('INSERT OR REPLACE INTO snapshot_meta VALUES (1,?,?,?)').run(identity.source, identity.sha, identity.manifestHash);
                });
            }
            const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
            const literal = `"${query.replaceAll('"', '""')}"`;
            const long = Array.from(query).length >= 3;
            const rows = databaseAccess(() => connection.prepare(`SELECT path,content FROM file_search
                WHERE ${long ? 'file_search MATCH ? AND' : ''} (path LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')
                ORDER BY path COLLATE BINARY`).all(...(long ? [literal, pattern, pattern] : [pattern, pattern]))) as IndexedFile[];
            return rows.map(row => {
                const position = Math.max(0, row.content.toLowerCase().indexOf(query.toLowerCase()));
                const prefix = Array.from(row.content.slice(0, position));
                const start = Math.max(0, prefix.length - 60);
                const content = Array.from(row.content);
                return { path: row.path, excerpt: `${start ? '…' : ''}${content.slice(start, start + 180).join('')}${start + 180 < content.length ? '…' : ''}` };
            });
        } finally { connection.close(); }
    })();
}
