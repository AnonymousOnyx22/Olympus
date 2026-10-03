import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { OlympusSettings, LocalEndpoint, ModelRef, PermissionMode, ProjectMeta, ProjectRef } from '../src/types/opencode'

const DEFAULTS: OlympusSettings = {
  lastProject: null,
  selectedModel: null,
  customEndpoints: [],
  projects: [],
  stores: [],
  projectRoots: [],
  hiddenProjects: [],
  projectMeta: {},
  lastSpace: null,
  permissionMode: 'ask',
  selectedVariants: {},
}

/**
 * Bumped whenever the on-disk shape changes, so `migrateSettings` knows which steps to run.
 * Version 0 means "no version field", i.e. every settings file written before this existed.
 */
export const SETTINGS_SCHEMA_VERSION = 2

/**
 * Ordered, additive migrations: step N takes the object at version N and returns it at N+1.
 * Never renumber or edit a step that has shipped - append a new one instead, or users who
 * already ran the old build lose their project list.
 */
const MIGRATIONS: ((raw: Record<string, unknown>) => Record<string, unknown>)[] = [
  // 0 -> 1: adopt an explicit schema version so future steps know where they start.
  (raw) => raw,
  // 1 -> 2: Station stores have their own registry, separate from projects.
  (raw) => ({ ...raw, stores: Array.isArray(raw.stores) ? raw.stores : [] }),
]

export function migrateSettings(raw: Record<string, unknown>): Record<string, unknown> {
  const from = typeof raw.schemaVersion === 'number' ? (raw.schemaVersion as number) : 0
  if (from >= SETTINGS_SCHEMA_VERSION) return raw
  let current = raw
  for (let version = from; version < SETTINGS_SCHEMA_VERSION; version += 1) {
    const step = MIGRATIONS[version]
    if (!step) break
    current = step(current)
  }
  return { ...current, schemaVersion: SETTINGS_SCHEMA_VERSION }
}

function project(value: unknown): ProjectRef | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ProjectRef>
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || typeof candidate.path !== 'string') {
    return null
  }
  return { id: candidate.id, name: candidate.name, path: candidate.path }
}

function projectMeta(value: unknown): Record<string, ProjectMeta> {
  if (!value || typeof value !== 'object') return {}
  const out: Record<string, ProjectMeta> = {}
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== 'object') continue
    const m = raw as Partial<ProjectMeta>
    const meta: ProjectMeta = {}
    if (m.pinned === true) meta.pinned = true
    if (typeof m.lastOpened === 'number') meta.lastOpened = m.lastOpened
    if (typeof m.firstSeen === 'number') meta.firstSeen = m.firstSeen
    out[id] = meta
  }
  return out
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item.length > 0))] : []

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json')

let cache: OlympusSettings | null = null

function modelRef(value: unknown): ModelRef | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<ModelRef>
  return typeof candidate.providerID === 'string' && typeof candidate.modelID === 'string'
    ? { providerID: candidate.providerID, modelID: candidate.modelID }
    : null
}

function endpoint(value: unknown): LocalEndpoint | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Partial<LocalEndpoint>
  if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || typeof candidate.baseURL !== 'string') {
    return null
  }
  return { id: candidate.id, name: candidate.name, baseURL: candidate.baseURL, custom: true }
}

function normalize(value: unknown): OlympusSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULTS }
  const raw = value as Partial<OlympusSettings>
  const selectedVariants = raw.selectedVariants && typeof raw.selectedVariants === 'object'
    ? Object.fromEntries(Object.entries(raw.selectedVariants).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {}
  const legacy = raw as Partial<OlympusSettings> & { permissionBypass?: boolean }
  const permissionMode: PermissionMode = raw.permissionMode === 'edit' || raw.permissionMode === 'bypass'
    ? raw.permissionMode
    : legacy.permissionBypass === true ? 'bypass' : 'ask'
  return {
    lastProject: typeof raw.lastProject === 'string' ? raw.lastProject : null,
    selectedModel: modelRef(raw.selectedModel),
    customEndpoints: Array.isArray(raw.customEndpoints)
      ? raw.customEndpoints.map(endpoint).filter((item): item is LocalEndpoint => item !== null)
      : [],
    projects: Array.isArray(raw.projects)
      ? raw.projects.map(project).filter((item): item is ProjectRef => item !== null)
      : [],
    stores: Array.isArray(raw.stores)
      ? raw.stores.map(project).filter((item): item is ProjectRef => item !== null)
      : [],
    projectRoots: strings(raw.projectRoots),
    hiddenProjects: strings(raw.hiddenProjects),
    projectMeta: projectMeta(raw.projectMeta),
    lastSpace: typeof raw.lastSpace === 'string' ? raw.lastSpace : null,
    permissionMode,
    selectedVariants,
  }
}

function load(): OlympusSettings {
  if (cache) return cache
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) as Record<string, unknown>
    cache = normalize(migrateSettings(raw))
  } catch (error) {
    // A corrupt settings file used to be silently replaced with defaults, which is
    // indistinguishable from "the app forgot all my projects". Recover from the backup
    // when we can, and quarantine the bad file so a user can still get at it.
    cache = { ...DEFAULTS }
    const recovered = recoverFromBackup()
    if (recovered) {
      try {
        cache = normalize(migrateSettings(recovered))
        console.error('[olympus] settings.json was unreadable; recovered from settings.json.bak')
      } catch {
        cache = { ...DEFAULTS }
      }
    } else if (error instanceof SyntaxError) {
      const stray = `${settingsPath()}.corrupt-${Date.now()}`
      try {
        fs.renameSync(settingsPath(), stray)
        console.error(`[olympus] settings.json was corrupt and has been moved to ${stray}`)
      } catch {
        // Nothing more we can do; the file is still in the app's data directory.
      }
    }
  }
  return cache!
}

/** Returns the last known-good settings, if one is readable. */
function recoverFromBackup(): Record<string, unknown> | null {
  try {
    return JSON.parse(fs.readFileSync(`${settingsPath()}.bak`, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

/**
 * Writes atomically. A crash or power loss mid-write used to leave a truncated settings.json
 * and take every saved project with it. Write a temp file, keep the previous good copy as a
 * backup, then rename over the target - rename is atomic on every platform Olympus ships on.
 */
function persist(settings: OlympusSettings): void {
  const target = settingsPath()
  const temp = `${target}.tmp`
  const body = JSON.stringify({ ...settings, schemaVersion: SETTINGS_SCHEMA_VERSION }, null, 2)
  try {
    fs.mkdirSync(path.dirname(target), { recursive: true })
    if (fs.existsSync(target)) fs.copyFileSync(target, `${target}.bak`)
    fs.writeFileSync(temp, body, 'utf8')
    fs.renameSync(temp, target)
  } catch (error) {
    try {
      fs.rmSync(temp, { force: true })
    } catch {
      // Best-effort cleanup of the temp file.
    }
    console.error('[olympus] failed to save settings:', error)
  }
}

export function getSettings(): OlympusSettings {
  return { ...load() }
}

export function updateSettings(patch: Partial<OlympusSettings>): OlympusSettings {
  cache = normalize({ ...load(), ...patch })
  persist(cache)
  return getSettings()
}
