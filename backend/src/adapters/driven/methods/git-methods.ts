import { createHash, randomUUID } from 'node:crypto';
import { lstat, mkdtemp, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { Methods } from '../../../application/ports';
import { nonempty, requireRule, RuleError, type Json, type Method, type Settings } from '../../../domain/model';
import { GitRepositories, methodSource, type GitMethodSource } from './repositories';
import { searchIndex } from './index';
import { childDirectory, directoryCheck, filePath, methodPath, readRegular, shaValid, storageRoot, syncDirectory, textContent, writeFixed } from './storage';

export interface GitMethodsOptions {
    directory: string;
    /** 可信宿主允许列表：应用 source 标识 → 仓库位置，不将请求中的 source 解释为 URL/宿主路径。 */
    sources: Record<string, GitMethodSource>;
    /** 仅声明的版本，不证明 Agent 或 Skill 已实际装配。 */
    runtimeVersion: string;
    skillVersion: string;
    limits: { commandTimeoutMs: number; maxTreeBytes: number; maxFileBytes: number; maxSnapshotBytes: number; historyEntries: number };
}

const manifestSchema = z.object({
    version: z.literal(1), source: z.string(), sha: z.string().refine(shaValid),
    files: z.array(z.object({ path: z.string(), hash: z.string().regex(/^[a-f0-9]{64}$/), size: z.number().int().nonnegative(), text: z.boolean() }).strict()),
}).strict();
type Manifest = z.infer<typeof manifestSchema>;
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const codeIs = (error: unknown, ...codes: string[]) => error instanceof Error && 'code' in error && codes.includes(String(error.code));

/** Git 只负责固定方法，不拥有执行生命周期或实际 Agent 装配。 */
export class GitMethods implements Methods {
    private readonly pending = new Map<string, Promise<void>>();
    private readonly repositories: GitRepositories;
    private constructor(private readonly root: string, private readonly options: GitMethodsOptions) {
        this.repositories = new GitRepositories(root, options.sources, options.limits);
    }

    static async open(options: GitMethodsOptions): Promise<GitMethods> {
        nonempty(options.runtimeVersion); nonempty(options.skillVersion);
        requireRule(Object.keys(options.sources).length > 0, 'invalid');
        for (const [source, repository] of Object.entries(options.sources)) { nonempty(source); methodSource(repository); }
        for (const key of ['commandTimeoutMs', 'maxTreeBytes', 'maxFileBytes', 'maxSnapshotBytes', 'historyEntries'] as const) {
            const value = options.limits[key];
            requireRule(Number.isSafeInteger(value) && value > 0 && value < Number.MAX_SAFE_INTEGER, 'invalid');
        }
        requireRule(options.limits.commandTimeoutMs <= 2147483647, 'invalid');
        try {
            const root = await storageRoot(options.directory);
            for (const name of ['mirrors', 'snapshots', 'indexes', 'template', 'views']) await childDirectory(root, name);
            requireRule((await readdir(join(root, 'template'))).length === 0, 'blocked', 'Git template must be empty');
            return new GitMethods(root, structuredClone(options));
        } catch (error) {
            if (error instanceof RuleError) throw error;
            throw new RuleError('blocked', 'method storage unavailable');
        }
    }

    private async protect<T>(work: () => Promise<T>): Promise<T> {
        try { return await work(); }
        catch (error) {
            if (error instanceof RuleError) throw error;
            throw new RuleError('blocked', 'method storage unavailable');
        }
    }
    private git(args: string[], maximum = this.options.limits.maxTreeBytes) {
        return this.repositories.run(args, maximum);
    }
    private async serial<T>(source: string, work: () => Promise<T>): Promise<T> {
        const previous = this.pending.get(source) ?? Promise.resolve();
        const result = previous.then(work);
        const completion = result.then(() => {}, () => {});
        this.pending.set(source, completion);
        try { return await result; }
        finally { if (this.pending.get(source) === completion) this.pending.delete(source); }
    }
    private async sourceDirectory(kind: string, source: string): Promise<string> {
        await directoryCheck(this.root);
        const parent = join(this.root, kind);
        await directoryCheck(parent);
        return childDirectory(parent, hash(source));
    }
    private async snapshot(method: Pick<Method, 'source' | 'sha'>): Promise<{ directory: string; manifest: Manifest; manifestHash: string }> {
        this.repositories.source(method.source);
        requireRule(shaValid(method.sha), 'invalid', 'invalid method revision');
        await directoryCheck(this.root);
        const parent = join(this.root, 'snapshots');
        await directoryCheck(parent);
        const source = join(parent, hash(method.source));
        try {
            await directoryCheck(source);
            const directory = join(source, method.sha);
            await directoryCheck(directory);
            const bytes = await readRegular(join(directory, 'manifest.json'), this.options.limits.maxTreeBytes * 4 + 1024);
            const parsed = manifestSchema.safeParse(JSON.parse(bytes.toString('utf8')));
            requireRule(parsed.success, 'blocked', 'invalid method snapshot');
            const manifest = parsed.data;
            requireRule(manifest.source === method.source && manifest.sha === method.sha, 'blocked', 'method snapshot mismatch');
            let size = 0;
            const paths = new Set<string>();
            for (const file of manifest.files) {
                methodPath(file.path);
                requireRule(!paths.has(file.path) && file.size <= this.options.limits.maxFileBytes, 'blocked');
                paths.add(file.path); size += file.size;
            }
            requireRule(size <= this.options.limits.maxSnapshotBytes, 'blocked');
            await directoryCheck(join(directory, 'runtime'));
            return { directory, manifest, manifestHash: hash(bytes) };
        } catch (error) {
            if (codeIs(error, 'ENOENT')) throw new RuleError('not-found', 'method snapshot unavailable');
            throw error;
        }
    }
    private async content(directory: string, file: Manifest['files'][number]): Promise<Buffer> {
        const path = await filePath(join(directory, 'runtime'), file.path);
        const bytes = await readRegular(path, this.options.limits.maxFileBytes);
        requireRule(bytes.length === file.size && hash(bytes) === file.hash, 'blocked', 'method content mismatch');
        return bytes;
    }
    private async exportSnapshot(source: string, sha: string, mirror: string): Promise<void> {
        try { await this.snapshot({ source, sha }); return; }
        catch (error) { if (!(error instanceof RuleError && error.code === 'not-found')) throw error; }
        const parent = await this.sourceDirectory('snapshots', source);
        const staging = await mkdtemp(join(parent, `.${sha}-`));
        try {
            const runtime = await childDirectory(staging, 'runtime');
            const directories = new Set([runtime, staging]);
            const tree = await this.git([`--git-dir=${mirror}`, 'ls-tree', '-rz', '--full-tree', sha]);
            const records = new TextDecoder('utf-8', { fatal: true }).decode(tree).split('\0').filter(Boolean);
            const manifest: Manifest = { version: 1, source, sha, files: [] };
            let total = 0;
            for (const record of records) {
                const separator = record.indexOf('\t');
                requireRule(separator > 0, 'blocked');
                const [mode, type, oid] = record.slice(0, separator).split(' ');
                const path = record.slice(separator + 1);
                if (path.split('/').some(part => ['.ome', '.git'].includes(part.toLowerCase()))) continue;
                if (!['100644', '100755'].includes(mode) || type !== 'blob') continue;
                methodPath(path); requireRule(shaValid(oid), 'blocked');
                const bytes = await this.git([`--git-dir=${mirror}`, 'cat-file', 'blob', oid], this.options.limits.maxFileBytes);
                total += bytes.length;
                requireRule(total <= this.options.limits.maxSnapshotBytes, 'blocked', 'method snapshot exceeds configured limit');
                let directory = runtime;
                const parts = path.split('/');
                for (const part of parts.slice(0, -1)) { directory = await childDirectory(directory, part); directories.add(directory); }
                await writeFixed(join(directory, parts.at(-1)!), bytes);
                manifest.files.push({ path, hash: hash(bytes), size: bytes.length, text: textContent(bytes) !== undefined });
            }
            await writeFixed(join(staging, 'manifest.json'), Buffer.from(JSON.stringify(manifest)));
            for (const directory of [...directories].sort((a, b) => b.length - a.length)) await syncDirectory(directory);
            try { await rename(staging, join(parent, sha)); }
            catch (error) { if (!codeIs(error, 'EEXIST', 'ENOTEMPTY')) throw error; }
            await syncDirectory(parent);
            await this.snapshot({ source, sha });
        } finally { await rm(staging, { recursive: true, force: true }); }
    }

    async latest(settings: Settings): Promise<Method> {
        return this.protect(() => this.serial(settings.omSource, () => this.prepare(settings, false)));
    }
    async status(settings: Settings) { return this.protect(() => this.repositories.status(settings)); }
    async sync(settings: Settings): Promise<Method> {
        return this.protect(() => this.serial(settings.omSource, () => this.prepare(settings, true)));
    }
    private viewPath(settings: Settings) { return join(this.root, 'views', hash(JSON.stringify([settings.omSource, settings.branch, settings.root])) + '.json'); }
    private async remember(settings: Settings, method: Method) {
        const path = this.viewPath(settings), temporary = path + '.' + randomUUID();
        try {
            await directoryCheck(join(this.root, 'views'));
            await writeFixed(temporary, Buffer.from(JSON.stringify(method)));
            await rename(temporary, path);
            await syncDirectory(join(this.root, 'views'));
        } finally { await rm(temporary, { force: true }); }
    }
    async browse(settings: Settings, sha?: string): Promise<Method> {
        return this.protect(async () => {
            this.repositories.source(settings.omSource);
            let method: Method;
            if (sha) {
                requireRule(shaValid(sha), 'invalid');
                method = { source: settings.omSource, sha, root: settings.root, runtimeVersion: this.options.runtimeVersion, skillVersion: this.options.skillVersion };
                try { await this.read(method, method.root); return method; }
                catch (error) { if (!(error instanceof RuleError && error.code === 'not-found')) throw error; }
                // Export an available historical commit without fetching or changing refs.
                const repository = await this.repositories.open(settings.omSource, false);
                const resolved = (await this.repositories.run([`--git-dir=${repository.gitDir}`, 'rev-parse', '--verify', '--quiet', `${sha}^{commit}`], undefined, [0, 1])).toString().trim();
                requireRule(resolved === sha, 'not-found');
                method = await this.serial(settings.omSource, () => this.pinned(settings, repository.gitDir, sha));
            } else {
                try {
                    const value = JSON.parse((await readRegular(this.viewPath(settings), 65536)).toString('utf8'));
                    requireRule(value.source === settings.omSource && value.root === settings.root && shaValid(value.sha), 'blocked');
                    method = value;
                } catch (error) {
                    if (!codeIs(error, 'ENOENT')) throw error;
                    // Local-only preparation reads committed files, not the worktree, and never fetches.
                    requireRule(this.repositories.source(settings.omSource).kind === 'local', 'not-found', 'no confirmed method snapshot');
                    method = await this.serial(settings.omSource, () => this.prepare(settings, false));
                }
            }
            await this.read(method, method.root);
            return method;
        });
    }
    async tree(method: Method) {
        return this.protect(async () => {
            await this.read(method, method.root);
            return (await this.snapshot(method)).manifest.files.map(({ path, size, text }) => ({ path, size, text }));
        });
    }
    async commit(method: Method): Promise<Json> {
        return this.protect(async () => {
            await this.read(method, method.root);
            const repository = await this.repositories.open(method.source, false);
            const raw = (await this.git([`--git-dir=${repository.gitDir}`, 'show', '-s', '--format=%H%x00%P%x00%cI%x00%s', method.sha, '--'])).toString('utf8').split('\0');
            const changed = (await this.git([`--git-dir=${repository.gitDir}`, 'diff-tree', '--root', '--no-commit-id', '--name-only', '-r', '-z', method.sha, '--'])).toString('utf8').split('\0').filter(Boolean);
            const files = changed.filter(path => { try { methodPath(path); return true; } catch { return false; } });
            const diff = files.length ? (await this.git([`--git-dir=${repository.gitDir}`, 'show', '--format=', '--no-ext-diff', '--no-textconv', '--no-renames', method.sha, '--', ...files])).toString('utf8') : '';
            return { sha: raw[0], parents: raw[1].split(' ').filter(Boolean), at: raw[2], subject: raw[3].trim(), files, diff };
        });
    }
    private async pinned(settings: Settings, gitDir: string, sha: string): Promise<Method> {
        await this.exportSnapshot(settings.omSource, sha, gitDir);
        const method = { source: settings.omSource, sha, root: settings.root, runtimeVersion: this.options.runtimeVersion, skillVersion: this.options.skillVersion };
        await this.read(method, method.root);
        return method;
    }
    private async prepare(settings: Settings, synchronize: boolean): Promise<Method> {
        methodPath(settings.root); nonempty(settings.branch);
        await this.git(['check-ref-format', `refs/heads/${settings.branch}`]);
        const repository = await this.repositories.open(settings.omSource);
        if (repository.kind === 'managed') await this.repositories.fetch(repository, settings.branch);
        else if (synchronize) await this.repositories.synchronize(repository, settings, async sha => { await this.pinned(settings, repository.gitDir, sha); });
        const sha = await this.repositories.revision(repository, settings.branch);
        const method = await this.pinned(settings, repository.gitDir, sha);
        await this.repositories.confirm(repository, settings.branch, sha);
        await this.remember(settings, method);
        return method;
    }
    async read(method: Method, path: string): Promise<string> {
        return this.protect(async () => {
            methodPath(method.root); methodPath(path);
            const { directory, manifest } = await this.snapshot(method);
            requireRule(manifest.files.some(file => file.path === method.root && file.text), 'blocked', 'method root unavailable');
            const file = manifest.files.find(file => file.path === path);
            requireRule(file, 'not-found');
            requireRule(file.text, 'blocked', 'method file is not UTF-8 text');
            const text = textContent(await this.content(directory, file));
            requireRule(text !== undefined, 'blocked');
            return text;
        });
    }
    async search(method: Method, query: string): Promise<{ path: string; excerpt: string }[]> {
        return this.protect(async () => {
            nonempty(query); requireRule(!query.includes('\0'), 'invalid');
            methodPath(method.root);
            const snapshot = await this.snapshot(method);
            requireRule(snapshot.manifest.files.some(file => file.path === method.root && file.text), 'blocked', 'method root unavailable');
            const parent = await this.sourceDirectory('indexes', method.source);
            const index = join(parent, `${method.sha}.sqlite`);
            try {
                const info = await lstat(index);
                requireRule(info.isFile() && !info.isSymbolicLink(), 'blocked');
            } catch (error) { if (!codeIs(error, 'ENOENT')) throw error; }
            return searchIndex(index, { source: method.source, sha: method.sha, manifestHash: snapshot.manifestHash }, query, async () => {
                const files = [];
                for (const file of snapshot.manifest.files) {
                    const bytes = await this.content(snapshot.directory, file);
                    const text = textContent(bytes);
                    requireRule(file.text === (text !== undefined), 'blocked');
                    files.push({ path: file.path, content: text ?? '' });
                }
                return files;
            });
        });
    }
    async cachedHistory(source: string): Promise<Json> { return this.readHistory(source, false); }
    async history(source: string): Promise<Json> { return this.readHistory(source, true); }
    private async readHistory(source: string, refresh: boolean): Promise<Json> {
        return this.protect(async () => {
            this.repositories.source(source);
            return this.serial(source, async () => {
                const repository = await this.repositories.open(source, refresh);
                if (repository.kind === 'managed' && refresh) await this.repositories.fetch(repository);
                const mirror = repository.gitDir;
                const limit = this.options.limits.historyEntries;
                const raw = (await this.git([`--git-dir=${mirror}`, 'log', '--branches', '--topo-order', `--max-count=${limit + 1}`, '--format=%H%x00%P%x00%cI%x00%s%x00', '--'])).toString('utf8').split('\0');
                const commits = [];
                for (let index = 0; index + 3 < raw.length; index += 4) {
                    const sha = raw[index].trim();
                    requireRule(shaValid(sha), 'blocked');
                    commits.push({ sha, parents: raw[index + 1].split(' ').filter(Boolean), at: raw[index + 2], subject: raw[index + 3] });
                }
                const shallow = (await this.git([`--git-dir=${mirror}`, 'rev-parse', '--is-shallow-repository'])).toString().trim() === 'true';
                const limitations = [];
                if (commits.length > limit) limitations.push(`history limited to ${limit} commits`);
                if (shallow) limitations.push('source history is shallow');
                return { source, scope: 'branches', commits: commits.slice(0, limit), complete: limitations.length === 0, limitations };
            });
        });
    }
}
