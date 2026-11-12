# Airic Work 技术设计

本文定义 headless OM Agent Worker 的目标设计。公开资源使用 Task，Session 保存 Agent 的持久会话和轨迹。现有运行内核仍使用 Execution 命名。产品语义与验收目标见 [PRD](prd.md)，目标接口见 [OpenAPI](openapi.yaml)。

## 部署与系统边界

- 一个受企业管理的 Airic Work 实例包含 HTTP API、后台 Worker 和持久卷。首版可将 API 与 Worker 装在同一服务中，API 处理短请求，Worker 独立领取持久工作。HTTP 请求结束后，Task 可以继续运行。Worker 暂停时，只要 API 和存储可用，调用方仍能提交回答。
- Airic Work 独立验证 API 调用方。实例以固定配置接入模型服务，启动任务时装配 Worker 提示词、指定版本的 OM、受隔离的 Workspace 和零个或多个 MCP 连接。模型服务、沙箱和持久存储由部署方管理。
- CertLab 的移动端是认证工作的入口。它自己的后端集成层通过 Airic Work API 创建 Task、查询 Decision Request 和代交回答，通过 CertLab 自己的业务接口处理 Test Task。页面用项目或报告外部引用组合两类事项，各自读写原系统。Airic Work 连接失败时，决策区显示加载失败，Test Task、评估和 CertLab MCP 继续可用。
- Airic Work 只在 Task 配置了 CertLab MCP 时调用相应业务工具。两个方向分别走公开合同。CertLab 可以独立部署，Airic Work 也可以通过 OpenAPI 运行无业务 MCP 的任务。
- 获授权的桌面 Agent 通过 HTTP 读取 Session、Decision Episode 和产出引用，按业务权限另取原始结果。OME Skill 在桌面侧组织反思和方法验证，改进后的 OM 由外部发布。对照实验创建新 Task，原 Task 保留原版本。

## 应用边界与运行内核

| 层 | 职责 |
| --- | --- |
| HTTP 接入 | 验证请求、认证、映射错误、输出 DTO 和 OpenAPI。文件传输遵循同一访问范围。 |
| 应用与领域 | Task 准入、授权、状态转换、请求和回答、输入投递意图、取消、恢复协调和查询。 |
| 存储适配器 | Task 目录、控制库事务、索引、凭据保管和文件引用。 |
| Worker 与 Runtime | 保持 Pi Durable 为执行内核，负责装配、持久片段、会话锚点、工具桥接和会话读取。 |
| Workspace 与 MCP | 隔离文件和工具进程，按 Task 配置访问已授权工具并保留调用记录。 |

沿用现有 Domain/Application/Adapter 分层。公开的 Task 和 Decision Request 合同由应用层维护。Pi 的内部 Task、Conversation 和 checkpoint 标识留在运行适配器及其恢复记录。当前实现固定 Pi Durable 1.4.0，升级时使用副本验证旧会话重开和待投递输入恢复。现有实现见 [Pi 运行模块](../backend/src/adapters/driven/runtime/README.md)。

## Task 目录与一致性

首版采用单实例持久卷。每个 Task 用服务生成的 ID 定位目录。

| 位置 | 权威数据 |
| --- | --- |
| 实例级登记库 | Task ID、创建幂等预留及资源定位。跨 Task 待办和调度查询可以使用派生索引。 |
| `tasks/<task_id>/control.sqlite` | 原始任务配置的脱敏记录、固定 OM 和装配身份、Task 控制状态、Decision Request 与 Context 修订、User Decision、Steering Input、待投递输入及回执。 |
| `tasks/<task_id>/runtime/` | Pi Session、运行检查点、分支、实际消息和工具轨迹。 |
| `tasks/<task_id>/workspace/` | 当前 Task 的输入、工作文件和输出。文件引用须在该 Task 授权范围内解析。 |
| 实例级连接表 | MCP 凭据和包含秘密的完整端点以明文保存在 SQLite。Task 控制库仅持连接标识。 |

创建请求按全实例唯一的幂等键预留 Task ID。相同请求重试接续同一预留，参数变化返回冲突。创建请求用 SHA-256 摘要比较内容。先持久化凭据和 Task 初始配置，再把登记标为可运行。中途崩溃时，用同一预留修复未完成初始化。只派发已就绪的 Task，API 仅在初始配置完成后确认创建。全局待办和派发索引可从 Task 控制记录重建，重建与更新都依据 Task 版本，读取详情及写入仍检查权威记录和权限。

