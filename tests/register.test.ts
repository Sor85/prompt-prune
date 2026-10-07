import type { PromptComposeInput, PromptComposeSection } from 'claude-code'
import { expect, test } from 'claude-code/testing'
import { prunePrompt } from '../hooks/register'

const SECURITY = 'IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools (C2 frameworks, credential testing, exploit development) require clear authorization context: pentesting engagements, CTF competitions, security research, or defensive use cases.'
const PRONOUNS = "When you use a pronoun for someone — the user or anyone else you mention — and their pronouns haven't been stated, use they/them. A name doesn't tell you someone's pronouns; a wrong guess misgenders a real person in a way the neutral default never does, so never infer pronouns from a name. This applies to all user-visible text, including visible thinking."
const ENVIRONMENT = `# Environment
 - The most recent Claude models are the Claude 5 family and Haiku 4.5. Model IDs — Fable 5.1: 'claude-fable-5-1', Opus 5.5: 'claude-opus-5-5', Sonnet 5.5: 'claude-sonnet-5-5', Haiku 4.5: 'claude-haiku-4-5-20251001'. When building AI applications, default to the latest and most capable Claude models.
 - Claude Code is available as a CLI in the terminal, desktop app (Mac/Windows), web app (claude.ai/code), and IDE extensions (VS Code, JetBrains).
 - Fast mode for Claude Code uses Claude Opus with faster output (it does not downgrade to a smaller model). It can be toggled with /fast.`

const ATTRIBUTION_PRIORITY = "(this replaces Claude Code's own earlier attribution guidance, such as a previous copy of this reminder; the user's own instructions about these lines, such as a CLAUDE.md or memory rule, take precedence over this reminder, but do not add attribution lines this reminder leaves out):"
const COMMIT_ATTRIBUTION = `Attribution for git commits you create from here on ${ATTRIBUTION_PRIORITY}
- End git commit messages with:
Co-Authored-By: Claude Code <noreply@anthropic.com>`
const ORIGINAL_ATTRIBUTION = COMMIT_ATTRIBUTION
  .replace('Attribution for git commits you create', 'Attribution for git commits and pull requests you create') +
  '\n- End pull request descriptions with:\n🤖 Generated with [Claude Code](https://claude.com/claude-code)'

const INPUT: PromptComposeInput = {
  model: 'test-model',
  promptModel: 'test-model',
  surfaces: ['terminal'],
  tools: [],
  outputStyle: null,
  traits: [],
}

const SOURCE = [SECURITY, PRONOUNS, ENVIRONMENT].join('\n\n')

test('删除指定三段，不写入任何压缩版或空环境标题', () => {
  expect(prunePrompt(SECURITY)).toBe('')
  expect(prunePrompt(PRONOUNS)).toBe('')
  expect(prunePrompt(ENVIRONMENT)).toBe('')
  expect(prunePrompt(SOURCE)).toBe('')
})

test('模型版本更新和 Fast 模型变化后仍删除整个目标说明', () => {
  const future = ENVIRONMENT
    .replaceAll('Claude 5 family', 'Claude 99 family')
    .replaceAll('5.5', '99.5')
    .replaceAll('claude-opus-5-5', 'claude-opus-99-5')
    .replace('uses Claude Opus', 'uses Claude Future')
  expect(prunePrompt(future)).toBe('')
})

test('删除旧 mod 曾输出的压缩版', () => {
  const legacy = `IMPORTANT: Support authorized security testing, defense, CTFs and education. Refuse destructive techniques, DoS, mass targeting, supply-chain compromise and malicious detection evasion. Dual-use tools (C2, credential testing, exploit development) require clear pentest, CTF, research or defensive authorization.

Use they/them unless pronouns are stated; never infer from names. Applies to all user-visible text, including visible thinking.

# Environment
 - Latest: the Claude 5 family and Haiku 4.5. IDs — Opus 5.5: 'claude-opus-5-5'. Default to the latest, most capable models for AI apps.
 - Claude Code: terminal CLI, desktop (Mac/Windows), web (claude.ai/code), IDEs (VS Code/JetBrains).
 - /fast: faster Claude Opus output, not a smaller model.`
  expect(prunePrompt(legacy)).toBe('')
})

