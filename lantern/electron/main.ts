import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { buildOpencodeConfig, detectOpencodeVersion, probeInstalledProviders } from './daemonManager'
import * as pool from './spacePool'
import { discoverProviders, fetchDaemonProviders, mergeProviders, isChatModel, modelAccess, slugifyProviderId, BUILTIN_ENDPOINTS } from './modelDiscovery'
import { getSettings, updateSettings } from './settings'
import * as projects from './projects'
import { gitStatus, gitAction } from './git'
import { licenseSummary } from './license'
import type { OlympusSettings, LocalProvider, StartDaemonResult } from '../src/types/opencode'

const MAX_READ_BYTES = 5 * 1024 * 1024
const MAX_PROJECT_FILES = 3000
const IGNORED_PROJECT_DIRS = new Set([
  '.git', '.next', '.nuxt', '.svelte-kit', '.turbo', '.vite',
  'build', 'coverage', 'dist', 'dist-electron', 'node_modules', 'out',
])

// The id of the folder-less "General chats" space; saved projects use their resolved path.
const GENERAL_SPACE = 'general'

let mainWindow: BrowserWindow | null = null
// The space whose Code/Preview/Terminal tabs and file tools are currently on screen.
// Every other open space keeps its own daemon running in the pool regardless of focus.
let focusedSpaceId = GENERAL_SPACE

const send = (channel: string, ...args: unknown[]) => {
  if (process.env.OLYMPUS_DEBUG_IPC) console.log('[ipc]', channel, ...args)
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args)
}

/**
 * Rejects IPC from anything other than our own top-level window. Every handler below proxies
 * privileged work (filesystem, git, process spawning, a local agent), so a stray frame must
 * never be able to reach them.
 */
function assertTrustedSender(event: Electron.IpcMainInvokeEvent) {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('No window to serve this request')
  if (event.sender !== mainWindow.webContents) throw new Error('IPC rejected: untrusted sender')
  if (event.senderFrame && event.senderFrame.parent !== null) throw new Error('IPC rejected: untrusted frame')
}

/** Wraps an IPC handler so it can only ever run for a trusted top-level frame. */
function handle(channel: string, fn: (...args: never[]) => unknown) {
  ipcMain.handle(channel, async (event, ...args) => {
    assertTrustedSender(event)
    return fn(...(args as never[]))
  })
}

/**
 * Olympus needs no camera, microphone, geolocation, notification, or sensor access, and its
 * renderer only ever talks to the main process. Electron approves renderer permission
 * requests unless a handler is registered, so deny them all rather than relying on the CSP.
 */
function lockDownPermissions(target: Electron.Session) {
  target.setPermissionRequestHandler((_wc, _permission, callback) => callback(false))
  target.setPermissionCheckHandler(() => false)
  target.setDevicePermissionHandler(() => false)
}
pool.initSpacePool(send)

/** Local port probe plus, if the daemon is up, the providers it knows (incl. opencode CLI setup). */
async function listAllProviders(spaceId: string): Promise<LocalProvider[]> {
  const local = await discoverProviders(getSettings().customEndpoints)
  const base = pool.baseUrl(spaceId)
  if (base) {
    const fromDaemon = await fetchDaemonProviders(base)
    return mergeProviders(fromDaemon, local)
  }
  // No project daemon yet — spin up a throwaway one so models configured via the
  // opencode CLI still show on the welcome screen (before any folder is opened).
  const installed = await probeInstalledProviders()
  const normalized: LocalProvider[] = installed
    .map((p) => {
      const isLocal = /127\.0\.0\.1|localhost|0\.0\.0\.0/.test(p.baseURL)
      return {
        id: p.id,
        name: p.name,
        baseURL: p.baseURL,
        online: true,
        models: Object.keys(p.models).filter(isChatModel).sort(),
        variants: Object.fromEntries(
          Object.entries(p.models).flatMap(([modelID, metadata]) => {
            if (!metadata || typeof metadata !== 'object') return []
            const variants = (metadata as { variants?: unknown }).variants
            if (!variants || typeof variants !== 'object') return []
            return [[modelID, Object.keys(variants)]]
          }),
        ),
        access: Object.fromEntries(
          Object.entries(p.models).map(([modelID, metadata]) => [modelID, modelAccess(metadata, isLocal)]),
        ),
        source: isLocal ? ('local' as const) : ('opencode' as const),
      }
    })
    .filter((p) => p.models.length > 0)
  return mergeProviders(normalized, local)
}

/**
 * Starts (or reuses) the given space's own daemon. Spaces that are already running with
 * the same directory and permission mode are left alone — this is what lets you switch
 * between several open projects, or send a message to a background one, without tearing
 * down anyone else's agent.
 */
