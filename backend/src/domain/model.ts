/**
 * Domain：稳定概念与纯规则。不得依赖 Application、HTTP、ORM、Runtime SDK 或文件系统。
 * 类型描述快照，不自行持久化；涉及当前资格和并发的规则必须在应用提交边界再次兑现。
 */
/**
 * 跨边界可序列化的数据值。业务 task、Context 与工具载荷以此承载；不接收 ORM/SDK 对象，也不在其中授予身份或权限。
 */
export type Json = null | boolean | number | string | Json[] | {
    [key: string]: Json;
};
/**
 * 领域与用例可识别的失败。code 表达规则类别，适配器负责映射 HTTP/MCP 错误；unknown 表示未能确认结果，不能直接按失败重试外部写入。
 */
export class RuleError extends Error {
    constructor(public readonly code: 'invalid' | 'forbidden' | 'not-found' | 'conflict' | 'blocked' | 'unknown', message: string = code) { super(message); }
}
/**
 * 集中抛出规则失败，并为 TypeScript 收窄类型。只表达当前条件，不做 I/O、不回滚已发生的外部效果。
 */
export function requireRule(ok: unknown, code: RuleError['code'], message?: string): asserts ok {
    if (!ok)
        throw new RuleError(code, message);
}
/**
 * 用户的显示与站内提示偏好，不参与执行权限、请求回答状态或通知投递保证。
 */
export interface Preferences {
    language: string;
    timezone: string;
    notify: {
        decision: boolean;
        anomaly: boolean;
        result: boolean;
    };
}
/**
 * 集成方身份在本地的用户记录；唯一身份为 issuer + subject。enabled/admin 由 Airic Work 管理，再次认证不得重置；管理员也不继承他人执行内容权限。
 */
export interface User {
    preferences?: Preferences;
    id: string;
    /**
     * 可信认证来源，与 subject 联合识别用户，不是显示名称。
     */
    issuer: string;
    /**
     * 集成方稳定用户标识；姓名或邮箱变化不改变映射。
     */
    subject: string;
    name: string;
    /**
     * 本地使用资格，再次认证不得重置为启用。
     */
    enabled: boolean;
    /**
     * 仅平台管理权限，不扩大执行内容读取范围。
     */
    admin: boolean;
    /**
     * 账户记录 CAS 版本，不是认证 token 的版本。
     */
    version: number;
}
/**
 * 调用方定义的执行分组。source + externalId 唯一；name 仅用于显示。没有权威业务完成状态，也不负责子任务调度。
 */
export interface Project {
    id: string;
    source: string;
    externalId: string;
    name: string;
}
/**
 * 创建 Execution 时固定的原始输入。source 必须由可信入口注入，不从 task 或模型指令推断；业务关联与创建命令幂等键分开。
 */
export interface Creation {
    /**
     * 可信接入上下文提供的业务实例标识，不从自定义 task 读取。
     */
    source: string;
    project_id: string;
    project_name: string;
    /**
     * 调用方 JSON 快照；id 是业务关联，不是创建幂等键。
     */
    task: {
        [key: string]: Json;
    };
    /**
     * 描述本次目标、范围与分工，交给 Agent 理解，不替代授权。
     */
    instruction: string;
}
/**
 * 执行实际使用的方法与环境版本快照。不是完整 OM 内容，也不是发布审批对象；执行续行不得静默替换这些版本。
 */
export interface Method {
    source: string;
    sha: string;
    root: string;
    runtimeVersion: string;
    skillVersion: string;
}
/**
 * 平台管理的一次可持续执行。ownerId 为发起用户且不可被续行改写；一个 Execution 对应同一 Session、Workspace 和首次准备后固定的 Method。
 * phase 只描述运行控制，不代表外部业务完成；generation 用于阻断旧运行，version 用于本地并发比较。
 */
