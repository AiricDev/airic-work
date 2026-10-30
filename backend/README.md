# Airic Work 后端

已交付 Domain/Application、入口校验与 DI、SQLite、Files Blob、Methods Git/快照/搜索、HTTPS Identity、本机管理员命令，以及 Pi Worker 和业务 MCP 对接。尚无 HTTP 服务和生产 Workspace 实现。

部署配置统一放在仓库根 `.env`，变量清单见 `.env.example`。填写真实的 Identity/MCP 地址、OM 来源和模型 API key；MCP 加密密钥需要固定保存。系统环境变量优先，相对路径以 dotenv 文件目录为基准。`loadConfiguration()` 和 `createConfiguredBackend(config, workspace)` 都位于 `src/bootstrap/bindings.ts`；完整装配与关闭示例见该目录 README。下面的工厂示例用于了解各 adapter 的独立配置合同。

在仓库根运行：

```sh
npm run typecheck
npm test
npm run check
```

使用 Node 24（当前验证版本 24.11.1）；根 package.json 固定 TypeScript/Vitest。后端运行依赖在 backend/package.json 精确固定，并由 backend/package-lock.json 锁定传递依赖；安装使用 `npm ci --prefix backend --ignore-scripts`。better-sqlite3 使用平台对应的原生预构建，部署平台需单独验证兼容性。

## 审阅入口

1. `docs/behavior/backend-phase1.md`：例子和边界。
2. `src/domain/model.ts`：纯模型与不变量。
3. `src/application/`：按能力组织的用例；每个服务类通过构造函数明确声明所需端口，不读取全局服务表。
4. `src/application/ports.ts`：HOW 实现必须兑现的合同。
5. `tests/core.test.ts`、`recovery.test.ts`、`management.test.ts`：行为证据。
6. `docs/backend-phase1-report.md`：覆盖、限制与交接。
7. `docs/behavior/sqlite-adapter.md`、`docs/sqlite-adapter-report.md`：真实存储行为与验证范围。
8. `src/adapters/driven/sqlite/`、`src/bootstrap/bindings.ts`：SQLite 实现、迁移和生命周期。
9. `src/adapters/driven/files/`、`src/bootstrap/bindings.ts`：本地 Blob；行为与证据见 `docs/behavior/files-blob.md`、`docs/files-blob-report.md`。
10. `src/adapters/driven/methods/`、`src/bootstrap/bindings.ts`：Git 方法、固定快照与独立 FTS5 索引；见 `docs/behavior/methods-adapter.md`、`docs/methods-adapter-report.md`。
11. `src/adapters/driven/identity/`、`src/bootstrap/bindings.ts`、`scripts/grant-admin.ts`：HTTPS 身份验证与独立管理员运维入口；见 `docs/behavior/identity-adapter.md`、`docs/identity-adapter-report.md`。

`tests/support` 是测试替身或集成 fixture，不可接到生产运行。`adapters/driving/validation` 使用 Zod，`bootstrap/container.ts` 使用 Awilix；生产 HTTP 和 Workspace 仍待实现。

## HTTPS Identity 与管理员命令

```ts
import { createIdentity } from './src/bootstrap/bindings';

const { identity } = createIdentity({
    issuer: 'trusted-integration',
    endpoint: 'https://identity.example.com/userinfo',
    fields: { subject: 'sub', name: 'name' },
    limits: { timeoutMs: 10000, maxResponseBytes: 65536, maxTokenBytes: 16384 },
});
// 将 identity 注入 createBackend；account.ensureUser(token) 验证后查找/创建本地用户。
```

- 配置来自可信宿主，不从请求接收 endpoint/issuer/字段映射。接口合同为 GET + `Authorization: Bearer <token>`，只有当前有效 token 才能返回 200；401/403 表示拒绝。支持不透明 token，不自行解析 JWT、不实现登录/签发/续期。
- 返回 UTF-8 JSON，映射两个必需的顶层字符串字段（稳定用户 ID、显示名）。不回退到 email/name 合并身份，不接受返回正文中的 issuer/admin/enabled 作为本地权限。
- TLS 证书/主机名验证开启；可通过可信配置 `ca` 提供企业 CA，不能关闭验证。不接受 HTTP、URL 凭据、查询或片段，不跟随重定向。超时覆盖 DNS/TLS/完整正文；不重试、不缓存成功认证。
- 本地 User 首次启用但非管理员；重复认证保留本地显示名、资格、管理员权限和偏好。停用用户即使外部验证成功仍被拒绝。
- 身份 token 仅用于本次验证，不写入数据库、日志、Session 或 Workspace。业务 MCP 另由凭据用例向固定 issue endpoint 换取并加密托管专用凭据，合同见 `src/adapters/driven/mcp/README.md`。

