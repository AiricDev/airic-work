# Airic Work 技术设计

| 项 | 内容 |
| --- | --- |
| 日期 | 2026-10-30 |
| 状态 | 目标设计；第一阶段 Domain/Application 已完成内层实现与测试，真实适配器及集成仍未交付 |
| 产品依据 | [PRD](prd.md) 中的 Ontology、Functional Requirements、User Experience 和核心验收 |
| 设计范围 | 架构、用例与端口、身份接入、运行与消息交付、Session、Workspace、MCP、接口与 UI 技术约束、存储与恢复 |
| 实现证据 | 当前证据见 [第一阶段报告](backend-phase1-report.md)；历史 M1/fake-port 或 spike 结论仅适用于当时合同，不代表真实适配器已交付 |
| Worker 与环境细化 | [Worker Skill 与 Pi Durable Agent 工作环境](worker-runtime-design.md)：常驻 Skill、能力映射、输入信封、容器与待验证合同 |

产品语义由 PRD 定义。本文说明怎样实现，不重新增加用户角色、业务实体或专业采纳流程。原型与现有代码用于识别差异，不自动成为新合同。文中的端口名、技术字段和 HTTP 路径是目标设计，不声明当前 SDK 已支持或当前服务已提供。

## 1. 产品约束与技术责任

### 1.1 必须兑现的关系

* 发起用户就是 Execution 唯一归属人。集成方 token 获取用户信息，首次有效请求自动创建本地 User 并获得使用资格；Airic Work 管理本地启用状态与管理员权限。
* 一个 Project 组织多个 Execution；同一业务任务的分工在 `instruction` 中描述，平台不自动建立依赖、调度或合并结果。
* 一个 Execution 对应一个 Session（亦称 Trajectory）和一个 Workspace；首次实际启动固定 OM 来源与 Commit SHA。
* UserDecision 提交成功即将 DecisionRequest 标记为已回答；回答保存、消息交付、Agent 继续和业务效果是不同事实。
* 一个 DecisionRequest 对应一个 Decision Episode，后者是其生命周期查看方式及关联记录，不独立抽取自主判断。
* UserDecision 和 Steering Input 都是发送给该执行 Agent 的输入。Execution 结束后可以继续原执行，沿用原 Session、Workspace、用户和 OM 版本。
* Session 是执行历史的唯一事实来源；MCP 操作列表是它的查询视图，不另建业务轨迹、操作账本或审计实体。
* Git 管理 OM；`.ome/` 是本地作者目录，不提交、不同步、不浏览、不检索、不加载。
* 外部 MCP 拥有业务能力合同。Airic Work 不内置 CertLab、Assessment、TestTask/Finding、业务资料修订或业务回执模型。

### 1.2 权威来源与持久化边界

| 内容 | 权威来源 | 本地责任 |
| --- | --- | --- |
| 用户外部身份 | 可信集成方的用户信息接口或验证机制 | 稳定用户映射；本地使用资格和管理员权限 |
| Project、Execution、DecisionRequest、UserDecision、Steering Input | Airic Work 应用数据库 | 归属、不可变提交、回答事实、消息交付意图及并发控制 |
| Agent 消息、工具调用及结果 | Execution 的持久 Session | 查询、补读、索引、来源关联及覆盖限制 |
| Decision Episode | 对应 DecisionRequest 的生命周期及相关 Session 记录 | 一一关联及组合查询，不复制一份判断历史 |
| 上传文件 | 固定上传内容及其输入关联 | Blob 保存、Workspace 交付及可用性说明 |
| 工作文件 | Execution 持续 Workspace | 隔离、恢复和备份；不升格为业务成果记录 |
| OM 文件 | Git 固定提交 | 快照、检索、实际加载记录与历史引用 |
| 业务状态与效果 | 外部 MCP 服务 | 在 Session 保留调用事实和服务返回，不另建平台业务状态机 |

## 2. 技术选型与运行形态

保留既有架构选型，精确版本在实现时锁定并验证。变更框架或存储不能改变上述产品关系。

| 能力 | 首版选择 | 责任边界 |
| --- | --- | --- |
| 后端 | TypeScript 模块化单体；单控制面进程 | Domain、Application 可独立测试 |
| HTTP | Fastify | 协议解析、身份接入、DTO 与错误映射 |
| 接口定义 | Zod；入口 Schema 与 transport contracts | 不进入 Domain 或 Application；当前入口校验位于 adapters/driving/validation |
| 依赖装配 | Awilix；组合根 CLASSIC + strict | 服务通过构造函数显式注入所需端口；容器不进入内层，不注册可变 currentUser |
| 应用存储 | SQLite WAL、Drizzle、better-sqlite3 | 控制记录、本地事务、Outbox、可重建读取索引 |
| 异步交付 | 同库 Outbox、进程内 worker | 持久意图、认领、重试、对账，不引入外部队列 |
| Agent Runtime | Pi Durable；模型调用采用其兼容生态（含 pi-ai） | 每 Execution 一个逻辑 Session 和独立 Pi 存储；SDK 能力需锁版验证 |
| 执行环境 | Docker，优先验证 pi-env 标准输入输出接入 | 文件工具和 Bash 在受限容器；模型、MCP、凭据及存储由可信宿主管理 |
| 文件 | 本地 SHA-256 内容寻址 Blob；Execution 持续目录 | 上传内容固定，Workspace 独立；未来可替换对象存储 |
| OM | Git mirror、固定 SHA 快照 | 不复制 Git Review 或发布审批 |
| 检索 | SQLite FTS5 trigram；短查询固定快照内 LIKE 回退 | 无 embedding 或向量库，中文与短查询需验证 |
| 身份 | 集成方 token 验证及用户信息适配器 | 不另建独立 OIDC 用户登录、密码、业务委托或外部授权产品流程 |
| 前端 | React、TypeScript、MUI、Vite、React Router | 保留已确认界面约束；服务端记录与本地草稿分开 |
| 前台更新 | SSE 通知及查询刷新 | SSE 不是权威记录，断线后重新查询 |
| 运维 | 结构化日志、OpenTelemetry、健康检查 | 技术诊断，不构成独立 Audit Record 产品模型；不存 token 或隐藏思考链 |

