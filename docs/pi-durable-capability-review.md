# Pi Durable 能力核实与具体接入方案

| 项 | 本次证据 |
| --- | --- |
| 日期 | 2026-10-30 |
| 阅读入口 | [Pi Durable 官方介绍](https://earendil.com/posts/pi-durable/) |
| 实际源码基线 | 官方仓库 tag `v1.4.0`，commit **`4a080252f06caf63a525d7873c5d94d3c23887e0`** |
| 测试环境 | macOS arm64、Node 24.11.1、npm 11.6.2、Vitest 4.1.11；构建依赖使用 TypeScript 5.9.3 |
| 上游测试 | 10 个选定文件，**258 tests passed**，不是完整上游测试集 |
| Airic 场景实验 | [continuation.test.ts](../spikes/pi-durable/continuation.test.ts)，**6 tests passed** |
| 未覆盖 | 真实模型、业务 MCP、Docker/pi-env、断电/kill -9、生产 Runtime/History 适配器、完整 Airic Work E2E |

实验在临时官方源码 checkout 中运行，没有给项目安装 Pi 依赖或接入真实模型。测试使用上游 fauxProvider 和真实 Pi Harness；持久化实验使用真实 Node SQLite。它们证明相应机制，不证明模型会正确分工或业务操作不会重复。

## 1. 核实结论与设计调整

一个 Execution 可以直接对应一个 Pi Harness / Session，其中有协调与局部 Conversation。**模型/工具执行、任务等待、checkpoint、恢复和 ownership 取消使用 Pi 原生机制；Airic Work 定义请求、局部工作范围、输入路由与资源准入政策。** 不另写一套通用任务执行器。

上一版需要具体调整：

* 把泛化的“就绪队列和局部状态机”收紧为 Session documents 中的关联/准入记录，加 Pi `defineTask` 的执行状态；不重复存储一套 ready/running/waiting 任务事实。
* 通过工具的 `control.terminate` 建立正常工具轮的执行边界；不用 `handoff` 重置上下文，也不用普通 abort 实现轮转。
* 提问锚点在该片段真实结束后由持久 Task 固化，再安排后续片段；不把 fail-open 的 `afterTools` observer 当成可靠写入门禁。
* 分支挂到 root 的 background anchor task 下，利用 Pi ownership 树停止整个 Execution；不默认 ownerless 后另造完整级联取消树。
* 人工等待仍保存为 DecisionRequest 和续行依赖，不把一个 JavaScript Promise 或 Pi 原生 Task.wait 冒充“等待任意外部用户事件”。

## 2. 能力与确切 API

下列 API 来自实际 checkout，而非直接复制文章中的示例。文章与 main 会变化；包的 version 字符串相同也不代表源码合同相同。比如本 tag 工具模型返回字段是 `output`，文章示例中的 `content` 不能直接照搬。

| 能力 | 锁定版本的机制 | Airic Work 用法与限制 |
| --- | --- | --- |
| 单存储多上下文 | `Harness.open`、`root`、`conversation`、`Conversation.fork` | 每 Execution 一个存储，多 Conversation；不新增产品 Execution |
| 精确历史上下文 | `conversation.context(context, { at })`、`fork(at, options, context)` | entry 是可定位锚点；不是进程堆、文件系统或业务数据库快照 |
| 分支原子绑定 | `root.commit` → `tx.forkConversation` + `tx.doc` + `configure` | 分支与 continuationId 映射一次提交；首次 submit 在后续提交中，用稳定键查回 |
| 扩展与工具 | `createRegistry`、`defineExtension`、`defineTool`、`wrapTool` | Worker、Root 与能力以 sections/tools 注册；所有 MCP 仍经应用用例 |
| 常驻上下文 | `section(key, render)`，每次模型请求重建 | render 读取固定装配与当前局部范围；不能读取 latest OM 替换既有 SHA |
| 持久状态 | `defineDoc` / `defineDocFamily`，`scope`、`history`、`fork` | Session 关联当前共享；局部方法现场可 rewindable/asOf；活动运行状态不复制 |
| 投递去重 | `submit({ requestId, ... })`、`tx.submissionByRequest`、`harness.submission` | 原生去重是 Conversation 范围；先固定全 Session 的输入路由，不能随机换分支 |
| 忙时输入 | `whenBusy: followUp / steer / reject` | 宿主串行片段建议用 reject 检出非法并发；普通消息不误映射为 Pi steer |
| 正常让出 | 工具结果 `control: { terminate: true }` | 同轮**每个**工具结果均为 true 才终止；不 reset；done 的 answer 可能是含工具调用的 assistant entry |
| 持久执行与等待 | `defineTask`、`runtime.commit`、`status: waiting, on: TaskId[], policy` | checkpoint/依赖等待交给 Pi；waiting 的 on 是 Task ID，不是 DecisionRequest ID 或任意文档谓词 |
| 后台寿命与取消 | `background: true`、任务 ownership、`root.abort(context, { background: true })` | 不阻塞 root 普通 idle；全局取消跨后台边界；不回滚外部业务效果 |
| 恢复与唤醒 | `Harness.open` 后 `resume`；`wake` / `onWake` | 原存储恢复；onWake 供外部宿主安排进程唤醒，不是业务消息服务或公平调度器 |
| 观察与历史 | `inspect`、`taskGraph`、`watchEvents`、`tx.scanEntries` | 调度状态使用原生事实；全 Session 查询不能只扫 root 的 fork-aware entries，否则会漏分支或重复祖先 |
| 存储与工具环境 | `openNodeSqliteStorage`、`HarnessOptions.env`、`ExecutionEnv` | 本次验证 SQLite；Pi 的 Node 环境不自动提供隔离，Docker/pi-env 单独验证 |

源码入口：[harness/types.ts](https://github.com/earendil-works/pi/blob/4a080252f06caf63a525d7873c5d94d3c23887e0/packages/durable/src/harness/types.ts)、[harness/harness.ts](https://github.com/earendil-works/pi/blob/4a080252f06caf63a525d7873c5d94d3c23887e0/packages/durable/src/harness/harness.ts)、[types.ts](https://github.com/earendil-works/pi/blob/4a080252f06caf63a525d7873c5d94d3c23887e0/packages/durable/src/types.ts)。

## 3. Extension 与适配器的实际形状

建议 `AiricWorkExtension` 注册以下内容，仍保持当前 Clean Architecture 的方向：

| 内容 | SDK 落点 | 职责 |
| --- | --- | --- |
| 平台边界、Worker、Root、局部范围与更新 | `sections: [section(...)]` | 读取固定装配与受控状态，不让资料注册为指令 |
| 人工协作工具 | `defineTool` → RuntimeToolController → DecisionUseCases | 原身份/代次、稳定命令键和请求保存 |
| 动态 MCP 工具 | `defineTool` / deferred tools → McpUseCases | Schema、派发前 Session 记录、当前用户调用、脱敏与未知效果 |
| 文件与命令工具 | Coding tools 经 wrapper → ExecutionEnv | 容器访问与输出限制，不使用默认宿主 NodeExecutionEnv |
| 局部寿命锚点 | `defineTask('aw.continuation-anchor')` | 官方 background anchor 模式；不等用户，不跑业务动作 |
| 输入/片段驱动 | `defineTask('aw.run-slice')` | 原 input/tick 身份、运行准入、submit、读取终结事实、固化锚点与安排下一片段 |
| 完成通知 | `defineTask('aw.report-progress')` 或 run-slice 的 report phase | 稳定键向协调路径追加一次内部通知，不重复执行业务 |

`PiRuntime` 实现应用 Runtime 端口；`PiHistory` 读取/追加唯一 Session 的事实；RuntimeToolController 只调用应用服务。registry、Pi 的 numeric ID、Document token 和 Task 类型不进入 Domain。bindings 和组合根装配这些 class；应用不获取 SDK 容器或绕过用例操作数据库。

`pi-mcp` 可以作为传输客户端，但不是现成 Airic Work Durable 适配器。其 [README](https://github.com/earendil-works/pi/blob/4a080252f06caf63a525d7873c5d94d3c23887e0/packages/mcp/README.md) 的 AgentTool 示例不能直接替代 Durable ToolRegistration；共享 token、分类/Schema 快照、发起记录及业务结果解释仍需适配。

## 4. Session documents 的分工

| 拟定 document | scope / fork | 保存什么 |
| --- | --- | --- |
| `aw.assembly` | session | 已核验 OM/Worker/Runtime/镜像配置与摘要，固定不随分支切换 |
| `aw.continuations` | session | 原请求 → 局部工作 → 来源/安全锚点 → 当前 Conversation/anchor task 的映射、scope 与依赖 |
| `aw.receipts` | session；可按 inputId 用 family | 输入摘要、原对象关联、固定目标、run-slice TaskId 与接收凭据；全 Session 去重 |
| `aw.execution-control` | session | generation、停止/收尾标记、片段活动槽和指示修订；不是另一份任务执行状态 |
| `aw.local-context` | conversation，rewindable / asOf | 需要随提问现场恢复的局部资料与范围版本 |
| `aw.slice-intent` | task 或运行片段关联记录 | 本轮让出/继续意图、明确交接与进展；需长期定位的内容同时引用不可变 entry，不能只留在会退休的 task document |

Session documents 不随 fork 回退；conversation asOf 文档按锚点 commit 恢复。SQLite 实验 P03 验证了“局部历史值为 1，但 Session 当前共享值已经是 2”，并验证分支映射跨 reopen 保留。**恢复现场与读取当前世界在同一个上下文中并存。**

## 5. 基于原生任务的串行片段方案

Pi 本身允许多个 Conversation 同时运行。首版选择每 Execution 一条活动片段，是 Airic Work 对共享 Workspace 和写操作的准入政策，不是 Pi 能力限制。

### 5.1 执行阶段

`aw.run-slice` 由 Pi `defineTask` 承担，拟定 phases：

1. **acquire**：在 Session commit 中检查 generation、停止/收尾标记及活动槽。槽被另一有效片段占用时，返回原生 `waiting`，`on: [activeSliceTaskId]`、`policy: 'allSettled'`；不自建等待 Promise/轮询。槽的任务若已终结而未释放，应原子回收，不等待一个永远失效的占用。
2. **submit**：checkpoint 固定 targetConversationId、内容和 `requestId = aw-slice:<task.id>`；调用该 Conversation 的 submit，建议 `whenBusy: 'reject'` 暴露槽/绑定错误。重启重跑同 phase 时仍找到同一 submission。
3. **observe**：等待当前 submission 终结；这只是正在运行的模型/工具片段，不是等待人。结果保存为 checkpoint 后再进入 finalize，避免重启重新解释已决定结果。
4. **finalize**：读原生 submission / tool-result entries；固化本轮提问锚点、工作交接及后续片段意图。在同一 commit 释放活动槽并创建必要的后续原生 Task；正常/失败/取消分别保留事实。
5. **report**：需要协调时提交稳定内部通知，再使当前 Task terminal。避免仍占活动槽时等协调路径回答，形成自等待。

任务的 pending/running/waiting/terminal、等待其他任务与 checkpoint 恢复全部由 Pi 维护。共享活动槽是准入约束，不是第二个任务调度器。实验 P06 验证了 B 原生等待 A，SQLite reopen 后 A/B 正确完成；生产槽回收、取消及结束协议仍需专门合同测试。

所有 run-slice/report Task 由 root Conversation 直接拥有，显式设为 background；目标工作 Conversation 存在其输入中。创建下一片段也使用 root ownership，不能把它作为当前片段的普通子任务再让父任务等它，否则会把应释放的活动槽和任务完成绑成链。

### 5.2 工具轮如何成为具体边界

采用可验证的正常路径：对允许模型直接调用的工具统一 wrapper，保留实际输出/错误语义，并给**正常终结的每个工具结果**添加 `control.terminate: true`。同轮调用由 `toolExecution: 'sequential'` 串行执行；一轮结束后 Pi 原生终止本次 run，工具结果已经提交，下一轮尚未开始。

随后 run-slice.finalize 根据结构化意图安排同一 Conversation 的下一片段、等待用户或交回协调。自动继续是内部输入，使用 `entry: { kind: 'aw.continue', data: { ... } }` 和稳定 requestId，不伪装成一条新的 UserDecision。`work_yield` 用同一机制提交局部结果，不使用会 reset 的 `control.handoff`。

这是明确的调度选择：正常工具轮之后会多一次内部续行输入，而非重新写 Pi 的 generation loop。P02 证明 terminate 不 reset，同时证明它不是“一个工具要求就能结束”的开关。

**错误轮仍有边界限制。** SDK 在工具不可用、Schema 校验失败或 wrapper 之前生成的错误返回可能不带 terminate；混合轮也可能继续请求模型。因此不能宣称该策略对任意异常输出都严格“一轮一片段”。wrapper 执行异常尽量返回可记录的错误结果；剩余情况纳入模型请求/工具预算和失败收敛测试，不能靠会 fail-open 的 hook 提供硬保证。生产适配若要求严格轮级上限，需要在模型调用出口落实可验证的限制后才能宣称达成。

### 5.3 人工等待的具体处理

`work_request_decision` 保存请求及续行来源后正常返回。本轮终结并固化锚点后：`defer_part` 保留被阻塞部分的依赖记录，原路径安排内部继续；`wait_current` 当前局部工作不再安排模型片段。其他就绪工作照常运行。

没有一个 Pi Task 或工具调用一直悬挂等待人。用户之后提交的 UserDecision 经应用 Outbox 创建一个新的、去重的 run-slice Task，唤醒对应局部工作。原生 Task 的 waiting 只用于已存在的运行任务依赖；不把 DecisionRequest ID 放到 `on` 中，也不通过 sleepUntil 每隔几秒查询是否回答。

## 6. 安全锚点与首次分支的具体提交

上一版用 `afterTools` 写锚点再放行，缺少失败处理依据。本次 P05 证实：observer 抛错被报告后，后续模型请求仍可发生。**可靠边界改为：原生 run 已正常终结 → finalize 持久提交锚点/绑定 → 才创建下一片段。** 该顺序由 aw.run-slice phases/checkpoints 表达，不由 observer 授权。

注意 `settled.answer` 在 terminate 情况下可能指向含工具调用的 assistant entry，不能直接用它作为“所有工具已返回”的位置。finalize 应从该片段的 Session 原记录找到末尾完整工具结果，再在同一 commit 追加 `aw.decision-anchor`、更新来源与局部 context。相关页面引用原始提问位置；fork 使用安全锚点。

分支创建的 API 骨架如下。类型与 API 来自已核实版本，业务记录/token 在生产中另行定义，下面不是已交付适配器：

```ts
const branchId = await root.commit(async tx => {
  const links = await tx.doc(Continuations);
  const c = links.items[continuationId];
  if (c.conversationId !== undefined) return c.conversationId;

  const anchorId = await tx.createTask(ContinuationAnchor, null, {
    ownership: { kind: 'conversation' }, background: true,
  });
  const branch = await tx.forkConversation(c.sourceConversationId, c.safeEntryId, {
    ownership: { kind: 'task', taskId: anchorId },
  });
  await configure(tx, branch.id, { instructions: c.activeScopeInstructions });
  c.conversationId = branch.id;
  c.anchorTaskId = anchorId;
  return branch.id;
}, context);
```

原子绑定以 continuationId 去重，而不是每条 UserDecision 都 fork。Session 级 receipt 再固定 inputId → branchId → TaskId。首次 submit 是另一个提交窗口，稳定 requestId 只作用于已固定的 Conversation；P03 验证同键在同一 Conversation 去重、在不同 Conversation 不去重。

分支的 `instructions` 限定当前局部责任；常驻 sections 仍提供原委托、固定 OM 与当前更新。原路径不得重复执行已交接的工作。历史副作用不重放，Workspace 不回退，具体业务操作依旧使用 McpUseCases 的 callId/原业务身份核验。

工具入口的应用幂等键可由 Session ID + `api.taskId` 派生；该 Task 在 Pi 重放时不变。业务调用的 callId 也由可信宿主按此稳定映射，不单独使用可能在不同 Conversation 中重复的 provider `api.callId`。一次新的明确尝试有新的工具 Task 身份，但业务系统的幂等键仍按其合同保留或变更；两种身份不能互相代替。

## 7. 原生 ownership 树与全局取消

采用官方 [background subagent 示例](https://github.com/earendil-works/pi/blob/4a080252f06caf63a525d7873c5d94d3c23887e0/packages/durable/test/examples/23-subagent-background.ts)中的 lifetime anchor 方式：root 拥有 background anchor task，anchor 拥有分支 Conversation。anchor 可以立即完成，长期历史绑定仍保留；分支不归已经返回的提问 tool task 所有。

```text
root Conversation
  ├─ aw.run-slice Tasks（background）
  ├─ anchor A（background）── Conversation A ── generation/tool tasks
  └─ anchor B（background）── Conversation B ── generation/tool tasks
```

普通 root idle/abort 不穿过后台边界；Execution 取消使用：

```ts
// 前置：Application 已持久化全局停止栅栏。
await root.abort(context, { background: true });
// 再核验容器/在途工具退出，才允许 confirmStopped。
```

P04 实验确认了普通 abort 留下后台 fork、background:true 将它停止，以及随后新输入仍可复用原 Conversation。这个调用覆盖的是取消被接纳时到达的 ownership 范围，不是给以后创建的所有任务发永久禁令；generation/停止栅栏仍须阻止新任务与网络派发。准入槽在取消/失败路径原子释放或被恢复对账回收，不能永久占用。

`Harness.close` 用于退出/可恢复重开，不等同于业务取消；`Submission.wait` 的等待取消也不等于工作停止。当前真实 SQLite close/reopen 实验不是 kill -9 或业务副作用回滚测试。

## 8. 存储、历史、环境与启动顺序

* 每 Execution 的 Pi SQLite 由 `openNodeSqliteStorage` 打开，使用 Node 内置 SQLite；与当前应用的 better-sqlite3 连接不是同一个数据库事务，不混用应用 Store 的事务来写 Pi 表。
* `Harness.open` 后先恢复/核验绑定、配置和全局栅栏，再允许 `resume`、submit、wait 等会启用调度的操作。只读 inspect/历史查回不能顺手启动旧工作。
* `tx.scanEntries` 按 Session 范围读取，保留原 entryId/conversationId 与提交位置；用原记录去重祖先。业务操作列表不依赖 watchEvents 作为唯一历史。
* Session 级 quiescing 仍连接 Pi 活动事实与应用 finish CAS，但活动事实来自原生任务/submission 与准入记录，不能只看 root idle 或 taskGraph 是否为空。taskGraph 主要展示 live tasks，不是全部历史。
* `HarnessOptions.env` 为每次工具调用提供 ExecutionEnv。当前 Docker/pi-env 设计保持不变；本次没有验证 Docker，不能因 Node SQLite/内存测试成功就宣称文件隔离成立。

## 9. 实验结果与证明范围

| 实验 | 本次实际验证 | 未证明 |
| --- | --- | --- |
| P01 | 真实 Harness 中两次提问后继续 C；按各自工具返回点 fork，B 先续行、A 后续行，原提问工具未重复执行 | 模型自主分工正确、完整平台 DecisionRequest 持久化、业务不重复 |
| P02 | terminate 的正常结束、不 reset、混合工具轮不会仅因部分结果要求就结束 | 所有异常工具轮都可强制单轮终止 |
| P03 | 原子分支绑定并发查回；SQLite reopen；asOf 与 Session 当前值；去重 scope | kill -9、文件状态恢复、生产应用与 Runtime 跨库故障 |
| P04 | background anchor 下的 fork 与两种 abort 范围 | 容器进程退出、已发出网络请求撤回 |
| P05 | afterTools observer 失败仍继续生成并报告错误 | hook 可以当作可靠写入/安全门禁 |
| P06 | 原生 Task waiting 等待活动槽，SQLite reopen 后按 checkpoint 恢复并释放槽 | 全部调度策略、饥饿上限、生产取消清理 |

上游 258 项来自 session-forks、harness-conversations、harness-inbox、harness-tools、harness-tasks、harness-tasks-recovery、harness-cancellation-barrier、harness-generation、harness-tools-recovery、sqlite-storage 十个测试文件。它们包含 Task/工具恢复等机制测试；没有把模型供应商 API 或云 Workers 测试集算作已通过。

## 10. 复现与下一步

复现需 Node 24.11.1、npm、可用的 TypeScript 5.9.3 `tsc`，并在独立临时目录进行。`hydrate-model-data` 是上游源码构建所需的目录元数据生成，会访问公开目录服务；不调用真实模型。目录数据不是本次机制实验的判断依据，也不能据此宣称模型目录发布构建已完全锁定。

```sh
git clone --depth 1 --branch v1.4.0 https://github.com/earendil-works/pi.git pi-review
cd pi-review
git rev-parse HEAD
npm ci --ignore-scripts --no-audit --no-fund --workspace=packages/durable --workspace=packages/chord --workspace=packages/ai --workspace=packages/codemode --workspace=packages/telemetry --include-workspace-root=false
npm run hydrate-model-data --workspace=packages/ai
tsc -p packages/telemetry/tsconfig.build.json
tsc -p packages/ai/tsconfig.build.json
cp -R packages/ai/src/providers/data packages/ai/dist/providers/data
tsc -p packages/codemode/tsconfig.build.json
# 从 Airic Work 的 spikes/pi-durable/continuation.test.ts 复制到：
# packages/durable/test/airic-continuation.test.ts
cd packages/durable
../../node_modules/.bin/vitest run test/airic-continuation.test.ts
../../node_modules/.bin/vitest run test/session-forks.test.ts test/harness-conversations.test.ts test/harness-inbox.test.ts test/harness-tools.test.ts test/harness-tasks.test.ts test/harness-tasks-recovery.test.ts test/harness-cancellation-barrier.test.ts test/harness-generation.test.ts test/harness-tools-recovery.test.ts test/sqlite-storage.test.ts
```

当前可以据此细化 Application 的来源/路由/整体活动合同，再实现 `AiricWorkExtension`、`PiRuntime`、`PiHistory`。优先新增的真实集成证明是：统一 wrapper 的正常/异常片段边界、分支创建及首次投递间崩溃、业务写入成功但返回未保存、全分支取消与 Docker 退出。项目尚未安装生产 Pi 包；正式安装应固定包与完整依赖锁，并检查它们是否与本次源码基线相符。


## 实现接入更新

Worker/Execution 运行核心现已接入项目：`bootstrap/bindings.ts`、`driven/runtime/` 与 `driving/worker/execution-runner.ts`。生产依赖已按 1.4.0 安装并写入 backend/package-lock.json；安装包 generation、harness、types、submissions、session 五处 source map 的原始源码与本文固定 commit 一致。完整后端检查通过 24 个文件、286 项测试，其中新增运行测试使用已安装包、真实 SQLite 与 faux 模型。

已实现请求锚点、按局部分支路由、同一工作多请求复用、独立回答越过失败交付、原生持久片段、收尾栅栏、全范围取消、Session 读取及 MCP 工具桥接。具体接入和当前限制见[运行模块说明](../backend/src/adapters/driven/runtime/README.md)。Docker Workspace、附件物化、真实业务网关和生产进程唤醒仍未交付，不能将上述测试当作完整部署证明。