test('不删除工作目录、OS、当前模型或其他未知文本', () => {
  for (const text of [
    '# Environment\n - Primary working directory: /example\n - OS: Darwin.\nYou are powered by the model example.',
    SECURITY.replace('DoS attacks', 'denial-of-service attacks'),
    PRONOUNS.replace('they/them', 'neutral pronouns'),
    ENVIRONMENT.split('\n')[1]!.replace('Model IDs —', 'Available model identifiers:'),
  ]) expect(prunePrompt(text)).toBe(text)
  expect(prunePrompt(`${ENVIRONMENT}\n - OS: Darwin.`)).toContain(' - OS: Darwin.')
})

test('支持 LF、CRLF、重复处理，保留相邻段落', () => {
  for (const newline of ['\n', '\r\n']) {
    const source = `Before.\n\n${SECURITY}\n\nAfter.`.replaceAll('\n', newline)
    const result = prunePrompt(source)
    expect(result).toBe(`Before.${newline}${newline}After.`)
    expect(prunePrompt(result)).toBe(result)
    expect(prunePrompt(ENVIRONMENT.replaceAll('\n', newline))).toBe('')
  }
})

for (const envId of ['env_info_simple', 'env_info_static']) {
  test(`真实 section ${envId} 和 session scope 均覆盖，保留其他内容`, async ($, on) => {
    const sections: PromptComposeSection[] = [
      { id: 'intro', text: `Intro.\n\n${SECURITY}\n\nHarness.`, scope: 'shared' },
      { id: 'other:policy', text: SOURCE, scope: 'shared' },
      { id: 'pronouns', text: PRONOUNS, scope: 'session' },
      { id: envId, text: ENVIRONMENT, scope: 'session' },
      { id: 'memory', text: SOURCE, scope: 'session' },
      { id: 'custom:environment', text: ENVIRONMENT, scope: 'session' },
    ]
    on('prompt.compose', (_$, e) => {
      expect(e).toEqual(INPUT)
      return { sections }
    })
    const result = await $.prompt.compose(INPUT)
    expect(result.sections).toEqual([
      { ...sections[0]!, text: 'Intro.\n\nHarness.' },
      sections[1], sections[4], sections[5],
    ])
  })
}

test('lean 删除安全模板，bare 不添加段落', async ($, on) => {
  on('prompt.compose', (_$, e) => ({
    sections: e.traits.includes('bare')
      ? [{ id: 'bare', text: 'Minimal prompt.', scope: 'shared' }]
      : [{ id: 'lean_body', text: `Coding instructions.\n\n${SECURITY}`, scope: 'shared' }],
  }))
  expect((await $.prompt.compose({ ...INPUT, traits: ['bare'] })).sections)
    .toEqual([{ id: 'bare', text: 'Minimal prompt.', scope: 'shared' }])
  expect((await $.prompt.compose({ ...INPUT, traits: ['lean', 'analysis'] })).sections)
    .toEqual([{ id: 'lean_body', text: 'Coding instructions.', scope: 'shared' }])
})

test('空 sections 原样返回', async ($, on) => {
  on('prompt.compose', () => ({ sections: [] }))
  expect(await $.prompt.compose(INPUT)).toEqual({ sections: [] })
})

