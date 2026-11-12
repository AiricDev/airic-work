# 架构路由索引

目标见[产品定义](docs/prd.md)、[技术设计](docs/technical-design.md)和 [OpenAPI](docs/openapi.yaml)。当前代码仍以 Execution 命名，以下是保留下来的实现入口。

| 修改意图 | 入口 | 验证 |
| --- | --- | --- |
| 执行创建、固定方法、停止 | `backend/src/application/execution.ts` | `backend/tests/core.test.ts`、`recovery.test.ts` |
| 提问、回答和输入投递 | `backend/src/application/decision.ts`、`input.ts` | `backend/tests/recovery.test.ts`、`contracts/control-store.ts` |
| Session、Episode 与操作查询 | `backend/src/application/query.ts`、`backend/src/adapters/driven/runtime/pi-history.ts` | `backend/tests/history-pagination.test.ts`、`pi-runtime.test.ts` |
| Pi 运行、分支和工具桥接 | `backend/src/adapters/driven/runtime/`、`backend/src/adapters/driving/worker/` | `backend/tests/pi-runtime.test.ts` |
| 控制记录、幂等与事务 | `backend/src/adapters/driven/sqlite/` | `backend/tests/sqlite-store-contract.test.ts`、`sqlite-integration.test.ts` |
| 固定 OM 与文件 | `backend/src/adapters/driven/methods/`、`files/` | `backend/tests/methods-git.test.ts`、`files-blob.test.ts` |
| MCP 和身份 | `backend/src/application/mcp.ts`、`backend/src/adapters/driven/mcp/`、`identity/` | `backend/tests/mcp-integration.test.ts`、`identity-https.test.ts` |
| 端口和装配 | `backend/src/application/ports.ts`、`backend/src/bootstrap/` | `backend/tests/architecture.test.ts`、`bootstrap-config.test.ts` |
| CertLab 的 Task API 认证、作答和完工通知 | [Task HTTP 装配](backend/src/bootstrap/task-http.ts)、[CertLab 集成说明](../certlab/deploy/airic-work.md) | [双服务验收](deploy/README.md) |

回答、`steering` 和 `notify` 共用持久输入队列。输入用例选择并复核队首，Worker 每投递一条就等 Pi 完成本轮工作，再选择下一条。Pi 负责判断续行锚点是否已就绪，以及记录接收回执。

旧前端、HTTP 和管理命令已清理。Task API、每 Task 存储、Worker 派发和 Compose 发布入口已接入。Workspace 命令由受限容器执行，容器只挂载当前 Task 的工作目录、输入和固定 OM。两条 Swagger 路径已在隔离环境验证，完整的 OpenAPI 合同核对和发布切换仍待完成。


## CertLab 资料传输

[CertLab MCP 传输合同](../certlab/docs/api/assistant-protocol.md)定义描述、固定修订及项目权限。Task 通过 [运行装配](backend/src/bootstrap/task-runtime.ts)注册文件传输工具，由 [MCP HTTP 适配器](backend/src/adapters/driven/mcp/http-mcp.ts)使用同一连接身份并校验字节数与哈希，由 [Workspace](backend/src/adapters/driven/workspace/docker-workspace.ts)保存输入。跨服务修改同时核对 [Airic Work 传输测试](backend/tests/mcp-integration.test.ts)与 [CertLab 项目授权测试](../certlab/tests/api/test_airic_work.py)。