async function startForProject(spaceId: string, dir: string, force = false): Promise<StartDaemonResult> {
  const resolved = path.resolve(dir)
  updateSettings({ lastProject: resolved })
  const settings = getSettings()
  const current = pool.state(spaceId)
  if (!force && (current.status === 'running' || current.status === 'starting') && current.cwd === resolved) {
    return { state: current, providers: await listAllProviders(spaceId) }
  }
  const local = await discoverProviders(settings.customEndpoints)
  const online = local.filter((p) => p.online)
  send(
    'daemon:log',
    spaceId,
    online.length
      ? `[olympus] local model servers: ${online.map((p) => `${p.name} (${p.models.length})`).join(', ')}`
      : '[olympus] no local model servers found — will still load models configured via the opencode CLI.',
  )
  const state = await pool.start(spaceId, resolved, buildOpencodeConfig(local, settings.selectedModel, settings.permissionMode))
  // Once the daemon is up, fold in the providers it knows (e.g. authenticated OpenCode Zen).
  const providers = await listAllProviders(spaceId)
  const daemonOnly = providers.filter((p) => p.source === 'opencode' && p.models.length)
  if (daemonOnly.length) {
    send('daemon:log', spaceId, `[olympus] opencode providers: ${daemonOnly.map((p) => `${p.name} (${p.models.length})`).join(', ')}`)
  }
  return { state, providers }
}

// ---- spaces: the folder-less "General chats" area + saved projects ----

/** A scratch workspace so the daemon can run for plain Q&A with no project open. */
function generalDir(): string {
  const dir = path.join(app.getPath('userData'), 'general-workspace')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function resolveSpaceDir(spaceId: string): string {
  if (spaceId === GENERAL_SPACE) return generalDir()
  const proj = projects.findProject(spaceId)
  if (!proj || !proj.exists) return generalDir()
  projects.markOpened(proj.id)
  return proj.path
}

/** Reads a text file only if it resolves inside the currently focused project. */
function readProjectFile(requested: string): string | null {
  const root = pool.state(focusedSpaceId).cwd
  if (!root || typeof requested !== 'string') return null
  try {
    const target = path.resolve(root, requested)
    const realRoot = fs.realpathSync(root)
    const realTarget = fs.realpathSync(target)
    const rel = path.relative(realRoot, realTarget)
    if (rel.startsWith('..') || path.isAbsolute(rel)) return null
    const stat = fs.statSync(realTarget)
    if (!stat.isFile() || stat.size > MAX_READ_BYTES) return null
    return fs.readFileSync(realTarget, 'utf8')
  } catch {
    return null
  }
}

/** Lists ordinary files without walking generated/vendor folders or following symlinks. */
function listProjectFiles(): string[] {
  const root = pool.state(focusedSpaceId).cwd
  if (!root) return []
  const realRoot = fs.realpathSync(root)
  const files: string[] = []
  const walk = (dir: string) => {
    if (files.length >= MAX_PROJECT_FILES) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (files.length >= MAX_PROJECT_FILES) break
      if (entry.isSymbolicLink()) continue
      const absolute = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!IGNORED_PROJECT_DIRS.has(entry.name)) walk(absolute)
      } else if (entry.isFile()) {
        files.push(path.relative(realRoot, absolute).split(path.sep).join('/'))
      }
    }
  }
  try {
    walk(realRoot)
    return files.sort((a, b) => a.localeCompare(b))
  } catch {
    return []
  }
}

/** Saves an existing UTF-8 file inside the focused project. */
function writeProjectFile(requested: string, content: string): boolean {
  const root = pool.state(focusedSpaceId).cwd
  if (!root || Buffer.byteLength(content, 'utf8') > MAX_READ_BYTES) return false
  try {
    const realRoot = fs.realpathSync(root)
    const realTarget = fs.realpathSync(path.resolve(root, requested))
    const rel = path.relative(realRoot, realTarget)
    if (rel.startsWith('..') || path.isAbsolute(rel) || !fs.statSync(realTarget).isFile()) return false
    fs.writeFileSync(realTarget, content, 'utf8')
    return true
  } catch {
    return false
  }
}

