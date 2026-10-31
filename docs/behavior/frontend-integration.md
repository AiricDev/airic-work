# 保留原界面的真实接口接入

以既有 AppShell、pages/components 为唯一 UI；保留项目表格、执行双栏、Decision Brief、处理与核对步骤、OM 文件树和设置布局。

- 本人 API 记录才显示；加载、空和失败不注入 seed。
- UserDecision 支持选项、自由文本、附件；固定实际阅读修订，不预选、不强制编造理由。
- 提交未知后保留原 payload/key，刷新后仍可同键重试；不能编辑或另建命令。
- Context 更新不改写草稿依据；明确查看新版才变更阅读修订。
- 上传保存真实字节并取得 Upload ID；回答/Steering 引用 ID，不用 data URL 伪装 Workspace。
- 保存回答/消息与 Agent 接收/继续分开；取消显示 stopping，不能计时推断 stopped。
- 浏览指定固定 SHA，不可取得时提示，不回退其他修订。
- 登出/身份失效清空内存数据，草稿按用户隔离。
- 无合同的能力保留说明位置，不提供模拟成功。

边界：Application 拥有权限和写入；HTTP 负责认证/DTO；前端 API 负责传输与视图映射，既有 Context 负责查询和草稿，原组件实现交互。不伪造生产 Workspace 或调度。
验证：HTTP 权限/CSRF/幂等/文件，映射/草稿恢复/原路由依赖测试，以及原布局浏览器核对。
