# 适配器交接边界

按 `../application/ports.ts` 实现 SQLite、Identity、Pi、Workspace/Blob、Git 和 MCP。生产代码尚未实现。

* Store 每个命名方法拥有自己的原子提交，不暴露 SQL、ORM 或通用写入回调给内层。
* 每次提交重查当前用户资格、归属、版本、文件范围、唯一性、运行代次及必要责任保护；UserDecision、已回答和 Outbox 必须一起保存。
* Runtime 同一 Session 中按 inputId 持久去重和查回，空闲/结束后续行不新建逻辑 Session；停止与新运行互斥。
* MCP 入口传宿主稳定 toolCallId，不得在每次重放时生成新 ID；网络派发前再查取消代次。外部业务恢复遵循服务合同，不盲重试。
* History 在派发前持久记录脱敏调用，重复原调用不再次派发；Session 索引可重建，分页/筛选报告覆盖限制及未知分类。
* Files 固定实际字节、大小和 SHA-256；Workspace 路径由宿主生成并隔离，文件和运行目录持续。
* Identity 校验 token，入口注入真实用户及 source；请求体不能自选 userId/source 取得权限。
* 只读 MCP handler 只装配 readonly-mcp.ts 返回的查询表面。HTTP/运行时/worker 共享用例，不写表绕过规则。

须补真实存储的并发/回滚测试、SDK 丢确认查回、容器停止和在途业务写入窗口。测试替身通过不证明这些机制成立。
