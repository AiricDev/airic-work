import { api } from './client';

/** Called only by a trusted, same-origin integration module. Never read identity from URLs or arbitrary postMessage events. */
export async function connectWithToken(token: string) {
    await api('login', { token });
    window.dispatchEvent(new Event('airic:session-ready'));
}