function packageManager(root: string): 'npm' | 'pnpm' | 'yarn' {
  if (fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) return 'pnpm'
  if (fs.existsSync(path.join(root, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

/** Picks the least surprising run target instead of guessing a framework command. */
function projectRunCommand(): string | null {
  const root = pool.state(focusedSpaceId).cwd
  if (!root) return null
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, unknown> }
    const manager = packageManager(root)
    if (typeof pkg.scripts?.dev === 'string') return `${manager} run dev`
    if (typeof pkg.scripts?.start === 'string') return manager === 'npm' ? 'npm start' : `${manager} start`
  } catch {
    // A non-Node project simply has no automatic Run target yet.
  }
  return null
}

/**
 * Finds common local dev-server ports. Preview is deliberately loopback-only.
 *
 * Probed concurrently rather than one at a time: probing sequentially meant up to fourteen
 * 450ms timeouts back to back, blocking the main process for seconds on every attempt.
 */
async function discoverPreview(): Promise<string | null> {
  let olympusDevPort = -1
  try {
    olympusDevPort = Number(new URL(process.env.VITE_DEV_SERVER_URL ?? '').port)
  } catch {
    // Packaged builds do not have a Vite development URL.
  }
  const ports = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 3000, 3001, 4173, 8080, 8000, 4200]
  const results = await Promise.all(
    ports
      .filter((candidate) => candidate !== olympusDevPort)
      .map(async (port) => {
        const url = `http://127.0.0.1:${port}`
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(450) })
          await response.body?.cancel()
          return response.status < 500 ? url : null
        } catch {
          return null
        }
      }),
  )
  // Keep the conventional-port preference order rather than whichever probe won the race.
  for (const url of results) if (url) return url
  return null
}

const notifyProjects = (list: ReturnType<typeof projects.listProjects>) => send('projects:changed', list)