test('Bash 描述、提示词裁剪和署名处理同时生效，保留用户分支规则', async ($, on) => {
  const branchRule = 'Commit or push only when the user asks. If on the default branch, branch first.'
  const sections: PromptComposeSection[] = [
    { id: 'intro', text: `Intro.\n\n${SECURITY}`, scope: 'shared' },
    { id: 'memory', text: branchRule, scope: 'session' },
  ]
  on('tool.describe', (_$, e) => ({ description: e.description }))
  on('prompt.compose', () => ({ sections }))
  on('attribution.text', (_$, e) => ({ text: e.text }))
  on('prompt.attachment', (_$, e) => ({ text: e.text }))

  expect(await $.tool.describe({
    tool: 'Bash', description: branchRule, provider: { plugin: 'engine', tier: 'core' },
  })).toEqual({ description: 'Commit or push only when the user asks.' })
  expect((await $.prompt.compose({ ...INPUT, tools: ['Bash'] })).sections)
    .toEqual([{ ...sections[0]!, text: 'Intro.' }, sections[1]])
  expect(await $.attribution.text({ kind: 'pr', text: 'PR attribution.' })).toEqual({ text: '' })
  expect(await $.attribution.text({ kind: 'commit', text: 'Commit attribution.' }))
    .toEqual({ text: 'Commit attribution.' })
  expect(await $.prompt.attachment({
    type: 'attribution', text: ORIGINAL_ATTRIBUTION, origin: { kind: 'engine' },
  })).toEqual({ text: COMMIT_ATTRIBUTION })
})

test('移除 PR 署名，保留提交署名及其他署名规则', async ($, on) => {
  on('attribution.text', (_$, e) => ({ text: e.text }))
  for (const kind of ['commit', 'pr', 'exemption', 'remedy'] as const) {
    const text = kind === 'commit'
      ? 'Co-Authored-By: Claude Code <noreply@anthropic.com>'
      : kind === 'pr'
        ? '🤖 Generated with [Claude Code](https://claude.com/claude-code)'
        : `Keep ${kind}.`
    expect(await $.attribution.text({ kind, text })).toEqual({ text: kind === 'pr' ? '' : text })
  }
})

test('引擎署名提醒精确转换为用户指定版本，兼容已有完整提醒和仅提交提醒', async ($, on) => {
  on('prompt.attachment', (_$, e) => ({ text: e.text }))
  for (const original of [
    ORIGINAL_ATTRIBUTION,
    ORIGINAL_ATTRIBUTION.split('\n- End pull request descriptions with:')[0]!,
    COMMIT_ATTRIBUTION,
  ]) {
    for (const newline of ['\n', '\r\n']) {
      const result = await $.prompt.attachment({
        type: 'attribution',
        text: original.replaceAll('\n', newline),
        origin: { kind: 'engine' },
      })
      expect(result.text).toBe(COMMIT_ATTRIBUTION.replaceAll('\n', newline))
    }
  }
})

test('不修改用户或插件上下文，以及未知署名提醒', async ($, on) => {
  on('prompt.attachment', (_$, e) => ({ text: e.text }))
  for (const origin of [
    { kind: 'hook', event: 'SessionStart' },
    { kind: 'plugin', event: 'prompt.submit' },
  ] as const) {
    expect(await $.prompt.attachment({ type: 'context', text: ORIGINAL_ATTRIBUTION, origin }))
      .toEqual({ text: ORIGINAL_ATTRIBUTION })
  }
  for (const text of [
    'Unrelated reminder.',
    `Documentation:\n${ORIGINAL_ATTRIBUTION}`,
    ORIGINAL_ATTRIBUTION.replace('🤖 Generated with [Claude Code](https://claude.com/claude-code)', 'Custom PR attribution.'),
  ]) {
    expect(await $.prompt.attachment({ type: 'attribution', text, origin: { kind: 'engine' } }))
      .toEqual({ text })
  }
})

test('保留下游省略提醒的决定', async ($, on) => {
  on('prompt.attachment', () => ({ text: null }))
  expect(await $.prompt.attachment({ type: 'attribution', text: ORIGINAL_ATTRIBUTION, origin: { kind: 'engine' } }))
    .toEqual({ text: null })
})

test('保留自定义提交署名，不重新添加空署名', async ($, on) => {
  on('attribution.text', (_$, e) => ({ text: e.text }))
  for (const text of ['', 'Co-Authored-By: Example <example@example.com>']) {
    expect(await $.attribution.text({ kind: 'commit', text })).toEqual({ text })
  }
  expect(await $.attribution.text({ kind: 'pr', text: '' })).toEqual({ text: '' })
})
