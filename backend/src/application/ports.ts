/**
 * Application 出口合同：定义用例需要外部机制保证什么，不指定供应商 API。
 * 所有 userId/运行调用身份来自可信入口，不能直接信任模型或请求体。读取结果不自动赋权，跨存储失败须显式保留未知/未交付。
 */
import type { User, Execution, Project, Creation, DecisionRequest, UserDecision, SteeringInput, Input, Upload, Method, Settings, Json } from '../domain/model';
/**
 * 本地命令幂等身份。Store 按用户、操作类型及 key 隔离；同键同 fingerprint 返回原结果，同键异内容冲突。不是业务 task.id 或外部操作幂等键。
 */
export interface Key {
    userId: string;
    key: string;
    /**
     * 确定性 JSON 内容编码；用于同键异内容比较，不是密码学签名。
     */
    fingerprint: string;
}
/**
 * 时间和标识生成的注入端口，便于确定性测试。生产实现须提供稳定唯一 ID 和 UTC 时间；内层不直接调用随机数或系统时钟。
 */
export interface Support {
    /**
     * 生成稳定内部标识；重试身份应由原命令/信封查回，而不是每次重新生成。
     */
    id(): string;
    /**
     * 提供可持久的 UTC 时间字符串，测试可注入固定时钟。
     */
    now(): string;
}
/**
 * 供应用用例使用的控制记录读取端口，不是可直接暴露给客户端的查询 API。集合可能包含多个用户，读取用例必须校验资格并过滤归属后才返回。
 */
export interface Reads {
    /**
     * 按本地 ID 读取用户快照；不存在应拒绝。读取本身不证明启用或管理员资格。
     */
    user(id: string): Promise<User>;
    /**
     * 返回本地用户快照集合，仅允许账户管理用例在管理员校验后对外呈现。
     */
    users(): Promise<User[]>;
    /**
     * 按 ID 返回控制快照，调用用例负责归属预检。不得混入 SDK 对象或业务完成结果。
     */
    execution(id: string): Promise<Execution>;
    /**
     * 供用例计算可见范围与账户责任；不得直接作为客户端全局执行列表。
     */
    executions(): Promise<Execution[]>;
    /**
     * 读取分组快照；用例须按本人可见 Execution 过滤分组及计数。
     */
    projects(): Promise<Project[]>;
    /**
     * 读取请求及 Context 修订历史；必须沿 executionId 校验内容访问。
     */
    request(id: string): Promise<DecisionRequest>;
    /**
     * 返回指定执行的请求，不按 Agent 采纳情况重算已回答状态。
     */
    requests(executionId: string): Promise<DecisionRequest[]>;
    /**
     * 按请求读取固定提交及更正，不覆盖历史或把事后解释署为用户原话。
     */
    decisions(requestId: string): Promise<UserDecision[]>;
    /**
     * 读取稳定投递信封及本地交付确认，不代表 Agent 已理解。
     */
    input(id: string): Promise<Input>;
    /**
     * 读取执行内持久顺序，供按序交付及 Finish 原子检查；不能只依赖进程内队列。
     */
    inputs(executionId: string): Promise<Input[]>;
    /**
     * 读取已固定文件的描述，调用用例必须校验上传者和执行范围。
     */
    upload(id: string): Promise<Upload>;
    /**
     * 读取同一配置版本快照，启动准备提交时还需比较该版本。
     */
    settings(): Promise<Settings>;
    /**
     * 按用户/操作/key 查命令结果，重查当前资格；同键异 fingerprint 冲突，undefined 仅表示无原提交。不得借缓存绕过访问限制。
     */
    replay<T>(operation: string, key: Key): Promise<T | undefined>;
}
// All writes are atomic, recheck enabled user/ownership at commit, CAS expected versions,
// enforce uniqueness and command fingerprints; duplicate commands return their original value.
// Production adapters must additionally recheck file scope, account responsibility protection,
// runtime generation and sequence assignment inside each atomic commit.
// Production adapters must run the same contract suite as the test store.
/**
 * 控制记录的命名原子提交端口；事务、CAS、唯一约束和 Outbox 持久化由适配器拥有，不向内层暴露 SQL 或万能事务回调。
 * 每次提交须重查当前用户资格/归属、预期版本、文件范围、运行代次及适用的账户责任保护。检查与写入必须原子完成；重复命令返回原结果，失败不能留下局部写入。
 * 测试替身只说明目标语义，不能证明生产数据库的并发、断电或跨存储保证。
 */
