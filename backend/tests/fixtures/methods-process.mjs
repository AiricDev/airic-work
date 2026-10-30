import './load-typescript.mjs';
const { createMethods } = await import('../../src/bootstrap/bindings.ts');

process.once('message', async ({ options, configuration, method, query }) => {
    try {
        const { methods } = await createMethods(options);
        const result = method ? await methods.search(method, query) : await methods.latest(configuration);
        process.send({ ok: true, result }, () => process.disconnect());
    } catch (error) {
        process.send({ ok: false, code: error.code, message: error.message }, () => process.disconnect());
    }
});
process.send({ ready: true });