首版采用专用 Linux 节点，Fastify、worker、Pi Host 由同一 composition root 启停；工具容器不计入控制进程数。开发机可用 Docker Desktop 或等价环境，不因容器失败回退到宿主任意命令执行。暂不引入微服务、Kafka、向量库或 micro-VM；Docker 共享宿主内核，隔离保证以部署验证为准。

## 3. Clean Architecture 与能力边界

~~~text
入口适配器：HTTP / Runtime Tools / Workers / Airic Work MCP
                         ↓
Application：用例、查询、提交合同、出口端口
                         ↓
Domain：稳定对象、关系、不变量

出口适配器：SQLite / Pi Durable / Docker / Git / MCP / Blob / Identity
                         ↑ 实现 Application 端口
Composition Root：装配具体实现和管理生命周期
~~~

* Domain 不导入 HTTP、ORM、Pi SDK、文件系统或环境配置。
* Application 拥有端口，只依赖 Domain 和自身合同，不导入框架、SDK 或 transport DTO。
* 用例组织行为，Domain 维护不变量，Store 适配器落实本地事务；控制器、worker 和工具入口不能绕过用例写状态。
* Runtime tool 是入口适配器，Pi 执行器是出口适配器。两者通过显式应用合同协作，不直接维护第二套生命周期。
* 不为每个 Ontology 名词机械创建聚合或 Repository。Decision Brief 是呈现，Decision Episode 是关联查询，MCP 操作是 Session 视图。

| 应用能力 | 拥有的规则或行为 | 主要出口 |
| --- | --- | --- |
| account | 首次用户接入、使用资格、管理员保护和身份映射 | Identity、UserStore、CredentialProvider |
| execution | Project、创建输入、OM 固定、停止及消息续行 | ExecutionStore、MethodRevision、AgentRuntime、WorkEnvironment |
| decision | DecisionRequest、UserDecision、已回答事实和 Decision Episode 查询 | DecisionStore、输入交付、SessionReader |
| input | Steering Input、上传绑定、消息顺序与交付 | InputStore、BlobContent、Workspace、AgentRuntime |
| session | Session 查询、关联、MCP 操作读取及索引同步 | SessionReader、SessionIndex、RuntimeHistory |
| method | 单 OM 来源、文件、检索和固定快照 | Git、Search、MethodRevision |
| mcp | 动态工具发现、用户身份调用、调用记录及脱敏 | McpGateway、CredentialProvider、RuntimeHistory |
| settings | 连接、运行环境、通知偏好和保留配置 | SettingsStore、受控配置/秘密存储 |

目标目录保持 `domain/`、`application/`、`adapters/driving/`、`adapters/driven/`、`bootstrap/`，按上述能力组织。既有 `practice/`、账户委托、旧反馈及轨迹模块不能按目录直接继承合同，迁移时按实际职责收敛。形成真实入口后维护架构路由索引，不在本文宣称未实现目录已就绪。

## 4. 本地记录与不变量

### 4.1 控制记录

| 记录 | 必要内容及约束 |
| --- | --- |
| User | 本地 ID、认证来源、外部稳定用户 ID、启用状态、管理员权限及偏好；来源与外部 ID 组合唯一，重新认证不覆盖本地停用或管理员设置 |
| Project | 内部 ID、sourceSystemId、externalProjectId、名称；来源与外部分组标识唯一，重试不改名 |
| Execution | Project ID、ownerUserId、创建输入快照、固定方法及环境版本、Session/Workspace 关联、运行控制版本；归属和启动后 OM 不变 |
| DecisionRequest | Execution ID、问题、选项、Decision Context 修订、创建/展示/回答时间和必要消息引用；提交回答不依赖 Agent 采纳 |
| UserDecision | DecisionRequest ID、文字、选项、固定文件引用、查看的 Context 修订、提交人/时间及可选更正关联；提交后不可覆盖 |
| Steering Input | Execution ID、文字、固定文件引用、提交人/时间；没有必需 DecisionRequest ID，不自动转为 UserDecision |
| 上传内容与绑定 | 上传者、Execution 范围、哈希/大小/类型、完成状态和输入关联；同名文件不覆盖已提交内容 |

Decision Context 是 DecisionRequest 的版本化内容，来源引用在其中保存。Decision Brief 从中渲染，不另有状态。Decision Episode 以 DecisionRequest ID 建立一一映射；如需独立 URL ID，应有唯一约束，不保存另一套结论或自主判断集合。

### 4.2 技术运行记录