export interface ControlStore extends Reads {
    /**
     * 原子按 issuer/subject 查找或创建。并发初建只能一条记录，已有用户的停用与管理员权限不得被 candidate 覆盖。
     */
    ensureUser(candidate: User): Promise<User>;
    /**
     * 原子重查命令、查找/创建唯一 Project、固定 Execution 输入及创建结果。组名重试不改写，task.id 不代替幂等键。
     */
    createExecution(key: Key, project: Project, execution: Execution): Promise<Execution>;
    /**
     * 原子比较 Execution 的 expected 及配置 settingsVersion，固定 Method 和唯一开始消息；不得重复准备或静默切换 SHA。
     */
    prepare(userId: string, expected: number, settingsVersion: number, execution: Execution, start: Omit<Input, 'sequence'>): Promise<Execution>;
    /**
     * 原子检查当前运行代次、去重并保存问题及 Context；请求 ID 同时提供一一 Episode 定位，不生成另一套判断记录。
     */
    createRequest(key: Key, generation: number, request: DecisionRequest): Promise<DecisionRequest>;
    /**
     * 检查请求 expected 版本及当前 generation 后追加阅读修订；原回答和旧版本必须保留。
     */
    refreshContext(userId: string, generation: number, expected: number, request: DecisionRequest): Promise<DecisionRequest>;
    /**
     * 单一事务提交回答、更正关联、已回答状态、固定文件绑定、顺序化输入/Outbox 和命令结果。提交前重查归属/文件/版本，失败全部回滚。
     */
    submitDecision(key: Key, expected: number, request: DecisionRequest, decision: UserDecision, input: Omit<Input, 'sequence'>): Promise<UserDecision>;
    /**
     * 原子固定一般消息、文件绑定、投递意图及幂等结果；允许结束后收消息、取消中排队，但不改变 DecisionRequest 状态。
     */
    submitSteering(key: Key, steering: SteeringInput, input: Omit<Input, 'sequence'>): Promise<SteeringInput>;
    /**
     * 保存 Runtime 已持久接收的稳定 receipt；重复确认安全。不可在 Runtime 接收前标记，失败后仍能按原 inputId 查回。
     */
    markDelivered(userId: string, inputId: string, receipt: string): Promise<void>;
    /**
     * 以 expected CAS 更新运行控制；保持 owner/Session/Workspace/Method 不变。requireNoPending 时必须原子检查无未交付输入，不能先查后盲写。
     */
    transition(userId: string, expected: number, execution: Execution, requireNoPending?: boolean): Promise<Execution>;
    /**
     * 重查用户/执行范围后保存已固定字节的描述，不建立指向未完成上传的正式绑定。
     */
    saveUpload(userId: string, file: Upload): Promise<Upload>;
    /**
     * 按用户资格和 expected 版本只更新本人偏好，不重置身份、启用状态或管理员权限。
     */
    updatePreferences(userId: string, expected: number, preferences: import("../domain/model").Preferences): Promise<User>;
    /**
     * 以 expected 比较只修改显示名及版本，不修改稳定身份和权限。
     */
    updateProfile(userId: string, expected: number, name: string): Promise<User>;
    /**
     * 原子重查管理员、目标版本、最后有效管理员及责任保护；不能把用例中的预检当成并发提交保证。
     */
    manageUser(actorId: string, expected: number, user: User): Promise<User>;
    /**
     * 原子比较 expected 并校验管理员后保存配置；不得修改已固定的执行版本。
     */
    saveSettings(actorId: string, expected: number, settings: Settings): Promise<Settings>;
}
/**
 * 验证可信集成方 token 并获取稳定用户信息。认证机制留在适配器；返回用户不等于已获本地使用资格。token 不得进入领域记录、模型或 Session。
 */
export interface Identity {
    /**
     * 验证 token 的可信来源/有效性并取稳定用户信息，失败应抛出可映射错误。不自动赋予本地资格，不记录或透传 token。
     */
    verify(token: string): Promise<{
        issuer: string;
        subject: string;
        name: string;
    }>;
}
/** 独立本机运维能力，仅供持有数据库 OS 权限的命令使用；不得注册到应用 HTTP/MCP 或普通 AdapterBindings。 */
export interface LocalAccountAdministration {
    /** 原子提升已有启用用户；重复提升幂等，不创建用户、不解除停用、不修改其他资料。 */
    grantAdministrator(userId: string): Promise<void>;
}
/**
 * 同一 Execution/Session 的运行与持久输入接收端口。适配器负责会话分配查回、单运行持有者、代次隔离、接收去重及停止确认。
 * SDK 的实际能力必须通过合同测试，不因此接口存在就宣称具备恢复或 exactly-once 业务效果。
 */
