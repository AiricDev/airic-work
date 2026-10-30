import type { Methods } from '../application/ports';
import { GitMethods, type GitMethodsOptions } from '../adapters/driven/methods/git-methods';

/** 宿主配置 URL 受管 clone 或直接复用本地 Git 目录；不自动同步本地仓库，不装配 Agent/控制记录或持有常驻句柄。 */
export async function createMethods(options: GitMethodsOptions): Promise<{ methods: Methods }> {
    return { methods: await GitMethods.open(options) };
}
