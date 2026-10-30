import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { requireRule, runtimePath } from '../../../domain/model';

export const shaValid = (sha: string) => /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/.test(sha);

export function methodPath(path: string): void {
    runtimePath(path);
    requireRule(!path.includes('\0') && !path.split('/').some(part => part === '.' || ['.git', '.ome'].includes(part.toLowerCase())), 'invalid', 'outside method files');
}

export async function directoryCheck(path: string): Promise<void> {
    const info = await lstat(path);
    requireRule(info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o022) === 0, 'blocked');
}

export async function syncDirectory(path: string): Promise<void> {
    const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await handle.sync(); } finally { await handle.close(); }
}

export async function childDirectory(parent: string, name: string): Promise<string> {
    const path = join(parent, name);
    try { await mkdir(path, { mode: 0o700 }); }
    catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error; }
    await directoryCheck(path);
    await syncDirectory(parent);
    return path;
}

export async function storageRoot(directory: string): Promise<string> {
    requireRule(isAbsolute(directory), 'invalid', 'absolute methods directory required');
    const path = resolve(directory);
    await mkdir(path, { recursive: true, mode: 0o700 });
    await directoryCheck(path);
    const root = await realpath(path);
    for (let current = root; ; current = dirname(current)) {
        await syncDirectory(current);
        if (dirname(current) === current) break;
    }
    return root;
}

/** 显式检查每级目录；仓库路径不能成为宿主路径或符号链接通道。 */
export async function filePath(root: string, path: string): Promise<string> {
    methodPath(path);
    await directoryCheck(root);
    const parts = path.split('/');
    let parent = root;
    for (const part of parts.slice(0, -1)) { parent = join(parent, part); await directoryCheck(parent); }
    return join(parent, parts.at(-1)!);
}

export async function readRegular(path: string, maximum: number): Promise<Buffer> {
    const info = await lstat(path);
    requireRule(info.isFile() && !info.isSymbolicLink() && info.size <= maximum, 'blocked');
    const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
    try {
        const actual = await handle.stat();
        requireRule(actual.isFile() && actual.size <= maximum, 'blocked');
        const chunks: Buffer[] = [];
        let size = 0;
        for await (const chunk of handle.createReadStream({ autoClose: false })) {
            size += chunk.length;
            requireRule(size <= maximum, 'blocked');
            chunks.push(chunk);
        }
        requireRule(size === actual.size, 'blocked');
        return Buffer.concat(chunks);
    } finally { await handle.close(); }
}

export async function writeFixed(path: string, bytes: Uint8Array): Promise<void> {
    const handle = await open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(bytes); await handle.chmod(0o400); await handle.sync(); }
    finally { await handle.close(); }
}

export function textContent(bytes: Uint8Array): string | undefined {
    if (bytes.includes(0)) return;
    try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch { return; }
}