function registerIpc() {
  handle('dialog:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: 'Add project folder',
      properties: ['openDirectory', 'createDirectory'],
    })
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  const normSpaceId = (spaceId: unknown) => (typeof spaceId === 'string' && spaceId ? spaceId : GENERAL_SPACE)

  // Focuses a space's Code/Preview/Terminal/file tools and starts its daemon if needed.
  // Other already-open spaces are left running untouched. `force` restarts it even if
  // already running with the same directory (needed after a config change, e.g. approvals).
  handle('space:start', (_e, spaceId: unknown, force: unknown) => {
    const id = normSpaceId(spaceId)
    focusedSpaceId = id
    pool.setFocused(id)
    updateSettings({ lastSpace: id })
    return startForProject(id, resolveSpaceDir(id), force === true)
  })
  // Starts a space's daemon in the background (e.g. a multi-project tab) without
  // changing which space is focused, so its agent can run alongside the focused one.
  handle('space:open', (_e, spaceId: unknown) => {
    const id = normSpaceId(spaceId)
    return startForProject(id, resolveSpaceDir(id))
  })
  handle('space:close', (_e, spaceId: unknown) => pool.stop(normSpaceId(spaceId)))
  handle('daemon:state', (_e, spaceId: unknown) => pool.state(normSpaceId(spaceId)))
  const gitProjectPath = (id: unknown) => {
    if (typeof id !== 'string') throw new Error('Select a project first.')
    const project = projects.findProject(id)
    if (!project?.exists) throw new Error('The project folder is unavailable.')
    return project.path
  }
  handle('git:status', (_e, id: unknown) => gitStatus(gitProjectPath(id)))
  handle('git:action', (_e, id: unknown, action: unknown, message: unknown) => gitAction(gitProjectPath(id), action, message))

  handle('projects:list', () => projects.listProjects())
  handle('projects:add', (_e, p: unknown) => {
    if (typeof p !== 'string' || !p) throw new Error('Not a folder')
    return projects.addProject(p)
  })
  handle('projects:remove', (_e, id: unknown) => projects.removeProject(String(id)))
  handle('projects:unhide', (_e, id: unknown) => projects.unhideProject(String(id)))
  handle('projects:pin', (_e, id: unknown, pinned: unknown) => projects.pinProject(String(id), pinned === true))
  handle('projects:create', (_e, root: unknown, name: unknown) => projects.createProject(String(root), String(name)))
  handle('projects:reveal', async (_e, id: unknown) => {
    const proj = projects.findProject(String(id))
    if (!proj?.exists) throw new Error('That folder no longer exists')
    const error = await shell.openPath(proj.path)
    if (error) throw new Error(error)
  })
  handle('projects:roots', () => getSettings().projectRoots)
  handle('projects:addRoot', (_e, p: unknown) => {
    if (typeof p !== 'string' || !p) throw new Error('Not a folder')
    const roots = projects.addRoot(p)
    const list = projects.listProjects()
    projects.watchRoots(notifyProjects)
    return { roots, projects: list }
  })
  handle('projects:removeRoot', (_e, p: unknown) => {
    const roots = projects.removeRoot(String(p))
    projects.watchRoots(notifyProjects)
    return { roots, projects: projects.listProjects() }
  })

  handle('models:discover', () => listAllProviders(focusedSpaceId))
  handle('models:addEndpoint', (_e, input: { name?: unknown; baseURL?: unknown }) => {
    const name = String(input?.name ?? '').trim()
    let baseURL = String(input?.baseURL ?? '').trim()
    if (!name || !baseURL) throw new Error('Name and URL are required')
    const url = new URL(baseURL) // throws on garbage
    if (!/^https?:$/.test(url.protocol)) throw new Error('URL must be http(s)')
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    const loopback = hostname === 'localhost' || hostname === '::1' || /^127(?:\.\d{1,3}){3}$/.test(hostname)
    if (!loopback) throw new Error('Olympus only connects to model servers on this computer')
    if (url.username || url.password) throw new Error('Do not put credentials in a local endpoint URL')
    baseURL = baseURL.replace(/\/+$/, '')
    const settings = getSettings()
    const taken = [...BUILTIN_ENDPOINTS, ...settings.customEndpoints].map((e) => e.id)
    const endpoint = { id: slugifyProviderId(name, taken), name, baseURL, custom: true }
    return updateSettings({ customEndpoints: [...settings.customEndpoints, endpoint] })
  })
  handle('models:removeEndpoint', (_e, id: unknown) => {
    const settings = getSettings()
    return updateSettings({ customEndpoints: settings.customEndpoints.filter((e) => e.id !== id) })
  })

  handle('settings:get', () => getSettings())
  handle('settings:set', (_e, patch: Partial<OlympusSettings>) => {
    const allowed: Partial<OlympusSettings> = {}
    if (patch && 'selectedModel' in patch) allowed.selectedModel = patch.selectedModel ?? null
    if (patch && 'lastProject' in patch) allowed.lastProject = patch.lastProject ?? null
    if (patch && 'permissionMode' in patch && ['ask', 'edit', 'bypass'].includes(String(patch.permissionMode))) {
      allowed.permissionMode = patch.permissionMode
    }
    if (patch && 'selectedVariants' in patch && patch.selectedVariants && typeof patch.selectedVariants === 'object') {
      allowed.selectedVariants = Object.fromEntries(
        Object.entries(patch.selectedVariants).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
      )
    }
    return updateSettings(allowed)
  })

  handle('oc:request', (_e, spaceId: unknown, method: unknown, reqPath: unknown, body: unknown) => {
    if (typeof method !== 'string' || typeof reqPath !== 'string') throw new Error('invalid request')
    return pool.request(normSpaceId(spaceId), method.toUpperCase(), reqPath, body)
  })

  // The terminal only ever shows the focused space's shell.
  handle('pty:connect', (_e, id: unknown) => {
    const b = pool.bridge(focusedSpaceId)
    if (!b) throw new Error('opencode daemon is not running')
    return b.ptyConnect(String(id))
  })
  ipcMain.on('pty:write', (event, id: unknown, data: unknown) => {
    try {
      assertTrustedSender(event as unknown as Electron.IpcMainInvokeEvent)
    } catch {
      return
    }
    if (typeof data === 'string') pool.bridge(focusedSpaceId)?.ptyWrite(String(id), data)
  })
  handle('pty:disconnect', (_e, id: unknown) => pool.bridge(focusedSpaceId)?.ptyDisconnect(String(id)))

  handle('fs:readProjectFile', (_e, p: unknown) => readProjectFile(String(p)))
  handle('fs:listProjectFiles', () => listProjectFiles())
  handle('fs:writeProjectFile', (_e, p: unknown, content: unknown) => {
    if (typeof p !== 'string' || typeof content !== 'string') return false
    return writeProjectFile(p, content)
  })
  ipcMain.on('app:closeReady', (event, ok: unknown) => {
    try {
      assertTrustedSender(event as unknown as Electron.IpcMainInvokeEvent)
    } catch {
      return
    }
    closePending = false
    const window = mainWindow
    if (!window) return
    const finish = () => {
      closeApproved = true
      window.close()
    }
    if (ok !== false) {
      finish()
      return
    }
    void dialog
      .showMessageBox(window, {
        type: 'warning',
        buttons: ['Keep editing', 'Close anyway'],
        defaultId: 0,
        cancelId: 0,
        message: 'Some changes could not be saved',
        detail:
          'A file you edited could not be written to disk. Closing now will discard the in-app copy of those changes. The files on disk are unchanged.',
      })
      .then(({ response }) => {
        if (response === 1) finish()
      })
  })

  /** Logs a renderer-side crash or unhandled rejection next to the daemon output. */
  handle('app:reportError', (error: { message?: unknown; stack?: unknown; componentStack?: unknown }) => {
    const message = String(error?.message ?? 'unknown renderer error').slice(0, 2000)
    const stack = typeof error?.stack === 'string' ? error.stack.slice(0, 4000) : ''
    const componentStack = typeof error?.componentStack === 'string' ? error.componentStack.slice(0, 2000) : ''
    console.error(`[olympus] renderer error: ${message}\n${stack}\n${componentStack}`)
  })

  /**
   * Licence state, read-only, for display.
   *
   * Deliberately NOT wired into a gate in front of createWindow(). Olympus is sold as a
   * free unlimited trial, so an unlicensed machine must still get the whole application;
   * blocking the window here would contradict what the site promises and would break every
   * install whose signing secret has not been set yet. Enforcement is a product decision
   * that belongs in a later release, deliberately left off until it is made. The secret
   * and the raw key never cross this boundary — only the summary does.
   */
  handle('license:state', () => licenseSummary())

  handle('workspace:runCommand', () => projectRunCommand())
  handle('preview:discover', () => discoverPreview())

  /**
   * What the app needs to tell the user about its own environment: whether opencode is
   * present and which version it is. Surfaced in the UI so a missing or incompatible
   * opencode is a clear instruction rather than an empty screen or a silent failure.
   */
  handle('app:opencodeStatus', () => {
    const version = detectOpencodeVersion()
    return { version, supported: version ? isSupportedOpencode(version) : false, available: version !== null }
  })

  /** Opens an http(s) URL in the user's browser. Anything else is ignored. */
  handle('shell:openExternal', async (_url: unknown) => {
    const url = String(_url ?? '')
    if (!/^https?:\/\//i.test(url)) throw new Error('Only http(s) links can be opened')
    await shell.openExternal(url)
  })
}

