import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPersistence } from '../src/bootstrap/persistence';
import { controlStoreContract, settings } from './contracts/control-store';

controlStoreContract('SQLite', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'airic-store-'));
    const resources = createPersistence({ filename: join(directory, 'control.sqlite'), initialSettings: settings });
    return { store: resources.store, close() { resources.close(); rmSync(directory, { recursive: true }); } };
});