export interface Runtime {
    /** 仅判断两个回答是否路由到独立局部工作；无法证明时返回 false。控制消息仍由用例保持全局顺序。 */
    independentAnswers?(e: Execution, earlier: Input, later: Input): Promise<boolean>;
    /**
     * 按已持久稳定 Session 标识分配或查回同一会话；本地确认前不可激活孤立候选，不通过新会话替代无法恢复的历史。
     */
    ensure(e: Execution): Promise<void>; // stable Session allocation, no activated orphan
    /**
     * 对同一 generation 幂等启动或修复工作循环，确保唯一运行持有者。禁止新旧运行同时推进同一 Workspace。
     */
    start(e: Execution): Promise<void>; // idempotent per generation, single holder
    /**
     * 查询原 inputId 是否已持久接收。undefined 必须证明未接收；查询超时/状态未知应抛错，不能转换为 undefined 诱发重复发送。
     */
    accepted(sessionId: string, inputId: string): Promise<string | undefined>; // undefined proves not accepted; unknown must throw
    /**
     * 向同一 Session 交付信封并返回持久接收凭据；相同 inputId 必须去重，返回不代表 Agent 已执行或业务成功。
     */
    deliver(e: Execution, input: Input): Promise<string>; // durable dedup by inputId
    /**
     * 可重试请求停止当前运行。返回只说明请求动作完成，实际退出由 stopped 另行确认；不可承诺撤回外部网络请求。
     */
    stop(e: Execution): Promise<void>;
    /**
     * 核验当前代次运行实例已实际退出，不能以空闲、连接断开或 stop 已返回代替退出事实。
     */
    stopped(e: Execution): Promise<boolean>;
}
/**
 * Execution 持续文件空间及工具进程的端口。运行恢复和容器回收不能悄悄换成空目录，路径与真实字节交付由适配器保证。
 */
export interface Workspace {
    /**
     * 查回或准备该 Execution 持续目录，不因续行换空目录；宿主路径由可信映射生成。
     */
    ensure(e: Execution): Promise<void>;
    /**
     * 把固定 Upload 字节交付到该执行可读位置，校验内容/路径及范围；重复物化安全，失败不伪报可读。
     */
    materialize(e: Execution, files: Upload[]): Promise<void>;
    /**
     * 确认旧代次的文件/Bash/容器进程已退出；Runtime 停止不自动证明工具也退出。
     */
    stopped(e: Execution): Promise<boolean>;
}
/**
 * 将上传字节固定保存的端口。返回内容身份而非任意宿主文件路径；本地 Blob 或对象存储均可实现，不在用例内引入业务资料登记流程。
 */
export interface Files {
    /**
     * 固定字节并返回实际 SHA-256、大小及受控内容引用。失败不返回可用引用，孤立但完整内容可后续清理；不负责输入事务绑定。
     */
    put(bytes: Uint8Array): Promise<{
        hash: string;
        size: number;
        contentRef: string;
    }>;
}
/**
 * 当前来源能力及不含秘密的禁用原因；UI 可以据此提示，但服务端仍必须拒绝禁用操作。
 */
export interface MethodSourceStatus {
    source: string;
    kind: 'managed' | 'local';
    /** 能力是否可用，不表示当前网络可达；提示不含仓库 URL、凭据或宿主路径。 */
    sync: { enabled: boolean; remote?: string; branch?: string; reason?: 'no-remote' | 'ambiguous-remote' | 'unsupported-remote'; message?: string };
}

/** 固定版本 OM 出口；受管来源确认远端，本地来源确认本地配置分支，不把缓存冒充最新或访问作者材料。 */
export interface Methods {
    /**
     * 确认配置分支的提交及 Root。受管来源须联网确认最新，本地来源只读本地已提交版本、不自动 fetch；无法确认时拒绝。
     */
    latest(settings: Settings): Promise<Method>;
    /** 查询同步能力与禁用提示；不联网，不把没有 remote 当作本地 OM 无法使用。 */
    status(settings: Settings): Promise<MethodSourceStatus>;
    /** 显式同步并返回固定版本；禁用时拒绝。本地仅安全快进，不覆盖修改、不自动 checkout/stash/reset，不发布或推送。 */
    sync(settings: Settings): Promise<Method>;
    /**
     * 读取指定来源/SHA 内允许文件，校验来源快照及路径，禁止 .ome/、越界和符号链接逃逸。
     */
    read(method: Method, path: string): Promise<string>;
    /**
     * 只搜索指定快照的文件名/路径/正文，排除 .ome/；返回稳定定位，不混合不同版本。
     */
    search(method: Method, query: string): Promise<{
        path: string;
        excerpt: string;
    }[]>;
    /**
     * 读取受配置管理的仓库历史，不代替 Git Review 或在平台内发布方法。
     */
    history(source: string): Promise<Json>;
}
/**
 * 历史或操作视图的一页结果。complete 描述读取覆盖，不等同于没有下一页；cursor 是继续读取位置，limitations 必须如实表达缺失、脱敏和索引滞后。
 */