可以保存命令去重、Outbox、投递序号、运行租约、运行代次、绑定、Session 索引游标和文件交付状态。这些是机制，不是新增业务任务或结果实体。

* Execution 的“本轮运行结束”不表示永远不能接收输入。等待、空闲、停止、失败与用户是否已回答分别表达，最终 API 状态名不在此伪装为既有实现。
* 每次启动工作循环使用递增运行代次和唯一租约；同一 Execution/Session 同时只允许一个获准推进的宿主。代次阻止旧 worker 或旧容器在续行后取得动作资格。
* Runtime 绑定是宿主到同一 Session 的恢复映射，不是第二个业务身份或另一条 Session。恢复失败时阻塞并说明，不能静默创建新会话替代历史。
* 内部模型调用、上下文压缩和 SDK 运行片段不产生新的产品 Execution、Session 或 Workspace。SDK 不能兑现时调整适配方案，不能改变产品语义。

## 5. 用例、事务与执行顺序

### 5.1 用户接入和创建执行

1. 入口通过可信 token 验证机制获取稳定用户身份。外部网络验证不放入 SQLite 事务。
2. `EnsureUser` 按认证来源和外部 ID 查找或创建本地 User，并检查本地使用资格。并发首次接入依赖唯一约束；默认自动获得使用资格，不重置已有停用状态。
3. `CreateExecution` 校验输入，按已验证接入来源与 `project_id` 建组，固定输入快照，并以归属用户及操作类型限定创建幂等键。
4. 一次本地提交保存 Project/Execution、命令结果和准备意图；同键异内容冲突，同键同内容返回当前用户可读取的原结果。业务 `task.id` 不替代幂等键。
5. `PrepareExecution` 在事务外确认最新 Git SHA、Root 与环境能力，再 CAS 固定实际来源和版本。配置变动或无法确认最新时不静默启动。
6. 宿主按 Execution 稳定标识确保 Session 和 Workspace 存在；确认绑定、取得运行资格后投递开始消息。API 接受与实际启动分别可查。

`project_name` 仅用于初建，已有名称更新仍是产品规则待定，不因并发创建或重试静默重命名。平台不从 `task` 推断身份，不建立通用业务 Task 生命周期。

### 5.2 DecisionRequest、UserDecision 和 Decision Episode

1. Agent 通过受控工具调用 `CreateDecisionRequest`，入口注入当前用户、Execution 和 Session 调用引用，模型不能任意指定归属。
2. 同一本地事务固定问题、选项和 Decision Context，建立 Decision Episode 一一关联并保存 Session 通知意图。工具重放按稳定命令身份去重，不重复提问。
3. 查询生成 Decision Brief。实际向用户交付展示内容时记录对应 Context 修订及展示事实；不把查询成功当作已阅读证明。重复展示不重建 Decision Episode。
4. `SubmitUserDecision` 校验归属、实质输入及文件绑定；同一本地事务保存 UserDecision、将 DecisionRequest 置为已回答，并保存固定输入 ID 的 Outbox 消息。
5. 提交成功立即返回已回答，后台交付失败不撤销。补充/更正追加新 UserDecision 及消息，不覆盖原内容、不将原问题恢复为待回答。
6. Worker 将消息交给原 Session；Agent 如何解释、继续或发起新 DecisionRequest 由 OM 决定，不建立独立采纳状态机。
7. `QueryDecisionEpisode` 组合请求生命周期、Context 历史、UserDecision、交付事实和明确关联的 Session 消息。Session 未同步时显示限制，不补造结果。

来源版本变化不机械阻止回答，不撤销已保存反馈。用户所看版本必须留存；当前页面发生变化时保留草稿并提示。UserDecision 已回答、投递已接受及 Agent 实际继续分别输出，不合并为一个成功字段。

### 5.3 Steering Input 和通用输入交付

* `SubmitSteeringInput` 保存任意工作消息及可选文件，关联 Execution，创建 Outbox；不需要 DecisionRequest，也不更新其已回答状态。
* 输入信封包含稳定 inputId、Execution/Session、User 来源、类型、原始输入 ID、顺序及固定文件引用。UserDecision 额外携带 DecisionRequest 关联，提交时间固定；凭据不在信封内。
* 同一 Execution 的投递按持久序号组织，不能只依赖进程内 Promise。先物化引用文件再向 Agent 暴露可用路径；文件失败保留已提交消息和已回答事实。
* 相同 inputId 的网络重试先查运行时持久接收结果，返回同一消息身份。Outbox 允许重复派发；适配器必须兑现同一 Session 中不重复产生输入消息的合同。
* 不能用“本地标记已发送”冒充 Runtime 已持久接收。无法核验时保留交付未知，不换 inputId 或 Session 盲投。
* 运行中消息进入队列并由 Runtime 在受控位置消费；空闲或已结束时触发续行。并发与文件就绪不改变用户提交时的回答事实。

### 5.4 结束、取消与消息续行

