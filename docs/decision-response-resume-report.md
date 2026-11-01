# DecisionRequest 回应后自动续行验证

2026-11-01，使用现有隔离 CertLab 报告与真实 qwen3.8-flash / Pi Durable，验证网页回应后的队列消费和原上下文恢复。本次验证通过的是受控、无附件、只读业务 MCP 场景，不代表生产后台调度或业务写入已验收。

## 使用对象

- Execution：`01a194b3-1d29-750f-9a3e-34956f372f59`
- Session：`01a194b3-1d29-750f-9a3e-393df3e51775`
- [被回应的正常 O7 请求](http://127.0.0.1:5217/episodes/01a194e2-1c49-774e-a8d7-22f33e00c211)
- OM：`71b0169699ab75740125e1abde8c382afd8df8d9`；Worker 沿用原执行固定的0.2.0内容快照。
- 当前浏览器此前选中的 `01a194e1-ba8e-7526-b21a-c3ffa95cb7ce` 是修复前留下的孤立请求，没有 Pi 续行锚点。本次未替它制造锚点或假装恢复成功。原 O1 也未代用户作答，其原有草稿保留。

## 让出执行后收到回应

网页选择 O7 的“目前不清楚，需要取证或向供应商澄清”，补充明确标注为合成联调的指示后提交。隔离宿主自动检查这个 Execution 的持久输入队列，不使用手动 run.signal。

| 检查 | 实际结果 |
| --- | --- |
| 回应保存 | 请求立即 answered，UserDecision 与待交付 Input 同时存在；宿主派发前快照仍为 ended / generation 1、Input pending |
| 自动交付 | 本轮约129ms后 UserDecision 进入原 Session；输入随后标记 delivered |
| 恢复位置 | 同一 Session 内从 root Conversation 1 的 entry 117 分支到 Conversation 127，正是该 O7 请求的安全锚点；未从root末尾重做整项委托 |
| 回答依据 | 输入包含原问题、Context revision 1、实际选择 unknown-need-source、回应原文、原指示及有限的后续进展 |
| 实际继续工作 | Agent 从分支127发起一次真实 report.context，只读重核同一报告和评估项，然后让出当前局部工作 |
| 版本与状态 | Session、Workspace、OM不变；本轮 generation 1→2，状态 ended→running→ended；O1仍 pending、请求总数仍3 |
| 幂等重放 | 用原浏览器命令键和原输入重放返回同一 UserDecision，没有新增输入或第二次续行 |

这里的 ended 是该轮自动工作已经让出，并不销毁 Session，也不表示业务评估完成。

## 运行中连续收到两条回应

在同一 O7 上追加两条明确标注为测试的补充/更正：A要求只读重核报告并明确列两项待确认事实；观察到A已交付且执行 running 后，在模型仍在处理A时提交B，要求沿用本轮已核对状态，不重复读取。

- B在 running / generation 3 时被接受，保存在队列中为 pending；没有打断A。
- A完成只读查询和让出后，收尾检查发现B尚未交付，因此拒绝过早写 ended。测试宿主记录 `finish-deferred-for-new-input`，下一次检查继续消费B。
- B沿用已存在的 Conversation 127，按序进入A之后；没有再fork，也没有重复MCP读取。
- 最终同一 generation 3 才成功结束。3条 UserDecision（首次回答、A、B）分别只有一条投递记录，两个补充保留 correctionOf 关联。输入总数4（含原开始），全部 delivered。
- O1仍未回答，孤立旧请求仍保留，未新增 DecisionRequest；同一 Session 中仍只有root与O7两个 Conversation（1、127）。

最终摘要明确保留两项未知：供应商随设备提供哪些起重设备及相关说明；哪些仅被指定/推荐、由用户自行取得说明。报告仍 version 0，20个评估项均 not_started / record_no 0；调用仅限只读工具。

## 发现与限制

1. 旧本地宿主只响应手动信号，网页保存回应不能自动触发。此次为指定Execution接入了隔离输入队列消费；它不是通用生产 Worker 调度服务。
2. 收尾遇到新增排队输入时，调用方需继续消费，而不是把用例的 blocked/conflict 视为整个宿主永久失败。测试宿主仅在确认新输入于本轮运行期间进入、执行仍running时重试；其他错误保留诊断并暂停，避免盲目重试未知业务效果。
3. 首次续行的让出摘要说“列出尚需确认项”却没有实际列出。连续回应A/B明确要求写入summary后才输出了具体两项。这属于结果汇报质量问题；不能把消息交付和分支恢复成功当作交付质量成功。本次沿用Worker0.2.0，并未验证新0.2.1的默认简洁性。
4. 本轮未覆盖不同问题的逆序同时回应、附件、业务写入、在途取消与硬崩溃恢复。前一轮的其他定向结果见 [第9章生命周期记录](ch9-decision-lifecycle-report.md)，分别看待其覆盖范围。

本地证据、探针与专用宿主在 Git 忽略的 `.qa-artifacts/decision-resume-20261101/`，其中 `verification.json`、`busy-verification.json` 记录正常续行和连续回应断言。原始 Pi 历史保留在隔离运行目录，不发布到文档或模型提示中。