对每个 Task，首版只允许一个活动 Worker 持有会话与工作目录的运行权。API 仍可独立追加输入。一次提交回答在控制库的同一事务中检查问题归属和 Context 版本、追加不可变回答、更新已回答状态、记录待投递输入及幂等结果。文件先完成持久化与归属校验，再被输入引用。控制库与 Pi 存储之间通过稳定输入 ID 和可查询回执协调，恢复时按已提交事实补齐另一侧。

## 创建、装配与访问

一次创建请求包含指令、可选资料和外部引用，以及可选的具名 MCP 连接。实例启动时验证配置的 OM 仓库、提交和入口，并固定可接单版本。验证失败时实例停止启动。创建时保存原始委托和当前固定版本，在创建回执返回 pinnedOm。外部引用作为结构化目标传入 Worker。续行使用原装配版本，Workspace 只挂载当前 Task 的工作文件，OM 快照只读。宿主按策略限定可解析的来源、可访问的 MCP 目的地和文件路径。

同一实例的 API 使用一个共享 Bearer。持有者可访问该实例的所有 Task。业务后端核对当前用户权限，提供实际操作者及目标 Task。Airic Work 校验请求和附件归属，将实际操作者记入回答回执。

调用 Airic Work 的凭据与 Worker 调用 MCP 的凭据分别管理。连接认证失败时记录受影响的工作。授权方可以更新同一连接的凭据，恢复前重新验证绑定和权限。敏感端点、请求头和凭据在运行宿主内使用，出站模型输入、Workspace、错误、查询结果和轨迹使用脱敏信息。

### MCP 集成协议

Airic Work 宿主在 Task 的 MCP JSON-RPC 请求中通过 `params._meta` 传递 Task 级上下文。创建请求照常配置 MCP 连接。Task ID 分配后，宿主在发出请求时附加元数据，连接重建后也使用同一个 Task ID。工具参数由业务应用定义。

| 字段 | 类型 | 语义 |
| --- | --- | --- |
| `ai.airic/task_id` | 字符串 | Airic Work 分配的原始 Task ID。该 Task 的各 MCP 连接和续行请求共用此值。 |

接收方先认证 MCP 连接，只对授权声明 Task 上下文的调用方采信该字段。业务权限仍由接收方校验。未接入这项约定的 MCP 服务可忽略该字段。将来新增 `ai.airic/` 字段时，逐项声明语义和信任要求。

例如，业务应用可以用可信的 Task ID 归因 Agent 创建的事项，在事项完成后向原 Task 发送结构化通知。

外部系统负责确认事件与原 Task 的业务关联，并用共享 Bearer投递。Airic Work 按事件 ID 幂等保存，将事件与人工 steering 一起投递到主 Session。事件类型、外部对象引用及其版本由发送方定义，Worker 按 OM 解释并按需读取最新业务事实。

## Decision Request 与续行

1. Agent 提交问题、已知依据及版本、可选回答、适用范围和受影响的工作。请求使用稳定的提问调用标识创建。运行时固化包含已完成提问结果的安全锚点，保存请求与工作分支的关联。若请求已经保存但锚点未提交，重放使用原标识找回请求并补齐锚点。回答可以先入库，投递等路由就绪。
2. 工程师可通过 API 单独作答。每次回答绑定所见的 Context 修订。更正追加新输入并引用原回答，Agent 按最新事实和 OM 判断它对待做工作或既有结果的影响。请求状态、回答投递状态、相关工作续行和业务结果分别读取。
3. Worker 查找该回答对应的工作范围及依赖。多个请求共同阻塞同一工作时，满足该工作的依赖后再调度。独立请求可以乱序作答，先满足依赖的工作先继续。首版允许同一 Task 内串行运行片段，共享 Workspace 和外部写入按此约束协调。
4. 投递前按稳定输入 ID 查询 Pi 是否已接受。已接受时补写交付回执。未接受时按原 ID 投递。接收结果未知时先恢复或查证，避免并行重复派发。Session 实际开始处理相关工作后，API 才能报告已续行。
5. 续行装配提问时的相关上下文、回答与之后适用的补充输入。涉及外部修改时重新读取当前版本。若外部操作已发出且结果未知，保留原命令身份，按 MCP 合同查回执或使用原命令幂等重试。无法查证时显式报告未知结果。

Decision Episode 由问题、Context 历史、回答及有明确关联的 Session 记录组成。跨请求共享的工作可以关联多条请求。Session 查询保留消息和工具调用的来源、时间、可用回执及脱敏说明。桌面复盘可据此区分人工原话、Agent 对回答的理解和实际业务效果。

