# SEMI S2 第9章 DecisionRequest 生命周期联调

2026-11-01，隔离 CertLab 合成项目；真实 qwen3.8-flash + Pi Durable 1.4.0。结果证明本次定向的人机协作链路可运行，不代表专业判断质量、完整 Worker 环境或生产调度已验收。

## 对象与边界

- [测试报告](http://127.0.0.1:5180/reports/6579440d-be6e-4ca9-939d-04dfa6003d24)：SEMI S2-0724，第9章共20个评估项。
- [验证执行](http://127.0.0.1:5217/executions/01a194e3-d3cc-728b-9928-7c7beaa94c0e)：Session `01a194e3-d3cc-728b-9928-810fbdeb531e`。
- 固定 OM：`certlab-om@71b0169699ab75740125e1abde8c382afd8df8d9`；使用9.6.3 draft Decision 的 O1 实际任务分类、O7 起重设备供货/推荐关系。
- 管理员仅按明确批准加入隔离合成项目并创建报告；Agent 与 UserDecision 使用 `certlab_engineer`。未改原数据库、密码或角色。
- 模型凭据沿用用户批准的 CertLab 模型配置，仅在进程内读取。宿主只允许目标报告的 `integration.info`、`report.context`，以及固定 OM 读取和人工协作；无业务写入、Bash 或附件能力。专用 Workspace 为持久空目录，拒绝文件物化。

## 实际验证

| 阶段 | 可核对的结果 |
| --- | --- |
| 提出请求 | Agent 核对报告并读取固定 OM，提出两个独立请求；页面选项未预选，保留文字输入；当前轮结束，两个请求仍 pending |
| 先回答 O7 | 页面提交合成 UserDecision 后，O7 立即 answered，O1 仍 pending；在宿主续行前，消息仍 pending、执行仍 ended |
| O7 续行 | 消息 delivered，运行代次变为2，恢复到 Conversation 71；O1 未被自动回答 |
| O1 续行 | 单独提交 O1 回答后，代次3恢复到 Conversation 107；两项工作使用不同局部分支 |
| 新问题独立建请求 | Agent 额外提出材料清单审批问题；作为第三个请求单独回答，代次4沿用 O7 的 Conversation 71 |
| 更正与重启 | O7 更正保存后先保持消息 pending，再重启宿主；代次5从原 Session 恢复并交付，更正仍进入 Conversation 71 |
| 原历史 | O7 Episode 保留两条 UserDecision；更正的 correctionOf 指向原回答，均保留阅读的 Context revision 1 |
| 幂等 | O1、材料清单回答及 O7 更正均用原 key/原内容重放，返回原 UserDecision，不重复保存 |
| 最终状态 | 此验证执行3个请求全部 answered；4条 UserDecision、5条输入（含开始）均 delivered；Execution ended，Session、OM和三个 Conversation（1/71/107）未因重启更换 |
| 业务边界 | 只有2次实际 MCP 查询（integration.info、report.context）；报告仍 version 0，20个评估项均 not_started / record_no 0 |

[O7 Decision Episode](http://127.0.0.1:5217/episodes/01a194e5-6bf0-7489-a9b8-d79fcc6e5c1a) 可查看原回答、更正和各自消息交付情况。回答均显式标注为合成测试，不是设备事实或专业结论。

## 发现与修复

首次运行中，模型把 Execution ID 当作 continuationId。原实现先通过用例保存请求，随后才校验续行标识，导致报错留下不可路由的请求，模型修正重试后出现重复项。现已改为先校验续行标识，再调用请求用例，提交阶段保留防御性校验。`backend/tests/pi-runtime.test.ts` 新增回归用例：修复前失败，修复后通过；完整类型与后端检查327项通过。

首次失败执行 `01a194b3-1d29-750f-9a3e-34956f372f59` 在首次运行结束时的3条 pending 请求保留为缺陷证据，其中1条缺失路由。它不计入上表的验证执行结果，未删除或伪造回答来美化数据；复现时请使用上方验证执行链接。

## 仍存在的交互问题与未覆盖范围

- Agent 在收到『只整理材料清单』的回答后，仍额外要求用户批准清单；这是不必要的请求，不能把3个请求全部 answered 当作交互质量通过。Worker 行为仍需后续改进。
- 首次提问过长：同一背景进入 question 和 Context，使页面重复展示大量文字。验证执行通过明确要求『问题一句话、背景进 Context』改善了呈现；默认行为尚未因此得到保证。
- 本次没有验证附件、Workspace 工具进程、业务写入/未知效果恢复、取消竞争或正式专业门禁。运行宿主是仅供该执行使用的定向测试装配，续行由显式测试触发，不等于正式后台调度已交付。

本地详细状态、断言脚本、Pi Session、模型输出与截图保存在 Git 忽略的 `.qa-artifacts/ch9-lifecycle-20261031/` 和 `.airic-data/certlab-link/ch9-real-pi/`；不发布密钥或原始模型会话。


2026-11-01后续验证：同一首次执行中，锚点完整的 O7 已实际接受回应并自动续行，另完成运行中连续回应的排队测试；O1与孤立O7仍待回应。最新状态及测试宿主调度边界见 [回应后自动续行验证](decision-response-resume-report.md)。上表独立验证执行的原始结果不变。