* `FinishExecution` 记录本轮结束，并与新输入提交通过执行版本协调。新消息已经提交时，不能结束后把它遗失；先结束后收消息时，由待投递意图重新调度原执行。
* `ContinueExecution` 是输入派发触发的内部行为，不要求用户额外创建 Execution。检查本地用户资格、固定 OM、原 Session/Workspace 和旧运行是否已退出，再取得新的运行代次与租约。
* 取消先原子设置当前代次的停止栅栏并提交停止意图，再等待 Runtime 和容器确认停止；在途外部操作不能宣称撤回或回滚。
* 取消过程中收到新消息，保存并明确显示等待停止后继续，不使旧运行恢复动作资格。只有旧进程确认退出后，才允许新代次清除旧栅栏继续。用户停用或 token 失效则保持阻塞，不绕过检查。
* 已结束、失败或已确认停止的 Execution 收到有效新输入，均按同一续行机制处理；失败原因仍未解除时明确阻塞，不静默建新 Session。
* 空闲 Harness 或容器可释放，但 Session 存储、Workspace 和版本关系保留。恢复不重放全部模型工作来猜测控制状态。

## 6. 应用端口与运行时合同

端口紧邻其使用用例，签名不暴露 SDK、ORM、HTTP DTO 或凭据。下列名称是职责，不要求机械按表创建包装类。

| 端口 | 必须兑现的合同 | 首版机制 |
| --- | --- | --- |
| Identity | 验证集成方身份并获取稳定用户信息，明确 token 失效；不代替本地账户规则 | 集成方验证/用户信息接口适配 |
| CredentialProvider | 宿主按当前用户取得对应连接的有效凭据；不返回给模型或 Domain | 受控内存/加密秘密托管 |
| 各能力 Store | 原子提交用例变更、命令结果和交付意图，当前资格和版本检查 | SQLite/Drizzle |
| AgentRuntime | 确保同一 Session、按 inputId 投递/查回、启动/停止/重开工作循环、报告运行事实 | 锁版 Pi Durable |
| RuntimeHistory / SessionReader | 持久消息和工具记录追加、稳定定位、补读、分页及覆盖限制 | Pi Session 存储和宿主扩展 |
| SessionIndex | 可重建的过滤/关联索引及同步游标 | 应用 SQLite，不成为另一套历史事实 |
| Workspace / BlobContent | 固定上传内容、原执行交付及持续目录、受限路径和可用性 | 本地 Blob 与目录物化 |
| WorkEnvironment | 容器准备、受控文件/Bash、资源限制和实际停止确认 | Docker，优先 pi-env |
| MethodRevision / Search | 确认最新来源、固定 SHA 快照、文件与版本内检索 | Git/FTS5 |
| McpGateway | 以执行用户发现和调用动态工具，暴露分类来源，保留调用事实，不解释业务状态机 | 通用 MCP 客户端 |
| Clock / IdSource | 时间和稳定内部身份，用于确定性验证 | UTC、UUIDv7 |

### 6.1 Pi Durable 的验证边界

每 Execution 使用一个逻辑 Session 和独立 Pi SQLite。精确 SDK 标识、submit/steer 接口、工具结果锚点、空闲重开及历史读取均由外层映射；不以 Runtime 的内部父子关系推导平台任务树。

首次 Session 分配和应用绑定不能跨库原子提交：先持久化稳定分配身份，再查回/分配；绑定 CAS 确认前，不激活候选会话或执行业务工具。崩溃后必须找回同一已激活 Session，孤立未激活候选可清理。

输入去重、历史扩展字段、MCP 发起记录、稳定游标、停止及重启后续行均是硬性验证项。SDK 若缺少接口，需要适配层补足并证明；不能靠“重放安全”声明替代业务幂等，也不能先写本地已交付再假定 SDK 已接收。

Runtime/模型/Skill 升级需要代表性回归。既有 Execution 保留实际版本，不能静默升级或因镜像缺失改用新环境。

### 6.2 Worker Skill 与宿主装配

[Worker Skill v0.1.0](../backend/skills/airic-work-worker/SKILL.md) 是产品运行时资产，随构建发布；不从 `.agents/skills/` 自动扫描开发或 OME Skill。每次请求实际装配固定 Worker 正文、Root OM 和可信运行快照，其他领域知识按需读取。宿主负责身份、持久输入、工具 Schema、停止与恢复，Skill 不承担这些机制保证。

首版使用一条 Root Conversation，忙时输入有序 follow-up；产品 Steering Input 不直接等于 Pi 的 steer 模式。DecisionRequest 工具保存后立即返回，UserDecision 通过新输入交付。正常让出执行后，宿主核验队列、空闲与工具退出事实，再显式结束当前运行；一次模型回复不代表业务完成。取消需处理已接收但被撤回的输入，不能把持久接收当作已处理。

详细输入、工具、隔离和验收合同以[配套设计](worker-runtime-design.md)为准。该设计同时列出了当前内层合同仍需补齐的实际装配记录、完整输入映射、动态 MCP Schema、调用身份与取消观察；这些能力尚未由生产适配器兑现。

## 7. Session 和 MCP 操作视图

### 7.1 单一历史与可重建索引

Session 中保留实际用户/Agent 消息、工具调用及返回和必要宿主记录。控制记录的权威回答事实仍在应用库，交付到 Session 后以稳定输入 ID 关联，不伪造消息已到达。

索引同步采用持久游标补读，实时通知仅提示。索引行与游标同事务提交；重复读取按 Session 原记录 ID 去重，不能越过尚未处理记录。索引删除可重建，不接受前台直接改写，也不建立独立轨迹事件模型。

读取索引时报告覆盖范围及同步位置；Session 已有而索引尚未覆盖时，允许补读或明确未同步，不返回貌似完整的空列表。压缩或清理后保留缺口信息，不从当前模型上下文恢复已丢失历史。

### 7.2 MCP 调用记录合同

