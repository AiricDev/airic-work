# 原前端与 HTTP 接入

## 路由与职责

应用保持 `frontend/src/index.tsx → App.tsx → AppShell → pages/components`。保留原项目表格、筛选、执行双栏/窄屏 Tabs、Decision Brief、处理表单、核对步骤、队列、OM 文件树/历史及用户/设置布局。没有替代工作台，也没有 `live/` 页面。

`api/client.ts` 负责同源请求、Cookie/CSRF 和结构化错误，`api/views.ts` 将真实 DTO 转为既有组件的显示模型。WorkbenchContext 查询本人项目、执行、请求、回答和交付状态；PlatformContext 查询身份、用户与设置。API 记录不写 localStorage；草稿按 userId 隔离，未知提交固定原始 payload/key。旧 reducer/seed 留作历史原型测试，正式入口不引用它们。

HTTP adapter 位于 `backend/src/adapters/driving/http`，通过 Application 查询/命令完成访问，不直接读取数据库。响应白名单、OpenAPI 及前端类型由 `contracts.ts` 统一生成。Domain/Application 保持对框架的独立性。

## 已接入

| 原界面 | API |
|---|---|
| 登录/退出、当前用户 | auth/session、me、me/preferences |
| 项目/执行表格与范围筛选 | projects、executions |
| 原执行双栏与队列 | executions/:id、decision-requests、user-decisions、inputs |
| Decision Brief/提交/追加更正 | 原 Context 修订、选项、自由文本、Upload ID；请求 ID 即 Episode ID |
| Steering/停止 | steering、cancel；不把保存视为已经继续或停止 |
| 原上传组件/下载链接 | multipart 上传真实字节，下载验证范围/大小/摘要 |
| Session/Trajectory 与 MCP 操作 | 原 Session；调用分页、类型筛选、参数与结果；未知分类保留 |
| 固定 OM 文件树、正文、搜索、Git 历史/diff | 本地固定 SHA；可从已有 Git 对象导出历史快照，不 fetch、不回退 |
| 资料/偏好、用户管理 | profile/preferences/users/manage；停用和最后管理员保护由后端裁决 |
| Git 与业务连接设置 | 宿主允许的 source/connection ID、分支、Root；CAS 版本 |
| 执行级业务连接 | 换取/续期/撤销该用户该执行的 MCP 凭据 |

SSE 只触发失效重查，另有 15 秒和窗口聚焦刷新。退出/身份失效清空内存，陈旧请求不能用上一身份覆盖新会话。前端没有伪造 Runtime 事件、业务产物、通知、授权或审计记录。未提供的结构化专业建议/事实不从任意 JSON 中猜测；Decision Context 原文完整显示在原 Brief 的 Context 区域。

## 配置与宿主

所有 HTTP 配置仍由 `bootstrap/bindings.ts` 的 dotenv 入口读取：

```dotenv
AIRIC_HOST=127.0.0.1
AIRIC_PORT=8010
AIRIC_HTTP_SOURCE=certlab
AIRIC_HTTP_ORIGINS='["https://work.example"]'
AIRIC_HTTP_SECURE_COOKIES=true
```

source/origins 必须一起设置；本地 HTTP 联调才显式关闭 Secure Cookie。生产通过同源 HTTPS 代理提供前端与 `/api`，SPA 深链回退不能拦截 API；关闭 SSE 缓冲，不记录 Cookie/Authorization 或敏感正文。

`createConfiguredBackend(config, workspace)` 加上 `bootstrap/http.ts` 的 `listenConfiguredHttp(config, backend)` 可以监听。HTTP 不拥有自动派发、停止确认或重启恢复循环；生产 Workspace 仍未交付，不将测试替身装配成生产能力。

身份交换：可信同源接入模块调用 `api/handoff.ts` 的 `connectWithToken(token)`。POST auth/session 校验外部 Bearer 身份后换取随机 HttpOnly Cookie；写请求校验精确 Origin 与 CSRF。后端会话内存有容量、空闲/绝对期限，并逐请求重验身份；重启后需重新接入。不从 URL/postMessage 接受身份，不把 token 放进模型、Workspace 或 localStorage。只有 Vite 开发模式显示 token 输入。

创建执行、回答、Steering 都要求稳定 Idempotency-Key。同键同内容返回原结果；未知网络结果沿用原内容/key重试，不另建命令。取消只是保存停止意图，HTTP 不推断实际停止。

## 运行和验证

```sh
npm ci --prefix backend --ignore-scripts
npm ci --prefix frontend --ignore-scripts
npm run check
npm --prefix backend run generate:http
npm --prefix frontend run typecheck
npm --prefix frontend test
npm --prefix frontend run build
```

隔离联调（临时 SQLite/Blob/Git、真实 HTTPS Identity adapter；Runtime/Workspace 明确是测试替身）：

```sh
AIRIC_QA_PORT=8048 AIRIC_QA_ORIGIN=http://127.0.0.1:5217 npm --prefix backend run qa:http
AIRIC_API_TARGET=http://127.0.0.1:8048 npm --prefix frontend run dev -- --host 127.0.0.1 --port 5217 --strictPort
```

开发登录使用合成 token `qa-owner` / `qa-other`。不能将此测试宿主用于部署。其数据在进程退出时清理，不是实际 CertLab 用户或业务工作。

自动验证涵盖 HTTP 身份/CSRF/归属/幂等/文件与重开、OM 离线/历史快照，以及 SSE 不耗尽普通请求并发；前端验证原组件树仍参与运行、seed 不进入入口、视图映射与未知提交的按用户持久恢复。旧 ontology 测试保留，不能当作真实 Agent 证据。

2026-10-31 浏览器验证：原项目表格→执行工作区→不填理由的选项回答→追加更正与真实附件→固定 OM 文件树/正文/历史。回答保存后仍显示消息待交付。桌面与窄屏断点均已检查。当前完整检查后端 326、前端 12 项通过，前端类型检查/构建通过；主包约 973 KB，尚未拆包。
