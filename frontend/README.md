# Airic Work 前端

保留 Magic Patterns 导出的原 AppShell、页面、组件和交互，通过既有 Context 与 `src/api/` 接入真实后端；不另建替代工作台。

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
npm run build
AIRIC_API_TARGET=http://127.0.0.1:8010 npm run dev -- --host 127.0.0.1
```

生产前端和 `/api` 应同源 HTTPS。登录由业务集成调用 `src/api/handoff.ts` 完成；开发模式有显式 token 联调表单。Cookie/CSRF 由 client 管理，业务 API 记录不写浏览器存储，只有用户隔离的草稿在本地保存。

完整 API、宿主限制、隔离联调命令及验证说明：[HTTP 对接](../docs/http-integration.md)。旧 seed/reducer 仅为历史原型测试，正式入口依赖测试禁止将它们引回页面。
