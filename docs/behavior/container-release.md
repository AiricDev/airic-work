# 单镜像集成预览

本批交付控制面集成预览，未交付生产 Agent 执行环境。

Scenario: 启动与页面访问
Given 配置了可信 HTTPS Identity、明确的 HTTP origin、OM 来源和持久卷
When 使用镜像启动一个 Airic Work 实例
Then 前端、SPA 深链和 /api 由同一端口提供
And /healthz 明确报告 control-plane 正常、agentExecution unavailable
And 匿名请求仍不能读取业务 API

Scenario: 路由与公开文件边界
Given 只有构建产物被指定为公开目录
When 请求未知 API、缺失资源、配置文件或非 GET/HEAD 的页面
Then 返回错误而非 index.html、宿主文件或秘密
And SPA 回退只适用于请求 HTML 的无扩展名页面

Scenario: 数据与运行能力
Given 当前没有生产 Workspace 和派发循环
When 集成方创建执行或保存输入
Then 保存的事实保持原有语义，不宣称已经运行或交付
And 不以测试 Workspace 代替生产能力
When 重建容器并保留数据卷与原加密密钥
Then 控制记录、上传、凭据和固定 OM 缓存继续保留
And 内存 HTTP 会话需重新接入

Scenario: 配置失败与退出
Given 必需配置缺失或构建产物缺失
When 启动服务
Then 非零退出且不输出配置值或凭据
When 接收到 SIGTERM
Then 先关闭 HTTP/SSE，再关闭 Worker 与数据库资源
