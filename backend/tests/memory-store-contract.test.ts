import { controlStoreContract } from './contracts/control-store';
import { MemoryStore } from './support/memory-store';

controlStoreContract('memory', async () => ({ store: new MemoryStore(), close() { } }));
