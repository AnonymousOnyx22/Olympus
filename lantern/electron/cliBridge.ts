import http from 'node:http'
import { spawn, type ChildProcess } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import type { LocalProvider } from '../src/types/opencode'

/**
 * Lets Claude Code and Codex appear in the model list and run through their own command line programs,
 * using the logins already on this PC. No API and no API key is involved.
 *
 * The agent engine talks to a model over an OpenAI-style chat endpoint. This bridge answers that endpoint on
 * 127.0.0.1 only, behind a random token, and answers each request by running the CLI in the folder the
 * conversation belongs to. The CLI does its own file edits and commands, so the engine's own tools are not used.
 * The prompt travels over stdin, never as an argument, so no chat text is ever interpreted by a shell.
 */

export type CliEngine = 'claude-code' | 'codex-cli'

export interface ChatMessage { role?: string; content?: unknown }

/** Text of a message whose content is a string or a list of parts. */
export function textOf(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content.map((part) => (part && typeof part === 'object' && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '')).join('')
}

/** The engine states the working folder in its system prompt, which is how a request is tied to a project. */
export function workingDirectory(messages: ChatMessage[]): string | null {
  for (const message of messages) {
    if (message.role !== 'system') continue
    const match = textOf(message.content).match(/Working directory:\s*([^\r\n<]+)/i)
    const dir = match?.[1]?.trim()
    if (dir && path.isAbsolute(dir) && fs.existsSync(dir)) return dir
  }
  return null
}

export function lastUserText(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === 'user') return textOf(messages[i].content).trim()
  return ''
}

/** The engine also asks the model for a short chat title. That must not start a full CLI run. */
export function isTitleRequest(messages: ChatMessage[]): boolean {
  return messages.some((message) => message.role === 'system' && /title generator|generate a (?:brief |short )?title|conversation title/i.test(textOf(message.content)))
}

export const titleFrom = (text: string): string => text.replace(/\s+/g, ' ').trim().split(' ').slice(0, 6).join(' ') || 'New chat'

export function sseChunk(id: string, model: string, delta: string, finish: string | null = null): string {
  return `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta: delta ? { role: 'assistant', content: delta } : {}, finish_reason: finish }] })}\n\n`
}

/** Short human line for a tool the CLI used, so the chat shows what is happening. */
export function describeTool(name: string, input: unknown): string {
  const record = input && typeof input === 'object' ? (input as Record<string, unknown>) : {}
  const target = record.file_path ?? record.path ?? record.command ?? record.pattern ?? ''
  const text = String(target).replace(/\s+/g, ' ').slice(0, 90)
  return `\n> ${name}${text ? `: ${text}` : ''}\n`
}

