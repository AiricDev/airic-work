# 组合根

`bindings.ts` 集中管理 adapter 配置类型、具体实现选择和资源创建入口；`AdapterBindings` 仍是传给应用容器的端口集合。

部署配置统一维护在仓库根 `.env`，完整变量清单见 `.env.example`。`loadConfiguration()` 使用 Node 内置 dotenv 解析器读取，不引入额外依赖、不修改 `process.env`；系统环境变量优先，支持只通过环境变量部署。显式传入文件路径时，文件不存在会报错。相对目录以 dotenv 文件所在目录为基准，切换启动目录不影响默认配置。

```ts
import { loadConfiguration, createConfiguredBackend } from './bindings';

const config = loadConfiguration(); // 或 loadConfiguration('/deployment/.env')
const backend = await createConfiguredBackend(config, workspace);
try {
    // 通过 backend.application / commands 处理请求，通过 runner 显式执行。
} finally {
    await backend.close();
}
```

目录、Identity 接口与字段、OM 来源、模型凭据、Worker Skill、MCP 连接和限制值由这个入口校验并装配。Workspace 仍由宿主提供实现。`server` 地址供未来 HTTP 宿主使用；装配本身不监听端口、不启动调度循环。低层工厂继续支持测试和专用宿主显式注入。

`.env` 已被 Git 忽略。`AIRIC_MCP_ENCRYPTION_KEY` 是 32 字节随机密钥的 64 位十六进制表示，需要备份并在重启时保持稳定；模型 API key 仅注入宿主模型凭据存储。配置校验错误只报告变量名。`AIRIC_OM_SOURCE/BRANCH/ROOT` 和 MCP 连接 ID 只作为空库 Settings 的初值，重开不覆盖管理员已保存的设置；连接地址、来源允许列表等宿主配置仍从 dotenv 读取。

| 创建入口 | 职责与生命周期 |
| --- | --- |
| `createPersistence` | SQLite ControlStore、迁移及 SystemSupport；调用方关闭连接。初始 Settings 只写空库，不创建管理员。 |
| `createFileStorage` | 初始化私有 Blob 目录；操作内关闭句柄，不提供空的 close，不负责 Workspace。 |
| `createIdentity` | 固定 HTTPS 用户信息接口配置；不联网初始化、不保存 token 或创建用户。 |
| `createMethods` | 配置允许的 Git 来源、固定快照和检索；本地仓库不自动同步，不持有常驻资源。 |
| `createWorker` | Pi Runtime、History、应用宿主与 ExecutionRunner；调用方显式关闭。 |
| `createMcpIntegration` | MCP 连接、加密凭据、HTTP 网关与 Worker 工具；凭据不进入模型。 |
| `createAccountMaintenance` | 本机管理员维护专用入口，只打开现存数据库，不迁移、不注册到普通应用容器。 |

配置类型同样从 `bindings.ts` 导入，包括 PersistenceOptions、FileStorageOptions、WorkerOptions、McpIntegrationOptions，以及 adapter 自有参数类型的导出。

`container.ts` 使用 Awilix（CLASSIC、strict）将端口实现绑定到应用服务类。`createBackend` 提供应用能力与 Zod 命令入口，不向业务层暴露容器；不在这里读取请求 actor、环境变量或启动服务。

初始化、显式运行和资源关闭由宿主负责：先创建所需 adapter，再传入 createBackend；退出时先 dispose Backend，再关闭 Worker/持久化资源。导入 bindings 本身不打开数据库、启动 Worker 或发起网络请求；Pi 的 Node SQLite 也延迟到首次实际打开 Session 时加载。

管理员运维工厂虽然集中在 bindings 中，依然不属于普通 AdapterBindings 或公开 HTTP/MCP 能力。Domain/Application 不导入本目录。
