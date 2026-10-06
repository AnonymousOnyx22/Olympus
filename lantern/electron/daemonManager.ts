import { spawn, execFileSync, type ChildProcess } from 'node:child_process'
import { randomBytes, randomInt } from 'node:crypto'
import { EventEmitter } from 'node:events'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import type { DaemonState, LocalProvider, ModelRef, PermissionMode } from '../src/types/opencode'

/**
 * Ports are drawn from a wide random range rather than a fixed base. Combined with the
 * per-launch basic-auth credential below, another process on the machine has to guess both
 * the port and a 256-bit secret before it can talk to a daemon.
 */
const PORT_RANGE_MIN = 20_000
const PORT_RANGE_MAX = 60_000
const HEALTH_TIMEOUT_MS = 45_000

/** Credentials Olympus uses for the daemon's HTTP basic auth. */
export interface DaemonCredentials {
  username: string
  password: string
}

const BASIC_AUTH_USERNAME = 'olympus'

/** A fresh, unguessable password for every daemon launch. */
function newCredentials(): DaemonCredentials {
  return { username: BASIC_AUTH_USERNAME, password: randomBytes(32).toString('base64url') }
}

export function basicAuthHeader(credentials: DaemonCredentials): string {
  return `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`, 'utf8').toString('base64')}`
}

/**
 * Builds the opencode config handed to the daemon via OPENCODE_CONFIG_CONTENT.
 * Only local providers are enabled, sharing/updates are off, web access is denied,
 * and edits + shell commands follow the user's local approval setting.
 */
export function buildOpencodeConfig(providers: LocalProvider[], selected: ModelRef | null, permissionMode: PermissionMode = 'ask') {
  const usable = providers.filter((p) => p.online && p.models.length > 0)
  const provider: Record<string, { npm?: string; name?: string; options: Record<string, unknown>; models?: Record<string, { name: string; tool_call: boolean }> }> = Object.fromEntries(
    usable.map((p) => [
      p.id,
      {
        npm: '@ai-sdk/openai-compatible',
        name: p.name,
        options: { baseURL: p.baseURL, apiKey: p.apiKey ?? 'local' },
        models: Object.fromEntries(p.models.map((m) => [m, { name: m, tool_call: true }])),
      },
    ]),
  )

  // Bound silent cloud requests without imposing a short generation limit on local models.
  // OpenCode merges this with the provider's existing authentication and endpoint settings.
  if (selected && !provider[selected.providerID]) {
    provider[selected.providerID] = { options: { timeout: 600_000, chunkTimeout: 120_000 } }
  }

  // Trust an explicit selection (it may be an opencode-configured provider we didn't probe);
  // otherwise default to the first usable local model, if any.
  const model = selected
    ? `${selected.providerID}/${selected.modelID}`
    : usable[0]
      ? `${usable[0].id}/${usable[0].models[0]}`
      : undefined

  // NOTE: no `enabled_providers` - that would hide providers the user set up through the
  // opencode CLI (e.g. authenticated OpenCode Zen). We only *add* local endpoints here.
  return {
    $schema: 'https://opencode.ai/config.json',
    provider,
    ...(model ? { model, small_model: model } : {}),
    share: 'disabled',
    // Big folders (a project with node_modules, a build output) made the engine's file watcher and change snapshots
    // take minutes to start, so the agent sat on "Starting" forever. Skip the heavy folders and the snapshots.
    snapshot: false,
    watcher: { ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/.next/**', '**/vendor/**'] },
    autoupdate: false,
    permission: {
      edit: permissionMode === 'ask' ? 'ask' : 'allow',
      bash: permissionMode === 'bypass' ? 'allow' : 'ask',
      external_directory: permissionMode === 'bypass' ? 'allow' : 'ask',
      webfetch: 'deny',
      websearch: 'deny',
    },
  }
}

/** Locates the opencode executable, strongly preferring a real binary so it can be spawned without a shell. */
function resolveOpencodeBinary(): { command: string; shell: boolean } {
  const override = process.env.OLYMPUS_OPENCODE_BIN
  if (override) return { command: override, shell: false }

  if (process.platform === 'win32') {
    let shimDirs: string[] = []
    try {
      const hits = execFileSync('where.exe', ['opencode'], { encoding: 'utf8', windowsHide: true })
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean)
      shimDirs = [...new Set(hits.map((hit) => path.dirname(hit)))]
      const exe = hits.find((hit) => hit.toLowerCase().endsWith('.exe'))
      if (exe) return { command: exe, shell: false }
      // npm installs opencode as a `.cmd` shim next to a real `opencode.exe`. Running the
      // binary directly avoids `shell: true`, which Node now warns about and which would
      // put cmd.exe parsing in the path of a spawned agent.
      for (const dir of shimDirs) {
        for (const candidate of [
          path.join(dir, 'node_modules', 'opencode-ai', 'bin', 'opencode.exe'),
          path.join(dir, 'node_modules', 'opencode-ai', 'node_modules', 'opencode-windows-x64', 'bin', 'opencode.exe'),
          path.join(dir, 'node_modules', 'opencode-ai', 'node_modules', 'opencode-windows-x64-baseline', 'bin', 'opencode.exe'),
          path.join(dir, 'opencode.exe'),
        ]) {
          if (fs.existsSync(candidate)) return { command: candidate, shell: false }
        }
      }
    } catch {
      // fall through to the shell lookup
    }
    // Last resort: a `.cmd`/extensionless shim, which Windows can only start through a
    // shell. Every argument below is an app-controlled literal or a bounded number, so
    // there is nothing user-supplied for the shell to reinterpret.
    const shim = shimDirs.length ? path.join(shimDirs[0], 'opencode.cmd') : 'opencode'
    return { command: fs.existsSync(shim) ? shim : 'opencode', shell: true }
  }

  // GUI-launched apps on macOS/Linux often get a minimal PATH.
  const candidates = [
    path.join(os.homedir(), '.opencode', 'bin', 'opencode'),
    path.join(os.homedir(), '.bun', 'bin', 'opencode'),
    path.join(os.homedir(), '.local', 'bin', 'opencode'),
    '/opt/homebrew/bin/opencode',
    '/usr/local/bin/opencode',
  ]
  const found = candidates.find((c) => fs.existsSync(c))
  return { command: found ?? 'opencode', shell: false }
}

/** Reports the opencode CLI version, or null when it cannot be determined. */
export function detectOpencodeVersion(): string | null {
  const { command, shell } = resolveOpencodeBinary()
  try {
    const out = execFileSync(command, ['--version'], {
      encoding: 'utf8',
      windowsHide: true,
      shell,
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    const match = /\d+\.\d+\.\d+[\w.+-]*/.exec(out)
    return match ? match[0] : null
  } catch {
    return null
  }
}

/**
 * The environment every `opencode serve` Olympus starts runs under.
 *
 * `OPENCODE_SERVER_PASSWORD` is the important one: it puts HTTP basic auth in front of the
 * daemon, so a web page the user visits cannot post to it (a CORS-"simple" request is sent
 * even when the response is unreadable). Sharing/autoupdate stay off, and web access is
 * denied in the config the daemon is handed.
 */
function daemonEnv(config: object | null, credentials: DaemonCredentials, connectionEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return {
    ...process.env,
    ...(config ? { OPENCODE_CONFIG_CONTENT: JSON.stringify(config) } : {}),
    // A connected project's real API keys (Stripe, Shopify, ...), decrypted only here and
    // inherited by every process this daemon's own bash tool spawns. Last, so nothing above
    // can shadow a key a project was actually given access to.
    ...connectionEnv,
    OPENCODE_SERVER_PASSWORD: credentials.password,
    OPENCODE_SERVER_USERNAME: credentials.username,
    OPENCODE_DISABLE_AUTOUPDATE: '1',
    OPENCODE_DISABLE_SHARE: '1',
    // NOTE: models fetch stays ENABLED so provider model lists (incl. opencode) populate.
    OPENCODE_DISABLE_LSP_DOWNLOAD: '1',
    OPENCODE_DISABLE_DEFAULT_PLUGINS: '1',
    OPENCODE_DISABLE_EMBEDDED_WEB_UI: '1',
    // A shell call that sets no timeout of its own is stopped after three minutes. Without this, one
    // command that never returns (a server started in the same call that checks it) hangs the agent
    // for good, and the prompt asking agents not to do that has been ignored more than once.
    OPENCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS: '180000',
  }
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

// Several spaces can start their daemons at nearly the same instant (e.g. on boot, when
// multiple projects have open Workspace-hub windows), and `isPortFree`'s check-then-listen
// has a gap: two concurrent callers can both see the same port as free before either one
// has actually claimed it, and both then try to bind it - one wins, the other crashes
// immediately. `reservedPorts` closes that gap: a port is added to it *synchronously*
// (no `await` in between), so no two concurrent calls can ever claim the same number,
// regardless of how their underlying OS-level checks interleave.
const reservedPorts = new Set<number>()

export function releasePort(port: number) {
  reservedPorts.delete(port)
}

async function findFreePort(): Promise<number> {
  const start = randomInt(PORT_RANGE_MIN, PORT_RANGE_MAX)
  for (let i = 0; i < 200; i++) {
    const port = (start + i) % (PORT_RANGE_MAX - PORT_RANGE_MIN) + PORT_RANGE_MIN
    if (reservedPorts.has(port)) continue
    reservedPorts.add(port)
    if (await isPortFree(port)) return port
    reservedPorts.delete(port)
  }
  throw new Error('No free port available for the opencode daemon')
}

/**
 * Owns the lifecycle of the `opencode serve` child process.
 * Emits `log` (string) for every stdout/stderr line and `state` (DaemonState) on every transition.
 */
export class DaemonManager extends EventEmitter {
  private proc: ChildProcess | null = null
  private state: DaemonState = { status: 'stopped', port: null, cwd: null }
  private startToken = 0
  private credentials: DaemonCredentials | null = null

  getState(): DaemonState {
    return { ...this.state }
  }

  /** The basic-auth credential for the current daemon, or null when none is running. */
  getCredentials(): DaemonCredentials | null {
    return this.credentials
  }

  get baseUrl(): string | null {
    return this.state.status === 'running' && this.state.port ? `http://127.0.0.1:${this.state.port}` : null
  }

  private setState(next: Partial<DaemonState>) {
    this.state = { ...this.state, ...next }
    if (next.status && next.status !== 'error') delete this.state.error
    this.emit('state', this.getState())
  }

  private log(line: string) {
    this.emit('log', line)
  }

  async start(cwd: string, config: object, connectionEnv: NodeJS.ProcessEnv = {}): Promise<DaemonState> {
    const token = ++this.startToken
    await this.stop()
    if (token !== this.startToken) return this.getState()

    const permissions = (config as { permission?: { edit?: string; bash?: string } }).permission
    this.setState({ permissionMode: permissions?.bash === 'allow' ? 'bypass' : permissions?.edit === 'allow' ? 'edit' : 'ask' })

    if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
      this.setState({ status: 'error', cwd, port: null, error: `Not a directory: ${cwd}` })
      return this.getState()
    }

    const { command, shell } = resolveOpencodeBinary()
    const credentials = newCredentials()
    this.credentials = credentials
    const env = daemonEnv(config, credentials, connectionEnv)

    // One retry with a fresh port: the port we picked can lose a tiny race between our
    // free-port check and opencode actually binding it (another process - even another
    // space's own daemon starting at the same instant - grabs it first). That shows up as
    // an immediate crash, not a real config problem, so retrying once is worth it before
    // surfacing an error.
    let attempt = 0
    for (;;) {
      attempt++
      const port = await findFreePort()
      this.setState({ status: 'starting', cwd, port })
      this.log(`[olympus] spawning ${command} serve --port ${port} in ${cwd}${attempt > 1 ? ' (retry)' : ''}`)

      const child = spawn(command, ['serve', '--port', String(port), '--hostname', '127.0.0.1'], {
        cwd,
        env,
        shell,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      this.proc = child
      const startedAt = Date.now()

      // Keeps the last few lines of output so a crash-on-start error can show *why*,
      // not just that it happened - this is otherwise invisible to the UI.
      const recentOutput: string[] = []
      const pipeLines = (stream: NodeJS.ReadableStream | null) => {
        let buffer = ''
        stream?.setEncoding('utf8')
        stream?.on('data', (chunk: string) => {
          buffer += chunk
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            this.log(line)
            recentOutput.push(line)
            if (recentOutput.length > 8) recentOutput.shift()
          }
        })
      }
      pipeLines(child.stdout)
      pipeLines(child.stderr)

      let retrying = false
      child.once('error', (err) => {
        if (this.proc !== child) return
        this.proc = null
        const code = (err as NodeJS.ErrnoException).code
        const hint =
          code === 'ENOENT'
            ? ' - opencode is not installed or not on your PATH. Install it with "npm i -g opencode-ai", or set OLYMPUS_OPENCODE_BIN to its full path.'
            : ''
        this.log(`[olympus] failed to start opencode: ${err.message}${hint}`)
        this.setState({ status: 'error', error: err.message + hint })
      })

      child.once('exit', (code, signal) => {
        if (this.proc !== child) return
        this.proc = null
        this.log(`[olympus] opencode exited (code ${code ?? 'null'}, signal ${signal ?? 'none'})`)
        if (attempt === 1 && code !== 0 && Date.now() - startedAt < 3000) {
          retrying = true
          return
        }
        if (this.state.status === 'starting' || this.state.status === 'running') {
          const detail = recentOutput.length ? `: ${recentOutput.join(' / ')}` : ''
          this.setState({ status: 'error', error: `opencode exited unexpectedly (code ${code})${detail}` })
        }
      })

      const healthy = await this.waitForHealth(port, child, credentials)
      if (token !== this.startToken) {
        releasePort(port)
        return this.getState()
      }
      if (healthy) {
        if (this.proc !== child) return this.getState()
        this.log(`[olympus] opencode is ready on http://127.0.0.1:${port}`)
        this.setState({ status: 'running' })
        return this.getState()
      }
      if (retrying) {
        releasePort(port)
        continue
      }
      if (this.proc !== child) {
        releasePort(port)
        return this.getState()
      }
      break
    }
    {
      await this.stop()
      this.setState({ status: 'error', error: 'opencode did not become healthy in time' })
    }
    return this.getState()
  }

  private async waitForHealth(port: number, child: ChildProcess, credentials: DaemonCredentials): Promise<boolean> {
    const deadline = Date.now() + HEALTH_TIMEOUT_MS
    const headers = { authorization: basicAuthHeader(credentials) }
    while (Date.now() < deadline) {
      if (this.proc !== child || child.exitCode !== null) return false
      try {
        const res = await fetch(`http://127.0.0.1:${port}/global/health`, {
          headers,
          signal: AbortSignal.timeout(1000),
        })
        if (res.ok) return true
      } catch {
        // not listening yet
      }
      await new Promise((r) => setTimeout(r, 300))
    }
    return false
  }

  /** Stops the daemon and its whole process tree, resolving once it has exited. */
  async stop(): Promise<DaemonState> {
    const child = this.proc
    if (this.state.port !== null) releasePort(this.state.port)
    this.credentials = null
    if (!child) {
      if (this.state.status !== 'stopped') this.setState({ status: 'stopped', port: null })
      return this.getState()
    }
    this.proc = null
    this.log('[olympus] stopping opencode…')

    const exited = new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) return resolve()
      child.once('exit', () => resolve())
    })

    killTree(child, 'SIGTERM')
    const timedOut = await Promise.race([exited.then(() => false), delay(4000).then(() => true)])
    if (timedOut) {
      killTree(child, 'SIGKILL')
      await Promise.race([exited, delay(2000)])
    }

    this.setState({ status: 'stopped', port: null })
    return this.getState()
  }

  /** Synchronous best-effort kill for process-exit paths where awaiting is impossible. */
  killNow() {
    if (this.proc) killTree(this.proc, 'SIGKILL')
    this.proc = null
    this.credentials = null
    if (this.state.port !== null) releasePort(this.state.port)
  }
}

