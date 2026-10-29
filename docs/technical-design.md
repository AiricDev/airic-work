# Airic Work 后端技术设计

| 项 | 内容 |
| --- | --- |
| 状态 | 设计草案，未实现、未联调验证 |
| 日期 | 2026-10-29 |
| 依据 | `docs/prd.md`、`docs/prototype-design.md`，以及架构讨论中已确认的决定 |
| 范围 | 后端服务、数据、运行时、Execution Workspace、文件、OM、身份、API、部署与实施阶段 |
| 不覆盖 | 前端实现、UI 细节；`frontend/` 是交互确认原型，其 mock 数据结构不是后端契约 |

本文的产品术语以 PRD 为准。凡标注"待验证"的内容，都是设计假设，必须在阶段 0 用真实环境验证后才能当作能力使用。

---

## 1. 设计目标与原则

1. **后台可靠推进，不依赖前台在线。** 执行状态、等待和恢复依据全部持久化。进程重启后，从持久记录恢复，而不是从聊天记录猜测。
2. **权威来源清楚。** Airic Work 只对自己拥有的对象负责：Project、Execution、Request、回应、Resolution、Trajectory 和输入文件。业务事实以业务系统为准，OM 以 Git 为准。
3. **等待只阻塞相关部分。** 一个未决 decision 只让依赖它的工作项停下，其他工作项继续推进。
4. **Agent 会话不长时间挂起等待。** 遇到未决 decision，会话结束本次运行并进入空闲；回应到达后，作为新输入送回原会话继续。
5. **每个 Execution 独立工作区。** 文件不跨 Execution 共享；Execution 内部的工作项通过只读视图共享输入和产物，每个文件保留来源、版本和哈希。
6. **先简单部署，留好替换点。** 先用单节点、SQLite、本地文件系统；数据库、对象存储、队列、沙箱都放在端口后面，以后可以替换。
7. **不重复、不冒充。** 所有外部写操作有幂等键和操作账本；结果未知时先查询权威回执，不盲目重发。

---

## 2. 关键决定

| # | 决定 | 理由 | 重新评估条件 |
| --- | --- | --- | --- |
| D1 | TypeScript 模块化单体，控制面单进程部署；工作项工具在独立 Docker 容器中执行 | 团队规模和产品阶段不需要微服务；不把模型生成的命令放在控制面执行 | 某个模块的负载或发布节奏明显独立 |
| D2 | Fastify 作为 HTTP 框架 | 性能好、插件体系成熟、对 schema 校验友好 | — |
| D3 | 数据库先用 SQLite（WAL 模式），数据访问层用 Drizzle ORM | 部署简单、备份简单；团队熟悉 Drizzle；Drizzle 同时支持 SQLite 和 PostgreSQL | 需要多实例横向扩展、写入并发成为瓶颈，或需要托管数据库 |
| D4 | 不引入外部消息队列；用数据库内的 Outbox 表加进程内派发器 | 单进程下足够；和业务写入同一个事务 | 迁移到 PostgreSQL 并多实例部署时，改用 `SKIP LOCKED` 或 pg-boss |
| D5 | Pi Durable 作为 Agent 运行时，经 `RuntimeAdapter` 接入，锁定精确版本 | 提供持久会话、任务检查点、崩溃恢复、fork；但它是 Experimental，API 可能无预告变化 | 版本升级破坏兼容，或验证发现关键能力缺失 |
| D6 | 每个 Execution 一个 Pi Harness 和一个独立的 Pi SQLite 文件 | 故障隔离（Pi 的存储错误会关闭整个 Harness）；生命周期与 Execution 一致，便于归档 | 同时打开的 Harness 数量带来明显资源压力 |
| D7 | Execution 内部由"协调会话 + 多个工作项会话"组成；所有会话由事件驱动，被阻塞时结束本次运行 | 让未决 decision 只阻塞相关工作项；回应可以回到原会话继续 | — |
| D8 | 工作项的状态、阻塞关系以 Airic Work 数据库为准，Pi 只保存会话上下文 | Pi 内部对象不等于产品对象（PRD 要求）；便于查询、审计和 UI 展示 | — |
| D9 | 每个 Execution 一个独立 Workspace：Execution 只读视图（输入与产物）加各工作项的可写工作区 | 结构简单；与 PRD"跨用户、跨 Project 不自动共享"一致；不需要处理跨归属人的文件授权 | 多个 Execution 经常需要同一份非业务材料 |
| D14 | 用户能看到本人在业务系统中发起的 Execution；Project 页面只聚合这些 Execution | 不暴露同项目他人的执行过程、Request 和轨迹 | 需要项目负责人或项目级协作视图 |
| D10 | 文件字节用内容寻址的 Blob 存储（SHA-256），先用本地文件系统 | 去重、固定内容、便于校验；以后可换成 S3 兼容存储 | 多节点部署或存储容量需要 |
| D11 | OM 全文检索用 SQLite FTS5（trigram 分词器），按 SHA 和视图隔离 | 不引入向量库或外部搜索服务（PRD 要求）；trigram 对中文可用 | 中文检索质量不足；迁移 PostgreSQL 后改用 `pg_trgm` |
| D12 | 实时推送用 SSE | 单向通知足够，比 WebSocket 简单 | 需要双向实时协作 |
| D13 | 登录用 OIDC；业务委托凭据由服务端加密托管，只由宿主注入请求 | PRD 要求凭据不进入模型、URL、工具参数和轨迹 | — |
| D15 | Pi Durable、模型调用和业务 MCP 留在宿主；每个工作项会话的文件工具与 Bash 进入独立 Docker 沙箱 | 首版部署简单；沙箱不接触业务凭据；通过 `ExecutionEnv` 保留替换点 | 需要独立内核隔离，或承载高风险第三方代码时评估 Gondolin 等 micro-VM |

明确不引入：Kafka 等消息中间件、微服务、向量数据库、内部学习服务、自建 Git 服务。

---

## 3. 系统上下文

```text
              ┌────────────────────┐        ┌─────────────────────┐
              │ 业务系统（如 CertLab） │        │ 工作台前端（React/MUI）│
              └─────────┬──────────┘        └──────────┬──────────┘
                标准任务/决策 API                      HTTP + SSE
                        │                               │
┌───────────────────────▼───────────────────────────────▼───────────────┐
│                         Airic Work（单进程）                            │
│  API 层（Fastify）  ── 应用服务（Project/Execution/Decision/File/...）   │
│        │                     │                    │                    │
│   只读轨迹 MCP          Outbox 派发器           Runtime Host            │
│                              │              （Pi Durable Harness × N）  │
│  SQLite（airic.sqlite）   Blob 存储      Execution Workspace（文件系统） │
└───────┬───────────────────────────┬───────────────────┬────────────────┘
        │ git fetch                 │ 业务 MCP + 受控 HTTP │ 模型 API
   ┌────▼─────┐               ┌─────▼──────┐        ┌────▼─────┐
   │ GitHub / │               │ 业务系统    │        │ 模型提供方 │
   │ GitLab   │               │ MCP/文件端点 │        │ （pi-ai）  │
   └──────────┘               └────────────┘        └──────────┘
        ▲
   外部 Agent（Codex、Claude Code 等）经只读轨迹 MCP 读取授权记录
```

Runtime Host 在控制面进程中运行 Pi Durable，通过执行环境适配把文件工具和 Bash 委派给独立 Docker 容器（见 8.3）。模型 API、业务 MCP 和凭据管理不进入工作项容器；容器中不启动 Pi CLI，也不打开 Pi 存储。

---

## 4. 模块划分

