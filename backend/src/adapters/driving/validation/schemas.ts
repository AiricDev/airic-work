import { z } from 'zod';
import type { Json } from '../../../domain/model';
/** 结构校验共享片段；只验证形状，不判断归属、权限、运行代次或回答的专业充分性。 */
const requiredText = z.string().refine(value => value.trim().length > 0, '必须包含非空文字');
const revision = z.number().int().nonnegative();
const json: z.ZodType<Json> = z.json();
/** 调用方业务属性自由表达 JSON，不转换成平台固定业务模型。 */
export const createExecutionSchema = z.strictObject({
    project_id: requiredText,
    project_name: requiredText,
    task: z.record(z.string(), json),
    instruction: requiredText,
});
/** UserDecision 的提交内容；requestId、userId、命令键由入口独立传入，不从正文取身份。 */
export const userDecisionSchema = z.strictObject({
    text: z.string().default(''),
    optionId: requiredText.optional(),
    contextRevision: z.number().int().positive(),
    files: z.array(requiredText).default([]),
    correctionOf: requiredText.optional(),
}).refine(value => !!value.text.trim() || !!value.optionId || value.files.length > 0, '需要文字、选项或文件');
/** 一般消息不需要 requestId，也不能借额外字段冒充 UserDecision。 */
export const steeringSchema = z.strictObject({
    text: z.string().default(''),
    files: z.array(requiredText).default([]),
}).refine(value => !!value.text.trim() || value.files.length > 0, '消息或文件不能为空');
/** 个人显示名更新与管理员启停/权限修改分别定义，禁止混入权限字段。 */
export const profileSchema = z.strictObject({ name: requiredText });
export const preferencesSchema = z.strictObject({
    language: requiredText,
    timezone: requiredText,
    notify: z.strictObject({ decision: z.boolean(), anomaly: z.boolean(), result: z.boolean() }),
});
export const manageUserSchema = z.strictObject({
    enabled: z.boolean().optional(),
    admin: z.boolean().optional(),
    name: requiredText.optional(),
}).refine(value => Object.values(value).some(v => v !== undefined), '至少指定一项变更');
/** expected 是客户端读取的配置修订；CAS 与管理员校验仍由用例和 Store 完成。 */
export const configureSchema = z.strictObject({
    expected: revision,
    omSource: requiredText,
    branch: requiredText,
    root: requiredText,
    connections: z.array(requiredText),
});
/** 环境配置不携带秘密值；此处不接受数值/布尔值自动强制转换，避免模糊配置。 */
export const bootstrapConfigSchema = z.strictObject({
    host: requiredText.default('127.0.0.1'),
    port: z.number().int().min(1).max(65535).default(8010),
});