const ENGINES: Record<CliEngine, { name: string; models: string[] }> = {
  'claude-code': { name: 'Claude Code (your login)', models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-4-5'] },
  'codex-cli': { name: 'Codex (your ChatGPT login)', models: ['gpt-6-astra', 'gpt-6-sol', 'gpt-6-luna', 'gpt-5.6-sol', 'gpt-5.6-terra', 'gpt-5.6-luna'] },
}

function onPath(names: string[]): string | null {
  for (const dir of (process.env.PATH ?? '').split(path.delimiter)) {
    for (const name of names) {
      const file = path.join(dir, name)
      try { if (fs.statSync(file).isFile()) return file } catch { /* not here */ }
    }
  }
  return null
}

/** The newest Claude Code program: on PATH, else the one that ships inside the VS Code extension. */
export function findClaude(): string | null {
  const found = onPath(process.platform === 'win32' ? ['claude.exe', 'claude.cmd'] : ['claude'])
  if (found) return found
  const extensions = path.join(os.homedir(), '.vscode', 'extensions')
  try {
    const dirs = fs.readdirSync(extensions).filter((name) => name.startsWith('anthropic.claude-code-')).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    for (const dir of dirs) {
      const exe = path.join(extensions, dir, 'resources', 'native-binary', process.platform === 'win32' ? 'claude.exe' : 'claude')
      if (fs.existsSync(exe)) return exe
    }
  } catch { /* no VS Code */ }
  return null
}

export const findCodex = (): string | null => onPath(process.platform === 'win32' ? ['codex.cmd', 'codex.exe'] : ['codex'])

interface RunHandlers { text: (chunk: string) => void; done: (error?: string) => void }

/** Environment the CLI programs get on top of this process's own: the owner's saved connections (Netlify and so on), same as the agent engine. */
let extraEnv: () => Record<string, string | undefined> = () => ({})
export function setBridgeEnv(provider: () => Record<string, string | undefined>): void { extraEnv = provider }

/** Set OLYMPUS_BRIDGE_LOG to a file path to record what the bridge does with each request (never the prompt text). */
const debug = (message: string): void => { const file = process.env.OLYMPUS_BRIDGE_LOG; if (file) { try { fs.appendFileSync(file, `${new Date().toISOString()} ${message}
`) } catch { /* logging only */ } } }

let lastCwd: { dir: string; at: number } | null = null

// One continuing conversation per folder, so a follow-up message resumes the same CLI session.
const started = new Set<string>()

export interface ClaudeStreamState { streamedText: boolean; sawText: boolean; tools: Map<number, { name: string; json: string }> }
export const newClaudeState = (): ClaudeStreamState => ({ streamedText: false, sawText: false, tools: new Map() })

/**
 * Turns one line of `claude -p --output-format stream-json --include-partial-messages` into chat text. Partial events
 * make text and each tool call appear as they are produced, instead of only when a whole step has finished, which
 * can be minutes while a long file is being written.
 */
export function claudeLine(line: string, state: ClaudeStreamState): { text?: string; error?: string } | null {
  let event: { type?: string; result?: string; is_error?: boolean; message?: { content?: unknown[] }; event?: { type?: string; index?: number; content_block?: { type?: string; name?: string }; delta?: { type?: string; text?: string; partial_json?: string } } }
  try { event = JSON.parse(line) } catch { return null }
  if (event.type === 'stream_event' && event.event) {
    const inner = event.event
    if (inner.type === 'message_start') { state.streamedText = false; return null }
    if (inner.type === 'content_block_start' && inner.content_block?.type === 'tool_use' && inner.content_block.name && inner.index !== undefined) {
      state.tools.set(inner.index, { name: inner.content_block.name, json: '' })
      return { text: `\n> ${inner.content_block.name}...\n` }
    }
    if (inner.type === 'content_block_delta' && inner.delta?.type === 'text_delta' && inner.delta.text) {
      state.streamedText = true
      state.sawText = true
      return { text: inner.delta.text }
    }
    if (inner.type === 'content_block_delta' && inner.delta?.type === 'input_json_delta' && inner.index !== undefined) {
      const tool = state.tools.get(inner.index)
      if (tool) tool.json += inner.delta.partial_json ?? ''
      return null
    }
    if (inner.type === 'content_block_stop' && inner.index !== undefined) {
      const tool = state.tools.get(inner.index)
      if (!tool) return null
      state.tools.delete(inner.index)
      try {
        const input = JSON.parse(tool.json) as Record<string, unknown>
        const target = String(input.file_path ?? input.path ?? input.command ?? input.pattern ?? input.url ?? '').replace(/\s+/g, ' ').slice(0, 100)
        return target ? { text: `  ${target}\n` } : null
      } catch { return null }
    }
    return null
  }
  if (event.type === 'assistant' && !state.streamedText) {
    // No partial events arrived for this message, so show the finished one.
    let text = ''
    for (const part of event.message?.content ?? []) {
      const block = part as { type?: string; text?: string; name?: string; input?: unknown }
      if (block.type === 'text' && block.text) { text += block.text + '\n'; state.sawText = true }
      else if (block.type === 'tool_use' && block.name) text += describeTool(block.name, block.input)
    }
    return text ? { text } : null
  }
  if (event.type === 'result') {
    if (event.is_error) return { error: String(event.result ?? 'Claude Code reported an error.') }
    if (!state.sawText && event.result) return { text: event.result }
  }
  return null
}

function runClaude(exe: string, cwd: string, model: string, prompt: string, handlers: RunHandlers): ChildProcess {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--include-partial-messages', '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch']
  if (started.has(cwd)) args.push('--continue')
  args.push('--model', model)
  const child = spawn(exe, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: /\.cmd$/i.test(exe), env: { ...process.env, ...extraEnv() } })
  const state = newClaudeState()
  let buffer = ''
  let failure = ''
  child.stdout?.on('data', (data: Buffer) => {
    buffer += data.toString()
    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (!line) continue
      const parsed = claudeLine(line, state)
      if (parsed?.text) handlers.text(parsed.text)
      if (parsed?.error) failure = parsed.error
    }
  })
  child.stderr?.on('data', (data: Buffer) => { failure = failure || data.toString().slice(0, 300) })
  child.on('error', (error) => handlers.done(`Could not start Claude Code: ${error.message}`))
  child.on('close', (code) => { started.add(cwd); handlers.done(code === 0 && !failure ? undefined : failure || `Claude Code stopped with code ${code}.`) })
  child.stdin?.end(prompt)
  return child
}