已有用户先通过有效身份接入，再由持有数据库 OS 权限的操作员运行：

```sh
npm --prefix backend run admin:grant -- --user <local-user-id>
```

默认使用 `.env` 中的数据库路径，可用 `--env /deployment/.env` 指定配置文件；`--database /absolute/path/control.sqlite` 可显式覆盖且不要求加载其他配置。

- 只提升指定的已有启用用户，原子更新 admin/version；重复执行幂等，不修改名称、偏好或身份。不自动选择首个用户，不创建或启用账户。
- 只打开现存普通数据库文件，拒绝链接；校验当前迁移版本/摘要，不执行迁移、不初始化 Settings、不创建空库或目录。
- 命令走独立 `LocalAccountAdministration` 端口，不注册到普通 Application、HTTP、只读 MCP 或普通 AdapterBindings。不要把这项 OS 运维权限暴露给网络客户端。
- CLI 使用锁定的 `tsx` 运行实际 TypeScript 源码，不复用测试转译 loader；安装依赖后可用 `npm --prefix backend run admin:grant -- --help` 查看用法。
- 当前使用本地 HTTPS 服务与临时测试 CA 验证；专项测试需要 OpenSSL。真实集成方协议、生产 CA/DNS/代理和部署认证仍须验证。

## SQLite 资源

`createPersistence` 只创建 Store、Support 和关闭函数，不提供完整 Backend 或后台调度：

```ts
import { createPersistence } from './src/bootstrap/bindings';

const persistence = createPersistence({
    filename: '/absolute/path/to/data/control.sqlite',
    initialSettings: {
        version: 0,
        omSource: 'primary',
        branch: 'main',
        root: 'om.md',
        connections: [],
    },
});
try {
    // 将 persistence.store / support 注入后续真实装配；这里没有 Agent 或 HTTP。
} finally {
    persistence.close();
}
```

- 文件路径必须绝对；`:memory:` 仅用于测试，不具备重启恢复。新建目录为 0700、新数据库为 0600，不改写已有路径的权限。
- 每条连接设置 WAL、synchronous=FULL、foreign_keys=ON、busy_timeout=5000ms。每个命名提交使用同步 IMMEDIATE 事务，资格/归属/版本与写入在同一事务中核验。
- 首次 WAL 切换遇到 SQLite busy/locked 时有界等待，预算 5000ms；仅初始化连接，不自动重试业务写入。Methods 索引复用此连接配置及 `operations.ts` 的事务/错误映射，不共享控制库表。
- 迁移保存在 `migrations.ts`，记录顺序及 SHA-256；已应用迁移不可修改，后续变更追加迁移并同步 `schema.ts`。未知版本或摘要不符阻塞打开，不自动重置数据库。
- `initialSettings` 只初始化空库，重开不覆盖已有配置；工厂不创建管理员、不提供管理员引导 API。
- 输入及附件绑定与回答原子保存；pending 输入就是待交付事实。本批没有认领/租约/重试 worker，也没有 Runtime 接收证明。
- 生命周期由调用方拥有。若与 `createBackend` 组合，先释放 Backend，再关闭持久化资源；容器不会替调用方关闭传入的 Store。

## Files Blob

```ts
import { createFileStorage } from './src/bootstrap/bindings';

const { files } = await createFileStorage({
    directory: '/absolute/path/to/data/blobs',
});
const fixed = await files.put(new Uint8Array([1, 2, 3]));
// fixed = { hash: '<SHA-256>', size: 3, contentRef: 'sha256:<SHA-256>' }
```

