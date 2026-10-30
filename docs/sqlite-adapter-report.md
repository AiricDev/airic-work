# SQLite / Support 交付与验证

日期：2026-10-30。范围依据已批准的非 Agent adapter 第 1 批计划。

## 已实现

* `backend/src/adapters/driven/sqlite/store.ts`：完整 ControlStore，包含读取、命令去重、命名原子提交、当前资格/归属复查、CAS、固定关联和责任保护。
* `schema.ts` / `migrations.ts`：关系约束、身份/Project/命令/输入唯一性、不可变记录保护、带摘要的顺序迁移。
* `database.ts`：WAL、FULL、foreign_keys、有限 busy_timeout；新建目录/文件权限；连接失败关闭与安全错误。
* `backend/src/adapters/driven/support/system-support.ts`：UUIDv7、UTC 时间。
* `backend/src/bootstrap/persistence.ts`：显式资源创建和幂等关闭；空库配置初始化不覆盖已有设置，不创建管理员。

Domain/Application/ports 未改动。Store 以 Application 的命名合同和既有领域函数兑现提交保证，不引入通用事务回调。

## 验证

`npm run check` 执行严格类型检查及全部后端测试。本批完整结果为 **9 个测试文件、104 项测试**：

| 证据 | 内容 |
| --- | --- |
| 共享合同 | MemoryStore / SQLite 各 17 项；覆盖全部公开 Store 方法及固定 Method 的 JSON 键序回归 |
| SQLite 专用 | 26 项；配置、迁移、权限、重开、真实关系约束、五个写入点故障、独立进程竞争与崩溃恢复 |
| Support | UUIDv7 类型/唯一性及 UTC 时间 |
| 原有测试 | 43 项内层行为、入口校验/DI 和依赖方向检查继续通过 |

具体故障与竞争证据：

* 回答事务的 decision INSERT、request UPDATE、input INSERT、file binding INSERT、command INSERT 各自失败时，所有相关写入回滚；原序号不被消耗。
* 多进程同时初始化空库、创建相同外部身份、同命令提交/异内容冲突、同 Project 创建、并发回答与分配输入序号。
* 最后有效管理员、停用与提交、用户责任与新执行、Finish 与新输入、配置 CAS 的进程竞争。
* 回答事务提交前/后 SIGKILL 写进程，再重新打开文件数据库；分别证明完整回滚/完整提交，同键恢复不重复回答或输入。
* 连接关闭后的读写均返回安全的规则错误，不携带驱动 SQL、绑定参数或原始异常。

## 不包含及交接

* Input/附件绑定已持久保存，但没有派发 worker、认领/租约/重试策略或 Runtime 接收实现。
* Upload 描述受范围及不可变约束保护，但实际 Blob 字节固定属于下一批 Files，不由 Store 声称已验证。
* Session ID / Workspace ID 是稳定控制关联，不代表真实 Session 或目录已创建。
* Pi、History、Workspace/Docker、工具入口、停止确认、恢复调度由独立 Agent 任务负责；未设计或实现它们。
* 没有 HTTP、真实认证、业务 MCP 或前端接入；首次管理员引导仍待独立确认。
* 当前环境为 macOS、Node 24.11.1；未验证 Linux 部署、物理断电、备份恢复或硬件存储保证。SIGKILL 不等同于断电。

下一批为 Files Blob，需要单独确认实施，不自动扩大本轮范围。

## 变更后设计复查

现场路径完整可用，无需重建历史：architecture-map → ports/use cases → MemoryStore/行为测试 → SQLite/Support → 组合根。后续修改同一路径进入；数据库结构修改须同步 schema、追加 migration 并运行合同/集成测试。

| 检查 | 结果 | 证据 | 后续风险 | 置信度 | 处置 |
| --- | --- | --- | --- | --- | --- |
| Missing Path | not-found | 现有索引直接定位端口与用例；新增 SQL 映射/迁移、测试与资源入口已按批准范围互相链接 | 后续结构变更若遗漏迁移会破坏兼容性，README 已明确同改闭包 | 高 | 无额外行动 |
| Boundary Bypass | not-found | 内层未导入 SQL/SDK；生产不依赖 tests；工厂只返回端口与 close；直接 SQL/触发器只用于验证存储保证 | 不可复制测试的直接 SQL 为业务入口，也不可将 delivered 解释为 Agent 已处理 | 高 | 无额外行动 |
| Unowned Capability | not-found | 事务/迁移归 SQLite，时钟/ID 归 Support，资源归 bootstrap；Agent 环境明确留在独立任务 | 后续 MCP 接入不可另建第二份调用历史或越过用例派发 | 中 | 无额外行动 |

没有发现需要新增能力负责人或重画边界的可执行路由问题。本复查不证明整个产品模型、Agent 或部署安全已经验证；未修改 AGENTS.md 或开发技能。
