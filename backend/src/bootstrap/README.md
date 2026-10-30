# 组合根

`container.ts` 使用 Awilix（CLASSIC、strict）注册外部适配器及应用服务类。`createBackend` 提供普通应用能力与经过 Zod 校验的命令入口，不暴露容器给业务层。

当前没有生产服务入口；传入适配器的创建/关闭由调用方负责。生产适配器工厂接入时明确注册资源 disposer，不把请求级 actor 放入根级单例。不从 Domain/Application 导入此目录。
