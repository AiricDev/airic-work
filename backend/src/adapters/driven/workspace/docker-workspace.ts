import { createHash, randomUUID } from 'node:crypto';
import { link, unlink } from 'node:fs/promises';
import { request } from 'node:http';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { Files, Workspace } from '../../../application/ports';
import { requireRule, type Execution, type Upload } from '../../../domain/model';
import { childDirectory, filePath, readRegular, syncDirectory, writeFixed } from '../methods/storage';

export interface DockerWorkspaceOptions {
    socketPath: string;
    hostDirectory: string;
    user: string;
    image: string;
    dataDirectory: string;
    methodDirectory: (method: NonNullable<Execution['method']>) => Promise<string>;
}

const logLimit = 64 * 1024;

/** The trusted host talks to Docker. Commands receive only the three scoped directory mounts. */
export class DockerWorkspace implements Workspace {
    private readonly name: string;
    private readonly directory: string;
    private starting?: Promise<void>;
    private running = false;

    constructor(
        private readonly options: DockerWorkspaceOptions,
        taskId: string,
        private readonly files: Files,
    ) {
        requireRule(/^[A-Za-z0-9_-]{1,128}$/.test(taskId), 'invalid');
        requireRule(isAbsolute(options.hostDirectory) && /^[1-9][0-9]*:[0-9]+$/.test(options.user), 'invalid');
        this.directory = resolve(options.dataDirectory, 'tasks', taskId);
        this.name = 'airic-workspace-' + createHash('sha256').update(options.hostDirectory + '/' + taskId).digest('hex');
    }