export interface Execution {
    id: string;
    projectId: string;
    ownerId: string;
    creation: Creation;
    /**
     * 稳定逻辑 Session 标识，Trajectory 是其别名；SDK 重启不换此关联。
     */
    sessionId: string;
    /**
     * 同一执行的持续文件空间标识，运行代次变化不重建。
     */
    workspaceId: string;
    /**
     * 首次准备成功后固定；new 阶段可以不存在，恢复不静默改用最新版。
     */
    method?: Method;
    /**
     * 运行控制阶段，不是业务完成状态；ended/stopped/failed 后仍可接受续行输入。
     */
    phase: 'new' | 'running' | 'ended' | 'stopping' | 'stopped' | 'failed';
    /**
     * 每次新运行递增的栅栏代次，旧 worker 不能借旧代次恢复动作资格。
     */
    generation: number;
    /**
     * 本地控制记录的 CAS 修订，与 generation 和 Git SHA 分别表达。
     */
    version: number;
}
/**
 * Decision Context 的一份固定阅读修订。sources 是来源定位，不自动赋予原文读取权限；刷新追加修订，旧版本仍可作为用户回答依据。
 */
export interface Context {
    revision: number;
    content: Json;
    sources: {
        system: string;
        objectId: string;
        version?: string;
        location?: string;
    }[];
}
/**
 * 单个 DecisionRequest 的候选回答。解释选项含义，不代表后台一定成功执行所述动作，也不代用户预选或提交。
 */
export interface Option {
    id: string;
    label: string;
    description: string;
}
/**
 * 必须由 Execution 归属人回答的具体问题。Decision Brief 是其 Context 的呈现，Decision Episode 是其生命周期查询，不额外建采纳/专业解决状态机。
 */
export interface DecisionRequest {
    id: string;
    executionId: string;
    /** 列表中的简短问题标题；完整问题保留在 question。历史请求未提供时由呈现层生成摘要。 */
    summary?: string;
    question: string;
    options: Option[];
    /**
     * 追加式阅读修订；不能只留最新一份而丢失 UserDecision 实际依据。
     */
    contexts: Context[];
    /**
     * 仅表示是否已保存用户回答，与专业问题解决、Agent 采纳及业务成功无关。
     */
    status: 'pending' | 'answered';
    createdAt: string;
    /**
     * 首次成功保存回答时间，更正不覆盖。
     */
    answeredAt?: string;
    version: number;
}
/**
 * 用户对一个 DecisionRequest 的不可覆盖提交。保存成功即已回答；消息到达、Agent 采纳及业务成功均是另外的事实。补充/更正追加记录。
 */
export interface UserDecision {
    id: string;
    requestId: string;
    userId: string;
    text: string;
    optionId?: string;
    /**
     * 用户实际查看的已保存修订，可以小于当前最新版本。
     */
    contextRevision: number;
    /**
     * 固定 Upload ID 集合，不是任意路径或外部业务资料 ID。
     */
    files: string[];
    /**
     * 同一请求内被更正的原提交 ID；追加记录，不覆写旧内容。
     */
    correctionOf?: string;
    at: string;
}
/**
 * DecisionRequest 流程之外的一次任意工作消息，可带文件并触发原执行续行，不自动转为 UserDecision 或解除待回答请求。
 */
export interface SteeringInput {
    id: string;
    executionId: string;
    userId: string;
    text: string;
    files: string[];
    at: string;
}
/**
 * 向同一 Session 投递的技术信封，并非新增业务工作实体。与 UserDecision/Steering Input 原始记录分开；稳定 id 支持去重和接收结果查回。
 */
export interface Input {
    /**
     * 稳定 Runtime 输入去重键；网络重试及丢确认查回必须沿用。
     */
    id: string;
    executionId: string;
    sessionId: string;
    userId: string;
    kind: 'start' | 'user-decision' | 'steering';
    /**
     * 对应 Execution 开始输入、UserDecision 或 Steering Input 的稳定记录 ID。
     */
    sourceId: string;
    text: string;
    files: string[];
    /**
     * Store 原子分配的执行内顺序，禁止仅用进程内到达顺序。
     */
    sequence: number;
    /**
     * delivered 仅代表 Runtime 已持久接收，pending 包含待重试情况。
     */
    status: 'pending' | 'delivered';
    /**
     * Runtime 持久接收凭据，不是外部业务回执。
     */
    receipt?: string;
}
/**
 * 已固定上传字节的描述与访问范围；不是外部业务资料实体。Blob 先写后绑定，contentRef 由宿主管理，不接受用户指定任意宿主路径。
 */
export interface Upload {
    id: string;
    userId: string;
    executionId: string;
    name: string;
    /**
     * 固定字节的内容哈希，生产 Files 实现须计算真实 SHA-256。
     */
    hash: string;
    size: number;
    /**
     * 受控 Blob 引用，不得解释为用户可自选宿主路径。
     */
    contentRef: string;
}
/**
 * 当前实现覆盖的实例控制配置。version 用于并发与启动准备比较；变更只影响后续准备，不改写已有 Execution 的固定方法。秘密配置不放入此类型。
 */
