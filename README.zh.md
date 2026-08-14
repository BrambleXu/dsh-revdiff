# dsh-revdiff

![dsh-revdiff hero](assets/hero.png)

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/BrambleXu/dsh-revdiff?style=flat-square" alt="MIT license"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-%5E22.19%20%7C%20%3E%3D24-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js ^22.19 or >=24"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript 5.9"></a>
  <a href="package.json"><img src="https://img.shields.io/badge/tests-Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white" alt="Tests with Vitest"></a>
</p>

<p align="center">
  <a href="https://github.com/awesome-dsh-plugin/awesome-dsh-plugin#development--runtime"><img src="https://img.shields.io/static/v1?label=awesome%20%C2%B7%20DSH%20plugin&amp;message=development&amp;color=5B4CF0&amp;style=flat-square" alt="awesome · DSH plugin · development"></a>
</p>

<p align="center"><a href="README.md">English</a> | 中文</p>

为 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供原生交互式 diff 审查。插件读取 Git unified diff，将其解析为文件、hunk 和行位置，在自己的终端审查界面中展示，并将提交的批注排队为 Agent 下一轮持久 follow-up。

## 为什么存在 💡

在独立工具中审查 diff，会割裂变更、审查上下文以及后续负责处理反馈的 Agent。`dsh-revdiff` 将审查保留在 Harness 内部，让批注直接针对实际 Git diff 创建，并返回同一个持久会话。

## 功能 ✨

- 审查工作区、暂存区、未暂存或相对于 base revision 的已跟踪变更，并支持可选的路径过滤器。
- 在交互式终端中切换文件、hunk 和 diff 行。
- 添加、编辑和删除 issue、suggestion、question 或 praise 批注。
- 通过带有消息来源信息的 `agent.followup()` 将结构化批注提交给当前 Agent。
- 配置 Git 执行、diff 上下文、大小和时间限制、终端宽限期以及评论长度。

## 安装 📦

将此 checkout 添加到 Harness profile：

```sh
dsh plugin --profile demo add ./dsh-revdiff
```

唯一的外部运行时要求是：Git 必须与 Harness 位于同一个执行环境中。

## 使用 🚀

```text
/revdiff
/revdiff --staged
/revdiff --unstaged
/revdiff main
/revdiff --base main -- src/index.ts README.md
```

默认情况下，审查相对于 `HEAD` 的所有已跟踪工作区变更，包括已暂存和未暂存的变更。`--staged` 审查暂存区，`--unstaged` 只审查相对于暂存区的工作区变更；指定 base revision 时，审查工作区相对于该 revision 的变更。路径过滤器请放在 `--` 之后。

Harness 进程必须拥有交互式终端。审查界面支持：

- `↑`/`↓` 或 `k`/`j`：在 diff 行之间移动
- `n`/`p`：在 hunk 之间移动
- `]`/`[` 或 `→`/`←`：在文件之间移动
- `a`：添加 issue、suggestion、question 或 praise 批注
- `e`：编辑选中行的批注
- `d`：删除选中行的批注
- `s`：向当前 Agent 提交批注
- `q`、Escape 或 Ctrl-C：取消，不发送消息

批注会保留文件、旧/新侧、行号、选中的代码、类型和评论。它们通过 `agent.followup()` 发送，并带有 `dsh-revdiff` 的消息来源信息，因此审查会进入同一个 Harness session，而不是通过外部通道发送。

## 配置 ⚙️

在后续 Harness patch layer 中覆盖已插入的配置项：

```yaml
- id: dsh-revdiff
  name: dsh-revdiff
  config:
    gitBinary: git
    contextLines: 3
    maxDiffBytes: 2097152
    diffTimeoutMs: 30000
    graceMs: 2000
    maxCommentLength: 4000
```

## 开发 🧑‍💻

```sh
pnpm install
pnpm run check
```

## 范围 🎯

0.1 版本审查已经由 `git diff` 表示的文本变更。未跟踪文件、二进制补丁、并排渲染、鼠标输入和浏览器托管的审查界面暂不支持。审查引擎和批注模型由本项目负责，因此可以针对 Harness 演进，而不必跟随其他审查工具的界面。

## 许可证 📄

MIT

## 致谢 🙏

产品思路受到 [`pi-diff-review`](https://github.com/badlogic/pi-diff-review) 和 [`revdiff`](https://github.com/umputun/revdiff) 的启发，但本项目是围绕 Harness command、受管控的 subprocess、Agent 生命周期和消息来源信息构建的独立实现。它不会安装、执行、包装或解析 `revdiff` 的输出。
