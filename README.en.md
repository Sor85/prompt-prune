# prompt-prune

[简体中文](README.md) | [English](README.en.md)

A prompt-pruning plugin for Claude Code. It removes specific built-in security, pronoun, and environment templates without replacing them with shorter instructions; removes PR attribution requirements while preserving commit attribution; and removes the requirement to create a branch before working on the default branch from the Bash tool description.

It does not modify the Claude Code installation, execute Git operations, or change permissions or user settings. Pruning these instructions does not change the model's or service's safety policies.

## Compatibility

Claude Code CLI **2.1.287+**. [Version 2.1.287](https://github.com/anthropics/claude-code/releases/tag/v2.1.287) officially introduced Claude Mods and enabled them by default. APIs and template wording should be verified again after upgrading.

## Installation

Install from [Sor85's plugin marketplace](https://github.com/Sor85/prompt-prune):

```sh
claude plugin marketplace add Sor85/prompt-prune
claude plugin install prompt-prune@sor85-mods --scope user
```

### Updates and management

```sh
claude plugin update prompt-prune@sor85-mods --scope user
claude plugin enable prompt-prune@sor85-mods --scope user
claude plugin disable prompt-prune@sor85-mods --scope user
claude plugin uninstall prompt-prune@sor85-mods --scope user
```

After installing, updating, or disabling the plugin, exit the old session and start a new one without `--resume` or `--continue`. System-prompt snapshots and tool-description caches can preserve old content, so module hot reload alone does not prove the update is active. For debugging, `--system-prompt-snapshot off` disables snapshot recording.

## Full text removed

The code blocks below contain the original English text matched by the plugin. Security and pronoun paragraphs are matched as complete strings. Environment instructions are matched as complete line patterns, allowing model names, versions, and IDs to vary. The environment examples come from test fixtures and are not a current model catalog.

### 1. Security template

```text
IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools (C2 frameworks, credential testing, exploit development) require clear authorization context: pentesting engagements, CTF competitions, security research, or defensive use cases.
```

### 2. Pronoun template

```text
When you use a pronoun for someone — the user or anyone else you mention — and their pronouns haven't been stated, use they/them. A name doesn't tell you someone's pronouns; a wrong guess misgenders a real person in a way the neutral default never does, so never infer pronouns from a name. This applies to all user-visible text, including visible thinking.
```

### 3. Environment template

```text
# Environment
 - The most recent Claude models are the Claude 5 family and Haiku 4.5. Model IDs — Fable 5.1: 'claude-fable-5-1', Opus 5.5: 'claude-opus-5-5', Sonnet 5.5: 'claude-sonnet-5-5', Haiku 4.5: 'claude-haiku-4-5-20251001'. When building AI applications, default to the latest and most capable Claude models.
 - Claude Code is available as a CLI in the terminal, desktop app (Mac/Windows), web app (claude.ai/code), and IDE extensions (VS Code, JetBrains).
 - Fast mode for Claude Code uses Claude Opus with faster output (it does not downgrade to a smaller model). It can be toggled with /fast.
```

Only these three instructions are removed. The `# Environment` heading is also removed if it becomes empty. Other environment details, such as the working directory, operating system, and active model, are preserved.

### 4. Legacy shortened text also removed

The following legacy text is also removed. The plugin does not generate these replacement instructions:

```text
IMPORTANT: Support authorized security testing, defense, CTFs and education. Refuse destructive techniques, DoS, mass targeting, supply-chain compromise and malicious detection evasion. Dual-use tools (C2, credential testing, exploit development) require clear pentest, CTF, research or defensive authorization.

Use they/them unless pronouns are stated; never infer from names. Applies to all user-visible text, including visible thinking.

# Environment
 - Latest: the Claude 5 family and Haiku 4.5. IDs — Opus 5.5: 'claude-opus-5-5'. Default to the latest, most capable models for AI apps.
 - Claude Code: terminal CLI, desktop (Mac/Windows), web (claude.ai/code), IDEs (VS Code/JetBrains).
 - /fast: faster Claude Opus output, not a smaller model.
```

## Changes to Git instructions

### PR and commit attribution

`attribution.text` sets PR attribution output to an empty string and leaves commit attribution unchanged. `prompt.attachment` rewrites the engine's standard attribution reminder from:

```text
Attribution for git commits and pull requests you create from here on (this replaces Claude Code's own earlier attribution guidance, such as a previous copy of this reminder; the user's own instructions about these lines, such as a CLAUDE.md or memory rule, take precedence over this reminder, but do not add attribution lines this reminder leaves out):
- End git commit messages with:
Co-Authored-By: Claude Code <noreply@anthropic.com>
- End pull request descriptions with:
🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

To:

```text
Attribution for git commits you create from here on (this replaces Claude Code's own earlier attribution guidance, such as a previous copy of this reminder; the user's own instructions about these lines, such as a CLAUDE.md or memory rule, take precedence over this reminder, but do not add attribution lines this reminder leaves out):
- End git commit messages with:
Co-Authored-By: Claude Code <noreply@anthropic.com>
```

Commit attribution and the parenthesized precedence instructions are preserved, including custom or empty commit attribution. Reminder rewriting only applies to engine-origin text, not user or plugin-injected context. Unknown PR attribution wording in the engine reminder is preserved, and reminders already omitted by downstream hooks are not reintroduced.

### Bash default-branch rule

`tool.describe` performs an exact replacement in the Bash description returned by downstream hooks:

```text
Commit or push only when the user asks. If on the default branch, branch first.
```

Becomes:

```text
Commit or push only when the user asks.
```

Only `If on the default branch, branch first.` is removed. The requirement for explicit user authorization before committing or pushing, other Git instructions, and the `isDeferred` field are preserved. Other tools are unchanged. If the complete source sentence does not match, the description is left unchanged; no fuzzy matching is performed. Branch requirements from CLAUDE.md, organizational policies, or other sources are not overridden.

## Processing boundaries

- `prompt.compose` prunes shared sections without a namespace and the session sections `pronouns`, `env_info_simple`, and `env_info_static`. The security template usually appears in `intro` or `lean_body`.
- Empty sections are removed. Other sections retain their IDs, scopes, and order. Plugin-namespaced sections are not processed.
- User memory, CLAUDE.md, historical user messages, and unmatched template text are not modified.
- LF, CRLF, and repeated processing are supported. No shortened replacement paragraphs are generated.
- The plugin only changes the specified instructions and tool descriptions the model receives. It does not guarantee every model decision.

## Development and verification

No npm dependencies need to be installed. Claude Code loads the TypeScript module directly, without bundling it into JavaScript.

```sh
npm run build
npm test
npm run test:request
```

- `build`: runs `claude plugin validate .` followed by `claude plugin validate .claude-plugin/plugin.json` to check the marketplace manifest, plugin manifest, and hooks module. It produces no build artifacts and does not replace TypeScript type checking.
- `test`: runs `claude plugin test .` with 22 tests against the real plugin engine, covering template pruning, attribution, Bash descriptions, and combined behavior. No model requests are required.
- `test:request`: launches fresh Claude Code child processes and a temporary local HTTP mock server to check template removal, preserved commit attribution, and the Bash description in both `env_info_simple` and `env_info_static` requests. It uses dummy credentials, makes no real model calls, executes no Bash tool calls, and saves no request bodies. Child processes and the server are closed on exit. Local execution permissions are required.

After the engine loads the plugin, it generates `.claude-plugin/types/`. With TypeScript 5.4 or later, run `tsc -p .`. Before types have been generated, use an external tsconfig that includes this build's `claude-code.d.ts`. Generated types and `node_modules/` are excluded from Git.

## License

[MIT](LICENSE).