```text
backend/
  src/
    app/                 Fastify 启动、路由注册、认证中间件、错误映射
    modules/
      projects/          Project 与业务引用
      executions/        Execution、ExecutionAttempt、取消
      workitems/         工作项与阻塞关系
      decisions/         DecisionRequest、RequestResponse、Resolution、Adoption、Brief
      files/             上传、InputFile、Blob 引用
      workspace/         Execution 工作区、文件清单、物化视图
      om/                Git 同步、快照、文件浏览、全文检索
      trajectory/        TrajectoryEvent 投影、Episode
      identity/          用户、业务身份映射、本人委托
      business/          业务 MCP 连接、BusinessOperation 账本、文件传输
      external-mcp/      对外只读轨迹 MCP
      admin/             系统设置、连接配置
      audit/             审计记录
    runtime/
      adapter.ts         RuntimeAdapter 端口（业务层只依赖它）
      pi/                Pi Durable 实现：Harness 管理、Airic 扩展（工具）、执行环境
      sandbox/           SandboxManager 端口与 Docker 实现：容器、挂载、资源限制、连接回收
    platform/
      db/                Drizzle 客户端、schema、迁移
      outbox/            Outbox 表与派发器
      blob/              BlobStore 端口与本地实现
      secrets/           凭据加密托管
      telemetry/         OpenTelemetry
      clock.ts ids.ts config.ts
  drizzle/sqlite/        迁移文件
packages/
  contracts/             API 请求/响应 schema（zod），前后端共享
```

模块之间只通过应用服务接口调用，不直接访问对方的表。`runtime/` 不直接写业务表，只通过应用服务和事件交互。

---

## 5. 权威来源与数据所有权

| 对象 | 权威来源 | Airic Work 保存什么 |
| --- | --- | --- |
| OM 文件与修订 | Git 仓库 | 镜像、快照、检索索引、Execution 使用的 SHA |
| 业务事实、状态、审批、正式完成 | 业务系统 | 引用（系统、对象 ID、版本）、调用记录与权威回执 |
| Project、Execution、WorkItem | Airic Work | 完整记录 |
| DecisionRequest、回应、Resolution、Adoption、SteeringInput | Airic Work | 完整记录；steering 不自动成为 Request 回应或 Resolution |
| 回应附件、执行输入文件、Workspace 文件 | Airic Work | 文件元数据与字节；正式业务资料由业务系统登记 |
| Agent 会话上下文 | Pi Durable 存储（每个 Execution 一个文件） | Airic Work 只保存映射（会话 ID、锚点记录 ID），并投影出 Trajectory |
| Trajectory、Episode | Airic Work | 从运行时事件投影的记录，带原始位置引用 |

Pi 存储和 Airic 数据库是两套存储，不做跨库事务。两者之间靠 Outbox、幂等键（Pi 的 `requestId`）和投影的幂等写入保持一致（见第 10 节）。

---

## 6. 领域模型

以下为核心实体与关键字段，不是最终 schema。Airic Work 内部 ID 用 UUIDv7（文本存储）；调用方的外部分组标识和自定义业务标识保留原值，不要求 UUID。

### 6.1 组织与执行

**Project**
- `id`（平台内部 ID）、`sourceSystemId`（经验证的业务系统实例）、`externalProjectId`（请求中的 `project_id`）、`name`（首次创建取 `project_name`）
- 唯一约束：`(sourceSystemId, externalProjectId)`；创建 Execution 时按此查找或创建，无需事先单独创建 Project
- 表示调用方定义的工作分组，可对应客户、订单或其他分组，不限定为某种业务实体；不保存业务完成状态
- 名称不参与身份识别；已有 Project 的名称更新规则待详细设计

**Execution**
- `id`、`projectId`、`ownerUserId`（唯一归属人）
- `instruction`（原始文字执行指令）、`task`（原始自定义 JSON 对象，可包含可选的稳定 `id`）、`sourceProjectSnapshot`（调用方提交的 `project_id`/`project_name`）；均作为创建输入快照保存，不随业务对象或 Project 名称变化改写
- `createdBy`（技术调用方 + 实际发起人）；归属人及业务主体另行可信校验，不从 `task` 中推断
- Agent 结合输入和 OM 理解目标、范围与预期产出，必要时发起 Decision Request；创建接口不强制结构化 `goal`/`scope`，`task` 的专业含义由业务系统、OM 和工具说明解释
- `businessSubjectSnapshot`（启动时代表的业务主体，不可改写）
- `omSourceId`、`omCommitSha`（启动时解析并固定）、`runtimeVersion`、`skillVersion`
- `status`：见 6.4
- `piStoragePath`、`coordinatorConversationId`
- `idempotencyKey` 与 `requestFingerprint`（见 10.2）

**ExecutionAttempt**
- 每次运行宿主接管 Execution 时一条：`executionId`、`hostId`、`startedAt`、`endedAt`、`endReason`
- 恢复前检查：授权、主体、版本兼容、未知副作用；不会因重启自动创建新 Execution

**WorkItem**
- `id`、`executionId`、`parentWorkItemId?`、`title`、`goal`、`scope`
- `status`：`ready` | `running` | `blocked` | `done` | `failed` | `cancelled` | `superseded`
- `conversationId`（Pi 会话）、`workDir`
- `result`（结构化结果）、`artifacts`（文件引用）

**WorkItemBlocker**
- `workItemId`、`kind`：`decision_request` | `business_operation` | `authorization` | `work_item`
- `refId`、`status`：`active` | `cleared`、`clearedBy`（例如某个 Adoption）
- 一个工作项可以有多个阻塞；全部清除后才可继续

### 6.2 决策协作

**DecisionRequest**
- 一项需要工程师介入的具体判断，逐项查看和处理；不提供跨 Request 批量作答、批准或解决
- `id`、`executionId`、`workItemId`、`kind`：`judgement` | `fact` | `authorization` | `investigation`
- `questions[]`：同一判断内的问题有稳定 ID，便于部分回应；不将独立判断合并成批量批准单
- `brief`（面向人的 Decision Brief）、`contextRefs[]`（来源系统、对象 ID、版本、位置）
- `omRefs[]`（文件路径、位置、SHA）
- `options[]`（稳定选项 ID、文字、含义/预期后续动作、可选推荐理由）、`allowedActions[]`、`continuableWork`（哪些工作仍可继续）；推荐不等于默认选中
- `status`：`open` | `partially_answered` | `resolved` | `withdrawn` | `superseded`
- 运行时恢复信息（见 7.4）：`anchor`（会话 ID、锚点记录 ID）、`resumeCapsule`

**RequestResponse**（收到了什么输入，不可修改）
- `id`、`requestId`、`content`、`coversQuestionIds[]`、`scopeNote`
- `selectedOptionId?`：引用本次核对的 Request 版本中的选项；`content` 可补充条件或提出其他方案，含义不明时继续澄清
- `declaredProvider`（声明的原始提供者）、`submissionChannel`（本人直接 / 代录 / Agent 转录）
- `submittedBy`、`submittedAt`（系统确认）
- `inputFileIds[]`、`correctsResponseId?`（更正链）
- `basisVersions`（提交时校验过的 Request、Context、业务状态版本）

**Resolution**（正式判断）
- `id`、`requestId`、`questionIds[]`、`decision`、`rationale?`（未知则标明未记录）
- `resolvedBy`、`basisResponseIds[]`、`basisVersions`、`supersedesResolutionId?`

**Adoption**（运行时实际采用）
- `id`、`resolutionId | responseId`、`workItemId`、`piEntryRef`（采用发生的会话记录）、`adoptedAt`
- 只有回应进入会话、并且 Agent 基于它继续行动时才写入

区分这三者，是为了让 UI 能分别显示"回应已记录""请求已解决""工作已继续"。

**SteeringInput**（交给 Execution 的补充输入）
- 稳定 `id`、`executionId`、文字 `content`、固定 `inputFileIds[]` / `businessRefs[]`、实际提交者与时间；代录结果保留已知原始提供者及来源
- 不要求 `requestId`，不生成 RequestResponse 或 Resolution；与选项判断入口分开
- 原始输入与文件引用固定保存；投递和实际采用状态另行记录，可关联受影响工作项、Assessment、TestTask/Finding 及业务回执
- TestTask/Finding 是业务系统的工作产出，可由 Agent 直接创建或由 Request 的选择引出，不与 Request 一一对应；平台只保存必要业务引用与调用记录，不复制其业务生命周期

### 6.3 文件、业务操作与轨迹

**Blob**：`sha256`（主键）、`size`、`storageKey`

