import type { EntryRecord } from '@earendil-works/pi-durable';

export interface TaskTraceEvent {
    eventId: string;
    recordedAt: string;
    kind: 'message' | 'continuation' | 'tool_call' | 'tool_result';
    role?: 'user' | 'agent' | 'worker';
    text?: string;
    workId?: string;
    inputId?: string;
    requestIds?: string[];
    tool?: {
        callId: string; name: string; connectionId: string;
        classification: 'read' | 'write' | 'unknown';
        outcome: 'sent' | 'succeeded' | 'failed' | 'unknown';
    };
}

/** Project public events from persisted Pi entries, without exposing prompts or SDK payloads. */
export function taskTrace(entries: EntryRecord[]): TaskTraceEvent[] {
    const events: TaskTraceEvent[] = [];
    const calls = new Map<string, TaskTraceEvent>();
    for (const entry of entries) {
        const data = entry.data;
        if (data && typeof data === 'object' && !Array.isArray(data) && typeof data.id === 'string') {
            if (entry.kind === 'aw.mcp-start' && typeof data.at === 'string'
                && typeof data.tool === 'string' && typeof data.connection === 'string') {
                const event: TaskTraceEvent = {
                    eventId: String(entry.id), recordedAt: data.at, kind: 'tool_call', role: 'worker',
                    tool: { callId: data.id, name: data.tool, connectionId: data.connection,
                        classification: data.type === 'read' || data.type === 'write' ? data.type : 'unknown', outcome: 'unknown' },
                    ...(typeof data.requestId === 'string' ? { requestIds: [data.requestId] } : {}),
                };
                calls.set(data.id, event);
                events.push(event);
                continue;
            }
            if (entry.kind === 'aw.mcp-finish') {
                const start = calls.get(data.id);
                if (start?.tool) {
                    start.tool.outcome = 'sent';
                    events.push({
                        ...start, eventId: String(entry.id), kind: 'tool_result',
                        recordedAt: typeof data.finishedAt === 'string' ? data.finishedAt : start.recordedAt,
                        tool: { ...start.tool, outcome: data.status === 'success' ? 'succeeded' : data.status === 'failed' ? 'failed' : 'unknown' },
                    });
                }
                continue;
            }
        }
        if (entry.kind === 'aw.user-decision' && data && typeof data === 'object' && !Array.isArray(data)
            && typeof data.inputId === 'string' && typeof data.requestId === 'string'
            && typeof data.workId === 'string' && typeof data.recordedAt === 'string') {
            events.push({
                eventId: String(entry.id), recordedAt: data.recordedAt, kind: 'continuation',
                inputId: data.inputId, requestIds: [data.requestId], workId: data.workId,
            });
            continue;
        }
        for (const [index, message] of (entry.model ?? []).entries()) {
            if (message.role !== 'assistant' && message.role !== 'user') continue;
            const text = typeof message.content === 'string' ? message.content
                : message.content.filter(part => part.type === 'text').map(part => part.text).join('\n');
            if (!text || !Number.isFinite(message.timestamp)) continue;
            events.push({
                eventId: `${entry.id}:${index}`, recordedAt: new Date(message.timestamp).toISOString(),
                kind: 'message', role: entry.kind === 'aw.branch-summary' ? 'worker' : message.role === 'assistant' ? 'agent' : 'user', text,
            });
        }
    }
    return events;
}