MCP 适配器与 Session 写入机制协作，在真正发出网络请求前持久记录调用发起，再关联返回或中断。不能记录发起则不发送调用。发起后崩溃、结果未保存时只能显示未确认，不能视为未发生。

| 记录内容 | 设计要求 |
| --- | --- |
| 定位 | Execution/Session、稳定 toolCallId、连接 ID、工具名、开始/结束时间、原 Session 位置 |
| 工具定义 | 当次工具 Schema 版本或摘要、分类 `read`/`write`/`unknown`、分类来源及配置修订 |
| 参数及返回 | 写入前移除凭据/秘密字段，保留可显示原始结构；截断/脱敏或不可读时有明确说明 |
| 执行情况 | 调用中、成功、失败、结果未知及错误；记录服务返回，传输正常不自动解释为业务成功 |
| 重试 | 每次尝试有独立调用 ID；存在明确来源时保留 retryOf/逻辑调用关联，不依据参数相同猜测 |
| 判断关联 | 仅保存显式 DecisionRequest/UserDecision 或消息来源关联，无依据时为空，不补造因果关系 |
| 快速查看 | 非权威摘要、可取得的业务对象链接；链接点击仍遵循来源访问条件，不代理扩大权限 |

操作分类由服务明确声明或连接配置提供，不能只凭工具名或 Agent 推测。记录当时分类和来源，后续配置改变不重写历史。MCP 协议或服务未提供充分结果语义时显示未知或原始返回，不建立通用业务成功解释器。

### 7.3 查询与展示

`QueryMcpCalls` 按 Execution、时间、连接、工具、操作类型和执行情况读取 Session 索引，游标限定过滤条件及记录位置。列表显示时间、连接、工具、分类、执行情况和摘要；详情按需读取参数、返回和业务链接。

写操作筛选同时提示过滤范围内是否存在类型未知调用；数量尚未完整计算时说明覆盖限制。列表包含失败、未知和每次重试，不把尝试次数当作业务效果数量。

点击可回到原 Session；有显式关联时与 Decision Episode 双向定位。无关联不猜测判断来源；浏览返回保留筛选、展开和滚动位置。

### 7.4 业务操作与结果未知

业务幂等键、回执查询和文件协议属于外部 MCP 工具合同。Agent/Runtime 按原调用信息查回，不因超时、中断或 Session 恢复生成新业务身份盲目重试。平台不为每次业务写入建立独立 Command/Outbox 账本。

本地输入去重、工具调用 ID 与业务操作幂等各自有范围，不能互相代替。必须验证“业务已成功、工具返回尚未持久化”的窗口；无法确认时明确阻碍，由服务合同和 OM 决定继续方式。

## 8. Workspace、文件与执行隔离

~~~text
$AIRIC_DATA/
  db/airic.sqlite
  blobs/sha256/...
  om/mirror.git
  om/snapshots/<source>/<sha>/runtime/
  executions/<executionId>/
    runtime/pi.sqlite
    workspace/                 持续可写工作目录
    inputs/<inputId>/...        固定输入的只读物化文件
~~~

* 文件先写不可变 Blob 并校验哈希/大小，再在应用事务中保存输入绑定。数据库失败可能留下孤立 Blob，允许清理；不能绑定未完整字节。
* 输入文件就绪后按固定 inputId 物化到该 Execution 的只读输入目录，以临时文件及原子替换完成交付；失败保留已提交输入并显示尚未可读。路径不是内容身份，文件名冲突不覆盖旧输入。
* 容器将 Workspace 挂为 `/workspace/work` 可写，固定输入为 `/workspace/inputs` 只读，固定 OM 为 `/om` 只读。工作目录按 Execution 持续，不按运行代次重新创建，不因容器回收删除。
* 宿主根据可信 ID 生成路径并检查目录穿越和符号链接；普通容器不挂载应用库、Pi 库、Blob 根目录、凭据或 Docker socket。
* 文件/Bash 工具全部进入容器。非 root、只读根文件系统、丢弃 capabilities、no-new-privileges、默认 seccomp，限制 CPU/内存/进程/超时/磁盘；首版容器不开放网络，外部服务由宿主受控 MCP 接入。
* 容器镜像使用固定 digest；空闲且工具退出后可回收，重启先核对旧容器实际停止，不能让两个运行实例同时写同一 Workspace。
* 容器临时存储和后台服务不承诺跨运行保留；持续文件纳入备份。达到保留期限或被清理时明确不可恢复内容，不能悄悄以空目录冒充原 Workspace。

业务 MCP 提供的文件能力按其合同处理；若需要通用 HTTP 字节传输，由可信宿主限定目标端点并注入该用户凭据，不能把下载描述变成任意网络代理。上传、下载与登记步骤不写死为平台通用业务流程，不固定 `asset.*` 工具名，不访问外部数据库或人工 UI 绕过业务门禁。

## 9. Git、OM 与搜索