/** Short readable form of a command Codex ran, without the PowerShell wrapper. */
export function describeCommand(command: string): string {
  const inner = command.replace(/^"?[^"]*powershell\.exe"?\s+-Command\s+/i, '').replace(/^"|"$/g, '')
  return inner.replace(/\s+/g, ' ').slice(0, 100)
}

/** Turns one line of `codex exec --json` into text for the chat, or null when it has nothing to show. */
export function codexLine(line: string): { text?: string; error?: string } | null {
  let event: { type?: string; message?: string; error?: { message?: string }; item?: { type?: string; text?: string; command?: string; changes?: { path?: string }[] } }
  try { event = JSON.parse(line) } catch { return null }
  const item = event.item
  if (event.type === 'item.completed' && item?.type === 'agent_message' && item.text) return { text: item.text + '\n' }
  if (event.type === 'item.started' && item?.type === 'command_execution' && item.command) return { text: `\n> Run: ${describeCommand(item.command)}\n` }
  if (event.type === 'item.completed' && item?.type === 'file_change') {
    const paths = (item.changes ?? []).map((change) => change.path).filter(Boolean).slice(0, 4).join(', ')
    return { text: `\n> Edit: ${paths || 'files'}\n` }
  }
  if (event.type === 'turn.failed' || event.type === 'error') return { error: event.error?.message ?? event.message ?? 'Codex reported an error.' }
  return null
}

function runCodex(exe: string, cwd: string, model: string, prompt: string, handlers: RunHandlers): ChildProcess {
  const args = ['exec', '--json', '-m', model, '--skip-git-repo-check', '-s', 'workspace-write', '-c', 'sandbox_workspace_write.network_access=true', '-']
  const child = spawn(exe, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: /\.cmd$/i.test(exe), env: { ...process.env, ...extraEnv() } })
  let buffer = ''
  let failure = ''
  let errors = ''
  child.stdout?.on('data', (data: Buffer) => {
    buffer += data.toString()
    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (!line) continue
      const parsed = codexLine(line)
      if (parsed?.text) handlers.text(parsed.text)
      if (parsed?.error) failure = parsed.error
    }
  })
  child.stderr?.on('data', (data: Buffer) => { errors += data.toString() })
  child.on('error', (error) => handlers.done(`Could not start Codex: ${error.message}`))
  child.on('close', (code) => {
    handlers.done(code === 0 && !failure ? undefined : failure || errors.trim().split('\n').slice(-3).join(' ') || `Codex stopped with code ${code}.`)
  })
  child.stdin?.end(prompt)
  return child
}

let server: http.Server | null = null
let port = 0
const token = randomBytes(24).toString('hex')

