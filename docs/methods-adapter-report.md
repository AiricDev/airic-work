# Methods Git / 快照 / 搜索交付与验证

范围：非 Agent adapter 第 3 批，以及 2026-10-30 确认的本地来源扩展。实现 `Methods.latest/read/search/history`，按用户确认补充 `status/sync` 端口与 Methods 用例入口；不改变 Domain 控制模型、SQLite schema 或已有执行固定版本规则。

## 实现与边界

* `backend/src/adapters/driven/methods/git-methods.ts`：允许来源、真实分支确认、SHA-1/SHA-256、固定快照读取、搜索与分支历史。
* `repositories.ts`：URL/SCP 受管 clone、本地仓库直接复用、remote/upstream 识别、能力状态与显式安全快进。支持普通仓库、linked worktree 和 bare 仓库。
* `git.ts`：无 shell 的受控 Git 子进程，禁用 system/global Git 配置及 `GIT_*` 覆盖；本地配置用于识别 remote，hooks/fsmonitor 禁用。协议允许列表、超时/输出上限与进程组终止，错误脱敏。
* `storage.ts`：可信绝对目录、非跟随普通文件访问、严格 UTF-8/路径检查、固定字节写入及目录同步。
* `index.ts`：来源/SHA 独立的可重建 FTS5 trigram 索引。少于三个 Unicode 字符的查询用字面 LIKE 回退，SQL/FTS 标点不作为查询语言。
* `backend/src/bootstrap/methods.ts`：显式来源映射、目录、声明版本和资源上限，返回 Methods；操作关闭自身句柄，无常驻后台工作或空的 close。
* `application/method.ts` 提供 `methodStatus/syncMethod`，复用当前用户资格与当前 Settings；`ValidatedCommands.syncMethod(actor)` 不接收外部目录/URL。外部只读 MCP 没有新增同步命令。
* `driven/sqlite/operations.ts` 提取既有 ControlStore 的事务/错误映射，索引复用；连接配置统一在 `database.ts`。首次并发切换 WAL 的 busy/locked 有界等待只用于初始化，不重试业务写入。
* 不新增依赖、控制库表、Git 编辑/发布、HTTP、认证、Runtime、History/Session、Workspace 或派发 worker。

## 固定方法协议

`Settings.omSource` 是宿主允许列表中的键，不将应用输入直接解释为 URL/宿主路径。来源字符串为 HTTPS/SSH URL 或 SCP 风格 SSH 地址时 clone 到受管 mirror，为绝对目录时直接复用本地仓库。可用显式 `{ kind: 'local', directory, remote? }` 或 `{ kind: 'managed', repository }` 配置；后者也支持本地 Git transport。拒绝任意协议、URL 密码、HTTPS 用户名、查询参数和片段。新 mirror 使用私有空 Git 模板。

受管来源的 `latest` 实际 fetch 指定分支并取得 commit SHA，导出普通 blob，验证 Root 是可读文本，最后通过 `ls-remote` 再确认分支。不可达、分支缺失、Root 无效或确认窗口内分支变化均阻塞，不能把缓存包装成最新。最后确认之后的远端变化不可能由本地事务冻结。

本地来源的 `latest` 直接读取配置分支的已提交对象，不 clone/fetch，不加载未提交或未跟踪文件；导出和 Root 校验后再确认本地 ref。没有 remote 或 remote 不可达不阻止本地运行。返回的 Method 仍固定来源/SHA，执行准备另由既有配置 CAS 保护；不是把可变工作区直接交给 Agent。

`status` 不联网。remote 选择顺序为显式配置、分支 upstream、origin、唯一 remote；缺失、歧义、不支持时返回同步禁用原因及脱敏中文提示，`sync` 同样在服务端拒绝。`enabled` 表示配置能力，不保证网络可达；Git 检查失败按失败传播，不伪装成已知配置问题。

本地 `sync` 仅显式执行，先检查当前分支、跟踪文件/暂存区和其他 worktree，再 fetch 并检查可快进、候选 Root 和作者目录边界，最后复查并更新。不 reset/stash/自动 checkout，不执行 hooks、不物化 `.ome` 变更；未跟踪覆盖冲突交给 Git 拒绝。bare 分支通过预期旧 SHA 更新，已被其他 worktree 检出时拒绝。错误不代表 Git 对象库/tracking ref 没有变化；不自动回滚或盲目重试。

快照布局为 `snapshots/<来源 SHA-256>/<Git SHA>/`，包含 `runtime/` 与内容 manifest。新目录 0700、文件 0400；先同步文件与目录，再 rename 发布完整 staging。失败只清理自身 staging，不覆盖已有正式快照。`.git`、`.ome`、链接与子模块不导出，路径不得越界。读取校验 manifest、大小与内容 SHA-256，不把二进制当文本。

`read/search` 固定来源/SHA，可离线重开。索引位于独立 `indexes/<来源摘要>/<SHA>.sqlite`，不是控制记录或第二份业务轨迹。重建逐文件校验快照；索引文档与身份标记同事务替换，失败回滚。manifest 摘要绑定索引身份，不是签名，也不提供对恶意宿主 writer 的认证保证。

`history` 对受管来源 fetch 分支，对本地来源只读本地历史；返回 `scope: 'branches'`、commit 元数据、`complete` 与 `limitations`。完整性只针对各自分支历史；tag-only 历史不在范围，超出配置条数或检测到浅历史明确标记，不伪造全仓库历史。

Runtime/Skill 版本仅来自可信宿主声明。它们不证明 Agent、工具、Skill 或容器已经装配。

## 验证证据

