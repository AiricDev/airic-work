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

旧前端、HTTP 和管理命令已清理。Task API、每 Task 存储、Worker 派发和 Compose 发布入口已接入。Workspace 命令由受限容器执行，容器只挂载当前 Task 的工作目录、输入和固定 OM。两条 Swagger 路径已在隔离环境验证，完整的 OpenAPI 合同核对和发布切换仍待完成。
