import { describe, expect, it } from 'vitest';
import { mcpWorkerOutput } from '../src/adapters/driven/runtime/mcp-worker-tools';

describe('MCP model output', () => {
    it('passes source pixels as image content and keeps provenance in the receipt', () => {
        const result = mcpWorkerOutput({
            callId: 'call-1', status: 'unknown',
            result: {
                structuredContent: { source: { revision_id: 'fixed-revision', page: 1 } },
                content: [{ type: 'image', mimeType: 'image/png', data: 'YWJjZA==' }],
            },
        });
        expect(result.output?.[1]).toEqual({ type: 'image', mimeType: 'image/png', data: 'YWJjZA==' });
        const text = result.output?.[0];
        expect(text?.type).toBe('text');
        if (text?.type !== 'text') throw new Error('Missing receipt');
        expect(text.text).toContain('fixed-revision');
        expect(text.text).not.toContain('YWJjZA==');
    });
});