- `directory` 必须是可信宿主提供的绝对目录，不允许请求体配置，不挂载给 Agent。受管目录拒绝符号链接、非目录和组/其他用户可写权限；已有目录不自动 chmod。
- 布局为 `sha256/<前两位>/<完整摘要>`。新建目录 0700，正式文件 0400；文件名、用户 ID 和执行 ID 不进入 Blob 路径。
- 先复制输入字节、计算真实 SHA-256，再写独占临时文件、同步文件，通过同目录 hard link 原子发布，最后清理本次临时文件并同步目录。已存在的内容重新校验大小和摘要，不覆盖。
- 内容引用不是路径或访问凭证。用户/执行范围仍由上传用例与 SQLite 管理；跨用户相同字节只共享内容，不合并 Upload 身份。
- 所有句柄按次关闭，没有常驻资源或空的 close/dispose。Blob 没有数据库事务；文件固定后数据库失败，允许留下完整孤立内容。
- 不新增下载或应用层读取合同，不做 Workspace 物化、自动 GC、配额或保留策略。崩溃或清理失败可能留下隐藏 staging 文件，不能把它们当正式内容，也不会删除其他 writer 的临时文件。
- 当前验证范围是 macOS 本地 POSIX 文件系统。部署需要支持 hard link、非跟随打开和目录同步；不支持时明确失败，不回退到覆盖式发布。Linux/断电及备份恢复另验。

## Methods Git / 固定快照 / 搜索

宿主需提供 Git 可执行程序、可信本地目录及明确的来源允许列表：

```ts
import { createMethods } from './src/bootstrap/bindings';

const { methods } = await createMethods({
    directory: '/absolute/path/to/data/methods',
    sources: { primary: '/absolute/path/to/existing-om-repository' },
    runtimeVersion: 'host-declared-runtime-version',
    skillVersion: 'host-declared-skill-version',
    limits: {
        commandTimeoutMs: 30000,
        maxTreeBytes: 4 * 1024 * 1024,
        maxFileBytes: 4 * 1024 * 1024,
        maxSnapshotBytes: 64 * 1024 * 1024,
        historyEntries: 1000,
    },
});
// Settings.omSource 使用 sources 的键，例如 primary。
// 将 methods 注入组合根；本工厂不启动 Agent 或后台同步。
```

`sources.primary` 可使用以下任一形式；实例仍只使用 `Settings.omSource` 选定的一个来源：

| 配置值 | 行为 |
| --- | --- |
| `'https://example.com/om.git'` 或 `'git@example.com:team/om.git'` | 首次使用时 clone 到受管 mirror，后续 fetch 并确认远端分支 |
| `'/absolute/path/to/om'` | 直接复用本地 Git 仓库，不 clone，不自动联网 |
| `{ kind: 'local', directory: '/absolute/path/to/om', remote: 'upstream' }` | 直接复用本地仓库，显式指定同步 remote |
| `{ kind: 'managed', repository: '/absolute/path/to/source.git' }` | 显式使用受管 clone，支持本地 Git transport，用于离线部署等场景 |