export const bridgeToken = (): string => token

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const parts: Buffer[] = []
    let size = 0
    req.on('data', (part: Buffer) => { size += part.length; if (size > 8_000_000) { reject(new Error('too large')); req.destroy() } else parts.push(part) })
    req.on('end', () => resolve(Buffer.concat(parts).toString('utf8')))
    req.on('error', reject)
  })
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  debug(`incoming ${req.method} ${req.url} length=${req.headers['content-length'] ?? 'chunked'}`)
  if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401).end(); return }
  const match = (req.url ?? '').match(/^\/(claude-code|codex-cli)\/v1\/(models|chat\/completions)/)
  if (!match) { res.writeHead(404).end(); return }
  const engine = match[1] as CliEngine
  if (match[2] === 'models') {
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ data: ENGINES[engine].models.map((id) => ({ id, object: 'model' })) }))
    return
  }
  const body = JSON.parse(await readBody(req)) as { model?: string; messages?: ChatMessage[]; stream?: boolean }
  const messages = body.messages ?? []
  // The model name ends up on a command line, so only the names this bridge lists are ever accepted.
  const model = ENGINES[engine].models.includes(String(body.model)) ? String(body.model) : ENGINES[engine].models[0]
  const id = `chatcmpl-${randomBytes(6).toString('hex')}`
  const stream = body.stream !== false

  const finish = (text: string, error?: string) => {
    const content = error ? `${text}${text ? '\n' : ''}[${ENGINES[engine].name} could not finish: ${error}]` : text
    if (stream) res.end(sseChunk(id, model, content, 'stop') + 'data: [DONE]\n\n')
    else res.end(JSON.stringify({ id, object: 'chat.completion', model, choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] }))
  }
  if (stream) res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
  else res.writeHead(200, { 'content-type': 'application/json' })

  debug(`request engine=${engine} model=${model} stream=${stream} messages=${messages.length} tools=${Array.isArray((body as { tools?: unknown[] }).tools) ? (body as { tools?: unknown[] }).tools!.length : 0}`)
  if (isTitleRequest(messages)) { debug('answered as a title request'); finish(titleFrom(lastUserText(messages))); return }
  const toolCount = Array.isArray((body as { tools?: unknown[] }).tools) ? (body as { tools?: unknown[] }).tools!.length : 0
  let cwd = workingDirectory(messages)
  // Only the engine's real agent requests carry tools. A small request with no tools and no folder is a side request
  // such as a title or summary, so it gets a one line answer instead of a full CLI run.
  if (!cwd && toolCount === 0) { finish(titleFrom(lastUserText(messages))); return }
  // A real request that did not repeat the folder is tied to the folder this bridge saw most recently, if that was recent.
  if (!cwd && lastCwd && Date.now() - lastCwd.at < 15 * 60_000) cwd = lastCwd.dir
  if (cwd) lastCwd = { dir: cwd, at: Date.now() }
  const prompt = lastUserText(messages)
  const exe = engine === 'claude-code' ? findClaude() : findCodex()
  debug(`folder=${cwd ?? 'none'} program=${exe ?? 'none'}`)
  debug(`connection variables passed: ${Object.keys(extraEnv()).length}, netlify token present: ${!!extraEnv().NETLIFY_AUTH_TOKEN}`)
  if (!cwd) { finish('', 'this request did not say which project folder it belongs to.'); return }
  if (!exe) { finish('', 'the program was not found on this PC.'); return }

  let collected = ''
  // A quiet CLI would look like a stalled model to the engine, so keep the stream alive while it works.
  const keepAlive = stream ? setInterval(() => res.write(sseChunk(id, model, '')), 10_000) : null
  const handlers: RunHandlers = {
    text: (chunk) => { debug(`text ${chunk.length} chars`); if (stream) res.write(sseChunk(id, model, chunk)); else collected += chunk },
    done: (error) => { debug(`done ${error ?? 'ok'}`); if (keepAlive) clearInterval(keepAlive); finish(stream ? '' : collected, error) },
  }
  const child = engine === 'claude-code' ? runClaude(exe, cwd, model, prompt, handlers) : runCodex(exe, cwd, model, prompt, handlers)
  res.on('close', () => { if (keepAlive) clearInterval(keepAlive); if (!child.killed && child.exitCode === null) child.kill() })
}

/** Starts the bridge once, on 127.0.0.1 only. Safe to call again. */
export function startCliBridge(): Promise<void> {
  if (server) return Promise.resolve()
  return new Promise((resolve) => {
    server = http.createServer((req, res) => { handle(req, res).catch((error: Error) => { debug(`error ${error.message}`); try { res.writeHead(500).end() } catch { /* already sent */ } }) })
    server.listen(0, '127.0.0.1', () => { port = (server!.address() as { port: number }).port; resolve() })
  })
}

export function stopCliBridge(): void { server?.close(); server = null }

/** Model-list entries for whichever CLI programs are installed. Empty until the bridge is running. */
export function cliProviders(): LocalProvider[] {
  if (!server || !port) return []
  const available: Record<CliEngine, boolean> = { 'claude-code': !!findClaude(), 'codex-cli': !!findCodex() }
  return (Object.keys(ENGINES) as CliEngine[])
    .filter((engine) => available[engine])
    .map((engine) => ({
      id: engine,
      name: ENGINES[engine].name,
      baseURL: `http://127.0.0.1:${port}/${engine}/v1`,
      online: true,
      models: ENGINES[engine].models,
      access: Object.fromEntries(ENGINES[engine].models.map((model) => [model, 'cli' as const])),
      source: 'local' as const,
      apiKey: token,
    }))
}
