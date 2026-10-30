import { parseArgs } from 'node:util';
import { createAccountMaintenance } from '../src/bootstrap/account-maintenance';
import { RuleError } from '../src/domain/model';

const usage = 'Usage: npm --prefix backend run admin:grant -- --database /absolute/path/control.sqlite --user <local-user-id>\n';

async function main() {
    let values;
    try {
        ({ values } = parseArgs({ options: { database: { type: 'string' }, user: { type: 'string' }, help: { type: 'boolean' } }, strict: true, allowPositionals: false }));
        if (values.help) { process.stdout.write(usage); return; }
        if (!values.database || !values.user) throw new Error('arguments');
    } catch {
        process.stderr.write(`Invalid arguments.\n${usage}`);
        process.exitCode = 2;
        return;
    }
    let resources: ReturnType<typeof createAccountMaintenance> | undefined;
    try {
        resources = createAccountMaintenance(values.database);
        await resources.administration.grantAdministrator(values.user);
        process.stdout.write('Administrator granted.\n');
    } catch (error) {
        const code = error instanceof RuleError ? error.code : '';
        const message = code === 'not-found' ? 'User not found; authenticate first.' : code === 'forbidden' ? 'User is disabled; no account state was changed.' : 'Administrator update unavailable; check the existing database and configuration.';
        process.stderr.write(`${message}\n`);
        process.exitCode = 1;
    } finally { resources?.close(); }
}

await main();
