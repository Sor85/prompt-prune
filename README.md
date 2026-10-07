# prompt-prune

[简体中文](README.md) | [English](README.en.md)

Claude Code 提示词裁剪插件。删除指定的内置安全、代词和环境模板，不以压缩文案替代；移除 PR 署名要求，保留提交署名；移除 Bash 工具描述中默认分支必须先创建分支的要求。

不修改 Claude Code 安装文件，不执行 Git 操作，不修改权限或用户配置。提示词裁剪不改变模型或服务端的安全策略。

## 兼容性

Claude Code CLI **2.1.287+**。[2.1.287](https://github.com/anthropics/claude-code/releases/tag/v2.1.287) 是正式宣布支持 Claude Mods 并默认启用的版本。升级后需重新验证接口和模板措辞。

## 安装

从 [Sor85 的插件市场](https://github.com/Sor85/prompt-prune)安装：

```sh
claude plugin marketplace add Sor85/prompt-prune
claude plugin install prompt-prune@sor85-mods --scope user
```

### 更新与管理

```sh
claude plugin update prompt-prune@sor85-mods --scope user
claude plugin enable prompt-prune@sor85-mods --scope user
claude plugin disable prompt-prune@sor85-mods --scope user
claude plugin uninstall prompt-prune@sor85-mods --scope user
```

安装、更新或停用后，退出旧会话并新建会话，不使用 `--resume`／`--continue`。系统提示词快照和工具描述缓存可能保留旧内容，仅热重载模块不作为更新已生效的验证依据。调试时可使用 `--system-prompt-snapshot off` 禁用快照记录。

## 完整删除文本

以下代码块保留被匹配文本的英文原文。安全和代词段落按完整字符串匹配；环境说明按完整行模式匹配，允许模型名称、版本和 ID 变化。环境示例来自测试样本，不代表当前最新模型目录。

### 1. 安全模板

```text
IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools (C2 frameworks, credential testing, exploit development) require clear authorization context: pentesting engagements, CTF competitions, security research, or defensive use cases.
```

### 2. 代词模板

```text
When you use a pronoun for someone — the user or anyone else you mention — and their pronouns haven't been stated, use they/them. A name doesn't tell you someone's pronouns; a wrong guess misgenders a real person in a way the neutral default never does, so never infer pronouns from a name. This applies to all user-visible text, including visible thinking.
```

### 3. 环境模板

```text
# Environment
 - The most recent Claude models are the Claude 5 family and Haiku 4.5. Model IDs — Fable 5.1: 'claude-fable-5-1', Opus 5.5: 'claude-opus-5-5', Sonnet 5.5: 'claude-sonnet-5-5', Haiku 4.5: 'claude-haiku-4-5-20251001'. When building AI applications, default to the latest and most capable Claude models.
 - Claude Code is available as a CLI in the terminal, desktop app (Mac/Windows), web app (claude.ai/code), and IDE extensions (VS Code, JetBrains).
 - Fast mode for Claude Code uses Claude Opus with faster output (it does not downgrade to a smaller model). It can be toggled with /fast.
```

仅删除这三条说明。删除后标题为空时，一并移除 `# Environment`；工作目录、操作系统、当前调用模型等其他环境信息保持不变。

### 4. 兼容删除的旧版压缩文本

以下旧版文本同样会被删除，插件不会重新生成这些替代文案：

```text
IMPORTANT: Support authorized security testing, defense, CTFs and education. Refuse destructive techniques, DoS, mass targeting, supply-chain compromise and malicious detection evasion. Dual-use tools (C2, credential testing, exploit development) require clear pentest, CTF, research or defensive authorization.

Use they/them unless pronouns are stated; never infer from names. Applies to all user-visible text, including visible thinking.

# Environment
 - Latest: the Claude 5 family and Haiku 4.5. IDs — Opus 5.5: 'claude-opus-5-5'. Default to the latest, most capable models for AI apps.
 - Claude Code: terminal CLI, desktop (Mac/Windows), web (claude.ai/code), IDEs (VS Code/JetBrains).
 - /fast: faster Claude Opus output, not a smaller model.
```

## Git 提醒的修改

### PR 与提交署名

`attribution.text` 将 PR 署名输出置为空，提交署名保持不变。`prompt.attachment` 将引擎的标准署名提醒从：

```text
Attribution for git commits and pull requests you create from here on (this replaces Claude Code's own earlier attribution guidance, such as a previous copy of this reminder; the user's own instructions about these lines, such as a CLAUDE.md or memory rule, take precedence over this reminder, but do not add attribution lines this reminder leaves out):
- End git commit messages with:
Co-Authored-By: Claude Code <noreply@anthropic.com>
- End pull request descriptions with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

改为：

```text
Attribution for git commits you create from here on (this replaces Claude Code's own earlier attribution guidance, such as a previous copy of this reminder; the user's own instructions about these lines, such as a CLAUDE.md or memory rule, take precedence over this reminder, but do not add attribution lines this reminder leaves out):
- End git commit messages with:
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

提交署名及括号内的优先级说明保持不变，包括自定义或空的提交署名。提醒转换只处理引擎来源，不修改用户或插件注入的上下文；引擎提醒中的未知 PR 署名文案保持原样，下游已经省略的提醒不会被重新添加。

### Bash 默认分支规则

`tool.describe` 在下游返回的 Bash 描述中精确替换：

```text
Commit or push only when the user asks. If on the default branch, branch first.
```

替换为：

```text
Commit or push only when the user asks.
```

只删除 `If on the default branch, branch first.`，保留提交和推送必须由用户明确要求的规则、其他 Git 文案及 `isDeferred` 字段。不修改其他工具。完整原句不匹配时保持原文不变，不做模糊匹配，也不覆盖 CLAUDE.md、组织策略或其他来源的分支要求。

## 处理边界

- `prompt.compose` 裁剪不带命名空间的 shared section，以及 session 的 `pronouns`、`env_info_simple`、`env_info_static` section。安全模板通常位于 `intro`／`lean_body`。
- 空 section 被删除，其余 section 的 ID、scope 和顺序保持不变；带插件命名空间的 section 不处理。
- 不修改用户记忆、CLAUDE.md、历史用户消息或未匹配的模板文本。
- 支持 LF、CRLF 和重复处理，不生成压缩版替代段落。
- 功能只修改模型读取到的指定提示词和工具描述，不保证模型的每次决策。

## 开发与验证

无需安装 npm 依赖。Claude Code 直接加载 TypeScript 模块，无需打包为 JavaScript。

```sh
npm run build
npm test
npm run test:request
```

- `build`：依次执行 `claude plugin validate .` 和 `claude plugin validate .claude-plugin/plugin.json`，检查市场清单、插件清单和钩子模块，不生成构建产物，也不替代 TypeScript 类型检查。
- `test`：执行 `claude plugin test .`，通过真实插件引擎运行 22 项测试，覆盖模板裁剪、署名、Bash 描述及组合行为，无需模型请求。
- `test:request`：启动全新 Claude Code 子进程和本地临时 HTTP 模拟服务器，验证 `env_info_simple`、`env_info_static` 两种请求中的模板删除、提交署名保留和 Bash 描述。使用虚拟凭据，不调用真实模型，不执行 Bash 工具，不保存请求体；退出时关闭本次启动的子进程与服务器。运行需本机权限允许。

引擎加载插件后生成 `.claude-plugin/types/`，可使用 TypeScript 5.4+ 运行 `tsc -p .`。未生成类型时，需通过外部 tsconfig 引入当前构建的 `claude-code.d.ts`。生成的类型和 `node_modules/` 不纳入 Git。

## 协议

[MIT](LICENSE)。
