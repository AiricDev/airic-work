# Files Blob 交付与验证

日期：2026-10-30。范围：非 Agent adapter 第 2 批，本地 `Files.put`。

## 实现与边界

* `backend/src/adapters/driven/files/local-blob-files.ts`：真实 SHA-256、字节快照、受控引用、原子发布、已有内容复核、失败脱敏和 staging 尽力清理。
* `backend/src/bootstrap/files.ts`：可信绝对目录初始化，返回 Files 端口；句柄按操作关闭，无常驻进程或空的 close。
* 不改动 Domain/Application/ports 或生产 SQLite；上传仍先固定字节，再通过已有 `saveUpload` 事务保存描述。
* 没有新增依赖、数据库表、文件下载/读取 API、Workspace、Agent、派发或自动清理策略。
* SQLite/Blob 进程测试共享 `tests/fixtures/load-typescript.mjs`，只用于测试转译，不作为生产启动机制。

## 固定内容协议

返回 `{ hash, size, contentRef: 'sha256:<完整摘要>' }`，引用不包含宿主路径，不授予内容访问权限。

落盘位置为 `<root>/sha256/<前两位>/<完整摘要>`。同目录隐藏临时文件通过独占、非跟随打开写入，完成后设为 0400 并同步；hard link 将完整 inode 原子发布到正式名称，随后移除本次临时名称并同步目录。碰到已有名称则检查真实大小和完整摘要，不能覆盖损坏文件。

新建目录为 0700。拒绝受管目录/正式对象的符号链接和异常类型，不修改已有目录权限；根目录由可信宿主管理，组/其他用户可写目录被拒绝。可信配置路径的既有祖先会正规化，不将用户文件名作为路径。

Blob 没有数据库访问或事务机制。Blob 固定成功但控制库失败时，可能留下完整孤立内容；写入未完成或清理失败可能留下隐藏 staging，它们都不形成正式 Upload。本批不自动清理这些文件，避免删除仍在写入或仍有引用的内容。

## 验证证据

`npm run check` 通过：严格 TypeScript 检查，**13 个测试文件、140 项测试**。本批新增 36 项：

| 测试 | 项数 | 证明范围 |
| --- | --- | --- |
| files-blob.test.ts | 18 | 已知 SHA-256 向量、空/二进制/Unicode 字节、数组快照、去重不覆盖、同进程并发、重开、损坏/异常路径拒绝 |
| files-blob-failure.test.ts | 10 | 部分写入、chmod、文件同步/关闭、原子发布、目录同步、读取及清理失败；失败不返回可用引用 |
| files-blob-process.test.ts | 2 | 独立进程同时初始化/写相同内容；同一 shard 的不同内容并发，各自完整且无覆盖 |
| files-upload-integration.test.ts | 6 | 真实 SQLite 描述/附件输入、同名不同内容、跨用户/执行隔离、无权请求先拒绝、数据库失败后完整孤立内容与安全重试 |

原有 104 项测试继续通过，包含共享 Store 合同、独立进程竞争、回答事务回滚和 SIGKILL 恢复。`git diff --check` 无格式问题。

## 尚未验证或交付

* 当前执行环境是 macOS、Node 24.11.1；未运行 Linux、Windows、物理断电、硬件故障或备份恢复验证。
* 需要支持 hard link、非跟随打开及目录 fsync 的本地 POSIX 文件系统，不支持时失败，不退化成覆盖式发布。
* Blob 根目录不能给 Agent 或不可信进程写入；不声称能防住同 UID 恶意进程并发替换受管目录。
* `Files` 目前只拥有写入合同。后续 Workspace 的受控读取/物化、目录隔离、配额、保留及清理策略各自另验，不能把引用存在当作已交付或 Agent 可读。
* 上传接口目前接收完整 Uint8Array，未新增流式/分片上传或大文件资源政策。

下一批是 Methods Git/固定快照/搜索，不在本轮自动实施。

## 变更后设计复查

现场路由完整：架构索引 → Files/InputUseCases → 已有文件与事务边界 → 本地 adapter/工厂 → 专项及 SQLite 联合验证。内层合同可信，真实文件系统能力由本批验证；无需重建历史或另行扫描无关模块。

| 检查 | 结果 | 现场证据 | 后续风险 | 置信度 | 处置 |
| --- | --- | --- | --- | --- | --- |
| Missing Path | not-found | 现有 Files 端口和上传用例清楚界定先字节后记录；新工厂、测试与索引已互相链接 | 后续读取不要从内容引用推导未授权下载能力 | 高 | 无额外行动 |
| Boundary Bypass | not-found | 内层及生产 SQLite 未变；Files 无数据库依赖；SQL 故障注入只在测试；未扩展到 Workspace | 联合提交不能伪装成跨文件/数据库事务，也不能跳过用例范围检查 | 高 | 无额外行动 |
| Unowned Capability | not-found | 内容固定归 Files；描述及绑定归 Store；初始化归 bootstrap；物化留给 Workspace | 自动清理/下载若需要新增合同应在对应任务明确，不塞入 put | 高 | 无额外行动 |

未发现需要新增负责人或重画边界的可执行路由问题；未修改 AGENTS.md 或开发技能。该复查不代替 Agent、部署隔离或完整存储安全审计。
