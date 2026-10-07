import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:http'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const plugin = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const forbidden = [
  'IMPORTANT: Assist with authorized security testing',
  'IMPORTANT: Support authorized security testing',
  'When you use a pronoun for someone',
  'Use they/them unless pronouns are stated',
  'The most recent Claude models are',
  'Claude Code is available as a CLI',
  'Fast mode for Claude Code uses',
  'Latest: the Claude',
  'Claude Code: terminal CLI',
  '/fast: faster Claude',
]

for (const staticEnvironment of [false, true]) {
  let captured
  const server = createServer(async (request, response) => {
    let source = ''
    for await (const chunk of request) source += chunk
    if (request.url?.startsWith('/v1/messages/count_tokens')) {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ input_tokens: 1 }))
      return
    }
    if (!request.url?.startsWith('/v1/messages')) {
      response.writeHead(404)
      response.end()
      return
    }
    captured = JSON.parse(source)
    response.writeHead(200, { 'content-type': 'text/event-stream' })
    const event = data => response.write(`event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`)
    event({ type: 'message_start', message: {
      id: 'msg_local_probe', type: 'message', role: 'assistant', model: captured.model,
      content: [], stop_reason: null, stop_sequence: null,
      usage: { input_tokens: 1, output_tokens: 0 },
    } })
    event({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } })
    event({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'OK' } })
    event({ type: 'content_block_stop', index: 0 })
    event({ type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 1 } })
    event({ type: 'message_stop' })
    response.end()
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const args = [
    '--print', '--output-format', 'json', '--no-session-persistence',
    '--setting-sources', '', '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
    '--tools', 'Bash', '--permission-mode', 'dontAsk', '--disable-slash-commands',
    '--plugin-dir', plugin, '--model', 'gpt-6.1-sol',
  ]
  if (staticEnvironment) args.push('--exclude-dynamic-system-prompt-sections')
  args.push('Reply OK.')
  const child = spawn('claude', args, {
    cwd: plugin,
    env: {
      ...process.env,
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${address.port}`,
      ANTHROPIC_API_KEY: 'local-test-only',
      ANTHROPIC_AUTH_TOKEN: '',
      ANTHROPIC_CUSTOM_HEADERS: '',
      CLAUDE_CODE_OAUTH_TOKEN: '',
      HTTP_PROXY: '', HTTPS_PROXY: '', ALL_PROXY: '',
      NO_PROXY: '127.0.0.1,localhost',
      CLAUDE_CODE_USE_BEDROCK: '0',
      CLAUDE_CODE_USE_VERTEX: '0',
      CLAUDE_CODE_USE_FOUNDRY: '0',
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
      CLAUDE_CODE_PLUGIN_DIRS: '',
      CLAUDE_CODE_SIMPLE: '0',
      CLAUDE_CODE_SAFE_MODE: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  child.stdout.resume()
  child.stderr.on('data', chunk => { stderr += chunk })
  const timer = setTimeout(() => child.kill('SIGKILL'), 45000)
  try {
    const code = await new Promise((resolve, reject) => {
      child.once('error', reject)
      child.once('close', resolve)
    })
    assert.equal(code, 0, `Claude CLI failed: ${stderr.slice(-1000)}`)
    assert.ok(captured, 'No request reached the local mock server')
    const system = typeof captured.system === 'string'
      ? captured.system
      : captured.system.map(block => block.text ?? '').join('\n')
    assert.ok(
      system.includes('You are Claude Code') ||
      system.includes("You are a Claude agent, built on Anthropic's Claude Agent SDK."),
      'The entire system prompt was unexpectedly removed',
    )
    for (const phrase of forbidden) assert.ok(!system.includes(phrase), `Template remains: ${phrase}`)
    const messages = JSON.stringify(captured.messages)
    assert.ok(messages.includes('Attribution for git commits you create from here on'), 'Commit attribution is missing')
    assert.ok(!messages.includes('End pull request descriptions with:'), 'PR attribution remains')
    const bash = captured.tools?.find(tool => tool.name === 'Bash')
    assert.ok(bash, 'Bash tool is missing from the request')
    assert.ok(bash.description.includes('Commit or push only when the user asks.'), 'Commit and push permission rule is missing')
    assert.ok(!bash.description.includes('If on the default branch, branch first.'), 'Automatic branch creation rule remains')
    console.log(`PASS: fresh Claude CLI request, ${staticEnvironment ? 'env_info_static' : 'env_info_simple'}; target templates absent, commit attribution preserved, Bash automatic branch creation rule absent`)
  } finally {
    clearTimeout(timer)
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await new Promise(resolve => child.once('close', resolve))
    }
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}