* Git mirror 与快照按来源和 SHA 隔离。PrepareExecution 在网络确认后，提交固定版本前再次检查来源配置版本；源变更期间不能混合仓库与 SHA。
* Root `om.md` 或已配置入口常驻，其他知识按需加载。记录实际文件路径、SHA、内容摘要及 Runtime/Skill 版本，不能用仓库已同步代替已装配。
* `.ome/` 不属于交付内容；快照构建、索引及链接扩读都排除该路径，不提供人工作者目录浏览。运行依赖缺失时报告而非回退。
* 人工文件浏览和检索固定选定快照，默认当前同步版本；后台始终使用 Execution 固定 SHA。相对链接限定同仓库同提交，不跨来源或版本读取。
* FTS5 索引可重建；短查询 LIKE 回退、中文和高亮定位要有集成验证。不做向量索引或 Decision 语义对象解析。
* 历史与 diff 来自 Git，大结果分页或限量外链；来源变更保留旧 Execution 的快照或可恢复来源，不改写历史。仓库审阅、合并与方法验证在外部完成。

## 10. HTTP、MCP、SSE 与界面适配

### 10.1 入口和错误

入口结构校验采用 Zod，运行时依赖装配采用 Awilix。当前锁定版本见 `backend/package.json` 及 `backend/package-lock.json`，不与业务 Schema 或领域类型混为一体。

* `adapters/driving/validation/schemas.ts` 定义严格输入形状，`commands.ts` 映射为普通应用命令。外部正文中的额外身份字段拒绝，不静默采用或扩权；`task` 保留调用方自定义 JSON。
* Zod 错误在入口转换为不含输入值的字段问题；Domain 的 RuleError、资格/归属、状态、CAS 和业务约束继续由内层负责。校验通过不等于操作获准。
* `bootstrap/container.ts` 使用 Awilix 注册适配器和应用服务类，使用 asClass 注册服务类并进行构造函数注入。使用 CLASSIC + strict 和根级单例；CLASSIC 按构造参数名解析依赖，后端构建不得混淆这些参数名。不使用反射装饰器，不让业务用例调用 resolve/cradle。
* 当前传入适配器由调用方创建并负责关闭，容器 dispose 只释放其拥有的注册实例；将来增加生产资源工厂时应显式登记 disposer。HTTP 请求的用户身份逐次传入，不能被根级单例捕获。
* 此接入尚不提供真实 HTTP/认证/数据库/Runtime；入口 Schema 与配置形状可独立测试，不能将库安装视作生产适配已完成。


Fastify、运行时工具、worker 和只读 MCP handler 调用同一组应用用例。入口建立可信用户及 Execution 调用来源，不信任模型填写的 userId；DTO 在边缘映射，Schema 留在 transport-contracts。

错误区分身份无效、本地停用、无权访问、输入无效、幂等/版本冲突、能力暂不可用、文件未就绪及结果未知，不用通用终态错误拒绝已经结束的 Execution 收取消息。

### 10.2 候选 HTTP 合同

路径是目标接口，正式 Schema 随用例合同锁定；不从 UI 路径自动推导 API。

| 方法 | 路径（`/api/v1`） | 应用入口 |
| --- | --- | --- |
| POST / GET | `/executions`、`/executions/:id` | CreateExecution / QueryExecution |
| POST | `/executions/:id/cancel` | RequestCancellation |
| POST | `/executions/:id/steering` | SubmitSteeringInput；消息可触发原执行续行 |
| GET | `/projects`、`/projects/:id` | QueryProject；仅聚合本人可见执行 |
| GET | `/executions/:id/decision-requests`、`/decision-requests/:id` | QueryDecisionRequest / Decision Brief 呈现 |
| POST | `/decision-requests/:id/user-decisions` | SubmitUserDecision；提交即已回答 |
| GET | `/episodes/:id` | QueryDecisionEpisode |
| GET | `/executions/:id/session` | QuerySession；Trajectory 为别名 |
| GET | `/executions/:id/mcp-calls`、`/executions/:id/mcp-calls/:callId` | QueryMcpCalls / QueryMcpCall；读取 Session 视图 |
| POST / PUT / POST | `/uploads`、`/uploads/:id/content`、`/uploads/:id/complete` | 开始、接收及固定上传内容 |
| GET | `/input-files/:id` | 按本人及 Execution 范围查询/读取 |
| GET / POST | `/om/*`、`/om/sync` | 浏览、检索及同步方法 |
| GET | `/stream` | SSE 更新提示，断线重查权威记录 |
| — | `/admin/*`、`/me/*` | 本地用户、配置和偏好；无委托或外部授权管理端点 |

创建字段沿用 PRD，不重定义通用业务 Task Schema。内容读取、命令重试结果、SSE 和分页均校验当前用户，幂等缓存不能泄露其他人内容。

Airic Work MCP 只调用身份相同的查询用例，暴露执行定位、Session 分页和 Decision Episode/Context/版本引用；不提供创建、取消、UserDecision、Steering Input、业务操作、凭据或 OM 修改能力。每页校验当前资格，引用不自动交付业务文件。传输、工具名和分页一致性在集成时锁定，不另设外部客户端授权流程。

### 10.3 前端约束与既定导航

React + TypeScript、Vite、React Router BrowserRouter；使用真实 MUI/Emotion 组件、浅色紧凑工作台、侧栏/AppBar/Paper/Table/Dialog/Alert。原型状态和 localStorage 不构成后端或身份合同；当前 UI 完成度需另行核实。

