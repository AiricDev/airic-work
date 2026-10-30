# Identity / 本机管理员命令交付与验证

日期：2026-10-30。范围：非 Agent adapter 第 4 批。用户确认 HTTPS Bearer 用户信息验证，并要求提供将某个已有用户标记为管理员的命令行脚本。

## 实现与边界

* `backend/src/adapters/driven/identity/https-user-info.ts` 实现既有 Identity.verify；`bootstrap/identity.ts` 提供明确的可信宿主配置。
* issuer 来自配置，subject/name 从指定顶层 JSON 字段读取；不接受响应里的权限/issuer，不以姓名或邮箱自动合并身份。AccountUseCases/ControlStore 接入流程不变。
* HTTPS TLS 证书/主机名验证始终开启，支持可选企业 CA。固定 GET + Bearer，不重定向、不重试、不缓存成功认证；拒绝 URL 凭据/查询/片段及非法 token。
* 总超时覆盖 DNS/TLS/头/正文；正文有字节上限，严格 UTF-8/JSON/字段类型；压缩及不完整响应拒绝。401/403 为凭据拒绝，服务/TLS/响应异常脱敏阻塞，不泄漏正文或 token。
* `LocalAccountAdministration` 是用户明确授权的本机维护端口，不加入普通 ControlStore、Application、AdapterBindings、HTTP 或只读 MCP。维护用例只提升已有启用用户，Sqlite adapter 在 IMMEDIATE 事务内验证迁移与状态，原子修改 admin/version；重复操作幂等。
* `backend/scripts/grant-admin.ts` 经独立 bootstrap 打开现存普通数据库文件，操作后关闭；拒绝缺失/链接/错误迁移，不初始化 Settings、不创建目录/数据库、不执行迁移，不启用停用用户。
* SQLite 连接复用已有配置，增加 fileMustExist 模式；迁移模块提取共享摘要验证，不修改任何既有迁移 SQL、内容摘要或 schema。
* 新增锁定的 `tsx@4.23.15` 用于生产 CLI，脚本纳入严格类型检查。没有把测试 loader 升格为生产启动机制，没有新增 HTTP、JWT/OIDC 登录、Agent 或派发 worker。

## 使用

配置示例见 `backend/README.md`。真实集成方必须提供可信用户信息接口：仅 token 当前有效时返回 200，JSON 含稳定 ID 和名称；失效返回 401/403。本实现不把 RFC 7662 introspection 的 `active` 字段解释成用户信息协议。

用户通过有效认证完成首次接入后，操作员指定本地用户 ID：

```sh
npm --prefix backend run admin:grant -- --database /absolute/path/control.sqlite --user <local-user-id>
```

操作权限来自数据库 OS 权限，不要求已有管理员，否则无法完成首位管理员引导。不能将该维护能力接到网络入口。命令只输出固定结果/错误，不打印用户资料、SQL、token 或宿主诊断。

Identity 只处理入站认证。业务 MCP 按 `Execution.ownerId + connection` 取得有效业务凭据的合同、托管、过期/续期或 token exchange 尚未交付；不能因平台认证成功就默认复用同一个 Bearer token。只有目标服务明确接受时才可能复用，仍须在宿主处理，不交给 Agent/Session/Workspace。

## 验证证据

`npm run check` 通过：严格 TypeScript 检查，**23 个测试文件、279 项测试**。本批新增 52 项：

| 测试 | 项数 | 证明范围 |
| --- | --- | --- |
| identity-https.test.ts | 36 | 真实 TLS/企业 CA 配置路径、固定端点/字段映射、token 输入、401/403/429/500、重定向拒绝、JSON/UTF-8/媒体类型/正文界限/截断/压缩拒绝、总超时、无成功缓存、错误脱敏 |
| identity-application.test.ts | 6 | 真实 HTTPS + SQLite 首次接入、非管理员默认、本地名称保留、停用保护、失败不建人、并发同身份唯一、不同 issuer 隔离 |
| account-maintenance.test.ts | 10 | 真实 CLI 子进程、无已有管理员提升、重复/多进程幂等、停用/缺失/链接/迁移拒绝、不创建空库、故障回滚及安全输出 |

原有 227 项继续通过，包含 Store 合同、独立进程竞争、事务回滚及既有 SIGKILL 恢复。`git diff --check` 通过；npm 安装输出报告 0 项已知漏洞，不代表完整供应链安全审计。

测试使用 OpenSSL 在临时目录生成证书/私钥，本地 HTTPS 绑定 loopback，测试后关闭/清理。未使用真实用户凭据或调用真实集成方。

## 未验证与未交付

* 真实提供方的字段、认证语义、生产 CA/DNS/代理及部署网络还需验证；本地 TLS 测试不是生产接入证明。当前环境是 macOS、Node 24.11.1。
* 没有 JWT 本地签名验证、OIDC 登录、token 签发、持久凭据托管、刷新或业务 token 交换；本批不保存/转发 token，后台 MCP 尚不可用。
* 管理命令不提供用户列表/搜索、降权、停用恢复或账户创建；数据库路径及本地用户 ID 由操作员显式确定。OS 文件权限必须由部署保证，不声称抵御同 UID 恶意进程并发换文件。
* 命令打开 SQLite 可能产生 WAL/SHM 等正常连接副作用，但不执行迁移或修改 Settings。提升失败不代表文件系统从未被打开；权限/版本更新按事务回滚。
* 独立运维入口不是 API 授权捷径。普通用户管理继续要求当前启用管理员，最后管理员及责任保护规则未放松。

## 变更后设计复查

模式：report。当前任务发现、用户澄清、实现及验证现场完整可见，置信度高；不重建更早批次的轨迹。

路线：既有 account/Identity 与设计未决项 → 确认 HTTPS 协议和显式 CLI → 保留既有账户接入规则 → 独立维护端口与 SQLite 原子操作 → TLS/SQLite/真实子进程验证 → 原路更新架构索引和交付说明。修改闭包包括 adapter/工厂、独立维护用例/脚本、SQLite 现存文件及迁移校验机制、锁文件/脚本类型检查、专项测试和文档；没有进入 MCP 凭据托管或 Agent 实现。

| 检查 | 结果 | 现场证据 | 后续风险 | 置信度 | 处置级别 |
| --- | --- | --- | --- | --- | --- |
| Missing Path | not-found | 架构索引与 account/Identity 直接定位接入合同；设计中认证协议/管理员引导的未决项由用户明确回答 | 后续认证接入不能略过本地资格检查或把 Identity 返回值当管理员许可 | 高 | 无修复行动 |
| Boundary Bypass | not-found | 普通 ensureUser/manageUser 不变；显式 OS 运维能力独立端口且不注册普通容器，SQLite 写入复用事务/错误边界 | 将维护工厂挂到 HTTP/MCP 会错误扩大授权面，文档已明确禁止 | 高 | 无修复行动 |
| Unowned Capability | not-found | 验证归 Identity；本地接入归 AccountUseCases/Store；管理员引导归显式本机维护；业务凭据保留既有未来 MCP/宿主责任 | 不能让本批验证 adapter 偷偷承担 token 托管或默认跨服务转发 | 高 | 无修复行动 |

未发现需额外行动的路由问题。指导文档更新属于批准的交付闭包，不是复查后的架构重建；未修改 AGENTS.md 或技能。复查不代替部署、安全或完整 Agent/MCP 集成验证。