function killTree(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return
  try {
    if (process.platform === 'win32') {
      execFileSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' })
    } else {
      child.kill(signal)
    }
  } catch {
    // already gone
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Spawns a short-lived `opencode serve` in a neutral directory just to enumerate the providers
 * the user configured through the opencode CLI (e.g. an authenticated OpenCode Zen account),
 * so models can be shown before any project is opened. The daemon is killed once read.
 *
 * This daemon is protected by basic auth exactly like a project daemon - a throwaway
 * unauthenticated server would reintroduce exactly the exposure the project daemons avoid.
 * It runs in a scratch directory rather than the user's home so it cannot pick up a project.
 */
export async function probeInstalledProviders(): Promise<
  { id: string; name: string; baseURL: string; models: Record<string, unknown> }[]
> {
  let port: number
  try {
    port = await findFreePort()
  } catch {
    return []
  }
  const credentials = newCredentials()
  const headers = { authorization: basicAuthHeader(credentials) }
  const { command, shell } = resolveOpencodeBinary()
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'olympus-probe-'))
  const child = spawn(command, ['serve', '--port', String(port), '--hostname', '127.0.0.1'], {
    cwd: scratch,
    // No OPENCODE_CONFIG_CONTENT here on purpose: this probe exists to read the providers
    // the user configured through the opencode CLI.
    env: daemonEnv(null, credentials, {}),
    shell,
    windowsHide: true,
    stdio: 'ignore',
  })

  try {
    const deadline = Date.now() + 20_000
    let healthy = false
    while (Date.now() < deadline) {
      if (child.exitCode !== null) return []
      try {
        const health = await fetch(`http://127.0.0.1:${port}/global/health`, {
          headers,
          signal: AbortSignal.timeout(1000),
        })
        if (health.ok) {
          healthy = true
          break
        }
      } catch {
        // not listening yet
      }
      await delay(300)
    }
    if (!healthy) return []
    const res = await fetch(`http://127.0.0.1:${port}/config/providers`, {
      headers,
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const body = (await res.json()) as {
      providers?: { id: string; name?: string; options?: { baseURL?: string }; models?: Record<string, unknown> }[]
    }
    return (body.providers ?? []).map((p) => ({
      id: p.id,
      name: p.name || p.id,
      baseURL: p.options?.baseURL ?? '',
      models: p.models ?? {},
    }))
  } catch {
    return []
  } finally {
    killTree(child, 'SIGKILL')
    releasePort(port)
    try {
      fs.rmSync(scratch, { recursive: true, force: true })
    } catch {
      // A leftover scratch directory in the OS temp dir is harmless.
    }
  }
}
