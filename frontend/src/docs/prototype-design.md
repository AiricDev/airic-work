# 前端原型维护说明

产品语义以 [PRD](prd.md) 为准，技术与导航约束见 [技术设计](technical-design.md)。可运行交互以 `frontend/` 为载体，不再维护平行的页面规格。

原型使用虚构数据和浏览器本地存储，不提供真实认证、后台 Agent、业务写入或 MCP 服务。界面中的延迟、交付和续行均为演示。

走查路径：业务入口进入执行 → 回答 DecisionRequest → 确认已回答 → 发送 Steering Input 或文件 → 结束后继续 → 筛选 MCP 写操作并展开参数与返回 → 查看对应 Session 和 Decision Episode。

修改前保留已确认的产品约束；新交互改变用户行为时先更新 PRD。检查桌面和窄屏、失败反馈、草稿及返回位置。

## 本轮验证与维护观察

构建和模型行为测试覆盖回答、资料版本变化、消息续行、身份隔离及更正历史。真实 token/MCP/Agent 尚未接入；上传以浏览器本地文件模拟，单次总量限 1 MB。MCP 参数/返回未完整提供时显示记录摘要及限制，不补造原始参数。

维护复查（本轮修改路径可见，非生产架构验收）：

| 检查 | 结果 | 依据及后续风险 | 置信度 | 建议层级 |
| --- | --- | --- | --- | --- |
| Missing Path | found | 原型曾内嵌多份 PRD/交互文档；后续只改主文档会留下旧副本 | 高 | how-level：后续用同一来源加载文档 |
| Boundary Bypass | not-found | 交互经 WorkbenchContext/reducer 更新模拟状态，文件类型放在 types，不由模型反向引用 UI | 中 | — |
| Unowned Capability | found | PlatformContext 与 WorkbenchContext 分别持有用户数据；未来停用和身份校验容易不同步 | 高 | what-level：正式接入时确定单一用户状态来源 |

本轮不扩展为生产后端或重画状态所有权。上表为维护建议，不代表已验证所有 PRD 场景。
