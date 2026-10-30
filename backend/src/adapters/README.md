# 适配器交接边界

按 `../application/ports.ts` 实现外部机制。当前已实现 `driven/sqlite/`（ControlStore）、`driven/support/`（UUIDv7/UTC）、`driven/files/`（本地 Files Blob）与 `driven/methods/`（Git/固定快照/搜索）；其余生产适配器尚未实现。

## 分批路线与任务边界

非 Agent 任务依次交付：SQLite/Support → Files Blob → Methods Git/搜索 → Identity → 业务 Mcp 网关 → HTTP/外部只读 MCP 与资源装配。当前前三批完成；证据见 `../../../docs/sqlite-adapter-report.md`、`../../../docs/files-blob-report.md`、`../../../docs/methods-adapter-report.md`。

Pi Runtime、History/Session 索引、Workspace/Docker、模型工具入口、输入信封装配、派发 worker、停止与恢复由独立 Agent 任务设计开发。业务 Mcp 网关不另外建立调用账本，仍通过 McpUseCases 与 Agent 任务提供的 History 协作。缺少的能力不能用生产测试替身或空历史伪装可用。

* Store 每个命名方法拥有自己的原子提交，不暴露 SQL、ORM 或通用写入回调给内层。
* 每次提交重查当前用户资格、归属、版本、文件范围、唯一性、运行代次及必要责任保护；UserDecision、已回答和 Outbox 必须一起保存。
* Runtime 同一 Session 中按 inputId 持久去重和查回，空闲/结束后续行不新建逻辑 Session；停止与新运行互斥。
* MCP 入口传宿主稳定 toolCallId，不得在每次重放时生成新 ID；网络派发前再查取消代次。外部业务恢复遵循服务合同，不盲重试。
* History 在派发前持久记录脱敏调用，重复原调用不再次派发；Session 索引可重建，分页/筛选报告覆盖限制及未知分类。
* Files 固定实际字节、大小和 SHA-256；Workspace 路径由宿主生成并隔离，文件和运行目录持续。
* Identity 校验 token，入口注入真实用户及 source；请求体不能自选 userId/source 取得权限。
* 只读 MCP handler 只装配 readonly-mcp.ts 返回的查询表面。HTTP/运行时/worker 共享用例，不写表绕过规则。

## SQLite 验证入口

* `../../tests/contracts/control-store.ts`：生产 SQLite 与 MemoryStore 共用的端口行为。
* `../../tests/sqlite-integration.test.ts`：真实数据库、独立连接/进程并发、写入点故障和 SIGKILL 恢复；不等同于物理断电验证。
* `../bootstrap/persistence.ts`：明确的资源创建/关闭，不自动启动应用或派发。

后续仍须验证 SDK 丢确认查回、容器停止和在途业务写入窗口。SQLite 合同通过不证明这些 Agent 机制成立。

## Files 验证入口

* `driven/files/local-blob-files.ts`：只实现 `Files.put`，不读写数据库，不接受宿主文件名或用户指定路径。
* `../../tests/files-blob.test.ts`、`files-blob-failure.test.ts`、`files-blob-process.test.ts`：真实字节、去重、并发、故障、受管路径检查。
* `../../tests/files-upload-integration.test.ts`：真实 SQLite 上传边界，先固定内容再提交描述；失败不伪造正式绑定。
* `../bootstrap/files.ts`：独立 Blob 初始化工厂；没有长驻句柄，不提供无意义的 close。

Blob 根目录必须由可信宿主管理，不暴露给 Agent 或不可信 writer；本批不承诺抵御同 UID 恶意进程并发替换目录。后续 Workspace 的读取/物化仍需在独立任务内兑现校验、权限和真实字节交付，不能凭 contentRef 推定可读。

## Methods 验证入口

* `driven/methods/git-methods.ts`：来源允许列表、实际分支确认、固定 SHA 快照、文本读取与分支历史；不是 Runtime 或 Git 编辑/发布工具。
* `driven/methods/repositories.ts`：URL 受管 clone / 本地仓库直接复用、remote/upstream 识别、同步禁用状态及显式安全快进；无 remote 不阻止本地运行。
* `driven/methods/git.ts`、`storage.ts`：受控 Git 进程与路径/普通文件机制。私有空模板避免导入 Git hooks，仓库里的链接和子模块不展开。
* `driven/methods/index.ts`：每个来源/SHA 的可重建 FTS5 索引；复用 `driven/sqlite/database.ts`、`operations.ts`，不接触控制记录表。
* `../../tests/methods-git.test.ts`、`methods-search.test.ts`、`methods-runner.test.ts`：真实仓库、固定读取、中文/短词/字面搜索、回滚与进程失败。
* `../../tests/methods-process.test.ts`：独立进程同步与离线索引初始化；Git 锁竞争允许明确阻塞，不能返回部分快照。
* `../../tests/methods-application.test.ts`：真实 SQLite 与执行准备合同；配置变化不得固定过期 Method，准备本身不调用 Agent。
* `../../tests/methods-local.test.ts`、`methods-usecases.test.ts`：无 remote 本地运行、状态/提示、来源权限、配置分支与 upstream、脏工作区/分叉/worktree/作者目录保护；Git 检查失败不伪装成已知禁用原因。
* `../bootstrap/methods.ts`：显式来源、目录、资源上限和声明版本；无常驻句柄或后台任务。

SHA-1/SHA-256 仓库在本地验证；HTTPS/SSH、生产凭据、Git 缓存维护、SIGKILL/断电及部署文件系统未在本批验证。Runtime/Skill 版本声明不能替代真实 Agent 装配证明。
