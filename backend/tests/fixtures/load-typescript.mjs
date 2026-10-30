// 独立测试进程共享的转译入口，不生成构建产物，不用于生产启动。
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

registerHooks({
    resolve(specifier, context, next) {
        try { return next(specifier, context); }
        catch (error) {
            if (error.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.') && !specifier.endsWith('.ts'))
                return next(`${specifier}.ts`, context);
            throw error;
        }
    },
    load(url, context, next) {
        if (url.endsWith('.ts'))
            return { format: 'module', source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText, shortCircuit: true };
        return next(url, context);
    },
});