* `/projects`、`/projects/:projectId`：执行/待回答 Tabs，仅聚合可见数量。
* `/executions/:id`：桌面左侧进展及 Session、右侧 DecisionRequest 与 Decision Brief；窄屏切 Tabs。新增 MCP 操作入口在同一执行内，不另设业务操作管理中心。
* `/executions/:id/trajectory`：Session 历史；`/episodes/:episodeId`：对应请求生命周期。旧 URL 命名不建立另一种模型。
* Decision Context 原文按需打开 Drawer，返回保留 UserDecision 草稿；提交后立即显示已回答，交付和后台继续另行反馈。
* `/om` 直接到文件浏览，无仓库选择页；`/om/history`、`/om/commits/:sha`、`/om?commit=:sha&path=:filePath` 保留版本定位。
* `/settings/system/:section`、`/settings/users`、`/settings/profile`：实例、用户及个人设置，不出现独立登录或业务委托步骤。

服务端记录与本地草稿分开；SSE 只触发查询失效或刷新，生产状态库按实现需要选择。加载保留布局，失败局部重试，提交防重复，脏值离开提示，返回恢复筛选/展开/滚动；Markdown 禁不安全 HTML，限制相对链接及文件权限，二进制不伪造预览。验证键盘、焦点恢复、语义标签、状态文字和窄屏表格，MUI 不自动证明可访问性达标。

## 11. 事务、部署与恢复

### 11.1 本地原子性和跨存储窗口

应用用例读取状态、执行规则并调用按用例定义的 Store 提交合同。Store 适配器内部生成去重结果与 Outbox，不暴露任意 SQL 或万能 UnitOfWork 给其他能力。事务内不执行模型、MCP、Git、Blob 写入、网络或容器操作。

| 窗口 | 处理原则 |
| --- | --- |
| 用户首次接入并发 | 唯一来源身份约束；复读同一 User，不覆盖本地资格 |
| 回答提交中途失败 | UserDecision、已回答事实、文件绑定及 Outbox 全部提交或全部回滚 |
| 应用提交后、Runtime 接收前崩溃 | Outbox 重试原 inputId，不丢已回答事实 |
| Runtime 接收后、应用确认前崩溃 | 查原 inputId 的持久接收状态，不重复追加消息 |
| 结束与新输入并发 | CAS 及待交付序号决定派发，输入不因结束丢失 |
| Blob 写完、绑定未提交 | 允许清理孤立 Blob，不出现指向缺失字节的已提交输入 |
| Session 已写、索引未更新 | 补读并原子更新索引与游标，不重建第二套历史 |
| MCP 已发出、结果未知 | 原调用保留未知，按外部合同查回，不自动重复业务写入 |
| 停止未确认、新消息到达 | 新消息持久排队；旧代次停止前不启动新工作循环 |

SQLite 使用 WAL、foreign_keys、busy_timeout；Drizzle/better-sqlite3 使用同步事务，不能把 async 回调放进同步事务 API。记录使用版本 CAS 和必要 SQL 唯一约束，不将 TypeScript enum 当数据库约束。内部 ID 采用 UUIDv7，时间存 UTC，界面按用户/组织时区展示。

Outbox 具备认领、租约、失败原因、重试及确认；worker 只调用应用用例，不自行写业务状态。单进程不代替持久去重和恢复验证。消息不重复效果须由本地身份和 Runtime 接收合同共同兑现，不宣称跨外部业务系统 exactly-once。

### 11.2 资源、备份与运行诊断

* 控制面独占 Pi 存储和容器管理权限；首版验证 rootless 挂载/UID，不挂载 Docker socket 给 Agent。
* 并发、配额、文件大小、保留期、SLA 和成本不虚构默认值；资源限制只影响派发，不改变用户回答或业务完成语义。
* 主密钥由部署环境提供，token 服务端受控托管；不独立发行业务委托，过期时重新验证或使用集成方明确支持的续期机制。
* 结构化日志和 tracing 记录操作关联、投递、运行时故障、索引积压、文件交付和资源占用；在落盘前脱敏，不把日志当作 Session 或另建产品审计表。
* 备份包括应用 SQLite、每个 Pi Session 存储、固定上传内容、持续 Workspace、OM 快照及必要加密配置；查询索引可重建。
* 多库和目录不天然同一时刻一致。首版备份暂停接收新写入和派发，确认运行及工具收尾，记录检查点后执行 SQLite 备份和文件快照；无法确认的业务调用保留未知。
* 恢复先确认旧进程/容器停止及唯一持有者，再恢复文件和 OM、重建索引、核验运行时接收记录和 Outbox，最后按当前用户资格续行。不能依靠重放完整 Agent 任务补猜状态。

## 12. 验证与实施闭包

### 12.1 新版验收合同

以下为目标验证，不表示既有 fake-port 或基础设施测试已经覆盖。实施前需要基于本版建立或更新行为规格、反馈合同和开发计划，不沿用其中冲突的终态、身份或轨迹假设。