/**
 * opencode's HTTP surface and config schema are moving while the project is in flux, so
 * Olympus states which versions it expects rather than failing confusingly on a later one.
 */
const MIN_OPENCODE = '1.18.0'

function isSupportedOpencode(version: string): boolean {
  const parse = (v: string) => v.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const [a, b, c] = parse(version)
  const [x, y, z] = parse(MIN_OPENCODE)
  if (a !== x) return a > x
  if (b !== y) return b > y
  return c >= z
}

// App/window icon. __dirname is dist-electron at runtime, so the icons live one level up.
const ICON_DIR = path.join(__dirname, '..', 'build')
const APP_ICON = path.join(ICON_DIR, process.platform === 'win32' ? 'icon.ico' : 'icon.png')

let closeApproved = false
let closePending = false

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1560,
    height: 940,
    minWidth: 1100,
    minHeight: 640,
    title: 'Olympus',
    icon: APP_ICON,
    backgroundColor: '#0f1115',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())
  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // A window close is held back until the renderer has flushed whatever it had open, so
  // closing the app can never silently discard an unsaved buffer.
  const window = mainWindow
  window.on('close', (event) => {
    if (closeApproved) return
    event.preventDefault()
    if (closePending) return
    closePending = true
    window.webContents.send('app:beforeClose')
  })

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
}

// Never let the renderer navigate away, spawn new Electron windows, or gain new device access.
app.on('web-contents-created', (_e, contents) => {
  lockDownPermissions(contents.session)

  contents.on('will-navigate', (event, url) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL
    if (!devUrl || !url.startsWith(devUrl)) event.preventDefault()
  })
  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  // A renderer that tries to attach a <webview> is not something this app does; refuse it
  // outright rather than letting a future iframe/webview become a new privilege boundary.
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.on('will-frame-navigate', (event) => {
    const devUrl = process.env.VITE_DEV_SERVER_URL
    if (!devUrl || !event.url.startsWith(devUrl)) event.preventDefault()
  })
})

// ---------- graceful teardown ----------
let quitting = false
async function shutdown() {
  if (quitting) return
  quitting = true
  projects.stopWatching()
  await pool.stopAll()
  app.exit(0)
}

app.on('before-quit', (event) => {
  if (quitting) return
  event.preventDefault()
  void shutdown()
})
app.on('window-all-closed', () => void shutdown())
process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
process.on('exit', () => pool.killAllNow())

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow?.isMinimized()) mainWindow.restore()
    mainWindow?.focus()
  })
  void app.whenReady().then(() => {
    // Ensures Windows uses our icon (not electron.exe's) for the taskbar button.
    if (process.platform === 'win32') app.setAppUserModelId('com.olympus.app')
    registerIpc()
    projects.watchRoots(notifyProjects)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}
