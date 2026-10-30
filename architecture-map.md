# 架构路由索引

产品语义：`docs/prd.md`；机制目标：`docs/technical-design.md`。

| 修改意图 | 行为负责人 | 相关合同与验证 |
| --- | --- | --- |
| 自动用户接入、管理与偏好 | backend/src/application/account.ts | domain/model.ts、ports.ts、management.test.ts |
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
| 组合应用能力 | backend/src/bootstrap/container.ts | Awilix 分别注册能力；bindings.ts 仅为组合根适配器类型 |
| 实现 HOW | backend/src/adapters/README.md | 应用拥有端口，bootstrap 装配；当前无生产适配器 |
| Worker 执行方式与运行环境 | backend/skills/airic-work-worker/SKILL.md | docs/worker-runtime-design.md；常驻装配、能力映射、输入/停止恢复与待验证场景 |

依赖方向：适配器 → Application → Domain。`tests/architecture.test.ts` 检查内层导入。前端当前为独立模拟原型，不能作为后端事实来源或反向依赖。
