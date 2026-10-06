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
  'codex-cli': { name: 'Codex (your ChatGPT login)', models: ['gpt-6-sol'] },
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

let lastCwd: { dir: string; at: number } | null = null

// One continuing conversation per folder, so a follow-up message resumes the same CLI session.
const started = new Set<string>()

function runClaude(exe: string, cwd: string, model: string, prompt: string, handlers: RunHandlers): ChildProcess {
  const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', 'acceptEdits', '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep,WebSearch,WebFetch']
  if (started.has(cwd)) args.push('--continue')
  args.push('--model', model)
  const child = spawn(exe, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: /\.cmd$/i.test(exe), env: { ...process.env, ...extraEnv() } })
  let buffer = ''
  let failure = ''
  let sawText = false
  child.stdout?.on('data', (data: Buffer) => {
    buffer += data.toString()
    let index: number
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim()
      buffer = buffer.slice(index + 1)
      if (!line) continue
      try {
        const event = JSON.parse(line) as { type?: string; message?: { content?: unknown[] }; result?: string; is_error?: boolean }
        if (event.type === 'assistant') {
          for (const part of event.message?.content ?? []) {
            const block = part as { type?: string; text?: string; name?: string; input?: unknown }
            if (block.type === 'text' && block.text) { handlers.text(block.text + '\n'); sawText = true }
            else if (block.type === 'tool_use' && block.name) handlers.text(describeTool(block.name, block.input))
          }
        } else if (event.type === 'result') {
          if (event.is_error) failure = String(event.result ?? 'Claude Code reported an error.')
          else if (!sawText && event.result) handlers.text(event.result)
        }
      } catch { /* not a JSON line */ }
    }
  })
  child.stderr?.on('data', (data: Buffer) => { failure = failure || data.toString().slice(0, 300) })
  child.on('error', (error) => handlers.done(`Could not start Claude Code: ${error.message}`))
  child.on('close', (code) => { started.add(cwd); handlers.done(code === 0 && !failure ? undefined : failure || `Claude Code stopped with code ${code}.`) })
  child.stdin?.end(prompt)
  return child
}

function runCodex(exe: string, cwd: string, model: string, prompt: string, handlers: RunHandlers): ChildProcess {
  const args = ['exec', '-m', model, '--skip-git-repo-check', '-s', 'workspace-write', '-c', 'sandbox_workspace_write.network_access=true', '-']
  const child = spawn(exe, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: /\.cmd$/i.test(exe), env: { ...process.env, ...extraEnv() } })
  let output = ''
  let errors = ''
  child.stdout?.on('data', (data: Buffer) => { output += data.toString() })
  child.stderr?.on('data', (data: Buffer) => { errors += data.toString() })
  child.on('error', (error) => handlers.done(`Could not start Codex: ${error.message}`))
  child.on('close', (code) => {
    if (output.trim()) handlers.text(output.trim() + '\n')
    handlers.done(code === 0 ? undefined : (errors.trim().split('\n').slice(-3).join(' ') || `Codex stopped with code ${code}.`))
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

  if (isTitleRequest(messages)) { finish(titleFrom(lastUserText(messages))); return }
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
  if (!cwd) { finish('', 'this request did not say which project folder it belongs to.'); return }
  if (!exe) { finish('', 'the program was not found on this PC.'); return }

  let collected = ''
  // A quiet CLI would look like a stalled model to the engine, so keep the stream alive while it works.
  const keepAlive = stream ? setInterval(() => res.write(sseChunk(id, model, '')), 10_000) : null
  const handlers: RunHandlers = {
    text: (chunk) => { if (stream) res.write(sseChunk(id, model, chunk)); else collected += chunk },
    done: (error) => { if (keepAlive) clearInterval(keepAlive); finish(stream ? '' : collected, error) },
  }
  const child = engine === 'claude-code' ? runClaude(exe, cwd, model, prompt, handlers) : runCodex(exe, cwd, model, prompt, handlers)
  res.on('close', () => { if (keepAlive) clearInterval(keepAlive); if (!child.killed && child.exitCode === null) child.kill() })
}

/** Starts the bridge once, on 127.0.0.1 only. Safe to call again. */
export function startCliBridge(): Promise<void> {
  if (server) return Promise.resolve()
  return new Promise((resolve) => {
    server = http.createServer((req, res) => { handle(req, res).catch(() => { try { res.writeHead(500).end() } catch { /* already sent */ } }) })
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