**InputFile**（上传暂存）：`id`、`executionId`、`blobSha256`、`fileName`、`mediaType`、`uploadedBy`、`purpose`（`request_response` | `steering`）、对应的 `requestId?` / `steeringInputId?`、`stage`（`staged` | `attached` | `discarded`）、`readability`（`pending` | `readable` | `failed` + 限制说明）、`executionFileId?`（随回应或 steering 提交后指向 Execution 视图中的文件）；不要求为 steering 附件构造 Request

**ExecutionFile**：见第 8.4 节

**BusinessOperation**（外部操作账本）
- `id`、`executionId`、`workItemId`、`connectionId`、`operationType`、`commandId`（发给业务系统的幂等标识）
- `actingSubject`（本人业务主体）、`requestDigest`
- `status`：`prepared` | `dispatched` | `confirmed` | `rejected` | `unknown`
- `receipt`（权威回执）
- 规则：`unknown` 时先用同一 `commandId` 查询回执，不换标识重发

**TrajectoryEvent**
- `id`、`executionId`、`workItemId?`、`seq`、`type`、`occurredAt`
- `actor`（Agent 技术执行者、业务主体、人工处理人）
- `payload`（脱敏后）、`sourceRef`（Pi 会话 ID + 记录 ID，或业务回执）
- 唯一约束：`(executionId, sourceRef)`，保证投影幂等
- 不保存隐藏思考链

**Episode**：围绕一个 DecisionRequest 关联情境、Context 引用、OM 修订、回应、Resolution、Adoption 与后续结果；链接原始轨迹位置。不自动成为 Precedent。

### 6.4 Execution 状态

PRD 将完整生命周期列为待设计，以下为草案：

```text
accepted ──► starting ──► running ◄──► waiting
                │            │
                ▼            ▼
              failed    agent_finished

accepted / starting / running / waiting ──► cancel_requested ──► cancelled
```

- `accepted`：创建请求已接受，尚未启动。
- `starting`：解析 OM 最新提交、检查身份与授权、准备 Workspace。无法确认 OM 最新提交时停在这里并报告原因，不使用旧缓存。
- `running` / `waiting`：由工作项状态推导。至少一个工作项在运行或可运行时为 `running`；所有未完成工作项都被阻塞时为 `waiting`。
- `agent_finished`：Agent 认为工作已结束。**这不等于业务完成**，业务完成以业务系统为准。
- `cancel_requested` → `cancelled`：分别记录"取消请求已接受"和"实际已停止"；已发生和结果未知的业务效果单独列出。

---

## 7. 执行运行时设计（Pi Durable）

### 7.1 已查证的 Pi Durable 能力