`npm run check` 通过：严格 TypeScript 检查，**20 个测试文件、227 项测试**。Methods 共 87 项，本地来源扩展比第三批初版新增 34 项：

| 测试 | 项数 | 证明范围 |
| --- | --- | --- |
| methods-git.test.ts | 19 | 真实分支/SHA/Root、本地/受管 SHA-256、固定旧版本、离线重开、来源隔离、路径/链接/子模块/损坏拒绝、最终确认窗口、导出故障、空模板、限量历史 |
| methods-search.test.ts | 17 | 中文及短词、文件名/路径、二进制名、字面标点、稳定片段、离线重建、事务替换回滚、未知索引版本拒绝 |
| methods-runner.test.ts | 14 | 来源协议/凭据拒绝、超时进程组终止、输出上限、错误脱敏与显式配置 |
| methods-process.test.ts | 2 | 独立进程争用时只发布完整快照；两个离线 reader 首次并发建索引得到一致结果 |
| methods-application.test.ts | 3 | 真实 Git 与 SQLite 执行准备、单一持久 Start Input、准备重试幂等、配置变化 CAS 拒绝、无 remote 仍可准备；不调用 Agent |
| methods-local.test.ts | 30 | 本地无 clone/fetch、未提交隔离、remote 优先级/提示/脱敏、离线运行、显式快进、hooks 禁用、脏文件/分叉/切分支/worktree/作者目录/无效 Root/未跟踪碰撞保护 |
| methods-usecases.test.ts | 2 | 当前用户资格及当前配置；禁用用户在检查来源或同步之前被拒绝 |

原有 140 项继续通过，含 ControlStore 合同、独立进程竞争、事务故障和 SIGKILL 恢复。`git diff --check` 通过。

索引故障注入使用普通 `snapshot_meta` 表的 INSERT 触发器，在文档替换后阻断元数据提交，以证明整个替换回滚；不在 FTS5 shadow table 上创建不受 SQLite 支持的触发器。

## 尚未验证或交付

* 当前环境为 macOS、Node 24.11.1、真实本地 Git 与 POSIX 文件系统。未验证 HTTPS/SSH 网络、生产凭据/代理、Linux/Windows、备份恢复、物理断电。
* 本批 Methods 未做 SIGKILL 恢复测试；既有 SQLite 的 SIGKILL 证据不能外推到 Git mirror 或快照。中断可能留下隐藏 staging 或 Git lock，暂不自动 GC/修复缓存。
* 根目录由可信宿主管理，不给 Agent 或不可信 writer 写入；不承诺抵御同 UID 恶意进程并发替换目录、manifest 或索引。
* 本地来源必须是已有 Git 仓库根，有提交及有效配置分支；无 Git 普通目录不在本轮范围。显式同步期间宿主应避免其他程序同时编辑/切换仓库；多步 Git 操作不具备整体事务保证，不声称抵御任意外部 writer 的竞态。
* 同实例来源同步串行；独立进程 Git 原生锁竞争可能阻塞失败，调用方可在确认失败后重试。失败不是部分成功或缓存最新。
* 索引删除可离线重建；损坏/未知版本阻塞，不自动删除未知数据库。没有新增配额、保留策略、流式索引或性能承诺。
* 没有生产应用入口或真实 Agent。下一批是 Identity，需用户批准后继续。

## 变更后设计复查

模式：report。本次本地来源扩展的现场完整可见，整体置信度高；之前第三批初始实现仅有交接摘要，不据此重建更早路线。

可见路线：用户要求目录/URL 两种模式 → 现有 Methods.latest 把本地路径也当拉取来源 → 查端口、MethodUseCases 及 PRD 固定 SHA 约束 → 用户确认已提交版本/仅显式同步/本轮仅 Git 目录 → 先补行为与端口，再实现仓库机制和应用入口 → 真实仓库、SQLite 准备与权限测试 → 更新既有产品及架构文档。

修改闭包：Methods 端口/用例/命令入口、仓库机制及工厂声明、测试替身与专项/应用测试、PRD/行为/技术设计/配置和既有架构索引。未来入口是 MethodUseCases → Methods.status/sync → GitRepositories → methods-local/usecases/application 测试；未进入 Runtime/Workspace、SQLite 业务提交或 HTTP/UI 实现。

| 检查 | 结果 | 现场证据 | 后续风险 | 置信度 | 处置 |
| --- | --- | --- | --- | --- | --- |
| Missing Path | not-found | 架构索引、Methods.latest、MethodUseCases 和 PRD 直接定位到来源确认及固定 SHA 的修改闭包；未因旧提示猜测本地模式 | 后续增加入口时可能遗漏 status 的禁用提示，配置说明已明确路由 | 高 | 无额外行动 |
| Boundary Bypass | not-found | 源状态与同步经用例资格检查，外部正文不选择目录/URL；工作区操作留在 adapter，执行准备仍用原 Store CAS | 后续不能让 UI 直接访问 Git 或将本地工作区绕过固定快照交给 Agent | 高 | 无额外行动 |
| Unowned Capability | not-found | 同步能力属既有 OM 用例/Methods，clone/remote/快进属 Methods 内 GitRepositories，状态类型由应用端口定义 | 不能把同步能力误作网络健康、实际 Skill 装配或自动方法编辑 | 高 | 无额外行动 |

本次扩展未发现需额外行动的路由问题（不适用 how/what 修复分类），不对更早缺失路线作保证。PRD/架构索引变更记录用户明确确认的新来源行为，属于交付闭包，不是复查触发的架构重建；未修改 AGENTS.md、技能或引入新负责人。复查不替代部署、安全或完整 Agent 集成验证。
