import { it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
it('Domain and Application only import inward, with no framework, adapter or frontend dependencies', () => {
    const root = resolve(import.meta.dirname, '../src');
    for (const layer of ['domain', 'application'])
        for (const file of readdirSync(resolve(root, layer))) {
            if (!file.endsWith('.ts'))
                continue;
            const path = resolve(root, layer, file);
            const text = readFileSync(path, 'utf8');
            for (const match of text.matchAll(/(?:from\s+|import\s*\()(['"])([^'"]+)\1/g)) {
                const spec = match[2];
                expect(spec.startsWith('.'), `${file}: ${spec}`).toBe(true);
                const target = relative(root, resolve(root, layer, spec));
                expect(target.startsWith('domain/') || (layer === 'application' && target.startsWith('application/')), `${file}: ${target}`).toBe(true);
            }
            expect(text).not.toMatch(/process\.env|fetch\(|localStorage|Date\.now\(|Math\.random\(/);
        }
});
