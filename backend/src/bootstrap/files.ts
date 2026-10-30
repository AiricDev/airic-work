import type { Files } from '../application/ports';
import { LocalBlobFiles } from '../adapters/driven/files/local-blob-files';

export interface FileStorageOptions {
    /** 可信宿主配置的绝对目录，不接受请求体路径；不与 Workspace/Agent 共享。 */
    directory: string;
}

/** 没有常驻句柄或后台进程，无须空的 close/dispose；每次操作自行关闭文件。 */
export async function createFileStorage(options: FileStorageOptions): Promise<{ files: Files }> {
    return { files: await LocalBlobFiles.open(options.directory) };
}