## 运行状态与取消

Task API 分开呈现本轮运行状态、等待依赖、受阻原因及停止状态。当前没有活动片段时可以等待人工，也可以结束本轮。一个普通结束的 Task 可由回答或补充输入开启下一轮，仍沿用原 Session。进程重启时，协调器根据持久运行状态及实际 Runtime 检查点恢复待做工作。

主动停止采用持久停止意图和运行代次检查。取消被接受后禁止领取新的片段，并通知当前运行与沙箱进程停止。工具派发前再次检查当前运行代次，取消时已经发出的外部调用仍按回执核对。确认当前运行退出后才报告已停止。与停止并发保存的回答保留原回执，未处理输入可查且保持暂停。停止中的 Task 和已主动停止的 Task 均禁止由回答、补充输入或重启自动唤醒。首版通过新 Task 发起新的委托。

## HTTP 与 OpenAPI

目标合同见 [OpenAPI YAML](openapi.yaml)，路由统一挂在 `/api/v1`。实现时用该合同校验请求和响应，并在同一身份和权限规则下提供 Swagger UI 验收入口。

| 路由 | 用途 |
| --- | --- |
| `POST /tasks`，`GET /tasks`，`GET /tasks/{taskId}` | 创建、筛选和查询 Task。创建返回持久 Task ID 与当前状态。 |
| `POST /tasks/{taskId}/steering`，`POST /tasks/{taskId}/cancel` | 追加输入及记录停止意图。 |
| `POST /tasks/{taskId}/notify` | 接收外部系统发往目标 Task 的结构化事件。 |
| `GET /decision-requests`，`GET /tasks/{taskId}/decision-requests` | 分页读取有权查看的待办和任务问题，支持状态及外部引用筛选。 |
| `GET /decision-requests/{requestId}`，`GET /decision-requests/{requestId}/episode` | 读取问题、依据版本和完整协作记录。 |
| `POST /decision-requests/{requestId}/user-decisions` | 提交或更正回答，返回持久回答 ID 及当前投递状态。 |
| `GET /tasks/{taskId}/session`，`GET /tasks/{taskId}/inputs` | 分页查轨迹及工具调用，核对输入保存、投递和续行。 |
| `POST /uploads`，`GET /tasks/{taskId}/files/{fileId}` | 上传归属于已认证调用者的暂存文件，及读取获授权的任务文件。创建或作答时核验并绑定暂存引用。 |
| `PUT /tasks/{taskId}/connections/{connectionId}/credential` | 由授权方更新既有连接凭据，连接端点和任务范围沿用原配置。 |

创建、回答和追加输入接收稳定的 `Idempotency-Key`。同键异参返回冲突。错误响应提供稳定错误码和可披露的对象标识，区分输入不合法、缺少授权、冲突及暂时不可用。已接受的后台工作通过查询返回状态与阻碍。现有 Execution 路由和镜像继续按各自版本的发布合同说明，目标路由以实际实现和生成的 OpenAPI 为准。

## 实施顺序与验证

| 批次 | 交付与验收 |
| --- | --- |
| 独立 Task API | 先复用现有运行和查询能力，接入独立认证、单次任务配置和 OpenAPI。用无 MCP 的资料任务验证创建重试、固定 OM、提问、回答和原 Session 续行。 |
| 目录与恢复 | 落实每 Task 目录、凭据引用、Worker 准入和重建索引。分别在问题保存后、回答保存后、Pi 接收后、MCP 写入返回前中断并恢复。检查请求、回答、输入和业务回执是否收敛。覆盖乱序回答、共享依赖、回答和取消并发。 |
| 自管部署 | 核查模型出站配置、任务文件隔离、凭据脱敏、进程停止及备份恢复。在受保护的持久卷副本上验收恢复。验证清理或重建索引后仍能查待办。 |
| CertLab 与桌面复盘 | 先在 Swagger UI 用真实测试 MCP 跑通草稿写入并核对回执，再在 CertLab 手机入口完成委托、作答和测试数据录入。切断 Airic Work 后验证 CertLab 主路径。用桌面 Agent 读取已授权 Episode 和 Session，按 OME Skill 复盘。 |

新版使用空数据卷启动，旧预览数据无需迁移。

[既有 Worker 运行设计](worker-runtime-design.md) 和 [局部续行机制](decision-continuation-design.md) 保留 Pi 装配、锚点、输入与分支的实现依据。其 Execution 命名、旧身份接入和部署描述按本文映射到目标设计。旧 HTTP 接入已移除。
