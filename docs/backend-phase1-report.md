# 第一阶段交付与审阅说明

日期：2026-10-30。依据当前 PRD/Ontology 和技术设计；没有沿用旧后端或前端 mock 的实体合同。

## 已交付

* Domain：账户、Project/Execution、请求/Context/UserDecision、Steering Input、输入文件、纯归属/回答/生命周期/路径规则。
* Application：按 account、execution、decision、input、query、method、mcp、settings 拆分，明确组合入口。
* 原子 Store 合同：创建去重、回答与已回答状态/输入消息一同保存、CAS、文件绑定、配置/用户保护。
* Runtime 与 Workspace 合同：持久消息身份、按序交付、失败查回、原执行续行、取消期间保留输入及旧代次阻断。
* Session/MCP：同一历史查询、操作类型筛选及未知数量、调用前记录、原调用 ID 查回、不推断业务成功。Decision Episode 组合请求及其消息，不抽取自主判断。
* 管理与方法：用户管理、个人资料/通知偏好、配置 CAS、方法路径/搜索/历史；外部 MCP 只读表面。
* 场景测试、架构依赖检查，以及后续适配器交接说明。

## 证据边界

本轮 `npm run check` 已通过：严格 TypeScript 检查、5 个测试文件共 43 项测试（包含架构依赖检查）。

`npm run check` 执行严格 TypeScript 检查及后端场景测试。内存 Store 验证命名提交语义，故障注入和重试检查内层的顺序与结果；不是 SQLite 断电、进程竞争、Pi SDK、Docker 或真实业务验收。上传测试不声称已有生产 SHA-256、路径隔离或真实字节搬运。当前没有 HTTP 服务。

核心审阅路径：`backend/src/domain/model.ts` → `backend/src/application/decision.ts` / `input.ts` / `execution.ts` → `backend/tests/`。优先确认回答、继续、取消、身份和历史语义，而不是框架代码。

## 后续代理可实现的 HOW

按 ports.ts 实现真实 SQLite/Outbox、身份验证和安全凭据、Pi、Docker/Workspace、Blob、Git/搜索、MCP/Session 存储及读取索引，再接 HTTP、SSE 和前端。不得自行增加采纳/审批、业务资料、业务账本、独立轨迹或委托流程。真实 SDK 无法兑现时反馈能力缺口，不削弱内层合同。

首次管理员引导、集成方字段同步策略、Project 改名等未决产品问题维持未决；不提供绕过它们的任意管理员创建 API。token 验证/续期、SDK 去重保留期、分页游标安全及资源限额属于后续机制验证。

## 设计复查

本轮从技术设计进入、建立新后端后以内层场景定位；现场路径完整，无额外历史重建。

| 检查 | 结果 | 依据/后续风险 | 置信度 | 处置层级 |
| --- | --- | --- | --- | --- |
| Missing Path | not-found | 新入口和兄弟用例已通过 architecture-map、README、场景映射连接 | 中 | — |
| Boundary Bypass | not-found | 内层无框架/ORM/SDK/前端依赖；测试替身仅在 tests，依赖检查可运行 | 高 | — |
| Unowned Capability | not-found | 提交由命名 Store 负责；生命周期/判断归用例，协议与存储明确留给适配器 | 中 | — |

目前未发现需要另设能力负责人或重画架构的可执行问题。该复查不证明所有并发、安全或运行条件已验证；后续适配器实现必须跑相应合同与集成测试。

## Validation / DI 接入补充

Zod 已用于入口输入/配置形状，Awilix 已用于组合根；精确版本及锁文件在 backend 包。新增 11 项测试覆盖自由 task JSON、额外身份字段拒绝、字段错误、领域权限/幂等保持、配置类型及独立容器/多用户隔离。尚未启动真实服务。

本次设计复查：Missing Path / Boundary Bypass / Unowned Capability 均为 not-found（置信度中/高/高）。依据是入口校验和装配各有明确目录及路由索引，内层依赖测试继续通过，命令按次传入 actor、没有引入全局用户；后续风险主要在生产适配器资源生命周期，已在组合根注释明确调用方所有权。无须新增能力负责人或扩大领域边界。

## Class 风格调整

应用能力、共享 ApplicationPolicy、应用门面、ValidatedCommands 和 ReadonlyMcp 均改为具名 class；Awilix 使用 asClass、CLASSIC + strict 注册。测试直接 new 服务类注入 fake ports，业务调用按具名能力访问，避免对象展开丢失 this。纯领域函数及数据 interface 未为风格变化引入额外状态。

本轮保持既有行为，43 项测试继续通过；主要新增维护约束是构造参数名属于 CLASSIC 装配合同，已写入技术设计和 README。
