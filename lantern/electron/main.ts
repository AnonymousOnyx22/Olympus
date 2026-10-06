import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import * as cliBridge from './cliBridge'
import { buildOpencodeConfig, basicAuthHeader, detectOpencodeVersion, probeInstalledProviders } from './daemonManager'
import * as pool from './spacePool'
import { sameDirectory, sessionsInDirectory } from './sessionScope'
import { discoverProviders, fetchDaemonProviders, mergeProviders, isChatModel, modelAccess, slugifyProviderId, BUILTIN_ENDPOINTS } from './modelDiscovery'
import { getSettings, updateSettings } from './settings'
import * as projects from './projects'
import * as connections from './connections'
import * as browserSignIn from './browserSignIn'
import { gitStatus, gitAction } from './git'
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
  if (channel === 'oc:event') {
    const event = args[1] as { type?: string; properties?: { info?: { directory?: unknown } } }
    if (event?.type?.startsWith('session.') && event.properties?.info?.directory && !sameDirectory(event.properties.info.directory, pool.state(String(args[0])).cwd)) return
  }
  if (process.env.OLYMPUS_DEBUG_IPC) console.log('[ipc]', channel, ...args)
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args)
}

/**
 * Rejects IPC from anything other than our own top-level window. Every handler below proxies
 * privileged work (filesystem, git, process spawning, a local agent), so a stray frame must
 * never be able to reach them.
 */
function assertTrustedSender(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('No window to serve this request')
  if (event.sender !== mainWindow.webContents) throw new Error('IPC rejected: untrusted sender')
  if (event.senderFrame && event.senderFrame.parent !== null) throw new Error('IPC rejected: untrusted frame')
}

/**
 * Wraps an IPC handler so it can only ever run for a trusted top-level frame.
 *
 * The event is passed straight through as the first argument, exactly as `ipcMain.handle`
 * would have supplied it. Every handler below was written with a leading event parameter
 * (`(_e, id) => ...`), so stripping it here would shift every handler's arguments by one
 * and silently pass `undefined` where a path or an id was expected.
 */
function handle<T extends unknown[]>(channel: string, fn: (event: Electron.IpcMainInvokeEvent, ...args: T) => unknown) {
  ipcMain.handle(channel, async (event, ...args: unknown[]) => {
    assertTrustedSender(event)
    return fn(event, ...(args as T))
  })
}

