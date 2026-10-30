// 独立进程使用同一生产实现。只在本测试进程转译 TS，不生成构建文件或启动服务。
import './load-typescript.mjs';
import Database from 'better-sqlite3';

const { SqliteControlStore } = await import('../../src/adapters/driven/sqlite/store.ts');
const resources = process.argv[3] === 'bootstrap'
    ? (await import('../../src/bootstrap/bindings.ts')).createPersistence({
        filename: process.argv[2],
        initialSettings: { version: 0, omSource: 'repo', branch: 'main', root: 'om.md', connections: ['business'] },
    })
    : undefined;
const connection = resources ? undefined : new Database(process.argv[2]);
if (connection) {
    connection.pragma('busy_timeout = 5000');
    connection.pragma('foreign_keys = ON');
    connection.pragma('synchronous = FULL');
}
const store = resources?.store ?? new SqliteControlStore(connection);
function close() { if (connection?.open) connection.close(); resources?.close(); }

process.on('message', async ({ operation, args, crash }) => {
    try {
        if (crash === 'beforeCommit') {
            connection.function('terminate_process', () => { process.kill(process.pid, 'SIGKILL'); return 0; });
            connection.exec(`CREATE TEMP TRIGGER crash_before_commit AFTER INSERT ON command_results
                WHEN NEW.operation = 'decision' BEGIN SELECT terminate_process(); END`);
        }
        const result = await store[operation](...args);
        if (crash === 'afterCommit') process.kill(process.pid, 'SIGKILL');
        close();
        process.send({ ok: true, result }, () => process.disconnect());
    } catch (error) {
        close();
        process.send({ ok: false, code: error.code ?? 'unexpected', message: error.message }, () => process.disconnect());
    }
});
process.send({ ready: true });
