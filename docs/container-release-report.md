# 镜像发布准备验证记录

日期：2026-11-01。本记录覆盖首次本地打包验证，当时仅构建本地控制面预览镜像。后续 GHCR 自动发布入口与标签规则见 [发布说明](container-release.md#github-actions-与-ghcr)，实时结果以 GitHub Actions 为准。

## 产物与验证

- 本地镜像：`airic-work:preview`，`linux/arm64`，约 153 MB（Docker inspect Size）。
- 镜像 ID：`sha256:0d2000310ccf4e34cc1886503c0a359ee38f269fe010efa9a31f900dce80b12d`。
- 单镜像包含前端、HTTP、后端运行依赖和 Worker Skill；启动、健康检查、SIGTERM 关闭和部署配置已接线。
- Docker 干净构建通过。构建时执行前端类型检查和 Vite 生产构建。修复了原前端锁文件依赖开发机 pnpm 路径的问题；新锁文件由独立 Linux 环境生成，无本地链接。
- 后端类型检查通过；32 个测试文件、329 项测试全部通过。测试使用临时服务/数据，不作为真实模型或业务执行证明。
- 前端 5 个测试文件、20 项测试以及本地类型检查通过。
- `python3 deploy/smoke.py airic-work:preview` 通过：复用实际 Compose service，UID 1000、只读根目录、健康检查、页面/深链、匿名 API 拒绝、未知 API 不回退 HTML、SIGTERM 退出码 0。
- 合成用户通过真实 SQLite Store 保存；强制重建容器后仍可查询。随机 Compose 项目及其测试卷已自动清理，原有数据未使用。
- Compose 配置校验、静态入口 HEAD/隐藏路径/资源边界测试和 diff 空白检查通过。

## 验证边界

未验证 linux/amd64、多架构发布、真实 HTTPS 代理/身份交接/生产 CA、远程私有 OM 认证、真实模型或 MCP 业务操作，以及备份恢复演练。Compose 测试使用合成 key 和示例地址，没有连接外部业务服务。

当前没有生产 Workspace、附件物化和自动派发/取消确认/重启恢复宿主。入口不会启动测试替身或派发循环，健康检查明确返回 `agentExecution: unavailable`。因此本次可用于控制面集成，不能宣称完整 Agent 执行版可发布。

前端构建仍有约 966 KB 主包提示；构建工具依赖安装报告 18 个审计项（17 moderate、1 high），未在本批做依赖安全升级或完整安全审计。后端生产依赖安装报告 0 项。构建工具和前端 node_modules 不进入最终镜像；公开前端依赖仍需正式发布前单独审查。

## 变更后设计反思

完整 live route 可用，无重要上下文缺口，整体置信度高。发现路线为运行配置 → bootstrap → HTTP → Workspace 合同；最终将公开产物交付放在 driving/http，将进程生命周期放在 bootstrap，将构建/Compose 放在仓库根与 deploy。没有新增业务用例或重画权限边界。

后续修改从 README/架构索引进入发布说明，再查 Dockerfile、Compose、serve、public-delivery 与对应静态入口/容器验证。须保持这些部署机制与行为规格一致。

| 检查 | 结果 | 证据 | 后续风险 | 置信度 | 级别 |
|---|---|---|---|---|---|
| Missing Path | not-found | 既有索引、bootstrap/HTTP 文档直接指出生产 Workspace 与自动派发缺失，未误接 QA 宿主；干净构建暴露的锁文件问题已有构建与说明承接 | 仅依赖开发机缓存仍可能遗漏部署兼容问题；保留干净构建与 smoke 命令 | high | — |
| Boundary Bypass | not-found | API 仍走现有应用/认证；公开交付在 API 认证前只处理构建产物与健康检查，测试验证 API 不被 SPA 接管 | 后续扩展公开路由需继续验证认证隔离 | high | — |
| Unowned Capability | not-found | 静态文件属于 HTTP delivery；启停属于 composition root；Workspace 保留原有缺失状态，未另造伪能力 | 将来完整执行仍需沿已有 Worker/Workspace 合同接入 | high | — |

无须新增架构修复或设计门禁；未发现本次需处理的路由问题。后续可把现有构建与 smoke 命令纳入 CI（how-level，Schedule later）；本次未修改开发技能或 AGENTS 指令。
