# Worker / Execution runtime

`bootstrap/bindings.ts` creates the Pi Runtime, Session History projection and application host. Supply the returned `runtime` and `history` to `createBackend`, then use `worker.runner(application).run(userId, executionId)` to prepare, deliver durable pending inputs, drain runnable work and finish the current generation. Calling run again after a UserDecision or Steering Input continues the original Session. The host process owns shutdown and calls `worker.close()`.

Responsibilities:

- `PiRuntime`: one SQLite per Session, process-lifetime exclusive SQLite ownership lock, fixed assembly digest, native background slice tasks, serial admission, question anchors, branch binding, input receipts, stop/quiesce fences. The OS releases the ownership transaction after process death; a normal close preserves unfinished Pi tasks for recovery.
- `ApplicationWorkerHost`: current user/generation checks, fixed OM and Skill loading, complete UserDecision/context revision/option mapping, requests through DecisionUseCases. `work_read_method` reads only the configured fixed snapshot.
- `PiHistory`: Session entries across all conversations, ancestor deduplication, bounded pages and immutable MCP start/result records. Concurrent duplicate MCP starts are rejected inside the Session commit.
- `McpWorkerTools`: typed configured MCP schemas mapped to Pi tools. Calls pass through McpUseCases with a stable Pi task-based call ID and expected schema revision. No direct MCP client bypass.
- `ExecutionRunner`: driving entry point using application services. No detached background promises. Schedule another run when durable input arrives; process restarts may safely retry pending delivery.

Model credentials/providers are supplied by the host through pi-ai Models. No credentials belong in task, tool parameters or Skill. Tools are deliberately limited to question/yield/method reading unless `createWorker` receives a trusted `tools` factory. A factory can close over the created Application and use `McpWorkerTools.create` with its configured schemas.

Current scope: the runtime and application integration are implemented. Docker/pi-env Workspace, materialized attachment paths, a production daemon/HTTP input wakeup remain separate adapters. Business MCP discovery/transport and credentials are implemented in `../mcp/` with composition in `bootstrap/bindings.ts`. The existing Workspace port must be supplied; do not substitute host Bash for missing isolation. Explicit run/drain is an operational entry, not a production polling daemon. The tests use a faux model and real Pi SQLite; they do not prove autonomous business judgment or a deployed environment.

Verification: `backend/tests/pi-runtime.test.ts` covers multiple pending questions, reverse answers, grouped continuation reuse, original Session restart, duplicate inputs, single ownership, assembly mismatch, stop/new generation, model failure, immutable MCP history and integration with existing Application services.

完整检查：`npm run check` 通过 24 个测试文件、286 项测试。安装包五处关键 source map 已与此前核实的官方 commit 对比一致。
