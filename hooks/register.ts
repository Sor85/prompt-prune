import type { Register } from 'claude-code'

const SECURITY_SOURCE = 'IMPORTANT: Assist with authorized security testing, defensive security, CTF challenges, and educational contexts. Refuse requests for destructive techniques, DoS attacks, mass targeting, supply chain compromise, or detection evasion for malicious purposes. Dual-use security tools (C2 frameworks, credential testing, exploit development) require clear authorization context: pentesting engagements, CTF competitions, security research, or defensive use cases.'
const LEGACY_SECURITY = 'IMPORTANT: Support authorized security testing, defense, CTFs and education. Refuse destructive techniques, DoS, mass targeting, supply-chain compromise and malicious detection evasion. Dual-use tools (C2, credential testing, exploit development) require clear pentest, CTF, research or defensive authorization.'

const PRONOUNS_SOURCE = "When you use a pronoun for someone — the user or anyone else you mention — and their pronouns haven't been stated, use they/them. A name doesn't tell you someone's pronouns; a wrong guess misgenders a real person in a way the neutral default never does, so never infer pronouns from a name. This applies to all user-visible text, including visible thinking."
const LEGACY_PRONOUNS = 'Use they/them unless pronouns are stated; never infer from names. Applies to all user-visible text, including visible thinking.'

const ENVIRONMENT_LINES = [
  /^[ \t]*-[ \t]+The most recent Claude models are [^\r\n]+?\. Model IDs [—–-] [^\r\n]+?\. When building AI applications, default to the latest and most capable Claude models\.[ \t]*(?:\r?\n|$)/gm,
  /^[ \t]*-[ \t]+Claude Code is available as a CLI in the terminal, desktop app \(Mac\/Windows\), web app \(claude\.ai\/code\), and IDE extensions \(VS Code, JetBrains\)\.[ \t]*(?:\r?\n|$)/gm,
  /^[ \t]*-[ \t]+Fast mode for Claude Code uses [^\r\n]+? with faster output \(it does not downgrade to a smaller model\)\. It can be toggled with \/fast\.[ \t]*(?:\r?\n|$)/gm,
  /^[ \t]*-[ \t]+Latest: [^\r\n]+?\. IDs [—–-] [^\r\n]+?\. Default to the latest, most capable models for AI apps\.[ \t]*(?:\r?\n|$)/gm,
  /^[ \t]*-[ \t]+Claude Code: terminal CLI, desktop \(Mac\/Windows\), web \(claude\.ai\/code\), IDEs \(VS Code\/JetBrains\)\.[ \t]*(?:\r?\n|$)/gm,
  /^[ \t]*-[ \t]+\/fast: faster [^\r\n]+? output, not a smaller model\.[ \t]*(?:\r?\n|$)/gm,
]

export function prunePrompt(text: string): string {
  let pruned = text
  for (const paragraph of [SECURITY_SOURCE, LEGACY_SECURITY, PRONOUNS_SOURCE, LEGACY_PRONOUNS]) {
    for (const separator of ['\r\n\r\n', '\n\n']) {
      pruned = pruned.replaceAll(paragraph + separator, '').replaceAll(separator + paragraph, '')
    }
    pruned = pruned.replaceAll(paragraph, '')
  }
  for (const line of ENVIRONMENT_LINES) pruned = pruned.replace(line, '')
  if (pruned === text) return text
  if (pruned.trim() === '# Environment') return ''
  return pruned.replace(/^# Environment[ \t]*(?:\r?\n){1,2}(?=# |$)/gm, '')
}

const ATTRIBUTION_HEADER = 'Attribution for git commits and pull requests you create from here on'
const PR_ATTRIBUTION = /\r?\n- End pull request descriptions with:\r?\n🤖 Generated with \[Claude Code\]\(https:\/\/claude\.com\/claude-code\)(?=\r?\n|$)/g

function commitOnlyAttribution(text: string): string {
  if (!text.startsWith(`${ATTRIBUTION_HEADER} (`) ||
      !text.includes('- End git commit messages with:')) return text

  const withoutPr = text.replace(PR_ATTRIBUTION, '')
  if (withoutPr.includes('- End pull request descriptions with:')) return text
  return withoutPr.replace(ATTRIBUTION_HEADER, 'Attribution for git commits you create from here on')
}

const BASH_GIT_SOURCE = 'Commit or push only when the user asks. If on the default branch, branch first.'
const BASH_GIT_REPLACEMENT = 'Commit or push only when the user asks.'

export const register: Register = (on) => {
  on('tool.describe', { tool: 'Bash' }, async (_$, e, next) => {
    const result = await next(e)
    return { ...result, description: result.description.replace(BASH_GIT_SOURCE, BASH_GIT_REPLACEMENT) }
  })

  on('attribution.text', { kind: 'pr' }, () => ({ text: '' }))

  on('prompt.attachment', async (_$, e, next) => {
    const result = await next(e)
    if (e.origin.kind !== 'engine' || result.text === null) return result
    return { ...result, text: commitOnlyAttribution(result.text) }
  })

  on('prompt.compose', async (_$, e, next) => {
    const result = await next(e)
    return {
      ...result,
      sections: result.sections.flatMap(section => {
        // These session IDs are the engine's actual names, not heading labels.
        if (section.id.includes(':') || (
          section.scope !== 'shared' &&
          !['pronouns', 'env_info_simple', 'env_info_static'].includes(section.id)
        )) return [section]

        const text = prunePrompt(section.text)
        if (text === section.text) return [section]
        return text.trim() ? [{ ...section, text }] : []
      }),
    }
  })
}
