# Airic Work 镜像发布与 Compose 集成

当前版本是**控制面集成预览**：单镜像包含原前端、HTTP API、SQLite/Blob/Git/Pi/MCP 适配器与 Worker Skill。生产 Workspace、附件物化、自动派发/恢复循环仍未交付；创建执行和保存输入不代表 Agent 已开始工作。不要作为正式无人值守执行版发布。

本次已验证的平台、结果和剩余限制见 [验证记录](container-release-report.md)。

## 构建和启动

在仓库根执行：

```sh
docker pull ghcr.io/airicdev/airic-work:preview
cp deploy/airic-work.env.example deploy/airic-work.env
# 编辑 deploy/airic-work.env，填入真实地址、模型 key 和固定加密密钥
docker compose -f deploy/compose.yaml config --quiet
docker compose -f deploy/compose.yaml up -d
docker compose -f deploy/compose.yaml ps
curl --fail http://127.0.0.1:8010/healthz
```

如需本地构建替代 registry 镜像，可运行 `docker build -t ghcr.io/airicdev/airic-work:preview .`。

密钥用 `openssl rand -hex 32` 生成一次；不要在每次重启时重新生成。配置文件仅保存在部署主机，限制读取权限；构建上下文排除 `.env`、本地数据、测试和开发技能。`VITE_REFERENCE_TEMPLATES` 是公开的构建参数，必要时用 `--build-arg` 指定，不能包含秘密。

Dockerfile 使用多阶段构建，前端产物与 Linux 原生依赖进入最终镜像，编译器留在依赖阶段。基础 Node 24.11.1 镜像固定 digest；升级时重建并重新验证。最终服务以 UID/GID 1000 运行，单端口 8010，支持 SIGTERM 顺序关闭。原生 better-sqlite3 在目标平台安装，不能复用开发机 node_modules。

## 组装到应用系统

把 `deploy/compose.yaml` 的 service 和 volume 合入业务系统的 Compose，调整 env_file 相对于该 Compose 的路径。所有服务在同一 Compose 项目时默认可通过 `airic-work:8010` 访问。跨 Compose 项目时由集成方声明并连接同一个外部网络。业务数据库、业务权限和业务事务仍归业务系统。

建议给 Airic Work 单独的 HTTPS 域名，例如 `https://work.example`。由应用系统已有代理转发该域名的全部路径到 `http://airic-work:8010`，保留路径；前端使用根路径与同源 `/api/v1`。当前没有通用子路径部署支持。业务系统使用自己已有的登录身份，通过可信接入模块向 `/api/v1/auth/session` POST Bearer token，再使用 HttpOnly Cookie/CSRF；现有前端 handoff 接口见 [HTTP 接入](http-integration.md)。发布构建不提供开发模式的手工 token 登录框。

代理需保留 Cookie、Authorization、Origin 和 Idempotency-Key；SSE `/api/v1/stream` 关闭缓冲并允许长连接，上传限制至少与 `AIRIC_HTTP_UPLOAD_BYTES` 一致。不要记录敏感请求头或正文。浏览器 origin 必须与 `AIRIC_HTTP_ORIGINS` 精确匹配。线上保持 Secure Cookie，HTTP 只用于明确的本地联调。

Identity、MCP 签发/撤销和调用地址必须是可达且证书有效的 HTTPS；容器内 `127.0.0.1` 指向容器本身。内部 CA 文件只读挂载，同时配置 `NODE_EXTRA_CA_CERTS` 与 `AIRIC_IDENTITY_CA_FILE`，前者必须在 Node 启动前存在。网络别名须匹配证书域名。

OM 默认示例使用远程 Git，由受管缓存保存。私有仓库认证须由部署方配置只读凭据与 known_hosts，不把秘密放 URL/镜像。离线部署可只读挂载完整 Git 仓库至 `/opt/om`，并设置：

```dotenv
AIRIC_OM_SOURCES='{"certlab":{"kind":"local","directory":"/opt/om"}}'
```

只读本地仓库用于读取已提交内容，显式同步会需要写权限；应在外部维护 OM。linked worktree 的 `.git` 引用目录也必须可达，建议挂载独立完整 clone。

## 持久化、升级与恢复

`/var/lib/airic-work` 覆盖控制库、Blob、OM 快照/索引、Pi Session 和加密凭据。首次使用 Docker 命名卷自动继承私有目录权限；改用主机目录时先准备 UID/GID 1000、模式 0700 的目录。适配器会拒绝不安全权限，不自动放宽。

