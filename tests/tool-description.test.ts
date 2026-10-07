import { expect, test } from 'claude-code/testing'

const TARGET = 'Commit or push only when the user asks. If on the default branch, branch first.'
const REPLACEMENT = 'Commit or push only when the user asks.'
const PROVIDER = { plugin: 'engine', tier: 'core' } as const
const PREFIX = '# Git\n- Use the `gh` CLI for GitHub operations.\n- '
const SUFFIX = '\n- End git commit messages and PR bodies with attribution lines.\n'

test('仅移除 Bash 的自动建分支要求，保留其余描述', async ($, on) => {
  on('tool.describe', (_$, e) => ({ description: e.description }))
  const result = await $.tool.describe({
    tool: 'Bash',
    description: PREFIX + TARGET + SUFFIX,
    provider: PROVIDER,
  })
  expect(result).toEqual({ description: PREFIX + REPLACEMENT + SUFFIX })
})

test('修改 next 返回的描述而非事件输入，保留下游修改', async ($, on) => {
  on('tool.describe', () => ({ description: PREFIX + TARGET + SUFFIX }))
  const result = await $.tool.describe({
    tool: 'Bash',
    description: '原始描述',
    provider: PROVIDER,
  })
  expect(result.description).toBe(PREFIX + REPLACEMENT + SUFFIX)
})

for (const isDeferred of [true, false] as const) {
  test(`Bash 描述保留 isDeferred=${isDeferred}`, async ($, on) => {
    on('tool.describe', (_$, e) => ({ description: e.description, isDeferred }))
    const result = await $.tool.describe({ tool: 'Bash', description: TARGET, provider: PROVIDER })
    expect(result).toEqual({ description: REPLACEMENT, isDeferred })
  })
}

test('不修改其他工具，即使含有相同文本', async ($, on) => {
  on('tool.describe', (_$, e) => ({ description: e.description }))
  const result = await $.tool.describe({ tool: 'Read', description: TARGET, provider: PROVIDER })
  expect(result).toEqual({ description: TARGET })
})

test('未匹配完整原句时保持 Bash 描述不变', async ($, on) => {
  const description = 'Commit or push only when the user asks.\nIf on the default branch, branch first.'
  on('tool.describe', (_$, e) => ({ description: e.description }))
  const result = await $.tool.describe({ tool: 'Bash', description, provider: PROVIDER })
  expect(result).toEqual({ description })
})

test('已替换的 Bash 描述保持不变', async ($, on) => {
  on('tool.describe', (_$, e) => ({ description: e.description }))
  const result = await $.tool.describe({ tool: 'Bash', description: REPLACEMENT, provider: PROVIDER })
  expect(result).toEqual({ description: REPLACEMENT })
})
