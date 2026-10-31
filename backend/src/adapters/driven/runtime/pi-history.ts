import type { History, CallRecord, SessionRecord } from '../../../application/ports';
import type { Json } from '../../../domain/model';
import { requireRule, RuleError } from '../../../domain/model';
import { PiRuntime } from './pi-runtime';

/** History is a projection of immutable Pi entries; no separate business-operation ledger. */
export class PiHistory implements History {
    constructor(private readonly runtime: PiRuntime, private readonly ensure: (sessionId: string) => Promise<void> = async () => {}) {}
    async page(sessionId: string, cursor?: string) {
        await this.ensure(sessionId);
        let after: { sessionId: string; after: number };
        try { after = cursor ? JSON.parse(Buffer.from(cursor, 'base64url').toString()) : { sessionId, after: 0 }; }
        catch { throw new RuleError('invalid'); }
        requireRule(after && after.sessionId === sessionId && Number.isSafeInteger(after.after) && after.after >= 0, 'invalid');
        const records = await this.runtime.records(sessionId);
        const selected = records.filter(e => e.id > after.after).slice(0, 100);
        const items: SessionRecord[] = selected.map(e => ({ id: String(e.id), at: new Date(e.model?.[0]?.timestamp ?? 0).toISOString(), kind: e.kind,
            data: JSON.parse(JSON.stringify({ conversationId: e.conversationId, data: e.data ?? null, messages: e.model ?? [] }, (key, value) => key === 'thinking' || value?.type === 'thinking' ? undefined : value)) }));
        return { items, complete: true, limitations: [], ...(records.some(e => e.id > (selected.at(-1)?.id ?? after.after)) ? { cursor: Buffer.from(JSON.stringify({ sessionId, after: selected.at(-1)!.id })).toString('base64url') } : {}) };
    }
    private async allCalls(sessionId: string) {
        await this.ensure(sessionId);
        const records = await this.runtime.records(sessionId);
        const calls = new Map<string, CallRecord>();
        for (const e of records) {
            if (e.kind === 'aw.mcp-start') { const call = e.data as unknown as CallRecord; calls.set(call.id, call); }
            if (e.kind === 'aw.mcp-finish') { const finish = e.data as unknown as { id: string; status: CallRecord['status']; result: Json }; const call = calls.get(finish.id); if (call) calls.set(call.id, { ...call, status: finish.status, result: finish.result }); }
        }
        return [...calls.values()];
    }
    async calls(sessionId: string, type?: CallRecord['type'], cursor?: string) {
        const all = await this.allCalls(sessionId);
        let after = 0;
        if (cursor) {
            try {
                const value = JSON.parse(Buffer.from(cursor, 'base64url').toString());
                requireRule(value.sessionId === sessionId && value.type === (type ?? null) && Number.isSafeInteger(value.after) && value.after >= 0, 'invalid');
                after = value.after;
            } catch { throw new RuleError('invalid'); }
        }
        const selected = all.map((call, index) => ({ call, sequence: index + 1 })).filter(c => c.sequence > after && (!type || c.call.type === type));
        const page = selected.slice(0, 100);
        return { items: page.map(c => c.call), complete: true, limitations: [], unknownCount: all.filter(c => c.type === 'unknown').length,
            ...(selected.length > page.length ? { cursor: Buffer.from(JSON.stringify({ sessionId, type: type ?? null, after: page.at(-1)!.sequence })).toString('base64url') } : {}) };
    }
    async call(sessionId: string, callId: string) { return (await this.allCalls(sessionId)).find(c => c.id === callId); }
    async appendCall(call: CallRecord) {
        requireRule(!await this.call(call.sessionId, call.id), 'conflict');
        await this.runtime.append(call.sessionId, 'aw.mcp-start', call as unknown as Json, call.id);
    }
    async finishCall(sessionId: string, id: string, status: CallRecord['status'], result: Json) {
        requireRule(await this.call(sessionId, id), 'not-found');
        await this.runtime.append(sessionId, 'aw.mcp-finish', { id, status, result });
    }
}
