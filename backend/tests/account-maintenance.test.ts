import { execFile } from 'node:child_process';
import { access, mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPersistence } from '../src/bootstrap/bindings';
import { settings, user } from './contracts/control-store';

const runner = fileURLToPath(new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url));
const script = fileURLToPath(new URL('../scripts/grant-admin.ts', import.meta.url));
async function command(args: string[]) {
    return new Promise<{ code: number; stdout: string; stderr: string }>(resolve => {
        execFile(process.execPath, [runner, script, ...args], { timeout: 10000, maxBuffer: 8192 }, (error, stdout, stderr) => {
            resolve({ code: error ? Number(error.code) || 1 : 0, stdout, stderr });
        });
    });
}
describe('local administrator promotion CLI', () => {
    let directory: string;
    let filename: string;
    let resources: ReturnType<typeof createPersistence>;
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-admin-cli-'));
        filename = join(directory, 'control.sqlite');
        resources = createPersistence({ filename, initialSettings: settings });
        await resources.store.ensureUser(user('target'));
        await resources.store.ensureUser({ ...user('disabled'), enabled: false });
    });
    afterEach(async () => { resources.close(); await rm(directory, { recursive: true, force: true }); });
    const args = (filename: string, id = 'target') => ['--database', filename, '--user', id];

    it('promotes a selected existing user without a prior administrator and is idempotent', async () => {
        await resources.store.updateProfile('target', 0, 'Local name');
        const before = await resources.store.user('target');
        expect(await command(args(filename))).toMatchObject({ code: 0, stdout: 'Administrator granted.\n', stderr: '' });
        expect(await resources.store.user('target')).toEqual({ ...before, admin: true, version: before.version + 1 });
        expect((await command(args(filename))).code).toBe(0);
        expect((await resources.store.user('target')).version).toBe(before.version + 1);
        expect(await resources.store.settings()).toEqual(settings);
    });
    it('arbitrates concurrent independent process promotions without double version changes', async () => {
        const results = await Promise.all([command(args(filename)), command(args(filename))]);
        expect(results.map(r => r.code)).toEqual([0, 0]);
        expect(await resources.store.user('target')).toMatchObject({ admin: true, version: 1 });
    });
    it('refuses disabled and missing users without creating or enabling accounts', async () => {
        expect((await command(args(filename, 'disabled'))).code).toBe(1);
        expect(await resources.store.user('disabled')).toMatchObject({ enabled: false, admin: false, version: 0 });
        expect((await command(args(filename, 'missing'))).code).toBe(1);
        expect(await resources.store.users()).toHaveLength(2);
    });
    it('does not create a missing database or its parent directory', async () => {
        const missing = join(directory, 'missing', 'control.sqlite');
        expect((await command(args(missing))).code).toBe(1);
        await expect(access(join(directory, 'missing'))).rejects.toMatchObject({ code: 'ENOENT' });
    });
    it('rejects database symlinks without changing the target', async () => {
        const linked = join(directory, 'linked.sqlite');
        await symlink(filename, linked);
        expect((await command(args(linked))).code).toBe(1);
        expect((await resources.store.user('target')).admin).toBe(false);
    });
    it.each(['unknown', 'tampered', 'pending'])('rejects %s migration history instead of migrating', async mode => {
        const raw = new Database(filename);
        try {
            if (mode === 'unknown') raw.exec("INSERT INTO schema_migrations VALUES (999, 'unknown')");
            else if (mode === 'tampered') raw.exec("UPDATE schema_migrations SET hash='changed'");
            else raw.exec('DELETE FROM schema_migrations');
            const before = raw.prepare('SELECT * FROM schema_migrations').all();
            expect((await command(args(filename))).code).toBe(1);
            expect(raw.prepare('SELECT * FROM schema_migrations').all()).toEqual(before);
            expect((await resources.store.user('target')).admin).toBe(false);
        } finally { raw.close(); }
    });
    it('rolls back permission and version changes if a database write fails', async () => {
        const raw = new Database(filename);
        try {
            raw.exec("CREATE TRIGGER fail_grant AFTER UPDATE OF admin ON users BEGIN SELECT RAISE(ABORT, 'private diagnostic'); END");
            const result = await command(args(filename));
            expect(result.code).toBe(1);
            expect(result.stderr).not.toContain('private diagnostic');
            expect(await resources.store.user('target')).toMatchObject({ admin: false, version: 0 });
        } finally { raw.close(); }
    });
    it('provides help and rejects malformed arguments without printing their values', async () => {
        expect((await command(['--help'])).code).toBe(0);
        const result = await command(['--unexpected', 'sensitive-argument']);
        expect(result.code).toBe(2);
        expect(result.stderr).not.toContain('sensitive-argument');
        expect((await resources.store.user('target')).admin).toBe(false);
    });
});
