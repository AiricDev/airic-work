import type { History, CallRecord, SessionRecord } from '../../../application/ports';
import type { Json } from '../../../domain/model';
import { requireRule } from '../../../domain/model';
import { PiRuntime } from './pi-runtime';

/** History is a projection of immutable Pi entries; no separate business-operation ledger. */
export class PiHistory implements History {
    constructor(private readonly runtime: PiRuntime, private readonly ensure: (sessionId: string) => Promise<void> = async () => {}) {}
    async page(sessionId: string, cursor?: string) {
        await this.ensure(sessionId);
        const after = cursor ? JSON.parse(Buffer.from(cursor, 'base64url').toString()) : { sessionId, after: 0 };
        requireRule(after.sessionId === sessionId && Number.isSafeInteger(after.after), 'invalid');
        const records = await this.runtime.records(sessionId);
        const selected = records.filter(e => e.id > after.after).slice(0, 100);
        const items: SessionRecord[] = selected.map(e => ({ id: String(e.id), at: new Date(e.model?.[0]?.timestamp ?? 0).toISOString(), kind: e.kind,
            data: JSON.parse(JSON.stringify({ conversationId: e.conversationId, data: e.data ?? null, messages: e.model ?? [] }, (key, value) => key === 'thinking' || value?.type === 'thinking' ? undefined : value)) }));
        return { items, complete: true, limitations: [], ...(records.some(e => e.id > (selected.at(-1)?.id ?? after.after)) ? { cursor: Buffer.from(JSON.stringify({ sessionId, after: selected.at(-1)!.id })).toString('base64url') } : {}) };
    }
    async calls(sessionId: string, type?: CallRecord['type']) {
        await this.ensure(sessionId);
        const records = await this.runtime.records(sessionId);
        const calls = new Map<string, CallRecord>();
        for (const e of records) {
            if (e.kind === 'aw.mcp-start') { const call = e.data as unknown as CallRecord; calls.set(call.id, call); }
            if (e.kind === 'aw.mcp-finish') { const finish = e.data as unknown as { id: string; status: CallRecord['status']; result: Json }; const call = calls.get(finish.id); if (call) calls.set(call.id, { ...call, status: finish.status, result: finish.result }); }
        }
        const all = [...calls.values()];
        return { items: all.filter(c => !type || c.type === type), complete: true, limitations: [], unknownCount: all.filter(c => c.type === 'unknown').length };
    }
    async call(sessionId: string, callId: string) { return (await this.calls(sessionId)).items.find(c => c.id === callId); }
    async appendCall(call: CallRecord) {
        requireRule(!await this.call(call.sessionId, call.id), 'conflict');
        await this.runtime.append(call.sessionId, 'aw.mcp-start', call as unknown as Json, call.id);
    }
    async finishCall(sessionId: string, id: string, status: CallRecord['status'], result: Json) {
        requireRule(await this.call(sessionId, id), 'not-found');
        await this.runtime.append(sessionId, 'aw.mcp-finish', { id, status, result });
    }
}
