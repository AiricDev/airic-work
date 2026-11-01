# 架构路由索引

产品语义：`docs/prd.md`；机制目标：`docs/technical-design.md`。

镜像/Compose 集成：`Dockerfile`、`deploy/compose.yaml`、`docs/container-release.md`；启动/关闭在 `backend/src/bootstrap/serve.ts`，公开静态产物与控制面健康检查在 HTTP adapter 的 `public-delivery.ts`。只复用现有应用合同；生产 Workspace 与自动派发仍未交付。

| 修改意图 | 行为负责人 | 相关合同与验证 |
| --- | --- | --- |
| 自动用户接入、管理与偏好 | backend/src/application/account.ts | domain/model.ts、ports.ts、management.test.ts |
| 集成方 Bearer token 验证与用户信息映射 | backend/src/adapters/driven/identity/https-user-info.ts | Identity；bootstrap/bindings.ts、identity-https.test.ts、identity-application.test.ts；不托管或透传业务 MCP token |
| 本机提升已有用户管理员权限 | backend/src/application/account-maintenance.ts | LocalAccountAdministration；driven/sqlite/account-maintenance.ts、bootstrap/bindings.ts、backend/scripts/grant-admin.ts；不注册普通 HTTP/MCP/容器 |
| 分组/创建/准备/结束/取消 | backend/src/application/execution.ts | domain/model.ts、core.test.ts、recovery.test.ts |
| 请求、回答、更正和 Context | backend/src/application/decision.ts | core.test.ts，提交合同在 ports.ts |
| Steering Input、文件、原执行消息续行 | backend/src/application/input.ts | recovery.test.ts、Runtime/Workspace 合同 |
| Session、Decision Episode、操作查询 | backend/src/application/query.ts | query 组合控制记录与 History，不存第二份轨迹 |
| 动态业务 MCP 调用、发起记录与未知结果 | backend/src/application/mcp.ts | core.test.ts、recovery.test.ts、History/Mcp 合同 |
| OM 浏览、搜索、历史 | backend/src/application/method.ts | 固定快照与 .ome/ 边界，core.test.ts |
| 配置 | backend/src/application/settings.ts | management.test.ts，CAS/管理员规则 |
| 外部只读 MCP 表面 | backend/src/application/readonly-mcp.ts | management.test.ts；无命令入口 |
| 输入结构校验与命令映射 | backend/src/adapters/driving/validation/commands.ts | schemas.ts 使用 Zod；validation-di.test.ts |
| DI 装配 | backend/src/bootstrap/container.ts | Awilix 只在组合根，实例与身份隔离测试 |
| 组合应用能力 | backend/src/bootstrap/container.ts | Awilix 分别注册能力；bindings.ts 负责 adapter 创建和组合 |
| dotenv 部署配置、校验与完整资源装配 | backend/src/bootstrap/bindings.ts | loadConfiguration / createConfiguredBackend；.env.example、bootstrap-config.test.ts；环境变量优先，路径相对配置文件，已有 Settings 不被初值覆盖 |
| 控制记录持久化、事务与幂等 | backend/src/adapters/driven/sqlite/store.ts | application/ports.ts；schema.ts 与 migrations.ts 同步；共享合同及 sqlite-integration.test.ts |
| 数据库连接、迁移与资源关闭 | backend/src/bootstrap/bindings.ts | driven/sqlite/database.ts、migrations.ts；调用方拥有 close，不启动派发 worker |
| 生产 ID 与时间 | backend/src/adapters/driven/support/system-support.ts | Support；UUIDv7 与 UTC，support.test.ts |
| 上传字节固定、Blob 去重与原子发布 | backend/src/adapters/driven/files/local-blob-files.ts | application/ports.ts 的 Files；files-blob*.test.ts、files-upload-integration.test.ts；不负责 Workspace |
| Blob 目录配置与初始化 | backend/src/bootstrap/bindings.ts | 仅向外提供 Files；绝对可信目录，每次操作关闭句柄，不需要常驻资源 disposer |
| Git 方法确认、固定版本读取与来源历史 | backend/src/adapters/driven/methods/git-methods.ts | application/ports.ts 的 Methods；methods-git.test.ts、methods-application.test.ts；不负责 Agent 装配 |
| OM 本地目录/URL、remote 识别及安全同步机制 | backend/src/adapters/driven/methods/repositories.ts | Methods.status/sync；methods-local.test.ts；本地无 remote 仍可运行，不自动拉取 |
| OM 同步能力提示与显式同步权限 | backend/src/application/method.ts | methodStatus/syncMethod；methods-usecases.test.ts；命令入口不接受任意目录/URL，外部只读 MCP 不增加同步命令 |
| 固定方法的中文/短词/路径搜索 | backend/src/adapters/driven/methods/index.ts | methods-search.test.ts、methods-process.test.ts；独立可重建 FTS5 索引，不写控制记录 |
| SQLite 通用连接、事务与错误映射 | backend/src/adapters/driven/sqlite/database.ts | operations.ts；ControlStore 和 Methods 索引共享机制，领域提交仍由各自 adapter 拥有 |
| Methods 允许来源、目录及版本配置 | backend/src/bootstrap/bindings.ts | 显式宿主配置；docs/methods-adapter-report.md；版本声明不证明 Runtime/Skill 已装配 |
| 实现 HOW 与后续批次 | backend/src/adapters/README.md | SQLite/Support、Files Blob、Methods 已实现；其余非 Agent 适配器分批接入，Agent 环境单独开发 |
| Worker 执行方式与运行环境 | backend/skills/airic-work-worker/SKILL.md | docs/worker-runtime-design.md；常驻装配、能力映射、输入/停止恢复与待验证场景 |

依赖方向：适配器 → Application → Domain。`tests/architecture.test.ts` 检查内层导入。前端保留原 AppShell/pages/components，通过 api 与既有 Context 对接；服务端事实来自 HTTP，不反向依赖前端。

Worker 运行入口：`backend/src/bootstrap/bindings.ts`；Pi 机制、历史和 MCP 工具桥接在 `backend/src/adapters/driven/runtime/`，宿主派发入口为 `adapters/driving/worker/execution-runner.ts`；行为证据见 `backend/tests/pi-runtime.test.ts`。隔离 Workspace 和业务网关仍由各自端口接入。

业务 MCP 凭据与 HTTP：`application/mcp-credentials.ts` 负责归属与配置资格，`adapters/driven/mcp/` 负责凭据签发/加密/撤销及逐请求认证；`bootstrap/bindings.ts` 提供组合入口与 Agent 工具。验证为 `tests/mcp-integration.test.ts`，协议见模块 README 与 CertLab 的 assistant-protocol.md。

前端接入路由：`frontend/src/App.tsx` 保留原页面树，`contexts/WorkbenchContext.tsx`、`PlatformContext.tsx` 负责真实查询生命周期与草稿，`api/views.ts` 适配既有显示类型。修改传输先看 `backend/src/adapters/driving/http/contracts.ts`，生成 OpenAPI/schema/routes；行为见 `docs/behavior/frontend-integration.md`，运行说明见 `docs/http-integration.md`。`frontend/tests/integration.test.ts` 防止替换原界面或重新引入 seed。

HTTP 身份、CSRF、分页、文件/SSE：`backend/src/adapters/driving/http/server.ts`；会话生命周期 `session.ts`，监听装配 `bootstrap/http.ts`。用户归属、设置允许列表、上传读取仍由 Application 及其端口负责。