export interface Settings {
    /**
     * 配置 CAS 修订；准备方法后提交时复查，避免切源竞争。
     */
    version: number;
    omSource: string;
    branch: string;
    root: string;
    connections: string[];
}
/**
 * 要求用户当前启用且是唯一归属人；不设置管理员旁路。提交时 Store 仍需重查，避免预检后的资格变化。
 */
export function own(user: User, e: Execution): void { requireRule(user.enabled && user.id === e.ownerId, 'forbidden'); }
/**
 * 只允许当前运行代次执行受控动作。取消中、已结束或旧 generation 均被阻断；网络派发前宿主仍须复查。
 */
export function active(e: Execution, generation: number): void { requireRule(e.phase === 'running' && e.generation === generation, 'blocked', 'stale or inactive runtime'); }
/**
 * 检查必填文字存在实质内容；不替代 transport Schema 对完整输入类型及大小的校验。
 */
export function nonempty(value: string): void { requireRule(typeof value === 'string' && value.trim().length > 0, 'invalid'); }
/**
 * 验证通用创建输入；不解释 task 的业务字段，也不核验外部业务是否已完成。
 */
export function creationValid(c: Creation): void { [c.source, c.project_id, c.project_name, c.instruction].forEach(nonempty); requireRule(c.task && !Array.isArray(c.task) && typeof c.task === 'object', 'invalid'); }
/**
 * 在内层拒绝绝对路径、反斜杠、越级及 .ome/ 作者路径。真实路径归一化、符号链接及文件访问隔离仍由适配器兑现。
 */
export function runtimePath(path: string): void { requireRule(!!path && !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(p => ['..', '.ome', ''].includes(p)), 'invalid', 'outside OM runtime files'); }
/**
 * 将 JSON 数据按对象键排序编码，作为本地命令内容比较依据。不是密码学哈希，不用于证明文件完整性；不可序列化值会拒绝。
 */
export function canonical(value: unknown): string {
    if (Array.isArray(value))
        return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object')
        return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
    const encoded = JSON.stringify(value);
    requireRule(encoded !== undefined, 'invalid');
    return encoded;
}
/**
 * 验证回答引用的历史 Context 和可选选项，返回新的已回答请求快照。允许基于旧修订回答，保留首次 answeredAt；本函数不写库或发送消息。
 */
export function answer(r: DecisionRequest, d: UserDecision): DecisionRequest {
    nonempty(d.text || d.optionId || (d.files.length ? 'file' : ''));
    requireRule(r.contexts.some(c => c.revision === d.contextRevision), 'invalid', 'unknown reading version');
    if (d.optionId)
        requireRule(r.options.some(o => o.id === d.optionId), 'invalid');
    return { ...r, status: 'answered', answeredAt: r.answeredAt ?? d.at, version: r.version + 1 };
}
/**
 * 在已固定方法、且非运行/取消中的执行上开启新运行代次。沿用原 Session/Workspace；实际进程互斥及停止确认由用例和 Runtime 端口负责。
 */
export function beginRun(e: Execution): Execution {
    requireRule(e.method && ['new', 'ended', 'stopped', 'failed'].includes(e.phase), 'blocked');
    return { ...e, phase: 'running', generation: e.generation + 1, version: e.version + 1 };
}
/**
 * 当前运行显式结束，不判定业务完成，也不永久关闭输入入口。用例还必须要求 Store 原子检查不存在未交付输入。
 */
export function endRun(e: Execution, generation: number): Execution { active(e, generation); return { ...e, phase: 'ended', version: e.version + 1 }; }
/**
 * 生成取消中的控制快照以先关闭新动作资格。它既不停止进程，也不撤回已发出的业务请求。
 */
export function beginStop(e: Execution): Execution { return { ...e, phase: 'stopping', version: e.version + 1 }; }
/**
 * 仅从 stopping 记录已停止；实际 Runtime 和容器退出事实必须由调用用例先取得，不能只凭调用 stop 成功。
 */
export function recordStopped(e: Execution): Execution { requireRule(e.phase === 'stopping', 'conflict'); return { ...e, phase: 'stopped', version: e.version + 1 }; }
