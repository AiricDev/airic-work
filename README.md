# Airic Work

独立 Agent 工作平台，通过业务系统身份与 MCP 集成，保存执行、人工 Decision、输入和运行轨迹。

- [单镜像发布与 Docker Compose 集成](docs/container-release.md)：当前为控制面集成预览，Agent 生产执行环境尚未完成。
- [产品定义](docs/prd.md)、[技术设计](docs/technical-design.md)、[架构路由](architecture-map.md)
- [后端开发与配置](backend/README.md)、[前端与 HTTP 集成](docs/http-integration.md)

镜像：`ghcr.io/airicdev/airic-work:preview`。GitHub Actions 在 amd64/arm64 验证后发布；版本标签与固定摘要的使用方式见部署说明。

本地检查：`npm run check`。部署配置参考 `.env.example`；容器部署使用 `deploy/airic-work.env.example`。
