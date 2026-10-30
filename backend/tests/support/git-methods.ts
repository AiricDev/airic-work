import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { promisify } from 'node:util';
import type { GitMethodsOptions } from '../../src/adapters/driven/methods/git-methods';
import type { Settings } from '../../src/domain/model';

const execute = promisify(execFile);
export async function git(repository: string, ...args: string[]): Promise<string> {
    return (await execute('git', ['-C', repository, ...args], { maxBuffer: 1024 * 1024 })).stdout.trim();
}
export async function file(repository: string, path: string, content: string | Uint8Array): Promise<void> {
    await mkdir(dirname(join(repository, path)), { recursive: true });
    await writeFile(join(repository, path), content);
}
/** 使用环境已配置的 Git 身份，不配置/覆盖作者或提交者，不推送任何提交。 */
export async function commit(repository: string, title: string, stage = true): Promise<string> {
    if (stage) await git(repository, 'add', '--all');
    await git(repository, 'commit', '-m', `${title}\n\nCo-authored-by: factory-droid[bot] <138933559+factory-droid[bot]@users.noreply.github.com>`);
    return git(repository, 'rev-parse', 'HEAD');
}
export async function repository(directory: string): Promise<string> {
    const root = join(directory, 'repository');
    await mkdir(root);
    await git(root, 'init', '--initial-branch=main');
    await file(root, 'om.md', '# Root\n固定版本，人工判断流程。\nRoot marker alpha.');
    await file(root, 'guides/判断.md', '判断标准与输入说明。\nLiteral 100% and a_b, x\\y.\nalpha ALPHA.');
    await file(root, 'guides/path-only.md', 'ordinary content');
    await file(root, '.ome/private.md', 'author-only-private-keyword');
    await file(root, 'nested/.ome/private.md', 'nested-author-only');
    await file(root, 'binary.bin', Uint8Array.from([0, 255, 128, 0]));
    await file(root, 'empty.md', '');
    await commit(root, 'Initial method');
    return root;
}
export const configuration: Settings = { version: 0, omSource: 'repo', branch: 'main', root: 'om.md', connections: [] };
export function options(directory: string, source: string): GitMethodsOptions {
    return {
        directory: join(directory, 'methods'), sources: { repo: { kind: 'managed', repository: source } }, runtimeVersion: 'declared-runtime', skillVersion: 'declared-skill',
        limits: { commandTimeoutMs: 10000, maxTreeBytes: 1024 * 1024, maxFileBytes: 1024 * 1024, maxSnapshotBytes: 8 * 1024 * 1024, historyEntries: 50 },
    };
}
