import { expect, it, vi } from 'vitest';
import { ValidatedCommands } from '../src/adapters/driving/validation/commands';
import { harness } from './support/harness';

it('exposes source status and explicit sync through current settings, not request-selected paths', async () => {
    const h = harness();
    const user = await h.app.account.ensureUser('owner');
    const status = vi.spyOn(h.d.methods, 'status');
    const sync = vi.spyOn(h.d.methods, 'sync');
    const settings = await h.store.settings();
    expect(await h.app.method.methodStatus(user.id)).toMatchObject({ source: settings.omSource, sync: { enabled: true } });
    await new ValidatedCommands(h.app).syncMethod({ userId: user.id, source: 'business' });
    expect(status).toHaveBeenCalledWith(settings);
    expect(sync).toHaveBeenCalledWith(settings);
});

it('rejects disabled users before source status inspection or sync', async () => {
    const h = harness();
    const user = await h.app.account.ensureUser('owner');
    h.store.u.set(user.id, { ...user, enabled: false });
    const status = vi.spyOn(h.d.methods, 'status');
    const sync = vi.spyOn(h.d.methods, 'sync');
    await expect(h.app.method.methodStatus(user.id)).rejects.toMatchObject({ code: 'forbidden' });
    await expect(h.app.method.syncMethod(user.id)).rejects.toMatchObject({ code: 'forbidden' });
    expect(status).not.toHaveBeenCalled();
    expect(sync).not.toHaveBeenCalled();
});
