import fs from 'node:fs'
import path from 'node:path'
import { getSettings, updateSettings } from './settings'
import type { ProjectInfo, ProjectMeta } from '../src/types/opencode'

// Folders inside a watched root that are never projects in their own right.
const SKIPPED_FOLDERS = new Set(['node_modules', '$recycle.bin', 'system volume information'])
const IGNORED_FOR_MTIME = new Set(['.git', 'node_modules', 'dist', 'build', 'out', '.next', 'target', '.venv', '__pycache__'])
const NEW_BADGE_MS = 3 * 24 * 60 * 60 * 1000
const INVALID_NAME = /[<>:"/\\|?*\u0000-\u001f]/
const RESERVED_NAME = /^(con|prn|aux|nul|com\d|lpt\d)(\..*)?$/i

/** Project ids are resolved paths; Windows paths compare case-insensitively. */
export const projectKey = (p: string) => {
  const resolved = path.resolve(p)
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved
}

const isDir = (p: string) => {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function subfolders(root: string): string[] {
  try {
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.') && !SKIPPED_FOLDERS.has(entry.name.toLowerCase()))
      .map((entry) => path.join(root, entry.name))
  } catch {
    return []
  }
}

function readJson(file: string): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/** Cheap, marker-file based stack detection — reads at most package.json. */
function detect(dir: string): Pick<ProjectInfo, 'stack' | 'gitBranch' | 'description' | 'modifiedAt'> {
  let names: string[] = []
  let modifiedAt: number | null = null
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    names = entries.map((entry) => entry.name)
    for (const entry of entries) {
      if (IGNORED_FOR_MTIME.has(entry.name)) continue
      try {
        const mtime = fs.statSync(path.join(dir, entry.name)).mtimeMs
        if (modifiedAt === null || mtime > modifiedAt) modifiedAt = mtime
      } catch {
        // Unreadable entry; skip it.
      }
    }
    if (modifiedAt === null) modifiedAt = fs.statSync(dir).mtimeMs
  } catch {
    return { stack: [], gitBranch: null, description: null, modifiedAt: null }
  }

  const has = (name: string) => names.includes(name)
  const hasExt = (ext: string) => names.some((name) => name.toLowerCase().endsWith(ext))
  const stack: string[] = []
  let description: string | null = null

  if (has('package.json')) {
    const pkg = readJson(path.join(dir, 'package.json'))
    const deps = { ...(pkg?.dependencies as object), ...(pkg?.devDependencies as object) } as Record<string, unknown>
    stack.push(has('tsconfig.json') || 'typescript' in deps ? 'TypeScript' : 'JavaScript')
    const frameworks: [string, string][] = [
      ['next', 'Next.js'], ['electron', 'Electron'], ['react', 'React'], ['vue', 'Vue'],
      ['svelte', 'Svelte'], ['@angular/core', 'Angular'], ['astro', 'Astro'], ['express', 'Express'],
    ]
    for (const [dep, label] of frameworks) {
      if (dep in deps && stack.length < 3) stack.push(label)
    }
    if (typeof pkg?.description === 'string' && pkg.description.trim()) description = pkg.description.trim()
  }
  if (has('Cargo.toml')) stack.push('Rust')
  if (has('go.mod')) stack.push('Go')
  if (has('pyproject.toml') || has('requirements.txt') || has('setup.py') || hasExt('.py')) stack.push('Python')
  if (has('pom.xml') || has('build.gradle') || has('build.gradle.kts')) stack.push('Java')
  if (hasExt('.csproj') || hasExt('.sln')) stack.push('.NET')
  if (has('Gemfile')) stack.push('Ruby')
  if (has('composer.json')) stack.push('PHP')
  if (has('pubspec.yaml')) stack.push('Flutter')
  if (has('CMakeLists.txt') || has('Makefile')) stack.push('C/C++')
  if (hasExt('.uproject')) stack.push('Unreal')
  if (has('ProjectSettings') && has('Assets')) stack.push('Unity')
  if (!stack.length && has('index.html')) stack.push('HTML')

  let gitBranch: string | null = null
  if (has('.git')) {
    try {
      const head = fs.readFileSync(path.join(dir, '.git', 'HEAD'), 'utf8').trim()
      gitBranch = head.startsWith('ref: refs/heads/') ? head.slice('ref: refs/heads/'.length) : head.slice(0, 7)
    } catch {
      gitBranch = 'git' // worktrees/submodules use a .git file; still a repo.
    }
  }

  return { stack: [...new Set(stack)].slice(0, 4), gitBranch, description, modifiedAt }
}

/** Merges manual projects with every subfolder of each watched root. */
export function listProjects(): ProjectInfo[] {
  const settings = getSettings()
  const hidden = new Set(settings.hiddenProjects.map(projectKey))
  const byKey = new Map<string, { path: string; source: ProjectInfo['source']; root: string | null; name: string }>()

  for (const root of settings.projectRoots) {
    for (const dir of subfolders(root)) {
      byKey.set(projectKey(dir), { path: dir, source: 'watched', root, name: path.basename(dir) })
    }
  }
  // A manually added folder keeps its manual status even if it also sits in a watched root.
  for (const proj of settings.projects) {
    const key = projectKey(proj.path)
    const existing = byKey.get(key)
    byKey.set(key, { path: proj.path, source: 'manual', root: existing?.root ?? null, name: proj.name })
  }

  // Record first sighting of newly detected folders so they can get a "New" badge, and
  // forget folders that are no longer part of the picture. Without the prune, pointing the
  // app at a broad folder once left a firstSeen entry behind for every subfolder forever.
  const now = Date.now()
  const meta: Record<string, ProjectMeta> = {}
  let metaChanged = false
  for (const key of byKey.keys()) {
    const previous = settings.projectMeta[key]
    if (!previous?.firstSeen) {
      // Only folders that appear in a watched root later count as "new"; 1 = known from the start.
      const fresh = byKey.get(key)!.source === 'watched' && !seededRoots.has(key)
      meta[key] = { ...previous, firstSeen: fresh ? now : 1 }
      metaChanged = true
    } else {
      meta[key] = previous
    }
  }
  // Keep metadata for manual and hidden projects even when they are outside a watched root.
  for (const key of [...settings.projects.map((p) => projectKey(p.path)), ...settings.hiddenProjects.map(projectKey)]) {
    if (meta[key] || !settings.projectMeta[key]) continue
    meta[key] = settings.projectMeta[key]
    metaChanged = true
  }
  if (Object.keys(meta).length !== Object.keys(settings.projectMeta).length) metaChanged = true
  if (metaChanged) updateSettings({ projectMeta: meta })
  seededRoots.clear()

  return [...byKey.entries()].map(([key, item]) => {
    const exists = isDir(item.path)
    const m = meta[key] ?? {}
    return {
      id: item.source === 'manual' ? settings.projects.find((p) => projectKey(p.path) === key)!.id : key,
      name: item.name,
      path: item.path,
      source: item.source,
      root: item.root,
      exists,
      pinned: m.pinned === true,
      hidden: hidden.has(key),
      lastOpened: m.lastOpened ?? null,
      firstSeen: !m.lastOpened && m.firstSeen && m.firstSeen > 1 && now - m.firstSeen < NEW_BADGE_MS ? m.firstSeen : null,
      ...(exists ? detect(item.path) : { stack: [], gitBranch: null, description: null, modifiedAt: null }),
    }
  })
}

/** Keys of folders that existed when their root was added (not flagged as new). */
const seededRoots = new Set<string>()

/**
 * Resolves one project without scanning anything.
 *
 * This used to call `listProjects()`, which walks every folder under every watched root and
 * runs filesystem detection on each one — so asking "what is this project's path?" (which
 * `git:status` does on every refresh) cost a full rescan, and could even write to settings
 * as a side effect. A project is either one you added by hand, or a direct child of a watched
 * root, so both cases are answerable from settings alone.
 */
export function findProject(id: string): ProjectInfo | undefined {
  const key = projectKey(id)
  const settings = getSettings()
  const target = path.resolve(id)

  const manual = settings.projects.find((p) => p.id === id || projectKey(p.path) === key)
  if (manual) return describeProject(manual.id, manual.name, manual.path, 'manual', null, settings)

  const root = settings.projectRoots.find((candidate) => projectKey(path.dirname(target)) === projectKey(candidate))
  if (root) return describeProject(key, path.basename(target) || target, target, 'watched', root, settings)

  return undefined
}

/** The subset of a project's fields that lookups need, without any filesystem detection. */
function describeProject(
  id: string,
  name: string,
  projectPath: string,
  source: ProjectInfo['source'],
  root: string | null,
  settings: ReturnType<typeof getSettings>,
): ProjectInfo {
  const key = projectKey(projectPath)
  const meta = settings.projectMeta[key] ?? {}
  return {
    id,
    name,
    path: projectPath,
    source,
    root,
    exists: isDir(projectPath),
    hidden: settings.hiddenProjects.some((p) => projectKey(p) === key),
    pinned: meta.pinned === true,
    lastOpened: meta.lastOpened ?? null,
    firstSeen: null,
    stack: [],
    gitBranch: null,
    description: null,
    modifiedAt: null,
  }
}

export function addProject(dir: string): ProjectInfo[] {
  const target = path.resolve(dir)
  if (!isDir(target)) throw new Error('Not a folder')
  const settings = getSettings()
  const key = projectKey(target)
  const patch: Partial<typeof settings> = {
    hiddenProjects: settings.hiddenProjects.filter((p) => projectKey(p) !== key),
  }
  if (!settings.projects.some((p) => projectKey(p.path) === key)) {
    patch.projects = [...settings.projects, { id: target, name: path.basename(target) || target, path: target }]
  }
  updateSettings(patch)
  return listProjects()
}

export function removeProject(id: string): ProjectInfo[] {
  const proj = findProject(id)
  if (!proj) return listProjects()
  const settings = getSettings()
  const key = projectKey(proj.path)
  const projects = settings.projects.filter((p) => projectKey(p.path) !== key)
  // Still inside a watched root → it would come straight back, so hide it instead.
  const insideRoot = settings.projectRoots.some((root) => projectKey(path.dirname(proj.path)) === projectKey(root))
  const hiddenProjects = insideRoot && !settings.hiddenProjects.some((p) => projectKey(p) === key)
    ? [...settings.hiddenProjects, proj.path]
    : settings.hiddenProjects
  updateSettings({ projects, hiddenProjects })
  return listProjects()
}

export function unhideProject(id: string): ProjectInfo[] {
  const key = projectKey(id)
  const settings = getSettings()
  updateSettings({ hiddenProjects: settings.hiddenProjects.filter((p) => projectKey(p) !== key) })
  return listProjects()
}

function patchMeta(id: string, patch: Partial<ProjectMeta>) {
  const proj = findProject(id)
  if (!proj) return
  const key = projectKey(proj.path)
  const settings = getSettings()
  updateSettings({ projectMeta: { ...settings.projectMeta, [key]: { ...settings.projectMeta[key], ...patch } } })
}

export function pinProject(id: string, pinned: boolean): ProjectInfo[] {
  patchMeta(id, { pinned })
  return listProjects()
}

export function markOpened(id: string) {
  patchMeta(id, { lastOpened: Date.now() })
}

export function createProject(root: string, rawName: string): { id: string; projects: ProjectInfo[] } {
  const name = String(rawName ?? '').trim()
  if (!name || name === '.' || name === '..' || name.length > 120 || INVALID_NAME.test(name) || RESERVED_NAME.test(name) || /[. ]$/.test(name)) {
    throw new Error('Use a simple folder name without \\ / : * ? " < > |')
  }
  const known = getSettings().projectRoots.find((r) => projectKey(r) === projectKey(root))
  if (!known) throw new Error('Pick one of your watched project folders')
  const target = path.join(known, name)
  if (fs.existsSync(target)) throw new Error(`"${name}" already exists in that folder`)
  fs.mkdirSync(target)
  const key = projectKey(target)
  const settings = getSettings()
  updateSettings({ projectMeta: { ...settings.projectMeta, [key]: { firstSeen: Date.now() } } })
  return { id: key, projects: listProjects() }
}

export function addRoot(dir: string): string[] {
  const target = path.resolve(dir)
  if (!isDir(target)) throw new Error('Not a folder')
  const settings = getSettings()
  if (settings.projectRoots.some((r) => projectKey(r) === projectKey(target))) return settings.projectRoots
  for (const sub of subfolders(target)) seededRoots.add(projectKey(sub))
  return updateSettings({ projectRoots: [...settings.projectRoots, target] }).projectRoots
}

export function removeRoot(dir: string): string[] {
  const settings = getSettings()
  return updateSettings({ projectRoots: settings.projectRoots.filter((r) => projectKey(r) !== projectKey(dir)) }).projectRoots
}

// ---- live detection ---------------------------------------------------------

const watchers = new Map<string, fs.FSWatcher>()
let debounce: NodeJS.Timeout | null = null
let lastSignature = ''

const signature = (list: ProjectInfo[]) => list.map((p) => `${p.id}|${p.exists}|${p.hidden}`).sort().join('\n')

/** Watches each root (non-recursively) and reports when project folders appear or vanish. */
export function watchRoots(onChange: (projects: ProjectInfo[]) => void) {
  const roots = getSettings().projectRoots
  const wanted = new Set(roots.map(projectKey))
  for (const [key, watcher] of watchers) {
    if (!wanted.has(key)) {
      watcher.close()
      watchers.delete(key)
    }
  }
  const schedule = () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      const list = listProjects()
      const sig = signature(list)
      if (sig === lastSignature) return
      lastSignature = sig
      onChange(list)
    }, 400)
  }
  for (const root of roots) {
    const key = projectKey(root)
    if (watchers.has(key) || !isDir(root)) continue
    try {
      const watcher = fs.watch(root, { persistent: false }, (eventType) => {
        // Content edits inside a subfolder don't fire here (non-recursive); renames do.
        if (eventType === 'rename') schedule()
      })
      watcher.on('error', () => {
        watcher.close()
        watchers.delete(key)
        schedule()
      })
      watchers.set(key, watcher)
    } catch {
      // Root unreadable right now; the next watchRoots call retries.
    }
  }
  lastSignature = signature(listProjects())
}

export function stopWatching() {
  for (const watcher of watchers.values()) watcher.close()
  watchers.clear()
  if (debounce) clearTimeout(debounce)
}
