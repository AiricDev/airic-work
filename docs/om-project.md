# 创建 OM 项目

在 Airic Work 项目里，可以直接请 Agent「帮我创建一个名为 my-om 的 OM 项目」。也可以在 Airic Work 仓库根目录运行以下命令，指定一个新目录或已有的空目录。

```sh
python3 scripts/init-om-project.py ../my-om
```

项目会带上 `AGENTS.md`、根入口 `om.md`，以及 `.agents/skills/` 中的 OM Work 和 OME Skill（含引用资料）。仓库提供 ChatGPT 专用说明时也会一并复制。`CLAUDE.md` 通过 `@AGENTS.md` 引入同一份入口，供 Claude Code 使用。[Claude Code 项目指令](https://code.claude.com/docs/en/memory#share-one-file-with-other-coding-tools)

在 ChatGPT Work 中，将 OM 文件夹添加到本地项目，然后在对话中请 ChatGPT 从项目的 `AGENTS.md` 和根 `om.md` 开始。普通聊天可直接提供 OM Work Skill、根 OM 和本次所需资料。[ChatGPT 本地项目](https://learn.chatgpt.com/docs/projects#use-local-projects-for-folders-and-codebases)

在桌面 Agent 中打开或授权访问这个项目目录。宿主需要手动指定入口时，告诉 Agent 从项目中的 `AGENTS.md` 开始。先用一个代表性案例建立 Root OM 和工作路由，再用真实工作试跑提问、回应与续行。复盘时在作者侧 `.ome/` 保存当时可见的证据、用户回答和恢复结果，交由 OME 提炼候选方法并验证。项目默认将 `.ome/` 排除在 Git 跟踪之外。

准备移到云端时，选定已纳入版本的 OM，核对所需业务能力能否通过 Airic Work 提供。云端由 Pi Durable 的 Worker 提示词与固定版 Root OM 共同驱动，Decision Request 及回复由 Task 宿主持久化。

需要跟团队共享的 OM 对齐时，可直接请 Agent「检查有没有新版」或「把本地 OM 更新到团队版」。Agent 会核对共享版本和本地草稿，再说明当前可用版本。详见 [OM Work 的版本同步说明](../.agents/skills/operating-model-work/SKILL.md#检查与同步-om-版本)。

## 维护项目模板和 Skill

在 Airic Work 的 [OM Work Skill](../.agents/skills/operating-model-work/SKILL.md) 更新通用执行、Decision Request 和仓库同步说明。初始化脚本从 Airic Work 复制 Skill 及其引用资料，项目入口来自 [OM 项目模板](../templates/om-project/)。已有 OM 项目升级时，从 Airic Work 选定版本复制对应 Skill 目录，并核对项目副本的差异。
