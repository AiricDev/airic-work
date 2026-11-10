import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { parseEnv } from 'node:util';

const directory = import.meta.dirname;
const config = join(directory, '.env.task');
const environment = { ...parseEnv(readFileSync(config, 'utf8')), ...process.env };
const repository = environment.AIRIC_OM_REPOSITORY?.trim();
if (!repository || !process.getuid?.()) throw new Error('Set AIRIC_OM_REPOSITORY and run as a non-root user');
if (!isAbsolute(repository)) {
    const url = new URL(repository);
    if (!['https:', 'ssh:'].includes(url.protocol)) throw new Error('OM repository must be an absolute Git path, HTTPS URL, or SSH URL');
}
const data = join(directory, 'data');
mkdirSync(data, { mode: 0o700, recursive: true });
const empty = join(data, 'om-mount');
if (!isAbsolute(repository)) mkdirSync(empty, { mode: 0o700, recursive: true });
const compose = spawnSync('docker', [
    'compose', '--env-file', config, '-f', join(directory, 'compose.yaml'),
    ...(process.argv.length > 2 ? process.argv.slice(2) : ['up', '--build', '-d', '--wait']),
], {
    stdio: 'inherit',
    env: {
        ...environment,
        AIRIC_OM_REPOSITORY: repository,
        AIRIC_DEPLOY_DATA: realpathSync(data),
        AIRIC_DEPLOY_OM_MOUNT: realpathSync(isAbsolute(repository) ? repository : empty),
        AIRIC_DEPLOY_UID: String(process.getuid()),
        AIRIC_DEPLOY_GID: String(process.getgid()),
    },
});
if (compose.error) throw compose.error;
process.exitCode = compose.status ?? 1;