export interface Page<T> {
    items: T[];
    /**
     * 不透明续读位置，适配器须限定 Session 与过滤条件，不能代替授权。
     */
    cursor?: string;
    /**
     * 本次读取是否具备声明范围的完整覆盖；不能用空 items 推断未发生事件。
     */
    complete: boolean;
    /**
     * 清理、脱敏、缺失或索引未同步等读取限制。
     */
    limitations: string[];
}
/**
 * Session 的一条可定位历史记录。是唯一执行历史的读取数据，不是另一种 TrajectoryEvent 领域实体；关联只来自实际记录。
 */
export interface SessionRecord {
    id: string;
    at: string;
    kind: string;
    inputId?: string;
    /**
     * 明确记录的判断请求关联，不以内容相似度补造因果。
     */
    requestId?: string;
    userDecisionId?: string;
    data: Json;
}
/**
 * Session 内的 MCP 调用事实/读取视图，不是业务操作账本。分类保留当时声明；calling 或传输返回均不自动代表业务成功，未知效果不能盲重试。
 */
export interface CallRecord {
    id: string;
    sessionId: string;
    connection: string;
    tool: string;
    at: string;
    /**
     * 当次服务声明或连接配置分类；缺少可靠声明时 unknown，不凭名字猜测。
     */
    type: 'read' | 'write' | 'unknown';
    /**
     * 当时分类的声明/配置来源，后改配置不重写历史。
     */
    classificationSource?: string;
    schemaRevision: string;
    /**
     * 写入前脱敏的结构化参数，不含 token/秘密。
     */
    parameters: Json;
    result?: Json;
    /**
     * 调用结果确认程度；calling 中断后不能按未发生自动重试。
     */
    status: 'calling' | 'success' | 'failed' | 'unknown';
    /**
     * 仅在有明确重试来源时关联原调用，不用参数相同推断。
     */
    retryOf?: string;
    requestId?: string;
    userDecisionId?: string;
}
/**
 * Session 历史读写与可重建查询索引的出口。保证稳定定位和覆盖限制；不建立独立权威轨迹，写入前必须脱敏。
 */
export interface History {
    /**
     * 按稳定 Session 游标读取历史；报告不可读/已清理/滞后限制，游标不可允许跨会话越权读取。
     */
    page(sessionId: string, cursor?: string): Promise<Page<SessionRecord>>;
    /**
     * 读取同一 Session 的调用视图。unknownCount 按相同范围统计、不因写筛选而消失；无法完整计算时返回 null 并说明覆盖限制。
     */
    calls(sessionId: string, type?: CallRecord['type'], cursor?: string): Promise<Page<CallRecord> & {
        unknownCount: number | null;
    }>;
    /**
     * 按 Session 和稳定调用 ID 查原记录；undefined 只表示不存在。读取失败应抛错，不能以未找到触发再次派发。
     */
    call(sessionId: string, callId: string): Promise<CallRecord | undefined>;
    /**
     * 真正网络派发前持久追加脱敏发起记录，Session/callId 唯一。失败必须阻止派发；重复 ID 需明确冲突，不能静默允许两次调用。
     */
    appendCall(call: CallRecord): Promise<void>; // durable before dispatch; no separate business ledger
    /**
     * 在原调用上记录返回或未确认结果；保持分类、Schema 和发起参数历史。写入失败须传播，不伪称结果已保存。
     */
    finishCall(sessionId: string, id: string, status: CallRecord['status'], result: Json): Promise<void>;
}
/**
 * 按执行用户访问动态工具的机制端口，不解释 CertLab 等外部业务模型。秘密由宿主注入；未知结果及原调用恢复遵循服务合同。
 */
export interface Mcp {
    /**
     * 以执行用户发现配置连接的工具。Schema/分类来源来自服务或显式配置，缺少分类保留未知。
     */
    tools(userId: string, connection: string): Promise<{
        name: string;
        schemaRevision: string;
        classification?: 'read' | 'write';
        classificationSource?: string;
    }[]>;
    /**
     * 在参数/结果进入 Session 或模型前移除秘密，保留可解释限制。不是事后仅对前端遮盖，也不用于推断业务成功。
     */
    sanitize(connection: string, value: Json): Json; // strips secrets BEFORE Session/model storage
    // Revalidate this execution generation immediately before network dispatch. Never auto-retry writes.
    /**
     * 派发前在宿主重查 scope 当前用户及运行代次/取消栅栏，再注入相应连接凭据。原始参数仅用于工具执行；无自动写重试，无管理员或共享身份回退。
     * 返回 success/failed/unknown 按服务可确认语义解释，不能只凭传输正常就标业务成功。
     */
    call(scope: {
        userId: string;
        executionId: string;
        sessionId: string;
        generation: number;
    }, connection: string, tool: string, parameters: Json): Promise<{
        status: 'success' | 'failed' | 'unknown';
        result: Json;
    }>;
}
export type { Creation };
