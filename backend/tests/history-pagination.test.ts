import { expect, it } from 'vitest';
import { PiHistory } from '../src/adapters/driven/runtime/pi-history';
import type { PiRuntime } from '../src/adapters/driven/runtime/pi-runtime';
import type { CallRecord } from '../src/application/ports';

it('paginates MCP calls within the same session/filter and rereads later result updates', async () => {
    const records: { id: number; kind: string; data: unknown }[] = Array.from({ length: 103 }, (_, index) => ({
        id: index + 1, kind: 'aw.mcp-start', data: { id: `call-${index}`, sessionId: 'session', connection: 'business', tool: 'tool', type: index === 102 ? 'unknown' : 'write', at: 'now', schemaRevision: '1', parameters: {}, status: 'calling' } satisfies CallRecord,
    }));
    const history = new PiHistory({ records: async () => records } as unknown as PiRuntime);
    const first = await history.calls('session', 'write');
    expect(first.items).toHaveLength(100); expect(first.unknownCount).toBe(1);
    expect((await history.calls('session', 'write', first.cursor)).items).toHaveLength(2);
    await expect(history.calls('other', 'write', first.cursor)).rejects.toMatchObject({ code: 'invalid' });
    await expect(history.calls('session', 'read', first.cursor)).rejects.toMatchObject({ code: 'invalid' });
    records.push({ id: 104, kind: 'aw.mcp-finish', data: { id: 'call-0', status: 'success', result: { saved: true } } });
    expect((await history.calls('session', 'write')).items[0].status).toBe('success');
    expect((await history.call('session', 'call-101'))?.id).toBe('call-101');
    await expect(history.page('session', 'invalid-json')).rejects.toMatchObject({ code: 'invalid' });
});
