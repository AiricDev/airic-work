import './load-typescript.mjs';
const { createFileStorage } = await import('../../src/bootstrap/bindings.ts');

process.once('message', async ({ bytes }) => {
    try {
        const { files } = await createFileStorage({ directory: process.argv[2] });
        const result = await files.put(Buffer.from(bytes, 'base64'));
        process.send({ ok: true, result }, () => process.disconnect());
    } catch (error) {
        process.send({ ok: false, code: error.code, message: error.message }, () => process.disconnect());
    }
});
process.send({ ready: true });