- `latest` 导出配置分支的固定 SHA 并验证 Root。受管来源实际 fetch，再通过 `ls-remote` 确认远端；本地来源直接确认本地 ref，未提交/未跟踪文件不进入快照。本地不要求 remote 或网络；任一来源的分支/Root 无效或确认时 ref 改变都会阻塞。
- `status(settings)` 返回 `{ source, kind, sync: { enabled, remote?, branch?, reason?, message? } }`，不探测网络。没有 remote 时返回 `enabled: false`、`reason: 'no-remote'` 与“仍可使用本地已提交的 OM”的提示；`sync` 在服务端同样拒绝，不只依赖按钮禁用。
- remote 选择顺序是显式配置、分支 upstream、origin、唯一 remote。多个候选无法确定时禁用并提示。分支 upstream 可以映射不同远端分支名；不支持或包含 URL 凭据的 remote 禁用同步，不妨碍本地运行。
- `sync(settings)` 显式同步。本地只允许安全快进：有工作区时须检出配置分支且已跟踪文件/暂存区无修改；分支不分叉且未被其他 worktree 检出。先验证候选 Root，再复查并更新。不 reset、stash 或自动 checkout；未跟踪内容发生覆盖冲突时由 Git 拒绝。涉及 `.ome` 的变更需外部维护，不由平台物化。
- 组合应用提供 `application.method.methodStatus(userId)`、`syncMethod(userId)`，经当前用户资格与当前配置调用端口；命令入口为 `commands.syncMethod(actor)`，不接受外部 URL/目录参数。当前尚无 HTTP/UI 服务，后续入口须用 status 显示提示和禁用操作。
- `read/search` 只访问来源/SHA 对应的固定快照，可离线重开。`.git`、`.ome`、符号链接和子模块不导出；二进制文件可按路径搜索，不作为文本读取或正文检索。
- 仅受管来源创建 `mirrors/<来源摘要>/mirror.git`；两类来源都使用 `snapshots/<来源摘要>/<SHA>/` 与 `indexes/<来源摘要>/<SHA>.sqlite`。快照 staging 通过目录 rename 发布；快照文件 0400、目录 0700。读取校验 manifest、字节大小和内容摘要。
- 搜索使用 FTS5 trigram；不足三个 Unicode 字符的查询通过字面 LIKE 回退。SQL/FTS 标点不作为查询语法，返回稳定路径及纯文本片段。索引可由同一快照离线重建，替换内容与身份标记使用同一事务。
- Git 子进程不用 shell，禁用 system/global Git 配置及 `GIT_*` 覆盖，保留本地仓库配置以识别 remote；禁用 hooks/fsmonitor，超时/输出超限杀死进程组。来源支持绝对本地目录、HTTPS、SSH URL/SCP 地址，不接受 URL 密码、HTTPS 用户名、查询参数、片段或任意 remote helper。
- Git 历史只覆盖分支历史，不含 tag-only 历史；限量和浅历史情况单独报告。不提供编辑、发布或自动清理。没有常驻数据库句柄，不需要空的 close。
- Runtime/Skill 版本仅是可信宿主声明，不代表 Agent 或常驻 Skill 已实际装配。受管目录不能挂载给 Agent 或不可信 writer。
- 本地目录必须是 Git 仓库根（含 linked worktree/bare），不接受父仓库内的任意子目录，也不支持无 Git 的普通 OM 目录。显式同步期间不要让其他程序同时切换分支或编辑仓库；Git 操作不具备跨步骤事务回滚，失败前可能已更新对象/tracking ref，不能自动重试为“未发生”。
- 当前使用 macOS 本地 POSIX 文件系统和真实本地 Git 仓库验证，含 SHA-1/SHA-256；HTTPS/SSH 认证、部署平台、崩溃恢复和 Git 缓存维护须另验，不能把本地测试当作生产网络验证。

## 内层注释约定

Domain 类型、Application 端口及用例入口使用中文 TSDoc，便于直接阅读与编辑器悬停查看。说明对象/能力负责什么、不负责什么、关键输入来源和状态含义；事务、重试和恢复合同明确区分内层预检与适配器必须兑现的保证。

修改语义时同步更新相应注释和行为测试。不能把端口注释中的目标保证当作真实适配器已验证，也不要仅重复函数名而省略身份、版本和副作用边界。

## Validation 与 DI

* 入口形状：`src/adapters/driving/validation/schemas.ts`；命令映射与结构化错误：`commands.ts`。不把 Zod 导入内层，也不以 Schema 替代状态、身份或事务规则。
* 组合根：`src/bootstrap/container.ts`。`createBackend(dependencies)` 返回 `application`、`commands` 和 `dispose`，不暴露容器；当前适配器由调用方负责关闭。
* `commands` 在每次调用时接收认证后的 actor。不要将外部正文直接断言为 VerifiedActor，不要注册可变全局用户。
* 对应验证见 `tests/validation-di.test.ts`；现有测试仍可直接 new 对应服务类并注入 fake ports，不必经容器。

## Class 风格

AccountUseCases、ExecutionUseCases 等是具名服务类，构造函数逐项注入端口，公开方法表达用例。Application 仅持有各能力实例，不再展开方法或创建全局 Dependencies。入口 ValidatedCommands 和外部 ReadonlyMcp 同样使用 class；纯数据 interface 和无状态领域函数保留其原本用途。Awilix 使用 asClass、CLASSIC、strict；禁止在后端构建中混淆构造参数名。
