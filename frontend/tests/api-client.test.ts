import { afterEach,beforeEach, expect, it, vi } from 'vitest';
import { api, ApiError, resetIdentity } from '../src/api/client';

beforeEach(()=>vi.stubGlobal('window',new EventTarget()));
afterEach(() => { vi.unstubAllGlobals(); resetIdentity(); });
it('uses a cookie session, keeps CSRF only in memory, and sends stable command identity separately from content', async () => {
    const fetcher = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({ user: { id: 'owner' }, csrfToken: 'csrf' })))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'saved' })));
    vi.stubGlobal('fetch', fetcher);
    await api('login', { token: 'synthetic-token' });
    await api('steering', { params: { id: 'execution/id' }, key: 'original-key', body: { text: 'same content', files: [] } });
    const first = fetcher.mock.calls[0][1] as RequestInit;
    expect((first.headers as Headers).get('authorization')).toBe('Bearer synthetic-token');
    const [url, second] = fetcher.mock.calls[1] as [string, RequestInit];
    expect(url).toBe('/api/v1/executions/execution%2Fid/steering');
    expect(second.credentials).toBe('same-origin');
    expect((second.headers as Headers).get('authorization')).toBeNull();
    expect((second.headers as Headers).get('x-csrf-token')).toBe('csrf');
    expect((second.headers as Headers).get('idempotency-key')).toBe('original-key');
});
it('keeps network outcome unknown instead of silently retrying a write', async () => {
    const fetcher = vi.fn().mockRejectedValue(new TypeError('network closed'));
    vi.stubGlobal('fetch', fetcher);
    await expect(api('answer', { params: { id: 'request' }, key: 'same-key', body: { text: 'answer', contextRevision: 1, files: [] } })).rejects.toBeInstanceOf(TypeError);
    expect(fetcher).toHaveBeenCalledTimes(1);
});
it('clears identity on rejection and does not turn a failed API read into mock data', async () => {
    const events = new EventTarget();
    const listener = vi.fn(); events.addEventListener('airic:identity-lost', listener);
    vi.stubGlobal('window', events);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ code: 'account-disabled', message: 'Disabled' }), { status: 403 })));
    await expect(api('me')).rejects.toBeInstanceOf(ApiError);
    expect(listener).toHaveBeenCalledOnce();
});

it('does not let a stale rejected request clear a newer login',async()=>{
 const listener=vi.fn();window.addEventListener('airic:identity-lost',listener);
 let finish!:(r:Response)=>void;
 vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>new Promise<Response>(resolve=>finish=resolve)).mockResolvedValueOnce(new Response(JSON.stringify({user:{id:'new'},csrfToken:'new-csrf'}))));
 const old=api('me').catch(e=>e);
 await api('login',{token:'new-identity'});
 finish(new Response(JSON.stringify({code:'invalid-identity',message:'Old session'}),{status:401}));
 expect(await old).toBeInstanceOf(ApiError);expect(listener).not.toHaveBeenCalled();
});
