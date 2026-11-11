# 在本项目中使用 Operating Model

从 [根 OM](om.md) 确认项目目的、工作类型和知识入口，再按当前任务加载相关方法。

- **开展或试跑实际工作、检查或同步 OM 版本**时，读取 [OM Work](.agents/skills/operating-model-work/SKILL.md)。按 OM 推进工作，需要人工判断时使用宿主提供的交互能力提出 Decision Request，并按回应恢复受影响的工作。
- **在 ChatGPT 中开展或试跑工作**时，按当前会话实际可访问的资料和交互能力执行。项目提供 `.agents/skills/chatgpt-om-work/SKILL.md` 时同时读取其中的宿主说明。
- **构造、评审或改进 OM** 时，读取 [Operating Model Engineering](.agents/skills/operating-model-design/SKILL.md)。把有复用价值的执行反馈带入 `.ome/`，记录来源与待验证范围，按项目采用机制更新正式方法。

宿主提供哪些工具、访问范围和交互能力，以当前会话为准。业务事实和结果以实际来源、记录与回执为准。执行中记录值得复盘的反馈，按用户委托提炼方法改进。

OM Work Skill 的维护源在 [Airic Work](https://github.com/AiricDev/airic-work) 的 `.agents/skills/operating-model-work/`。升级项目内副本时，从 Airic Work 选定版本复制该目录。
