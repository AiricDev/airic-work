# 组合根

`container.ts` 使用 Awilix（CLASSIC、strict）注册外部适配器及应用服务类。`createBackend` 提供普通应用能力与经过 Zod 校验的命令入口，不暴露容器给业务层。

`persistence.ts` 的 `createPersistence` 创建生产 SQLite ControlStore 和 SystemSupport，返回 `close()`；只装配本批资源，不伪造其他 AdapterBindings。初始 Settings 由可信部署配置提供，只有空库会写入，不引导管理员、不启动 worker。

`files.ts` 的 `createFileStorage` 异步初始化可信绝对 Blob 目录，仅返回 `{ files }`，可与持久化资源分别创建并传入后续装配。它没有常驻句柄或后台工作，不提供空的 close；操作内负责清理自身句柄和 staging，不注册到 SQLite 事务，也不物化到 Workspace。

`methods.ts` 的 `createMethods` 异步初始化 Git 缓存/固定快照/索引目录，返回 `{ methods }`。来源允许列表、资源上限与 Runtime/Skill 声明版本由可信宿主显式提供；应用 `Settings.omSource` 只能引用允许列表中的键，不能把请求字符串解释为任意 URL 或宿主路径。Git/数据库句柄按操作关闭，无后台同步、Agent 装配或空的 close。示例与部署限制见后端 README 和 `docs/methods-adapter-report.md`。

来源字符串为 URL/SCP 地址时使用受管 clone，为绝对目录时直接复用本地 Git 仓库；显式 `{ kind: 'local', directory, remote? }` 可选定 remote，`{ kind: 'managed', repository }` 可指定受管 Git transport。本地运行不自动 fetch；无 remote 的禁用原因与提示经 Methods.status/MethodUseCases 返回，显式同步走既有应用能力，不在工厂执行 pull、修改工作区或创建空仓库。

当前没有生产服务入口；传入适配器的创建/关闭由调用方负责。组合使用时先调用 Backend 的 `dispose()`，再调用持久化资源的 `close()`；初始化失败会关闭已打开连接。未来由容器创建资源时再显式登记 disposer。不把请求级 actor 放入根级单例，不从 Domain/Application 导入此目录。
