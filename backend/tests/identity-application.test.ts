import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AccountUseCases } from '../src/application/account';
import { createIdentity } from '../src/bootstrap/identity';
import { createPersistence } from '../src/bootstrap/persistence';
import { settings, user } from './contracts/control-store';
import { httpsIdentityFixture } from './support/https-identity';

describe('real HTTPS identity with SQLite accounts', () => {
    let fixture: Awaited<ReturnType<typeof httpsIdentityFixture>>;
    let directory: string;
    let resources: ReturnType<typeof createPersistence>;
    let account: AccountUseCases;
    beforeAll(async () => { fixture = await httpsIdentityFixture(); });
    afterAll(async () => { await fixture.close(); });
    beforeEach(async () => {
        directory = await mkdtemp(join(tmpdir(), 'airic-identity-app-'));
        resources = createPersistence({ filename: join(directory, 'control.sqlite'), initialSettings: settings });
        account = new AccountUseCases(createIdentity(fixture.options).identity, resources.store, resources.support);
        fixture.handler = (_req, res) => { res.setHeader('Content-Type', 'application/json'); res.end('{"sub":"stable","name":"External","admin":true,"enabled":true}'); };
    });
    afterEach(async () => { resources.close(); await rm(directory, { recursive: true, force: true }); });

    it('creates a non-administrator once and preserves locally edited name on renewed credentials', async () => {
        const first = await account.ensureUser('first-token');
        expect(first).toMatchObject({ issuer: fixture.options.issuer, subject: 'stable', enabled: true, admin: false });
        await account.updateProfile(first.id, 'Local name');
        const again = await account.ensureUser('renewed-token');
        expect(again.id).toBe(first.id);
        expect(again.name).toBe('Local name');
        expect(await resources.store.users()).toHaveLength(1);
        expect(JSON.stringify(await resources.store.users())).not.toContain('token');
    });
    it('does not restore disabled users after successful external authentication', async () => {
        const first = await account.ensureUser('valid-token');
        await resources.store.ensureUser(user('admin', true));
        await resources.store.manageUser('admin', first.version, { ...first, enabled: false, version: first.version + 1 });
        await expect(account.ensureUser('renewed-token')).rejects.toMatchObject({ code: 'forbidden' });
        expect(await resources.store.user(first.id)).toMatchObject({ enabled: false, admin: false });
    });
    it.each([401, 500])('creates no account after upstream HTTP %s', async status => {
        fixture.handler = (_req, res) => { res.writeHead(status); res.end('private service details'); };
        await expect(account.ensureUser('rejected-token')).rejects.toMatchObject({ code: status === 401 ? 'forbidden' : 'blocked' });
        expect(await resources.store.users()).toEqual([]);
    });
    it('deduplicates simultaneous first requests using the durable identity key', async () => {
        const users = await Promise.all(Array.from({ length: 8 }, (_, index) => account.ensureUser(`token-${index}`)));
        expect(new Set(users.map(u => u.id)).size).toBe(1);
        expect(await resources.store.users()).toHaveLength(1);
    });
    it('does not merge equal subject or name from different trusted issuers', async () => {
        const first = await account.ensureUser('token-one');
        const another = new AccountUseCases(createIdentity({ ...fixture.options, issuer: 'other-trusted-integration' }).identity, resources.store, resources.support);
        const second = await another.ensureUser('token-two');
        expect(first.id).not.toBe(second.id);
        expect(await resources.store.users()).toHaveLength(2);
    });
});