| 编号 | 情境 | 必须验证的结果 |
| --- | --- | --- |
| T01 | 同一集成用户首次并发接入、停用后再次认证 | 唯一 User；初次自动使用；不绕过本地停用或重置管理员权限 |
| T02 | 相同分组及创建幂等键并发重试、同键异内容 | 分组唯一；相同创建返回原执行，异内容冲突，无部分写入 |
| T03 | 新执行启动、Git 不可达、来源切换、旧执行续行 | 确认最新后固定 SHA；失败不偷用缓存；旧执行保持原版本 |
| T04 | Agent 创建请求、用户展示及提交回答 | Decision Episode 一一对应；保存回答即已回答，与投递及专业充分性无关 |
| T05 | 回答事务中失败、重试及补充更正 | 回答/状态/文件/Outbox 原子；同提交不重复；更正保留历史不重置待回答 |
| T06 | Runtime 接收消息前后崩溃、连续消息并发 | 原 inputId 查回，不丢、不重复输入；按持久序号交付 |
| T07 | 新消息与 Finish 并发、结束后提交消息 | 原 Execution/Session/Workspace 继续，版本不变，只有一个工作循环 |
| T08 | 取消中提交消息、旧 worker 或容器尚在途 | 消息排队、旧代次栅栏有效；停止确认后才能续行，不宣称远端回滚 |
| T09 | Blob 完成而事务失败、Workspace 交付失败 | 无错误正式绑定；孤立文件可清理；回答仍已保存，未交付明确可见 |
| T10 | Pi 分配完成但绑定未提交、进程重启 | 查回同一逻辑 Session，未激活候选不能执行；无法恢复时阻塞而非新建替代 |
| T11 | Session 写入后索引崩溃、删除索引再重建 | 同源补读、索引/游标原子；不重做业务动作，覆盖不足明确 |
| T12 | MCP 读取/写入/未知分类及配置变更 | 保留当时分类和来源；写筛选提示未知；后改配置不重写历史 |
| T13 | MCP 超时、返回业务失败、重试、结果落盘前崩溃 | 尝试独立可见；传输成功不冒充业务成功；未知不盲重试 |
| T14 | 从操作查看参数/返回、定位 Session 和判断过程 | 原结构可读且脱敏；仅显式关联双向跳转，筛选/展开位置保留 |
| T15 | 其他用户、管理员、失效 token、停用后分页/SSE/缓存读取 | 同一用户访问规则；不泄露内容、计数或原幂等结果 |
| T16 | Workspace 等待/回收/重建、路径攻击、跨执行读取 | 文件持续、目录隔离；无宿主秘密或越界路径，失败不回退宿主工具 |
| T17 | 空闲重开、上下文整理及运行环境版本缺失 | 同一 Session 和 Workspace；历史限制明确，缺版本不静默升级 |
| T18 | 外部 Agent 读取、方法文件浏览及 `.ome/` 引用 | MCP 只读且与工作台权限一致；作者目录不进入同步/索引/运行 |
| T19 | 停派发备份、多库恢复、在途外部操作 | 唯一宿主、历史/文件关联可恢复，未知操作核验而非全量重放 |

验证分层：Domain 检查归属和回答等不变量；Application + fake ports 检查操作顺序和事务合同；Store 集成检查唯一约束、CAS、回滚、Outbox 和游标；Runtime 合同检查去重、历史追加/读取和停止续行；Docker 检查实际文件/Bash 隔离与回收；Delivery 检查 DTO、身份、分页、MCP/SSE；端到端走通委托—回答—补充—核查操作—结束后继续。

### 12.2 实施顺序

| 阶段 | 交付 | 完成依据 |
| --- | --- | --- |
| 0 合同与能力验证 | 对齐行为规格，锁定 Pi/Docker/SQLite 版本，验证单 Session 续行、输入去重和历史扩展 | 可复现证据；缺失能力明确阻塞相关适配，不削弱产品保证 |
| 1 身份与执行 | 集成方 token、自动建 User、Project/Execution 创建、固定 OM、Session/Workspace 初始化 | T01–T03、T10、身份隔离和创建合同 |
| 2 人机消息闭环 | DecisionRequest/UserDecision、Decision Episode、Steering Input、文件和 Outbox | T04–T09；原执行续行含并发取消窗口 |
| 3 Session 与 MCP | 单一历史、可重建索引、动态 MCP、操作分类和展开查询 | T11–T14，含真实服务未知效果窗口 |
| 4 查询与界面 | OM、MCP 操作窗口、用户设置、SSE、外部只读 MCP | T15–T18 及 PRD 核心 UX 路径 |
| 5 运行交付 | 资源、保留、备份、恢复和运行回归 | T19 和实际部署演练，不以模拟测试代替真实业务验收 |

修改闭包覆盖领域规则、用例与端口、适配器、数据库迁移、transport 映射、前端、装配与对应测试。旧测试保留其历史证明范围，冲突合同应替换而非让旧断言决定新产品；删除旧数据或存储结构前单独验证迁移和备份。不在本轮文档工作中修改实现或声称迁移完成。

### 12.3 仍需落实的机制与真实未决项

* 集成方 token 的可信验证、用户信息接口、目标服务接受范围、后台安全保存及过期/续期协议；不能假定任意服务都接受同一 token。
* Pi 锁版后的 inputId 持久查回/去重、单 Session 重开、发起记录追加、历史扩展、游标及停止确认；以真实合同测试证明。
* SSE 重连、HTTP/MCP 正式 Schema、分页稳定性、大内容限制、文件解析工具、保留/清理策略和容量配置。
* 集成方用户字段与本地可编辑资料的同步优先级，以及首次管理员的部署引导方式，需要在身份接入实现前明确；不重新引入密码或注册产品流程。
* Project 名称更新、跨 Project 迁移等 PRD 未定义行为仍需产品决定；不是实现时可自行补出的规则。

Execution 结束后是否继续、UserDecision 何时已回答、Decision Episode 覆盖什么、Trajectory 是否独立等已经确定，不再列为待决定事项。旧 airic-forge 的资产迁移或归档放在开发/迁移计划，不由本设计宣布完成。
