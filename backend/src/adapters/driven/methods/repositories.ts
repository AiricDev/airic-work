import { createHash } from 'node:crypto';
import { mkdtemp, readdir, realpath, rename, rm } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import type { MethodSourceStatus } from '../../../application/ports';
import { nonempty, requireRule, RuleError, type Settings } from '../../../domain/model';
import { repositoryValid, runGit } from './git';
import { childDirectory, directoryCheck, shaValid, syncDirectory } from './storage';

export type GitMethodSource = string | { kind: 'managed'; repository: string } | { kind: 'local'; directory: string; remote?: string };
type Source = Exclude<GitMethodSource, string>;
export interface GitRepository { kind: 'managed' | 'local'; gitDir: string; directory: string; bare: boolean; repository?: string; remote?: string; }
type Remote = { name: string; repository: string; branch: string };

/** 字符串 URL/SCP 地址使用受管 clone；绝对目录直接复用。显式 managed 也允许本地 Git transport，便于离线部署。 */
export function methodSource(value: GitMethodSource): Source {
    const source = typeof value === 'string' ? (isAbsolute(value) ? { kind: 'local' as const, directory: value } : { kind: 'managed' as const, repository: value }) : value;
    requireRule(source !== null && typeof source === 'object', 'invalid');
    if (source.kind === 'managed') {
        requireRule(typeof source.repository === 'string', 'invalid');
        nonempty(source.repository); repositoryValid(source.repository);
    } else {
        requireRule(source.kind === 'local' && typeof source.directory === 'string' && isAbsolute(source.directory), 'invalid');
        requireRule(!source.directory.includes('\0'), 'invalid');
        if (source.remote !== undefined) { requireRule(typeof source.remote === 'string', 'invalid'); nonempty(source.remote); }
    }
    return source;
}

/** 仓库获取/remote 识别与安全快进机制，不拥有运行生命周期或平台配置权限。 */
export class GitRepositories {
    constructor(private readonly root: string, private readonly sources: Record<string, GitMethodSource>, private readonly limits: { commandTimeoutMs: number; maxTreeBytes: number }) { }

