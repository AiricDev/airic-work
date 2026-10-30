import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { link, lstat, mkdir, open, realpath, unlink, type FileHandle } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type { Files } from '../../../application/ports';
import { requireRule, RuleError } from '../../../domain/model';

function hasCode(error: unknown, code: string): boolean {
    return error instanceof Error && 'code' in error && error.code === code;
}

/** 所有文件系统失败在边界脱敏，不传播原始路径、字节或系统异常。 */
function unavailable(): RuleError { return new RuleError('blocked', 'blob storage unavailable'); }

async function checkDirectory(path: string): Promise<void> {
    const info = await lstat(path);
    requireRule(info.isDirectory() && !info.isSymbolicLink() && (info.mode & 0o022) === 0, 'blocked');
}

async function syncDirectory(path: string): Promise<void> {
    const handle = await open(path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
    try { await handle.sync(); }
    finally { await handle.close(); }
}

async function childDirectory(parent: string, name: string): Promise<string> {
    const path = join(parent, name);
    try { await mkdir(path, { mode: 0o700 }); }
    catch (error) { if (!hasCode(error, 'EEXIST')) throw error; }
    await checkDirectory(path);
    // 即便另一个 writer 刚创建了目录，也由当前操作确认父目录项已同步。
    await syncDirectory(parent);
    return path;
}

/** 本地内容寻址 Files 实现；没有数据库、用户权限、文件名、下载或 Workspace 职责。 */
export class LocalBlobFiles implements Files {
    private constructor(private readonly directory: string) { }

    /** 根目录来自可信宿主配置；已有目录不 chmod，也不接受可由其他本地用户写入的根目录。 */
    static async open(directory: string): Promise<LocalBlobFiles> {
        requireRule(isAbsolute(directory), 'invalid', 'absolute blob directory required');
        try {
            const path = resolve(directory);
            await mkdir(path, { recursive: true, mode: 0o700 });
            await checkDirectory(path);
            const root = await realpath(path);
            // 启动时同步整条目录链，包含并发初始化时由另一进程刚创建的父目录。
            for (let current = root; ; current = dirname(current)) {
                await syncDirectory(current);
                if (dirname(current) === current) break;
            }
            return new LocalBlobFiles(root);
        } catch { throw unavailable(); }
    }

    private async verify(path: string, hash: string, size: number): Promise<void> {
        const info = await lstat(path);
        requireRule(info.isFile() && !info.isSymbolicLink(), 'blocked');
        const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
        try {
            const actual = await handle.stat();
            requireRule(actual.isFile() && actual.size === size, 'blocked');
            const digest = createHash('sha256');
            let count = 0;
            for await (const chunk of handle.createReadStream({ autoClose: false })) {
                digest.update(chunk);
                count += chunk.length;
            }
            requireRule(count === size && digest.digest('hex') === hash, 'blocked');
        } finally { await handle.close(); }
    }

    async put(bytes: Uint8Array): Promise<{ hash: string; size: number; contentRef: string }> {
        requireRule(bytes instanceof Uint8Array, 'invalid', 'byte array required');
        // 在首次 await 前独立复制，不能让调用方改写导致摘要与落盘内容不一致。
        const content = Buffer.from(bytes);
        const hash = createHash('sha256').update(content).digest('hex');
        let temporary: string | undefined;
        let handle: FileHandle | undefined;
        try {
            await checkDirectory(this.directory);
            const algorithm = await childDirectory(this.directory, 'sha256');
            const shard = await childDirectory(algorithm, hash.slice(0, 2));
            const destination = join(shard, hash);
            temporary = join(shard, `.${hash}.${randomUUID()}.tmp`);
            handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
            await handle.writeFile(content);
            await handle.chmod(0o400);
            await handle.sync();
            await handle.close();
            handle = undefined;
            try {
                // 同目录 hard link 原子发布完整 inode，EEXIST 不覆盖现有内容。
                await link(temporary, destination);
            } catch (error) {
                if (!hasCode(error, 'EEXIST')) throw error;
                await this.verify(destination, hash, content.byteLength);
            }
            await unlink(temporary);
            temporary = undefined;
            await syncDirectory(shard);
            return { hash, size: content.byteLength, contentRef: `sha256:${hash}` };
        } catch { throw unavailable(); }
        finally {
            // 正常失败尽力清理本次 staging；清理失败不伪造成功，也不删除其他 writer 的文件。
            if (handle) await handle.close().catch(() => {});
            if (temporary) await unlink(temporary).catch(() => {});
        }
    }
}
