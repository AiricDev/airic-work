import { v7 } from 'uuid';
import type { Support } from '../../../application/ports';

/** 系统时钟与 UUIDv7；重试必须复用持久命令/信封身份，而非调用此生成器重新编号。 */
export class SystemSupport implements Support {
    id(): string { return v7(); }
    now(): string { return new Date().toISOString(); }
}