/** The `ipcMain.on` sibling of `handle()`, for fire-and-forget channels that have no response. */
function onTrusted<T extends unknown[]>(channel: string, fn: (event: Electron.IpcMainEvent, ...args: T) => void) {
  ipcMain.on(channel, (event, ...args: unknown[]) => {
    try {
      assertTrustedSender(event)
    } catch {
      return
    }
    fn(event, ...(args as T))
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

/** Adds Claude Code and Codex, which run through their own CLI logins, to a discovery result. */
const withCli = async (found: Promise<LocalProvider[]>): Promise<LocalProvider[]> => [...(await found), ...cliBridge.cliProviders()]

/** Local port probe plus, if the daemon is up, the providers it knows (incl. opencode CLI setup). */
async function listAllProviders(spaceId: string): Promise<LocalProvider[]> {
  const base = pool.baseUrl(spaceId)
  if (base) {
    const creds = pool.credentials(spaceId)
    // Independent of each other - one probes local ports, the other asks the daemon over
    // HTTP - so run them concurrently rather than paying both timeouts back to back.
    const [local, fromDaemon] = await Promise.all([
      withCli(discoverProviders(getSettings().customEndpoints)),
      fetchDaemonProviders(base, creds ? basicAuthHeader(creds) : undefined),
    ])
    return mergeProviders(fromDaemon, local)
  }
  const local = await withCli(discoverProviders(getSettings().customEndpoints))
  // No project daemon yet - spin up a throwaway one so models configured via the
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
 * the same directory and permission mode are left alone - this is what lets you switch
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
  const local = await withCli(discoverProviders(settings.customEndpoints))
  const online = local.filter((p) => p.online)
  send(
    'daemon:log',
    spaceId,
    online.length
      ? `[olympus] local model servers: ${online.map((p) => `${p.name} (${p.models.length})`).join(', ')}`
      : '[olympus] no local model servers found - will still load models configured via the opencode CLI.',
  )
  // Every saved connection is available to every project automatically - nothing to opt into
  // per store, just somewhere to check what's there (Station's "Connections" button).
  const allConnectionIds = connections.CONNECTION_PROVIDERS.map((p) => p.id)
  const connectionEnv = { ...connections.envForConnections(allConnectionIds), ...browserSignIn.sessionEnv(allConnectionIds) }
  const state = await pool.start(spaceId, resolved, buildOpencodeConfig(local, settings.selectedModel, settings.permissionMode), connectionEnv)
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
function readProjectFile(spaceId: string, requested: string): string | null {
  const root = pool.state(spaceId).cwd
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

/** Preview a small generated raster image from this project's own files. */
function readProjectImage(spaceId: string, requested: string): string | null {
  const root = pool.state(spaceId).cwd
  if (!root || typeof requested !== 'string') return null
  const mime: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif' }
  try {
    const realRoot = fs.realpathSync(root)
    const realTarget = fs.realpathSync(path.resolve(root, requested))
    const rel = path.relative(realRoot, realTarget)
    const type = mime[path.extname(realTarget).toLowerCase()]
    if (!type || rel.startsWith('..') || path.isAbsolute(rel)) return null
    const stat = fs.statSync(realTarget)
    if (!stat.isFile() || stat.size > 2 * 1024 * 1024) return null
    return `data:${type};base64,${fs.readFileSync(realTarget).toString('base64')}`
  } catch { return null }
}

/** Lists ordinary files without walking generated/vendor folders or following symlinks. */
function listProjectFiles(spaceId: string): string[] {
  const root = pool.state(spaceId).cwd
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
function writeProjectFile(spaceId: string, requested: string, content: string): boolean {
  const root = pool.state(spaceId).cwd
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
function projectRunCommand(spaceId = focusedSpaceId): string | null {
  const root = pool.state(spaceId).cwd
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
async function discoverPreview(): Promise<string[]> {
  let olympusDevPort = -1
  try {
    olympusDevPort = Number(new URL(process.env.VITE_DEV_SERVER_URL ?? '').port)
  } catch {
    // Packaged builds do not have a Vite development URL.
  }
  const ports = [5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180, 3000, 3001, 4173, 4321, 8080, 8000, 4200]
  const results = await Promise.all(
    ports
      .filter((candidate) => candidate !== olympusDevPort)
      .map(async (port) => {
        const url = `http://127.0.0.1:${port}`
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(450) })
          await response.body?.cancel()
          return response.ok ? url : null
        } catch {
          return null
        }
      }),
  )
  // An open port cannot establish project ownership. Let the user choose, then remember it
  // per project instead of silently showing another project's server (or a 404).
  return results.filter((url): url is string => url !== null)
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
  handle('space:setPinned', (_e, spaceIds: unknown) => {
    if (!Array.isArray(spaceIds)) throw new Error('Expected a list of spaces')
    pool.setPinned(spaceIds.filter((id): id is string => typeof id === 'string').map(normSpaceId))
  })
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
  handle('connections:list', () => connections.listConnectionStatus())
  handle('connections:set', (_e, providerId: unknown, values: unknown) => {
    if (typeof providerId !== 'string' || !values || typeof values !== 'object') throw new Error('Invalid connection values')
    const entries = Object.entries(values as Record<string, unknown>).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    connections.setConnectionValues(providerId, Object.fromEntries(entries))
    // Test it right away so the owner sees a real answer, not "saved".
    return connections.verifyConnection(providerId)
  })
  handle('connections:verify', (_e, providerId: unknown) => connections.verifyConnection(String(providerId)))
  handle('connections:clear', (_e, providerId: unknown) => connections.clearConnection(String(providerId)))
  handle('connections:openSignIn', async (_e, providerId: unknown) => {
    await browserSignIn.openSignIn(String(providerId))
    return connections.listConnectionStatus()
  })
  handle('connections:forgetSignIn', (_e, providerId: unknown) => {
    browserSignIn.forgetSession(String(providerId))
    return connections.listConnectionStatus()
  })
  // Signs in to a model provider with an account login (ChatGPT Plus/Pro, GitHub Copilot) instead of an API key.
  // The agent engine runs the real OAuth flow and keeps the login in its own auth store, shared by every agent.
  const MODEL_SIGN_IN: Record<string, string[]> = { openai: ['auth.openai.com'], 'github-copilot': ['github.com'] }
  handle('models:signIn', async (_e, providerId: unknown, spaceId: unknown) => {
    const id = String(providerId)
    const hosts = MODEL_SIGN_IN[id]
    if (!hosts) throw new Error('That provider has no account sign-in.')
    const space = typeof spaceId === 'string' && pool.isOpen(spaceId) ? spaceId : pool.openSpaceIds()[0]
    const base = space ? pool.baseUrl(space) : null
    const creds = space ? pool.credentials(space) : null
    if (!space || !base) throw new Error('Open any project or store first so an agent engine is running, then try again.')
    const headers = { 'content-type': 'application/json', ...(creds ? { authorization: basicAuthHeader(creds) } : {}) }
    const methodsRes = await fetch(`${base}/provider/auth`, { headers, signal: AbortSignal.timeout(15_000) })
    const methods = ((await methodsRes.json()) as Record<string, { type: string; label: string }[]>)[id] ?? []
    const preferred = methods.findIndex((m) => m.type === 'oauth' && /browser/i.test(m.label))
    const method = preferred >= 0 ? preferred : methods.findIndex((m) => m.type === 'oauth')
    if (method < 0) throw new Error('This version of the agent engine has no account sign-in for that provider.')
    const authRes = await fetch(`${base}/provider/${id}/oauth/authorize`, { method: 'POST', headers, body: JSON.stringify({ method }), signal: AbortSignal.timeout(30_000) })
    if (!authRes.ok) throw new Error(`The sign-in could not start (${authRes.status}).`)
    const auth = (await authRes.json()) as { url?: string; method?: string; instructions?: string }
    const target = new URL(String(auth.url))
    if (target.protocol !== 'https:' || !hosts.some((host) => target.hostname === host || target.hostname.endsWith(`.${host}`))) throw new Error('The sign-in address was not what was expected, so it was not opened.')
    await shell.openExternal(target.href)
    // The engine holds this request open until the browser step finishes, which can take minutes.
    void fetch(`${base}/provider/${id}/oauth/callback`, { method: 'POST', headers, body: JSON.stringify({ method }), signal: AbortSignal.timeout(10 * 60_000) })
      .then(async (res) => send('models:signedIn', id, res.ok, res.ok ? '' : `The sign-in did not finish (${res.status}).`))
      .catch((error: Error) => send('models:signedIn', id, false, `The sign-in did not finish: ${error.message}`))
    return { instructions: auth.instructions ?? 'Finish signing in in your browser.' }
  })
  handle('stores:list', () => projects.listStores())
  handle('stores:create', (_e, root: unknown, name: unknown, displayName: unknown) => projects.createStore(String(root), String(name), typeof displayName === 'string' ? displayName : undefined))
  handle('stores:remove', async (_e, id: unknown, deleteFiles: unknown) => {
    const storeId = String(id)
    await pool.stop(storeId).catch(() => {})
    return projects.removeStore(storeId, deleteFiles === true)
  })
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

  handle('oc:request', async (_e, spaceId: unknown, method: unknown, reqPath: unknown, body: unknown) => {
    if (typeof method !== 'string' || typeof reqPath !== 'string') throw new Error('invalid request')
    const id = normSpaceId(spaceId)
    const root = pool.state(id).cwd
    const sessionRoute = /^\/session\/([^/]+)(?:\/|$)/.exec(reqPath)
    // OpenCode can return shared history for unrelated folders. Never select or mutate
    // another folder's session just because its ID was restored from an older UI state.
    if (sessionRoute && sessionRoute[1] !== 'status') {
      const listed = await pool.request(id, 'GET', '/session')
      if (!listed.ok || !sessionsInDirectory(listed.data, root).some(session => session.id === decodeURIComponent(sessionRoute[1]))) {
        return { ok: false, status: 403, data: null, error: 'This conversation belongs to another project or is no longer available.' }
      }
    }
    const result = await pool.request(id, method.toUpperCase(), reqPath, body)
    if (method.toUpperCase() === 'GET' && reqPath === '/session' && result.ok) {
      return { ...result, data: sessionsInDirectory(result.data, root) }
    }
    return result
  })

  // The terminal only ever shows the focused space's shell.
  handle('pty:connect', (_e, id: unknown) => {
    const b = pool.bridge(focusedSpaceId)
    if (!b) throw new Error('opencode daemon is not running')
    return b.ptyConnect(String(id))
  })
  onTrusted('pty:write', (_e, id: unknown, data: unknown) => {
    if (typeof data === 'string') pool.bridge(focusedSpaceId)?.ptyWrite(String(id), data)
  })
  handle('pty:disconnect', (_e, id: unknown) => pool.bridge(focusedSpaceId)?.ptyDisconnect(String(id)))

  handle('editor:confirmSwitch', async (_e, file: unknown) => {
    const options = { type: 'question' as const, buttons: ['Save changes', 'Discard changes', 'Cancel'], defaultId: 0, cancelId: 2, message: 'Save changes before switching projects?', detail: String(file) }
    const result = mainWindow ? await dialog.showMessageBox(mainWindow, options) : await dialog.showMessageBox(options)
    return ['save', 'discard', 'cancel'][result.response]
  })
  handle('fs:readProjectFile', (_e, id: unknown, p: unknown) => readProjectFile(String(id), String(p)))
  handle('fs:readProjectImage', (_e, id: unknown, p: unknown) => readProjectImage(String(id), String(p)))
  handle('fs:listProjectFiles', (_e, id: unknown) => listProjectFiles(String(id)))
  handle('fs:writeProjectFile', (_e, id: unknown, p: unknown, content: unknown) => {
    if (typeof p !== 'string' || typeof content !== 'string') return false
    return writeProjectFile(String(id), p, content)
  })
  onTrusted('app:closeReady', (_e, ok: unknown) => {
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
  handle('app:reportError', (_event, error: { message?: unknown; stack?: unknown; componentStack?: unknown }) => {
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
   * and the raw key never cross this boundary - only the summary does.
   */
  handle('license:state', () => ({ product: 'Olympus', model: 'Beta ? no public release', valid: true, trial: false, expired: false, daysLeft: 0, email: null }))

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
  handle('shell:openExternal', async (_e, _url: unknown) => {
    const url = new URL(String(_url ?? ''))
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only http(s) links can be opened')
    await shell.openExternal(url.href)
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
    width: 1360,
    height: 860,
    minWidth: 940,
    minHeight: 600,
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

  if (browserSignIn.isSignInSession(contents.session)) {
    // A real sign-in window: it must be free to navigate the provider's own site (and any
    // OAuth popups it opens), but still gets no camera/mic/etc access from lockDownPermissions
    // above.
    contents.setWindowOpenHandler(() => ({ action: 'allow' }))
    return
  }

  contents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (!isMainFrame && code !== -3) send('preview:error', url, description)
  })
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
    const url = new URL(event.url)
    const localPreview = !event.isMainFrame && ['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost'].includes(url.hostname)
    const localDev = devUrl && url.origin === new URL(devUrl).origin
    if (!localPreview && !localDev) event.preventDefault()
  })
})

// ---------- graceful teardown ----------
let quitting = false
async function shutdown() {
  cliBridge.stopCliBridge()
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
    void cliBridge.startCliBridge()
    registerIpc()
    projects.watchRoots(notifyProjects)
    createWindow()
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })
}
