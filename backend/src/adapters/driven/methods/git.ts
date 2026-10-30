import { spawn } from 'node:child_process';
import { isAbsolute } from 'node:path';
import { requireRule, RuleError } from '../../../domain/model';

/** 只接受宿主允许列表中的 HTTPS/SSH 地址或绝对本地仓库，不接受 ext/任意协议命令。 */
export function repositoryValid(repository: string): void {
    requireRule(!/[\0\r\n]/.test(repository), 'invalid', 'unsupported Git source');
    if (isAbsolute(repository)) return;
    // Git 常见的 SCP 风格 SSH 来源；不接受 ext:: 等双冒号 remote helper。
    if (/^(?:[A-Za-z0-9._-]+@)?(?:[A-Za-z0-9][A-Za-z0-9.-]*|\[[0-9a-fA-F:]+\]):[^:][^\0\r\n]*$/.test(repository) && !repository.includes('://')) return;
    let url: URL;
    try { url = new URL(repository); } catch { throw new RuleError('invalid', 'unsupported Git source'); }
    requireRule(['https:', 'ssh:'].includes(url.protocol) && !!url.hostname && !url.password && !url.search && !url.hash && (url.protocol !== 'https:' || !url.username), 'invalid', 'unsupported Git source');
}

/** 不使用 shell；超时/超量杀死整个 Git 进程组，不传播 stderr、参数或原始系统错误。 */
export function runGit(args: string[], timeoutMs: number, maximum: number, acceptedCodes: number[] = [0]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
        Object.assign(env, { GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1' });
        const child = spawn('git', [
            '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always',
            '-c', 'protocol.ssh.allow=always', '-c', 'protocol.file.allow=always',
            '-c', 'gc.auto=0', '-c', 'maintenance.auto=false', ...args,
        ], { env, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
        const chunks: Buffer[] = [];
        let size = 0;
        let failed = false;
        const kill = () => {
            failed = true;
            if (child.pid) try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 已退出。 */ }
        };
        const timer = setTimeout(kill, timeoutMs);
        child.stdout.on('data', (chunk: Buffer) => {
            size += chunk.length;
            if (size > maximum) kill();
            else chunks.push(chunk);
        });
        child.stderr.resume();
        child.once('error', () => { clearTimeout(timer); reject(new RuleError('blocked', 'Git unavailable')); });
        child.once('close', code => {
            clearTimeout(timer);
            if (failed || code === null || !acceptedCodes.includes(code)) reject(new RuleError('blocked', 'Git unavailable'));
            else resolve(Buffer.concat(chunks));
        });
    });
}