    source(source: string): Source {
        requireRule(Object.hasOwn(this.sources, source), 'forbidden', 'unconfigured method source');
        return methodSource(this.sources[source]);
    }
    async run(args: string[], maximum = this.limits.maxTreeBytes, acceptedCodes = [0]): Promise<Buffer> {
        const template = join(this.root, 'template');
        await directoryCheck(template);
        requireRule((await readdir(template)).length === 0, 'blocked', 'Git template must be empty');
        return runGit(['-c', `core.hooksPath=${template}`, '-c', 'core.fsmonitor=false', ...args], this.limits.commandTimeoutMs, maximum, acceptedCodes);
    }
    async open(source: string, allowClone = true): Promise<GitRepository> {
        const definition = this.source(source);
        if (definition.kind === 'local') {
            const directory = await realpath(definition.directory);
            const gitDir = (await this.run(['-C', directory, 'rev-parse', '--absolute-git-dir'])).toString().trim();
            const bare = (await this.run(['-C', directory, 'rev-parse', '--is-bare-repository'])).toString().trim() === 'true';
            if (!bare) {
                const top = (await this.run(['-C', directory, 'rev-parse', '--show-toplevel'])).toString().trim();
                requireRule(await realpath(top) === directory, 'blocked', 'method directory must be a repository root');
            }
            return { kind: 'local', gitDir, directory, bare, remote: definition.remote };
        }
        await directoryCheck(this.root);
        const mirrors = join(this.root, 'mirrors');
        await directoryCheck(mirrors);
        const parent = await childDirectory(mirrors, createHash('sha256').update(source).digest('hex'));
        const destination = join(parent, 'mirror.git');
        try { await directoryCheck(destination); }
        catch (error) {
            if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
            requireRule(allowClone, 'not-found', 'method repository unavailable');
            const staging = await mkdtemp(join(parent, '.mirror-'));
            try {
                await this.run(['clone', '--mirror', '--no-local', `--template=${join(this.root, 'template')}`, '--', definition.repository, staging]);
                try { await rename(staging, destination); }
                catch (error) {
                    if (!(error instanceof Error && 'code' in error && ['EEXIST', 'ENOTEMPTY'].includes(String(error.code)))) throw error;
                }
                await syncDirectory(parent);
            } finally { await rm(staging, { recursive: true, force: true }); }
        }
        requireRule((await this.run([`--git-dir=${destination}`, 'rev-parse', '--is-bare-repository'])).toString().trim() === 'true', 'blocked');
        // 同时兼容前版 init/fetch 创建的缓存；只修改受管仓库，不修改用户仓库 remote。
        await this.run([`--git-dir=${destination}`, 'config', 'remote.origin.url', definition.repository]);
        return { kind: 'managed', gitDir: destination, directory: destination, bare: true, repository: definition.repository };
    }
    async revision(repository: GitRepository, branch: string): Promise<string> {
        await this.run(['check-ref-format', `refs/heads/${branch}`]);
        const sha = (await this.run([`--git-dir=${repository.gitDir}`, 'rev-parse', '--verify', `refs/heads/${branch}^{commit}`])).toString().trim();
        requireRule(shaValid(sha), 'blocked');
        return sha;
    }
    async fetch(repository: GitRepository, branch?: string): Promise<void> {
        requireRule(repository.kind === 'managed' && repository.repository, 'blocked');
        if (branch !== undefined) await this.run(['check-ref-format', `refs/heads/${branch}`]);
        await this.run([`--git-dir=${repository.gitDir}`, 'fetch', '--prune', '--no-tags', '--no-recurse-submodules', '--force', '--', repository.repository,
            branch === undefined ? '+refs/heads/*:refs/heads/*' : `+refs/heads/${branch}:refs/heads/${branch}`]);
    }
    async confirm(repository: GitRepository, branch: string, sha: string): Promise<void> {
        if (repository.kind === 'local') {
            requireRule(await this.revision(repository, branch) === sha, 'blocked', 'method branch changed during sync');
        } else {
            const confirmed = (await this.run(['ls-remote', '--refs', '--exit-code', '--', repository.repository!, `refs/heads/${branch}`])).toString().trim();
            requireRule(confirmed === `${sha}\trefs/heads/${branch}`, 'blocked', 'method branch changed during sync');
        }
    }
    private async remote(repository: GitRepository, branch: string): Promise<{ remote?: Remote; sync: MethodSourceStatus['sync'] }> {
        // config 无匹配返回 1，不把其他 Git 失败误判成“没有 remote”。
        const raw = await this.run(['-C', repository.directory, 'config', '--null', '--get-regexp', '^(remote\\..*\\.url|branch\\..*\\.(remote|merge))$'], undefined, [0, 1]);
        const values = new Map<string, string[]>();
        for (const record of raw.toString().split('\0').filter(Boolean)) {
            const separator = record.indexOf('\n');
            requireRule(separator > 0, 'blocked');
            const key = record.slice(0, separator);
            values.set(key, [...(values.get(key) ?? []), record.slice(separator + 1)]);
        }
        const names = [...values.keys()].filter(key => key.startsWith('remote.') && key.endsWith('.url')).map(key => key.slice(7, -4));
        const upstream = values.get(`branch.${branch}.remote`)?.at(-1);
        const name = repository.remote ?? upstream ?? (names.includes('origin') ? 'origin' : names.length === 1 ? names[0] : undefined);
        if (name === '.' || (name !== undefined && !names.includes(name)) || names.length === 0)
            return { sync: { enabled: false, reason: 'no-remote', message: '本地仓库没有可用的 remote，同步已禁用；仍可使用本地已提交的 OM。' } };
        if (name === undefined)
            return { sync: { enabled: false, reason: 'ambiguous-remote', message: '仓库有多个 remote，请配置分支 upstream 或显式指定 remote 后再同步。' } };
        const urls = values.get(`remote.${name}.url`)!;
        let url = urls[0];
        const merge = upstream === name ? values.get(`branch.${branch}.merge`) : undefined;
        const remoteBranch = merge?.[0]?.startsWith('refs/heads/') ? merge[0].slice(11) : branch;
        try {
            requireRule(urls.length === 1 && (!merge || (merge.length === 1 && merge[0].startsWith('refs/heads/'))), 'invalid');
            if (!isAbsolute(url) && !url.includes(':')) url = resolve(repository.directory, url);
            repositoryValid(url);
            for (const ref of [`refs/heads/${remoteBranch}`, `refs/remotes/${name}/${remoteBranch}`]) {
                const normalized = (await this.run(['check-ref-format', '--normalize', ref], undefined, [0, 1])).toString().trim();
                requireRule(normalized === ref, 'invalid');
            }
        } catch (error) {
            if (!(error instanceof RuleError && error.code === 'invalid')) throw error;
            return { sync: { enabled: false, reason: 'unsupported-remote', message: 'remote 地址或 upstream 配置不受支持，同步已禁用；请检查协议和凭据配置。' } };
        }
        return { remote: { name, repository: url, branch: remoteBranch }, sync: { enabled: true, remote: name, branch: remoteBranch } };
    }
    async status(settings: Settings): Promise<MethodSourceStatus> {
        const definition = this.source(settings.omSource);
        await this.run(['check-ref-format', `refs/heads/${settings.branch}`]);
        if (definition.kind === 'managed') return { source: settings.omSource, kind: 'managed', sync: { enabled: true, remote: 'origin', branch: settings.branch } };
        const repository = await this.open(settings.omSource);
        return { source: settings.omSource, kind: 'local', sync: (await this.remote(repository, settings.branch)).sync };
    }
    private async editable(repository: GitRepository, branch: string): Promise<void> {
        const worktrees = (await this.run(['-C', repository.directory, 'worktree', 'list', '--porcelain', '-z'])).toString().split('\0');
        const checkouts = worktrees.filter(field => field === `branch refs/heads/${branch}`).length;
        requireRule(checkouts <= (repository.bare ? 0 : 1), 'conflict', '配置分支已在其他 worktree 检出，请在外部维护仓库。');
        if (!repository.bare) {
            const current = (await this.run(['-C', repository.directory, 'rev-parse', '--symbolic-full-name', 'HEAD'])).toString().trim();
            requireRule(current === `refs/heads/${branch}`, 'conflict', '请先检出配置分支，再显式同步。');
            const changed = await this.run(['-C', repository.directory, 'status', '--porcelain=v1', '--untracked-files=no', '--ignore-submodules=none']);
            requireRule(changed.length === 0, 'conflict', '工作区或暂存区有修改，请先处理后再同步。');
        }
    }
    async synchronize(repository: GitRepository, settings: Settings, validate: (sha: string) => Promise<void>): Promise<void> {
        const { remote, sync } = await this.remote(repository, settings.branch);
        requireRule(remote && sync.enabled, 'blocked', sync.message);
        const local = await this.revision(repository, settings.branch);
        await this.editable(repository, settings.branch);
        const tracking = `refs/remotes/${remote.name}/${remote.branch}`;
        await this.run(['-C', repository.directory, 'fetch', '--no-tags', '--no-recurse-submodules', '--', remote.repository, `refs/heads/${remote.branch}:${tracking}`]);
        const candidate = (await this.run(['-C', repository.directory, 'rev-parse', '--verify', `${tracking}^{commit}`])).toString().trim();
        requireRule(shaValid(candidate), 'blocked');
        const counts = (await this.run(['-C', repository.directory, 'rev-list', '--left-right', '--count', `${local}...${candidate}`])).toString().trim().split(/\s+/);
        requireRule(counts.length === 2 && counts[0] === '0', 'conflict', '本地分支不能快进到 remote，未覆盖本地提交。');
        const paths = (await this.run(['-C', repository.directory, 'diff', '--no-ext-diff', '--no-textconv', '--name-only', '-z', local, candidate, '--'])).toString().split('\0');
        requireRule(!paths.some(path => path.split('/').some(part => part.toLowerCase() === '.ome')), 'blocked', '远端变更包含作者目录，请在外部维护仓库后再运行。');
        await validate(candidate);
        await this.editable(repository, settings.branch);
        requireRule(await this.revision(repository, settings.branch) === local, 'conflict', 'local method branch changed');
        if (candidate === local) return;
        if (repository.bare) await this.run([`--git-dir=${repository.gitDir}`, 'update-ref', `refs/heads/${settings.branch}`, candidate, local]);
        else await this.run(['-C', repository.directory, '-c', 'merge.autostash=false', '-c', 'submodule.recurse=false', 'merge', '--ff-only', '--no-edit', '--no-autostash', candidate]);
    }
}