    private async docker(method: string, path: string, options: {
        body?: object; statuses: number[]; timeout?: number; limit?: number;
    }): Promise<{ status: number; bytes: Buffer }> {
        const data = options.body && Buffer.from(JSON.stringify(options.body));
        return new Promise((done, fail) => {
            const unavailable = () => fail(new Error('Workspace container unavailable'));
            const req = request({
                socketPath: this.options.socketPath, path: '/v1.47' + path, method,
                signal: AbortSignal.timeout(options.timeout ?? 5000),
                headers: data ? { 'Content-Type': 'application/json', 'Content-Length': data.length } : undefined,
            }, res => {
                const status = res.statusCode ?? 0;
                const chunks: Buffer[] = [];
                let size = 0;
                res.on('error', unavailable);
                res.on('data', (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > (options.limit ?? logLimit)) { res.destroy(); unavailable(); }
                    else chunks.push(chunk);
                });
                res.on('end', () => {
                    if (options.statuses.includes(status)) done({ status, bytes: Buffer.concat(chunks) });
                    else unavailable();
                });
            });
            req.on('error', unavailable);
            req.end(data);
        });
    }

    async ensure() {
        const workspace = await childDirectory(this.directory, 'workspace');
        await childDirectory(workspace, 'inputs');
        await childDirectory(workspace, 'work');
    }

    async materialize(e: Execution, uploads: Upload[]) {
        for (const upload of uploads) {
            requireRule(upload.executionId === e.id && upload.userId === e.ownerId && this.files.read, 'forbidden');
            await this.storeInput(upload.id, await this.files.read(upload));
        }
    }

    async storeInput(id: string, bytes: Uint8Array) {
        requireRule(/^[A-Za-z0-9_-]{1,128}$/.test(id), 'invalid');
        const inputs = join(this.directory, 'workspace', 'inputs');
        const target = join(inputs, id);
        const stage = join(inputs, '.' + randomUUID());
        try {
            await writeFixed(stage, bytes);
            try { await link(stage, target); }
            catch (error) {
                if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
                requireRule((await readRegular(target, bytes.length)).equals(bytes), 'blocked');
            }
        } finally {
            await unlink(stage).catch(error => {
                if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
            });
        }
        await syncDirectory(inputs);
    }

    private mount(directory: string, target: string, readOnly: boolean) {
        const subpath = relative(this.options.dataDirectory, directory);
        requireRule(subpath && subpath.split('/').every(part => /^[A-Za-z0-9_.-]+$/.test(part) && part !== '..' && part !== '.'), 'blocked');
        return {
            Type: 'bind', Source: join(this.options.hostDirectory, subpath), Target: target, ReadOnly: readOnly,
            BindOptions: { NonRecursive: true },
        };
    }

    private containerPath(suffix = '') { return '/containers/' + this.name + suffix; }

    private async remove() {
        await this.docker('DELETE', this.containerPath('?force=true'), { statuses: [204, 404] });
    }

    async stop() {
        await this.starting?.catch(() => {});
        await this.remove();
    }

    async stopped() {
        if (this.starting) return false;
        const response = await this.docker('GET', this.containerPath('/json'), { statuses: [200, 404] });
        return response.status === 404;
    }

    async readOutput(path: string) {
        requireRule(!this.running, 'blocked');
        this.running = true;
        try {
            requireRule(await this.stopped(), 'blocked');
            const file = await filePath(join(this.directory, 'workspace', 'work'), path);
            return await readRegular(file, 10 * 1024 * 1024);
        } catch {
            throw new Error('Workspace output is unavailable');
        } finally { this.running = false; }
    }

    async run(e: Execution, command: string, admit: () => Promise<void>) {
        requireRule(e.method && command.length > 0 && command.length <= 8192, 'invalid');
        requireRule(!this.running, 'blocked');
        this.running = true;
        try { return await this.runContainer(e.method, command, admit); }
        finally { this.running = false; }
    }

    private async runContainer(method: NonNullable<Execution['method']>, command: string, admit: () => Promise<void>) {
        const om = await this.options.methodDirectory(method);
        const workspace = join(this.directory, 'workspace');
        const start = async () => {
            await admit();
            await this.remove(); // An interrupted tool attempt may have left its container behind.
            await this.docker('POST', '/containers/create?name=' + this.name, {
                statuses: [201], body: {
                    Image: this.options.image, User: this.options.user, Entrypoint: ['/usr/bin/timeout'],
                    Cmd: ['--signal=KILL', '25s', '/bin/sh', '-c', command],
                    WorkingDir: '/work', Env: ['HOME=/tmp'], NetworkDisabled: true, Healthcheck: { Test: ['NONE'] },
                    HostConfig: {
                        NetworkMode: 'none', ReadonlyRootfs: true, CapDrop: ['ALL'],
                        SecurityOpt: ['no-new-privileges'], PidsLimit: 64, Memory: 256 * 1024 * 1024,
                        NanoCpus: 1_000_000_000, Init: true,
                        Tmpfs: { '/tmp': 'rw,noexec,nosuid,nodev,size=32m' },
                        LogConfig: { Type: 'local', Config: { 'max-size': '64k', 'max-file': '1', compress: 'false' } },
                        Mounts: [this.mount(om, '/om', true), this.mount(join(workspace, 'inputs'), '/inputs', true),
                            this.mount(join(workspace, 'work'), '/work', false)],
                    },
                },
            });
            await admit();
            await this.docker('POST', this.containerPath('/start'), { statuses: [204] });
        };
        const started = start().finally(() => { this.starting = undefined; });
        this.starting = started;
        try {
            await started;
            const { bytes } = await this.docker('POST', this.containerPath('/wait?condition=not-running'), {
                statuses: [200], timeout: 30_000,
            });
            const { StatusCode } = JSON.parse(bytes.toString());
            requireRule(Number.isInteger(StatusCode), 'blocked');
            const logs = await this.docker('GET', this.containerPath('/logs?stdout=true&stderr=true&tail=100'), {
                statuses: [200], limit: logLimit,
            });
            return { exitCode: StatusCode as number, output: this.output(logs.bytes) };
        } finally {
            await this.remove();
        }
    }

    private output(bytes: Buffer) {
        const parts: Buffer[] = [];
        for (let offset = 0; offset < bytes.length;) {
            requireRule(offset + 8 <= bytes.length, 'blocked');
            const end = offset + 8 + bytes.readUInt32BE(offset + 4);
            requireRule(end <= bytes.length, 'blocked');
            parts.push(bytes.subarray(offset + 8, end));
            offset = end;
        }
        return Buffer.concat(parts).toString('utf8');
    }
}
