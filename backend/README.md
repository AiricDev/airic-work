# Airic Work 后端：第一阶段内层

此阶段交付可执行的产品行为，不启动 HTTP 或真实 Agent。

在仓库根运行：

```sh
npm run typecheck
npm test
npm run check
```

依赖版本在根 package.json 固定；当前使用工作区已有 Node/TypeScript/Vitest。后端 Zod/Awilix 运行依赖在 backend/package.json 精确固定，并由 backend/package-lock.json 锁定传递依赖；安装使用 `npm ci --prefix backend --ignore-scripts`。后续生产适配器单独接入验证。

## 审阅入口

1. `docs/behavior/backend-phase1.md`：例子和边界。
2. `src/domain/model.ts`：纯模型与不变量。
3. `src/application/`：按能力组织的用例；每个服务类通过构造函数明确声明所需端口，不读取全局服务表。
4. `src/application/ports.ts`：HOW 实现必须兑现的合同。
5. `tests/core.test.ts`、`recovery.test.ts`、`management.test.ts`：行为证据。
6. `docs/backend-phase1-report.md`：覆盖、限制与交接。

`tests/support` 是测试替身，不可接到生产运行。`adapters/driving/validation` 已接入 Zod，`bootstrap/container.ts` 已接入 Awilix；其他生产适配器留待后续实现；本阶段不伪造可用 API、真实认证或真实 MCP。

## 内层注释约定

Domain 类型、Application 端口及用例入口使用中文 TSDoc，便于直接阅读与编辑器悬停查看。说明对象/能力负责什么、不负责什么、关键输入来源和状态含义；事务、重试和恢复合同明确区分内层预检与适配器必须兑现的保证。

修改语义时同步更新相应注释和行为测试。不能把端口注释中的目标保证当作真实适配器已验证，也不要仅重复函数名而省略身份、版本和副作用边界。

## Validation 与 DI

* 入口形状：`src/adapters/driving/validation/schemas.ts`；命令映射与结构化错误：`commands.ts`。不把 Zod 导入内层，也不以 Schema 替代状态、身份或事务规则。
* 组合根：`src/bootstrap/container.ts`。`createBackend(dependencies)` 返回 `application`、`commands` 和 `dispose`，不暴露容器；当前适配器由调用方负责关闭。
* `commands` 在每次调用时接收认证后的 actor。不要将外部正文直接断言为 VerifiedActor，不要注册可变全局用户。
* 对应验证见 `tests/validation-di.test.ts`；现有测试仍可直接 new 对应服务类并注入 fake ports，不必经容器。

## Class 风格

AccountUseCases、ExecutionUseCases 等是具名服务类，构造函数逐项注入端口，公开方法表达用例。Application 仅持有各能力实例，不再展开方法或创建全局 Dependencies。入口 ValidatedCommands 和外部 ReadonlyMcp 同样使用 class；纯数据 interface 和无状态领域函数保留其原本用途。Awilix 使用 asClass、CLASSIC、strict；禁止在后端构建中混淆构造参数名。