一个数据卷只供一个 Airic Work 实例，禁止扩容共享 SQLite/Pi 存储。此镜像不需要 Docker socket。后续隔离执行容器属于独立的 Worker 环境能力，不因平台本身已经容器化而自动具备。

升级前停服务，备份整个数据卷和独立保存的原加密密钥，再切换固定镜像 tag/digest。启动会执行已定义的 SQLite 迁移；迁移失败不会清库。需要回滚时恢复匹配的卷备份与旧镜像，不能假定旧程序支持新 schema。不要运行 `down -v` 删除数据。HTTP 会话在内存中，服务重启后需业务系统重新交接身份。

首次用户经真实身份接入后，可由部署管理员运行已有本机命令：

```sh
docker compose -f deploy/compose.yaml exec airic-work npm --prefix backend run admin:grant -- --user <local-user-id>
```

不自动授予首个用户管理员权限。Settings 初值只用于空库，环境变量中的来源/连接 ID 不覆盖数据库中已有管理员设置；地址和允许列表仍属于宿主配置。

## 发布验收

构建镜像后运行 `python3 deploy/smoke.py airic-work:preview`。脚本复用本仓库 Compose 定义，使用随机项目名和合成配置，验证普通用户、页面/API、优雅退出以及强制重建后真实用户记录保留；结束时只删除本次临时项目和测试卷，不接触部署卷，不调用真实外部服务。

`/healthz` 只证明控制面可响应，返回 `agentExecution: unavailable`；不证明 Identity/MCP/模型/OM 可用，也不证明 Agent 执行可用。匿名 API 仍须拒绝；HTML 深链回退不能吞掉 API 错误。

发布到外部仓库前，应验证目标 CPU 平台的镜像构建、只读根目录与普通用户启动、真实 HTTPS 身份交接/MCP、数据卷重建、备份恢复，以及既有后端/前端检查。仓库现已配置 GHCR 构建发布工作流，不自动创建 release tag。正式 Agent 执行发布还需要生产 Workspace、附件物化、派发/取消/重启恢复宿主及相关端到端验收。

实现参考：[Docker 多阶段构建](https://docs.docker.com/build/building/multi-stage/) 与 [Fastify 服务生命周期](https://fastify.dev/docs/latest/Reference/Server/)。


## GitHub Actions 与 GHCR

工作流为 `.github/workflows/docker.yml`，使用 GitHub 自动提供的 `GITHUB_TOKEN` 和 `packages: write`，无需配置 Docker Hub 账号或长期发布密钥。第三方 Action 固定到核实过的提交 SHA。amd64/arm64 分别在原生 runner 构建，先运行 `deploy/smoke.py`，两者成功后再合并发布多架构标签；PR 不登录 registry、不推送镜像。

| 触发 | 发布标签 |
|---|---|
| push main | `ghcr.io/airicdev/airic-work:preview`、`sha-<完整commit SHA>` |
| push `v0.1.0` 等版本标签 | `ghcr.io/airicdev/airic-work:0.1.0`、`sha-<完整commit SHA>` |
| Actions 手动运行 | 发布所选提交的 SHA 标签；main 同时更新 preview |
| PR | 仅构建与容器验证 |

每个运行还会留下 `build-<run id>-<attempt>-<arch>` 平台标签，用于合并镜像。没有自动 `latest` 标签；当前控制面预览不会被标成完整 Agent 正式版。公开的 `VITE_REFERENCE_TEMPLATES` 如需定制，应构建自己的镜像；官方通用镜像不绑定 CertLab 实例地址。

CertLab 合并 Compose service 后直接引用：

```yaml
services:
  airic-work:
    image: ghcr.io/airicdev/airic-work:preview
```

也可通过宿主环境 `AIRIC_WORK_IMAGE=ghcr.io/airicdev/airic-work:sha-<commit>` 选择已验证的提交，或使用 `ghcr.io/airicdev/airic-work@sha256:<manifest digest>` 固定部署。该变量由 Compose 宿主解析，不放在 service 的 `airic-work.env` 中。首次发布后在 GitHub Packages 检查镜像可见性；公共镜像可以匿名拉取，私有镜像需在部署主机先用具备 `read:packages` 的凭据执行 `docker login ghcr.io`。CertLab Actions 若读取私有镜像，还须在 Package 的 Actions access 中授权 CertLab 仓库；不把拉取凭据放入容器。

参考：[GitHub 镜像发布](https://docs.github.com/en/actions/tutorials/publish-packages/publish-docker-images)、[GHCR 权限与拉取](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)、[多平台构建](https://docs.docker.com/build/ci/github-actions/multi-platform/)。