来源：[README](https://github.com/earendil-works/pi/blob/main/packages/durable/README.md)、[spec](https://github.com/earendil-works/pi/blob/main/packages/durable/docs/spec.md)，2026-10 查阅。

- 会话记录、模型调用、工具调用和自定义状态先提交到存储再显示；进程崩溃后重新打开存储即可从检查点继续。
- 存储后端：SQLite（单文件、WAL）、JSONL、内存、Cloudflare Durable Object；可按 Storage contract 自定义，并有一致性测试套件。**一个存储同一时间只能被一个进程拥有，没有跨进程锁。**
- `submit()` 支持 `requestId` 幂等；会话忙时支持 steer（插到当前工具轮之后）和 follow-up（排队），可以用自定义 `entry` 类型提交输入。
- 工具结果可返回 `control: { terminate: true }`；一轮中所有调用都这样返回时，本次运行结束。
- 一次 generation 等本轮所有工具任务结束后才继续；会话在一次运行期间是"忙"的。
- `conversation.fork(entryId)`：新会话包含到该记录为止的内容，之后独立运行；task 不复制；新会话拿到新的 provider 会话标识。
- 工具声明 `replay: "safe"` 时，中断后会重跑；否则模型收到 `interrupted` 错误结果。
- `env` 回调按会话构建执行环境，可以做到每个会话一个目录或一个容器。**`cwd` 本身不是权限边界。**
- `NodeExecutionEnv` 直接访问本机，不提供隔离；官方 `@earendil-works/pi-env` 提供 `RemoteExecutionEnv` 和守护进程，可通过命令的标准输入输出连接，SSH 是现成连接方式之一。它提供执行能力，不负责创建容器或约束权限。
- QuickJS `CodemodeSandbox` 用于运行编排工具调用的 JavaScript，不替代文件系统与 Bash 的沙箱。Pi Coding Agent 的 Docker/Gondolin 示例也不等于 Durable 已有开箱即用的容器适配器。
- 状态：Experimental，API 在版本之间可能无预告变化。

没有找到"由外部事件直接唤醒某个 task"的一等 API。本设计因此不依赖这种能力。

执行环境依据：[pi-env README](https://github.com/earendil-works/pi/blob/main/packages/env/README.md)、[Connection 接口](https://github.com/earendil-works/pi/blob/main/packages/env/src/connection.ts)、[Pi 隔离指南](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/containerization.md)，2026-10-29 查阅。本文的 Docker 接法是宿主设计，尚未运行验证。

### 7.2 Harness 与会话结构

每个 Execution 一个 Harness，存储文件位于该 Execution 的目录下（见 8.2）。Harness 内部的会话：

```text
Execution E
 ├─ 协调会话（coordinator）
 │    职责：理解目标、读取 OM Root、拆分工作项、汇总结果、结束执行
 │    不持有业务写入工具
 ├─ 工作项会话 W1 ── 运行中
 ├─ 工作项会话 W2 ── 发起 decision_request(R1) → 本次运行结束（空闲）
 └─ 工作项会话 W3 ── 被业务回执阻塞（空闲）
```

- 所有会话都是 **ownerless**，由 Airic Work 的 `RuntimeAdapter` 通过 `harness.createConversation()` 创建，并在 WorkItem 表里登记映射。
- 不使用 Pi 的 subagent 所有权模式。原因：前台 subagent 工具会阻塞父会话；我们本来就需要在数据库里维护工作项状态，由 Airic Work 直接管理生命周期更清楚。取消时由适配器逐个 `abort()`。
- 每个会话的 `cwd` 和执行环境由宿主按工作项构建（见 8.3）。
- Harness、协调会话和工作项会话的模型循环都在宿主进程中。Docker 只承载工作项的文件操作和命令执行，不是每个 Agent 一个 Pi 进程。
- 协调会话只开放调度、查询和受限读取工具，不开放 Bash、Write、Edit；宿主读取工具只接受当前 Execution 文件 ID 或固定 OM 快照中的合法路径。

### 7.3 事件驱动的运行

会话不在工具调用里长时间等待。规则：

1. 会话的每次运行由一个**事件输入**启动：执行开始、工作项创建、回应送达、steering 输入送达、业务回执确认、依赖的工作项完成、取消前的收尾通知等。
2. 遇到阻塞时，Agent 调用登记类工具（如 `decision_request`），工具返回 `terminate: true`，本次运行结束，会话进入空闲。
3. 事件发生后，Airic Work 在本地事务里写入状态变化和一条 Outbox 记录；派发器调用 `RuntimeAdapter.deliver()`，把事件作为输入提交给目标会话。
4. 提交时使用确定性的 `requestId`，例如 `wi:{workItemId}:resolution:{resolutionId}`。重复派发不会产生两次输入。

协调会话也遵循同样规则：它创建工作项后结束运行；工作项完成、失败或阻塞状态变化时，再收到事件。

### 7.4 未决 decision：登记、等待与恢复

**登记**。工作项会话调用 `decision_request` 工具：

```ts
const decisionRequest = defineTool({
  name: "decision_request",
  description: "登记一个需要人工判断或补充的问题。登记后本工作项停止，回应到达后会在这里继续。",
  parameters: DecisionRequestArgs, // 问题、影响、Context 引用、建议、恢复摘要
  execute: async (args, api, context) => {
    // 幂等：同一 tool call 重放时返回同一个 Request
    const req = await airic.decisions.registerFromRuntime({
      callKey: api.taskId,
      workItemId: currentWorkItem(api),
      ...args,
    });
    return {
      output: [{ type: "text", text: `已登记 Request ${req.id}，等待回应。` }],
      control: { terminate: true },
    };
  },
  replay: "safe",
});
```

登记时同时保存：

- **锚点**：会话 ID，以及这次工具结果所在的记录 ID。
- **恢复摘要（resume capsule）**，由 Agent 填写：为什么要问；当时正在做什么；考虑过哪些选项；拿到回应后打算怎么做；哪些后续步骤依赖它；**依赖的前提**（业务对象版本、Execution 内文件版本、其他 decision 的结论）。

恢复摘要是最精炼的相关上下文，不受会话压缩或 reset 的影响，也是恢复前检查前提是否过时的依据。

**恢复**。Resolution（或覆盖部分问题的回应）记录后，按顺序执行：

1. **授权检查**：归属人的本人委托、业务主体和范围仍然有效。无效时，工作项保持阻塞，阻塞原因改为 `authorization`。
2. **前提检查**：比较恢复摘要中的前提与当前状态。宿主能直接比较的（Execution 内文件版本、其他 Request 的状态）由宿主比较；业务事实版本交给 Agent 在恢复后自行核验，输入里明确要求它先核验。
3. **选择恢复方式**：

| 情况 | 恢复方式 |
| --- | --- |
| 工作项会话空闲，最后一步就是这个请求（常见情况） | 原地继续：向同一会话提交输入，`entry.kind = "airic.decision.resolution"` |
| 会话在请求后还继续做过同一工作项的其他事（"登记后继续"模式） | 走得不远时用 steer 或 follow-up 加恢复摘要；走得远或中间有压缩、reset 时，从锚点 fork |
| 前提已实质变化 | 不直接恢复；通知协调会话，由它决定重新评估、作废工作项或重新发起请求 |
| 已采用的回应被更正 | 从锚点 fork 重做，保留旧分支用于审计，旧分支产物标记为"可能失效" |

4. 输入被放进会话、Agent 开始据此行动后，写入 **Adoption** 并清除对应的 WorkItemBlocker。

**部分回应**只推进它明确覆盖的问题。Agent 在新的运行里处理已覆盖部分；如果仍需要其他问题的答案，再次登记或停止，Request 保持 `partially_answered`。

**Fork 时必须补充的内容**：请求之后的变化说明（其他已解决的 decision、产物变化、业务事实变化）；独立的工作目录和沙箱映射（fork 继承原 `cwd`，宿主必须改为新分支目录，不让新旧分支共用可写挂载）；结果通过 `work_item_complete` 交回协调会话合并，不直接覆盖主线产物。会话 fork 不会把文件回滚到锚点；新分支只复制明确选定的文件，并在恢复输入里说明版本。

Fork 点选在工具结果所在的记录，不选在工具调用所在的记录。否则新会话停在一个没有结果的工具调用上。

**Steering 与批量工作结果接续**

测试/现场查验及整改仍通过业务系统的 TestTask/Finding、测试计划和反馈列表集中交接。结果返回后，工程师提交 steering 的文字、结果文件或固定业务资料引用，无需逐个填入 Request。

1. 校验 Execution 访问范围及提交身份，按幂等键保存 SteeringInput、固定附件和 Outbox；先返回输入已接受，再跟踪投递及实际采用。重复派发使用稳定输入 ID，不重复投递或重复写业务记录。
2. 输入先交给 Execution 协调会话，再定位需要读取结果的工作项；具体忙碌会话的排队/安全投递及运行时 API 映射待验证。不把 steering 接受等同于强制中断正在执行的业务操作，也不自动重开已结束/已取消的 Execution；终态输入策略待设计。
3. Agent 读取文件，核验来源、固定修订、任务/报告/Assessment 身份、执行条件及覆盖范围。必要时用业务工具登记资料和 TestTask/Finding 交付或响应，核对当前业务版本后更新相关 Assessment 草稿；最终提交与确认仍由工程师在 CertLab 完成。事项不明或需新增专业判断时，单独发起 Request。
4. Steering 不自动清除 `decision_request` 阻塞，不建立 Resolution，也不把批量回传当成工作完成或专业通过；只推进已核验且有权修改的部分。对已回答 Request 的实质影响另行核验，原判断与历史保留。
5. 记录输入已接受、文件可读取、Agent 已采用及逐项业务更新的关联与回执；结果未知按原 BusinessOperation 查询，不因一份文档覆盖多个事项而重放整批操作。

### 7.5 Airic 扩展：提供给 Agent 的工具

| 工具 | 可用会话 | 说明 |
| --- | --- | --- |
| `work_item_create` / `work_item_cancel` | 协调 | 创建工作项，声明依赖关系 |
| `work_item_status` | 协调 | 查询工作项与阻塞情况 |
| `execution_finish` | 协调 | 提交执行结果摘要，Execution 进入 `agent_finished` |
| `work_item_complete` / `work_item_fail` | 工作项 | 提交结构化结果和产物（产物进入 Execution 视图），`terminate: true` |
| `decision_request` | 协调、工作项 | 见 7.4 |
| `om_read` / `om_search` | 全部 | 只读固定 SHA 的运行时快照，排除 `.ome/` |
| `input_file_open` | 工作项 | 按 ID 打开 Request 或 steering 引用的附件，也可以在 Execution 只读视图中浏览 |
| `execution_files` | 协调、工作项 | 按来源、Request、steering 输入、工作项、关键字查询 Execution 视图中的文件 |
| 业务 MCP 桥接工具 | 工作项 | 以归属人本人身份调用；写操作走 BusinessOperation 账本；文件传输由宿主完成 |
| `read` / `write` / `edit` / `bash` | 工作项 | Pi 自带工具，文件操作与命令执行统一经过 Docker 内的 `ExecutionEnv`，不回退到宿主 |

工具的 `replay` 声明：只读工具声明 `safe`；业务写入工具不声明 `safe`，中断后由 BusinessOperation 账本按"先查回执"恢复。

### 7.6 Harness 生命周期

- 进程启动时，对状态为 `starting`、`running`、`cancel_requested` 的 Execution 打开 Harness 并调用 `resume()`，同时新建 ExecutionAttempt。
- `waiting` 的 Execution 不打开 Harness。事件到达时再打开，提交输入后由 Pi 调度运行。
- 所有任务都空闲（`harness.wake().active` 为假）超过空闲时限后关闭 Harness，释放资源。
- 沙箱生命周期独立于 Harness：工作项本次运行结束且工具调用已收尾后，停止并删除容器，保留可写工作目录；等待人工回应时不保活容器。事件到达后按同一目录和固定镜像重建，不依赖容器内存、临时文件或后台进程续跑。
- `runtime_leases` 表记录哪个宿主持有哪个 Execution 的存储，带心跳。单进程下它主要用于防止误操作；以后多进程部署时用来保证"一个存储只被一个进程拥有"。
- 并发控制：全局、每个 Project、每个 Execution 的同时运行会话数上限，由派发器执行。

### 7.7 取消

1. API 记录取消请求，Execution 进入 `cancel_requested`，返回"已接受"。
2. 派发器对所有会话调用 `abort()`，并撤回队列中的输入；SandboxManager 停止并回收该 Execution 的容器，必要时强制终止容器内全部进程。
3. 所有会话空闲且沙箱进程确认停止后，Execution 进入 `cancelled`，记录实际停止时间；无法确认停止时保持 `cancel_requested` 并报告原因。
4. 状态为 `dispatched` 或 `unknown` 的 BusinessOperation 继续查询回执，结果单独显示。取消不回滚已发生的业务效果。

### 7.8 Trajectory 投影

宿主订阅 Pi 的提交（`observeCommits` / `subscribeCommits`，以锁定版本的 API 为准），把会话记录、工具调用与结果、运行失败等投影为 TrajectoryEvent，`sourceRef` 指向原记录，按唯一约束幂等写入。人工回应、Resolution、Adoption、业务回执由各应用服务直接写入 Trajectory。投影过程中做脱敏，凭据不进入任何记录。

### 7.9 版本与升级

- Pi Durable、pi-ai、chord 锁定精确版本。升级前用代表性 OM 和回归案例验证。
- Execution 记录启动时的 Runtime 版本和 Skill 版本。进行中的 Execution 遇到不兼容的升级时，保持阻塞并报告原因，不静默迁移。
- Execution 同时记录工具镜像 digest 和沙箱策略版本。容器重建沿用固定镜像，不随 `latest` 漂移；镜像不可用时报告运行环境错误，不静默替换。
- 扩展和工具名称保持稳定。Pi 按名称保存扩展，重启后必须重新安装同名扩展，挂起的任务才能继续。

---

## 8. Execution Workspace

### 8.1 目标

- 每个 Execution 有自己独立的工作区，不和其他 Execution 共享。跨 Execution、跨 Project 都不共享文件，与 PRD"跨用户、跨 Project 不自动共享"一致。
- Execution 内部的工作项之间通过一个只读视图共享：回应附件、业务系统下载的文件、已完成工作项交付的产物。
- 写入有边界：工作项只能写自己的目录；产物通过 `work_item_complete` 交付后才进入只读视图。
- 每个文件都有来源、版本和 SHA-256。
- 多个 Execution 需要同一份材料时：业务资料以业务系统为准，由各 Execution 用自己归属人的身份分别取得；用户材料在各自的 Request 中提供。Airic Work 不另建跨 Execution 的共享区。

### 8.2 目录布局

```text
$AIRIC_DATA/
  db/airic.sqlite
  blobs/sha256/ab/cd/<sha256>            内容寻址，只增不改
  om/
    mirror.git                            OM 仓库镜像（bare）
    snapshots/<sha>/runtime/              运行时快照，排除 .ome/
  executions/<executionId>/
    pi.sqlite                             该 Execution 的 Pi 存储
    view/                                 Execution 只读视图
      inputs/attachments/<请求短码>/<文件名>   回应附件，随回应提交放入
      inputs/steering/<输入短码>/<文件名>     结果文档等 steering 附件，随输入提交放入
      inputs/business/<来源系统>/<对象>@<修订>/<文件名>   业务系统下载的文件
      artifacts/<工作项短码>/...            已完成工作项交付的产物
      .airic/index.json                   文件清单：路径、版本、来源、关联 Request/steering/工作项、可读状态
    work/<workItemId>/<conversationId>/   工作项会话工作区（可写，fork 使用新目录）
```

`view/` 是根据数据库中的文件清单生成的物化视图，不是权威数据。权威数据是 ExecutionFile 记录加 Blob。

### 8.3 工作项的执行环境

每个工作项会话看到的文件系统：

| 挂载点 | 来源 | 权限 |
| --- | --- | --- |
| `/workspace/work` | `executions/<eid>/work/<wid>/<cid>/` | 读写 |
| `/workspace/execution` | `executions/<eid>/view/` | 只读 |
| `/om` | `om/snapshots/<sha>/runtime/` | 只读 |
| `/tmp` | 临时目录 | 读写，运行结束后清理 |

协调会话不创建命令执行容器，通过受限宿主工具读取当前 Execution 视图和 OM 快照；不开放任意宿主文件读取或命令执行。

**选定方案：每个工作项会话一个 Docker 沙箱。** Pi 的 `cwd` 不是权限边界，所以 `read/write/edit/bash` 必须统一经过沙箱，不能只把 Bash 放进容器。新旧 fork 分支使用不同的工作目录和容器。

**宿主与沙箱的分工**

| 宿主控制面 | Docker 沙箱 |
| --- | --- |
| Pi Durable、Pi SQLite、模型调用、业务 MCP、权限检查、BusinessOperation、凭据、Blob 与文件登记 | `pi-env` 守护进程、文件操作、Bash/Python/Node 等文件处理程序 |
| 通过工具入口访问业务端点，不提供任意 URL 网络代理 | 无网络，不持有模型或业务凭据，不挂载数据库、Blob 根目录或 Docker socket |

**执行环境接入（待阶段 0 验证）**

1. `SandboxManager` 按 Execution、工作项和会话查找或创建容器；容器中只启动执行环境守护进程，不运行 Pi CLI。
2. 优先复用官方 `pi-env`：`Connection` 通过 `docker exec -i` 的标准输入输出启动容器中的 `pi-env` 守护进程，再交给 `RemoteExecutionEnv`。不开放 TCP 服务，不启用 SSH，不分配 TTY。
3. `env` 回调返回该会话沙箱对应的环境，`cwd = /workspace/work`；连接和容器由 SandboxManager 持有，不因每次工具调用重新创建。环境 `id` 标识同一个容器文件命名空间，重连保持一致，重建容器使用新标识。
4. 宿主扩展工具的注册由宿主代码控制，不允许从 OM、附件或工作目录动态加载可在宿主执行的扩展。业务调用只经过已注册的受控工具。
5. 对这套连接运行 Pi 的 `registerEnvConformance()`，并验证流式输出、大文件、超时、取消、连接中断和容器重建。验证不通过时修复适配，不静默回退到宿主执行。

**容器基线**

- 固定镜像 digest，预装 Bash、Python、Node、检索和文档处理工具；首版不支持运行时联网安装依赖，需要新增能力时构建并验证新镜像。
- 非 root 用户、只读根文件系统、丢弃全部 Linux capabilities、`no-new-privileges`，保留默认 seccomp；禁止 privileged、宿主 PID/网络命名空间及任意设备挂载。
- 只有上表中的工作目录可持久写入；`/tmp` 和必要的用户缓存目录使用有大小限制的临时存储。配置 CPU、内存、进程数、命令超时及工作目录磁盘配额。
- 容器环境变量采用白名单，不透传宿主环境。使用 `--network=none`；模型与业务调用直接在宿主完成，不通过给容器注入凭据或联网权限实现。
- 宿主根据数据库映射生成挂载路径，不接受 Agent 自选宿主路径。读取、上传或交付产物时校验路径及符号链接，不能越出所属会话工作目录或当前 Execution 的只读视图。

**重启与回收**

- 沙箱是可丢弃执行环境，工作目录才是持续状态。等待人工输入时删除容器；恢复后重新挂载原目录，`/tmp` 和后台进程不保留。
- 主进程重启后，先按容器标签和宿主所有权核对并终止遗留沙箱，再恢复对应 Harness，防止旧进程与恢复会话同时写一个目录。无法确认旧沙箱已停止时不启动新沙箱。
- `env.cleanup()`、工具超时和 `abort()` 的职责必须区分：单次调用取消不能关闭其他并发调用共用的环境；整次运行收尾由 SandboxManager 回收容器。首版不支持跨运行存活的后台服务。

**开发与生产一致**。两者均使用 Docker，macOS 开发通过 Docker Desktop 或兼容的 Linux 虚拟机运行。Docker 不可用时报告运行环境错误，不提供面向真实 Execution 的本机弱隔离回退；单元测试可使用明确隔离的 mock。

### 8.4 Execution 文件

**ExecutionFile**（Execution 只读视图中的一个文件）
- `id`、`executionId`、`path`（视图内路径）、`version`、`blobSha256`
- `origin`：`response_attachment` | `steering_attachment` | `business_download` | `work_item_artifact`
- `provenance`：上传者与关联的 Request/RequestResponse 或 SteeringInput；或来源业务对象、修订与取得时使用的业务主体；或交付它的工作项
- `readability`：解析结果与限制说明，Agent 和用户都能看到
- `status`：`current` | `superseded`
- 每个 Execution 维护一个单调递增的视图修订号 `viewRevision`

四种来源进入视图的方式：

- **回应附件**（见 9.1）：回应提交的同一事务内登记，路径为 `inputs/attachments/<请求短码>/<文件名>`。同一目录下文件名重复且内容不同时自动加序号，不覆盖。回应记录引用的是固定的 Blob，不是视图路径。更正回应时，新附件作为新文件加入，旧文件保留。
- **Steering 附件**（见 9.1）：steering 提交的同一事务内登记，路径为 `inputs/steering/<输入短码>/<文件名>`，保留固定 Blob 与提交来源；同名不覆盖，不要求关联 Request。
- **业务下载文件**（见 9.2）：宿主核对大小和哈希后登记到 `inputs/business/...`。同一 Execution 只代表一个归属人，所以它的所有工作项都可以读取。
- **工作项产物**：`work_item_complete` 列出工作区内的产物路径，宿主计算哈希、写入 Blob，登记到 `artifacts/<工作项短码>/...`。工作项被替代时，它的产物标为 `superseded`，新工作项的产物作为新版本加入。

Agent 不能直接写入视图，只能通过以上四条路径。

**发现文件**：Agent 可以直接浏览 `/workspace/execution`，读取 `.airic/index.json`，或用 `execution_files` 工具按来源、Request、steering 输入、工作项、关键字查询。Agent 把某个文件作为判断依据时，记录文件 ID、版本和 SHA-256，写入 Trajectory 和 Decision Context 引用。

**读取记录**：`read`、`edit` 等工具读取视图中的文件时，记录文件 ID 和版本。`bash` 无法逐个拦截文件访问，所以每次运行开始时记录当时的 `viewRevision`。

**清理**：Execution 结束后，工作区保留用于追溯。`work/` 目录和 Blob 何时清理由留存策略决定（待设计）；ExecutionFile 记录不改写。
---

## 9. 文件、附件与业务文件传输

### 9.1 回应与 steering 附件上传

1. `POST /api/v1/uploads` 创建上传会话（关联 Execution，声明用途为 Request 回应或 steering，以及文件名、大小、类型；回应用途另校验 Request，steering 不要求 Request）。
2. `PUT /api/v1/uploads/:id/content` 上传字节，服务端边接收边计算 SHA-256，写入 Blob。
3. `POST /api/v1/uploads/:id/complete` 校验大小和哈希，生成 InputFile，`readability = pending`。
4. 后台任务用文档处理工具尝试读取，更新为 `readable` 或 `failed` 并附限制说明。
5. 提交回应或 steering 时只能引用 `readable` 或明确允许的文件；未完成的文件不会被悄悄附加。上传失败不影响文字草稿（草稿由前端保存）。
6. 回应或 steering 提交的同一事务内，附件的 InputFile 变为 `attached`，绑定对应 RequestResponse 或 SteeringInput，并登记为该 Execution 的 ExecutionFile（见 8.4）。提交前处于 `staged` 状态的文件只有上传者本人可见；放弃的草稿附件标为 `discarded`，按留存策略清理。

### 9.2 业务文件传输

按 PRD 的"MCP 协商 → 宿主 HTTP 搬运 → MCP 登记"模式实现，以 CertLab `certlab/v3` 合同为第一个适配：

- **下载**：Agent 调用 `asset.download` 协商固定修订 → 宿主用本人凭据下载 → 核对大小和哈希 → 写入 Blob → 登记到该 Execution 视图的 `inputs/business/`（见 8.4）。
- **上传登记**：Agent 指定工作区文件 → 宿主计算大小和哈希 → `asset.upload-prepare` → 宿主上传字节 → `asset.upload-commit`，整个过程记录为 BusinessOperation。
- 凭据只由宿主放入请求头，不进入 URL、工具参数、模型可见内容或轨迹。
- 宿主只访问已配置、经合同校验的业务端点。
- 登记结果未知时，先用原 `commandId` 查询；传输描述过期时重新协商，但不重新创建已登记的资料。

---

## 10. 一致性机制

### 10.1 本地事务 + Outbox

所有"状态变化 + 需要触发的后续动作"在同一个 SQLite 事务里写入：

```text
BEGIN IMMEDIATE
  写入业务表（如 Resolution、WorkItemBlocker 变化）
  写入 outbox(id, topic, payload, available_at, attempts, locked_until)
COMMIT
```

派发器在进程内循环拉取 `available_at <= now` 且未锁定的记录，执行后删除或标记完成；失败时指数退避。处理器必须幂等：对 Pi 的提交使用确定性的 `requestId`，对数据库写入使用唯一约束。

主要 topic：`execution.start`、`runtime.deliver`（向会话提交事件）、`runtime.abort`、`file.parse`、`business.reconcile`（查询未知操作回执）、`om.sync`、`notify.user`。

### 10.2 API 幂等

- 写接口接受 `Idempotency-Key` 请求头。
- 幂等范围：调用方 + 操作类型 + 幂等键。
- 同一个键、相同请求内容：返回原结果。同一个键、不同请求内容：返回 `409`。
- 创建 Execution 的指纹覆盖完整创建输入，包括分组标识/名称、自定义 `task`、`instruction` 以及可信确定的执行归属关系；相同键的冲突检查先于任何创建副作用。
- 创建幂等记录、按唯一约束查找/创建 Project、新建 Execution 并保存输入快照、写入 `execution.start` Outbox 在同一事务内完成，避免重试或并发创建重复分组/执行。首次接受后，重复请求返回原结果，不重新启动或更新 Project。
- `task.id` 是业务关联，不是创建幂等键。同一 task 用新键可创建多个 Execution；失败后的恢复与新建执行仍是不同操作。
- 记录保存在 `idempotency_records` 表，保留期待定。

### 10.3 并发与版本校验

- 回应和 Resolution 提交时携带客户端看到的 Request 版本和 Context 版本；不一致时返回 `409` 和变化说明，前端保留草稿，要求复核。
- SQLite 只有一个写入者：写事务用 `BEGIN IMMEDIATE` 并设置 `busy_timeout`；**事务里不做任何外部 IO**（模型、MCP、HTTP、文件上传都在事务外）。

### 10.4 外部操作账本

```text
prepared ─► dispatched ─► confirmed
                │      └► rejected
                └► unknown ─(查询回执)─► confirmed / rejected
```

- 先在本地事务中写入 `prepared`（含 `commandId`），再发起外部调用。
- 超时或进程崩溃导致结果未知时，状态为 `unknown`，由 `business.reconcile` 用同一 `commandId` 查询。
- 未确认前，依赖它的工作项保持阻塞（`business_operation` 类阻塞）。

---

## 11. OM 管理

- **同步**：管理员配置仓库、来源分支、凭据引用。同步任务对 `mirror.git` 执行 `git fetch`，记录远端分支的最新提交 SHA 和确认时间。同步失败时历史仍可浏览，并明确显示"未确认最新"。
- **新 Execution 启动**：在 `starting` 阶段对来源分支执行一次 fetch 确认最新 SHA。确认失败时 Execution 停在 `starting` 并报告原因，不使用旧缓存。
- **两种视图，同一修订**：
  - 人工浏览视图：直接从 Git 对象读取（`git ls-tree`、`git show`），包含 `.ome/` 作者材料并标明用途。
  - 运行时视图：用 `git archive` 导出到 `snapshots/<sha>/runtime/`，排除 `.ome/`，只读挂载给 Agent。Root `om.md`（或配置的入口）作为常驻内容注入系统提示。
- **全文检索**：每个 SHA 同步后建立索引，`om_documents(sha, view, path, content)` 加 FTS5 虚拟表（`tokenize = 'trigram'`）。查询必须同时指定 SHA 和视图，不跨版本混合。trigram 要求查询词至少 3 个字符，少于 3 个字符的查询改为对该快照做 `LIKE` 扫描（单仓库的文件量可以接受）。FTS5 虚拟表不由 Drizzle 管理，用手写 SQL 迁移创建。
- **加载记录**：Execution 记录实际 Root 路径、SHA、Skill 版本；`om_read` 记录每次加载的文件和内容摘要。引用缺失或越界时报错，不回退到作者材料。
- **历史与 diff**：从镜像读取，较大的 diff 限制体积并提供 GitHub/GitLab 外链。

---

## 12. 身份与授权

四层分别校验，任何一层通过都不代表其他层通过：

1. **登录身份**：OIDC 登录，服务端会话（Cookie，`HttpOnly`、`SameSite`）。管理员创建用户，无邀请流程。
2. **业务主体映射**：`platformUserId ↔ (businessInstanceId, externalSubjectId)`，需经业务系统可验证依据确认后生效；每个用户在每个业务实例只有一个有效主体。
3. **本人委托**：用户本人完成的授权（令牌由服务端加密保存，`secrets` 模块用主密钥加密，主密钥来自部署环境）。管理员不能代为同意，也不能读取。
4. **对象与动作权限**：每次业务调用由业务系统判定；Airic Work 在本地按 Execution 范围预先拦截明显越界的请求。

**调用方身份**：业务系统调用标准 API 时使用客户端凭据（具体协议待定，候选为 OAuth2 客户端凭据或签名 JWT），并带上实际发起用户的可验证断言。调用方不能任意填写 `userId`。

**恢复时重新校验**：每次向会话投递事件前、每次业务调用前，都重新校验委托、主体和范围。失效时只阻塞受影响的工作项，其他工作项继续。

**历史快照**：Execution 保存启动时的身份快照；映射或授权变化不改写历史，也不会让运行中的 Execution 静默换人。

### 12.1 工作台可见范围

| 对象 | 谁能看到 |
| --- | --- |
| Execution 及其 Request、回应、Trajectory、Episode | 本人在业务系统中发起的 Execution（发起人；归属人与发起人不同时，归属人也可见） |
| Execution 的文件（附件、业务下载文件、产物） | 与该 Execution 相同；业务下载文件的原文读取另受来源权限限制 |
| Project | 用户在其中至少有一个可见 Execution 时可见；页面只聚合这些 Execution |
| 同一 Project 中他人的 Execution | 不可见；项目列表和统计也不计入 |

- 管理员同样适用以上规则，平台角色不带来额外的业务数据可见性。
- 所有判断在服务端执行；无权限时不泄露对象是否存在。

---

## 13. API 设计

以 `/api/v1` 为前缀，JSON，错误使用统一结构（`code`、`message`、`details`）。以下是资源草案，正式字段在 `packages/contracts` 中定义。

### 13.1 业务系统与工作台共用

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/executions` | 创建执行（幂等）。接收 `project_id`、`project_name`、自定义 `task` 与文字 `instruction`，按业务系统实例及外部分组标识查找/创建 Project，保存输入快照。返回"已接受"，不代表已启动 |
| GET | `/executions/:id` | 进展、结果、实际 OM SHA、已确认与未知效果 |
| POST | `/executions/:id/cancel` | 请求取消（幂等），返回"已接受" |
| POST | `/executions/:id/steering` | 提交补充文字、固定附件或业务资料引用（幂等）；持久化并投递给 Agent，不自动生成 Request 回应/Resolution，不代表相关业务更新已完成 |
| GET | `/projects`、`/projects/:id` | 只返回调用者有可见 Execution 的 Project；统计只计入调用者可见的 Execution |
| GET | `/executions/:id/requests` | Request 列表 |
| GET | `/requests/:id` | Brief、Context 引用、允许动作、回应与处理历史 |
| POST | `/requests/:id/responses` | 逐项提交回应：所选选项、补充文本、覆盖的问题、附件、声明提供者；可同时请求对已覆盖问题形成 Resolution。携带版本，幂等；不提供跨 Request 批量作答/批准接口 |
| POST | `/uploads`、PUT `/uploads/:id/content`、POST `/uploads/:id/complete` | 附件上传 |
| GET | `/input-files/:id` | 文件元数据与可读状态；下载另需权限 |

**创建输入与内部模型映射**

请求示例与产品语义见 PRD“Project 与 Execution 的创建契约”。四项核心输入之外，调用方仍需提供协议要求的可信身份/委托及 `Idempotency-Key`；身份断言格式待定，不允许在自定义属性中自行声明权限。

| 创建请求 | 内部记录与校验 |
| --- | --- |
| `project_id` | 必填外部稳定标识，映射到 `Project.externalProjectId`；`sourceSystemId` 由经验证的接入上下文确定 |
| `project_name` | 必填显示名称，用于首次创建 `Project.name`；与外部标识一起保留在 Execution 的创建快照中 |
| `task` | 自定义 JSON 对象，完整保存并交付 Agent；可选 `id` 用于业务关联，不强制 `type`/`attributes` 或特定业务字段 |
| `instruction` | 必填非空文字，原样保存并交付 Agent，不要求调用方预先提交结构化目标/范围 |

响应明确区分平台内部 Execution ID、Project ID 与原始外部分组标识。平台不根据 `task` 建立业务 Task 状态机，也不从文字或自定义字段扩大授权；业务当前事实由 Agent 经授权工具核验。完整请求/响应 Schema、输入大小限制及已有 Project 的名称更新规则待详细设计。

### 13.2 工作台专用

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/executions/:id/trajectory?cursor=` | 分页，支持类型、时间、Request 过滤 |
| GET | `/episodes/:id` | Episode |
| GET | `/om/source` | 仓库、分支、最新确认 SHA、同步状态 |
| GET | `/om/tree`、`/om/file`、`/om/search` | 均需 `sha` 参数 |
| GET | `/om/commits`、`/om/commits/:sha` | 历史与 diff |
| POST | `/om/sync` | 管理员触发同步 |
| GET | `/executions/:id/files`、`/executions/:id/files/:fileId/content` | Execution 文件清单、元数据与下载，权限同该 Execution |
| GET | `/stream` | SSE：执行状态变化、新 Request、通知 |
| — | `/admin/*`、`/me/*` | 用户、身份映射、连接、系统设置、个人设置与本人授权 |

### 13.3 对外只读轨迹 MCP

挂在同一服务的 `/mcp` 路径。只提供定位执行、分页读取轨迹、读取 Episode 和必要版本引用的工具。每次调用校验客户端授权、用户授权和数据外发策略，并写入读取审计。不提供任何写入工具。工具名、认证协议和分页一致性规则待设计。

---

## 14. 持久化：SQLite + Drizzle

### 14.1 选型

- 驱动：`better-sqlite3`（同步 API，性能稳定）。Pi Durable 自己的存储使用 Node 内置的 `node:sqlite`，两者在同一进程共存，各自操作不同的数据库文件。
- ORM：Drizzle（`drizzle-orm/sqlite-core`），迁移用 `drizzle-kit`，迁移文件放在 `backend/drizzle/sqlite/`。
- 连接参数：`journal_mode = WAL`、`synchronous = NORMAL`、`foreign_keys = ON`、`busy_timeout = 5000`。
- 待验证：Drizzle 在 `better-sqlite3` 驱动下的事务回调是同步执行的，异步回调的行为需要在阶段 0 确认。无论如何，事务内都不做外部 IO。

### 14.2 字段约定（为以后迁移 PostgreSQL 预留）

| 类型 | SQLite 写法 | 以后 PostgreSQL 对应 |
| --- | --- | --- |
| ID | `text`（UUIDv7） | `uuid` |
| 时间 | `integer({ mode: "timestamp_ms" })` | `timestamp with time zone` |
| JSON | `text({ mode: "json" }).$type<T>()` | `jsonb` |
| 枚举 | `text({ enum: [...] })` | `text` + check 约束，或 enum |
| 布尔 | `integer({ mode: "boolean" })` | `boolean` |

避免依赖某一种数据库独有的特性（JSON 路径查询、数组类型等）。需要按 JSON 内字段查询时，把字段提出来单独成列。

示例：

```ts
export const workItems = sqliteTable("work_items", {
  id: text("id").primaryKey(),
  executionId: text("execution_id").notNull().references(() => executions.id),
  title: text("title").notNull(),
  status: text("status", {
    enum: ["ready", "running", "blocked", "done", "failed", "cancelled", "superseded"],
  }).notNull(),
  conversationId: text("conversation_id"),
  result: text("result", { mode: "json" }).$type<WorkItemResult>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
}, (t) => [index("work_items_execution_idx").on(t.executionId, t.status)]);
```

### 14.3 多数据库支持路径

Drizzle 的表定义按数据库区分（`sqliteTable` 与 `pgTable`），查询 API 基本一致，但类型不同。因此：

1. 应用服务只依赖各模块的**仓储接口**（例如 `ExecutionRepository`），不直接依赖 Drizzle 的数据库类型。
2. 现阶段只实现 SQLite 版本的仓储。
3. 增加 PostgreSQL 时，新增 `schema/pg.ts` 和对应仓储实现。仓储的**契约测试**在两种数据库上运行同一套用例。
4. 少量数据库相关的部分单独实现：全文检索（FTS5 与 `pg_trgm`）、Outbox 拉取（PostgreSQL 用 `FOR UPDATE SKIP LOCKED`）。

迁移到 PostgreSQL 的触发条件见 D3。迁移时 Pi 的存储可以继续使用每个 Execution 一个 SQLite 文件，或者按 Pi 的 Storage contract 实现 PostgreSQL 存储并跑一致性测试。

### 14.4 不采用的方案

把 Pi 的表放进 `airic.sqlite`（Pi 支持表名前缀），以获得跨两边的原子提交。不采用的原因：Pi 要求所有操作走它的适配器队列，绕过队列的直接写入可能被 Pi 的事务回滚；这还会让 Airic 数据库和 Pi 的生命周期耦合，并失去按 Execution 隔离的好处。两边的一致性由 Outbox 和幂等键保证。

---

## 15. 可观测性与审计

- **OpenTelemetry**：HTTP、数据库、派发器、业务调用各自产生 span。Pi Durable 支持接入宿主的 telemetry context（只记录 ID 和控制元数据，不记录消息内容），一并接入。
- **关键指标**：Execution 各状态数量、工作项阻塞时长、Request 等待时长、派发失败与重试次数、`unknown` 业务操作数量、OM 同步失败、Harness 打开数量、模型用量与成本。
- **日志**：结构化 JSON，脱敏，不记录凭据和隐藏思考链。
- **审计**（`audit_records`）：账户、身份映射、委托、连接配置、OM 同步、外部 MCP 读取、取消操作。记录操作者、对象、时间、结果和变更摘要，只追加。

---

## 16. 部署与备份

### 16.1 阶段一部署形态

- 单节点、控制面单进程：在专用 Linux 节点上以系统服务运行 Fastify API、派发器和 Runtime Host；工作项工具在独立 Docker 容器中执行。这里的"单进程"不包含沙箱内的工具进程。
- 前端静态文件由同一服务或 CDN 提供，需要 SPA fallback。
- `$AIRIC_DATA` 使用本地持久磁盘，工作目录挂载权限必须与容器用户匹配。
- SandboxManager 按 8.3 节管理本机 Docker 容器，优先验证 rootless Docker 下的只读挂载、资源限制和 UID 映射；首版不采用 Docker-in-Docker。
- Docker 管理权限属于可信控制面，不暴露给 Agent 或工作项容器。若以后把控制面也容器化，需另行设计受限的容器管理接口，不把挂载宿主 Docker socket 当作普通低权限配置。
- 配置：环境变量加数据库中的系统设置；主密钥来自部署环境的密钥管理。

### 16.2 备份与恢复

需要一起备份的内容：`airic.sqlite`、所有 `pi.sqlite`、`blobs/`、各 Execution 的 `work/` 目录。`view/` 是物化视图，可以根据清单重建，不必备份。

- SQLite 使用在线备份（`VACUUM INTO` 或持续复制工具，如 Litestream），不能直接复制正在写入的文件。
- Blob 只增不改，可以增量同步。
- 恢复演练纳入阶段 4 验收：恢复后 Execution 能继续，`unknown` 业务操作能对账。

### 16.3 容量与限制

- SQLite 单写入者：只能单进程运行。写入频率主要来自 Trajectory 投影和派发器，阶段一规模下预计足够，需要在阶段 0 压测确认。
- Pi Durable 进程内存：README 提到 TypeBox 未打包时峰值约 23 MB（按进程计）；每个打开的 Harness 的内存占用需要实测，空闲关闭策略据此调整。

---

## 17. 安全要点

- 每个服务端操作都校验身份、对象权限和必要委托，不依赖前端隐藏按钮。
- 无权限时不泄露对象是否存在，也不泄露数量。
- 凭据只在宿主进程内解密使用，不传给沙箱、模型、浏览器或日志。
- Docker 沙箱无网络；业务端点和模型端点只由宿主访问并限制目标地址，不向沙箱提供任意网络代理。Docker 共享宿主内核，不视为独立内核的强多租户隔离边界。
- 输入文件和业务内容里的指令性文字只当资料处理，不授予任何权限。工具权限由宿主按会话类型决定，不由提示词决定。
- Markdown 安全渲染、路径穿越校验在服务端同样执行。

---

## 18. 实施阶段

| 阶段 | 内容 | 完成标准 |
| --- | --- | --- |
| 0 能力验证 | Pi Durable 锁定版本：`terminate` 结束运行、空闲会话再提交、`kill -9` 后同 `requestId` 重放、从锚点 fork、按会话构建 `env`；Docker + pi-env 接入与环境一致性测试、目录和网络隔离、环境变量不泄露、取消及遗留进程回收、容器重建、rootless 挂载和资源限制；Drizzle + better-sqlite3 事务行为；FTS5 trigram 中文检索效果；CertLab MCP 文件传输链路；SQLite 写入压测 | 每项有可重复运行的验证脚本和结论记录 |
| 1 最小执行闭环 | 创建/查询/取消 API（幂等）、按外部分组标识查找/创建 Project、自定义 task 与 instruction 输入快照、OM 同步与运行时快照、协调会话 + 单工作项、Workspace 目录与挂载、Trajectory 投影、Outbox 派发器 | 一个 Execution 从创建到 `agent_finished` 全程可追溯；进程重启后能继续 |
| 2 决策协作 | 多工作项与阻塞关系、`decision_request` 登记与恢复路由、逐项选项判断与补充文本、回应/Resolution/Adoption、部分回应与更正、steering 输入投递及附件读取、工作项产物交付、可见范围、SSE、对接前端 | 一个工作项等待 decision 时，其他工作项继续；Request 逐项处理；steering 不冒充判断回应；更正走 fork |
| 3 业务链路 | 身份映射与本人委托、业务 MCP 桥接、BusinessOperation 账本与对账、业务文件传输、授权失效处理、业务下载文件进入 Execution 视图 | 授权失效只阻塞受影响工作项；未知业务结果可对账，不重复写入 |
| 4 生产补齐 | 对外只读轨迹 MCP、审计、留存与脱敏、备份恢复演练、沙箱加固、可观测性、按需实现 PostgreSQL 仓储 | 通过 PRD 核心验收表中的各项场景 |

---

## 19. 风险与待决问题

### 19.1 主要风险

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| Pi Durable 是 Experimental，API 可能变化 | 升级成本高，行为变化 | 锁定版本；所有调用经 `RuntimeAdapter`；回归案例 |
| fork 后 provider 会话标识变化，可能影响 prompt cache | 成本上升 | 阶段 0 实测；fork 只用于更正和走远的情况 |
| Docker 与 pi-env 接法、挂载或回收行为不符合预期 | 越权访问、遗留进程或恢复时并发写入 | 阶段 0 运行环境一致性与故障注入测试；失败时不回退到宿主执行 |
| Docker 共享宿主内核，控制面持有容器管理权限 | 容器逃逸或控制面失陷可能影响整节点 | 专用节点、最小权限、优先验证 rootless；需要更强边界时评估 micro-VM |
| SQLite 单写入者 | 无法横向扩展 | 仓储接口隔离；达到触发条件时迁移 PostgreSQL |
| trigram 不支持少于 3 个字的查询 | 中文短词搜索效果差 | 短查询回退到 `LIKE`；阶段 0 评估 |
| 恢复摘要质量依赖 Agent | 恢复时上下文不足 | 工具参数结构化并设必填项；用回归案例检查 |
| Execution 内文件和产物较多时，Agent 难以找到相关材料 | 漏用材料或误用旧版本 | 维护 `.airic/index.json` 和 `execution_files` 查询；Decision Context 引用记录文件版本 |

### 19.2 待决问题

1. 归属人与发起人不同时的可见性：本设计假设两人都能看到该 Execution，需要确认。
2. 多个 Execution 需要同一份用户材料时，是否允许业务系统在创建 Execution 时传入输入文件引用，以免用户重复上传。
3. 协调会话的模型与工作项会话的模型是否不同；模型选择由实例配置还是由 OM 声明？
4. 每个 Project、每个 Execution 的并发运行会话数上限的默认值。
5. Execution 工作区、Blob、Pi 存储的留存期限与清理规则。
6. 业务系统调用标准 API 的认证协议，以及实际发起用户断言的格式。
7. 对外只读 MCP 的客户端授权协议与分页一致性规则。
8. Episode 是否也覆盖没有 Request 的 Agent 自主判断；如果覆盖，如何标记。
