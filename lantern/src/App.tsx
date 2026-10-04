import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import Sidebar from './components/Sidebar'
import OlympusBoot from './components/OlympusBoot'
import AllAgentsGrid, { type AgentGridEntry } from './components/AllAgentsGrid'
import { agentDisplayTitle } from './components/AgentWorkspace'
import DiffViewer from './components/DiffViewer'
import EditorWorkspace from './components/EditorWorkspace'
import PreviewPanel from './components/PreviewPanel'
import ContextPanel from './components/ContextPanel'
import ProjectPicker, { pickerSpaces } from './components/ProjectPicker'
import ProjectsPage from './components/ProjectsPage'
import ConnectionsSettings from './components/ConnectionsSettings'
import TerminalPanel from './components/TerminalPanel'
import WorkspaceBar, { type WorkspaceView } from './components/WorkspaceBar'
import StationView, { type StationTarget } from './components/StationView'
import { buildStationCheckBrief } from './services/stationBrief'
import { api } from './services/api'
import { useSessionStream } from './services/streamHandler'
import { GENERAL_SPACE } from './constants'
import type { DaemonState, LocalProvider, ModelRef, PermissionMode, ProjectInfo, Session, Skill } from './types/opencode'

const STOPPED: DaemonState = { status: 'stopped', port: null, cwd: null }
/** Automatic restarts for a project whose daemon keeps failing, before waiting for the user. */
const MAX_START_RETRIES = 3
/**
 * How often a managed store gets another management pass while Olympus is open and the store
 * is idle. The point of turning management on is that the store is watched continuously, not
 * polled once a day, so this stays short - a managed store with nothing new to do just gets a
 * quick "still fine" pass and goes back to idle.
 */
const MANAGEMENT_CHECK_INTERVAL_MS = 5 * 60 * 1000

const providersKey = (providers: LocalProvider[]) =>
  JSON.stringify(providers.filter((p) => p.online).map((p) => [p.id, p.baseURL, p.models, p.variants, p.access]))

/** Compares two busy maps so reconciliation can skip a no-op state update. */
function shallowEqualBusy(a: Record<string, boolean> | undefined, b: Record<string, boolean>): boolean {
  if (!a) return Object.keys(b).length === 0
  const keys = Object.keys(a)
  if (keys.length !== Object.keys(b).length) return false
  return keys.every((key) => a[key] === b[key])
}

const modelKey = (model: ModelRef) => `${model.providerID}/${model.modelID}`

function pickModel(providers: LocalProvider[], preferred: ModelRef | null): ModelRef | null {
  const online = providers.filter((p) => p.online && p.models.length > 0)
  if (preferred && online.some((p) => p.id === preferred.providerID && p.models.includes(preferred.modelID))) return preferred
  return online[0] ? { providerID: online[0].id, modelID: online[0].models[0] } : null
}

const topLevelByRecent = (sessions: Session[]) =>
  sessions.filter((s) => !s.parentID).sort((a, b) => b.time.updated - a.time.updated)

export default function App() {
  // Every open space (General chats + each project you've visited) keeps its own entry
  // here, because each one runs its own opencode daemon and can be working concurrently.
  const [daemonBySpace, setDaemonBySpace] = useState<Record<string, DaemonState>>({})
  const [sessionsBySpace, setSessionsBySpace] = useState<Record<string, Session[]>>({})
  const [activeSessionIdBySpace, setActiveSessionIdBySpace] = useState<Record<string, string | null>>({})
  const [busySessionsBySpace, setBusySessionsBySpace] = useState<Record<string, Record<string, boolean>>>({})
  const busyBySpace = useMemo(() => Object.fromEntries(Object.entries(busySessionsBySpace).map(([id, sessions]) => [id, Object.values(sessions).some(Boolean)])), [busySessionsBySpace])

  const setSpaceSessionBusy = (id: string, sessionID: string, value: boolean) =>
    setBusySessionsBySpace((prev) => ({ ...prev, [id]: { ...prev[id], [sessionID]: value } }))

  /**
   * Replaces a space's busy map with what the daemon actually reports.
   *
   * Busy state used to be an ever-growing map of booleans set from events and never
   * pruned. Because a space counts as busy if *any* key is true, one missed `session.idle`
   * (a daemon crash, a dropped event stream, a synthetic key nothing will ever clear) left
   * that space permanently busy: the composer locked and the queue never drained again.
   * Re-reading `/session/status` makes the daemon the single source of truth and drops keys
   * for sessions that no longer exist.
   */
  const reconcileBusy = useCallback(async (id: string) => {
    try {
      const status = await api.sessionStatus(id)
      setBusySessionsBySpace((prev) => {
        const next: Record<string, boolean> = {}
        for (const [sessionID, value] of Object.entries(status)) next[sessionID] = value.type !== 'idle'
        if (shallowEqualBusy(prev[id], next)) return prev
        return { ...prev, [id]: next }
      })
    } catch {
      // The daemon is not reachable; its state change will drive the next reconciliation.
    }
  }, [])
  // Which of each project's sessions have an open agent window - the single source of truth
  // for both that project's own view and the cross-project "All agents" grid.
  const [openIdsBySpace, setOpenIdsBySpace] = useState<Record<string, string[]>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('olympus.agentWindows') ?? '{}')
      if (!saved || typeof saved !== 'object') return {}
      return Object.fromEntries(
        Object.entries(saved as Record<string, unknown>).map(([id, ids]) => [
          id,
          Array.isArray(ids) ? [...new Set(ids.filter((item): item is string => typeof item === 'string'))] : [],
        ]),
      )
    } catch { return {} }
  })
  const setSpaceOpenIds = (id: string, ids: string[]) =>
    setOpenIdsBySpace((prev) => {
      const next = { ...prev, [id]: ids }
      try { localStorage.setItem('olympus.agentWindows', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })

  const [windowOrder, setWindowOrder] = useState<string[]>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('olympus.agentWindowOrder') ?? 'null')
      if (Array.isArray(saved)) return saved.filter((key): key is string => typeof key === 'string')
    } catch { /* migrate existing windows */ }
    return Object.entries(openIdsBySpace).flatMap(([id, ids]) => ids.map((sessionId) => JSON.stringify([id, sessionId])))
  })
  useEffect(() => {
    const keys = Object.entries(openIdsBySpace).flatMap(([id, ids]) => ids.map((sessionId) => JSON.stringify([id, sessionId])))
    const next = [...windowOrder.filter((key) => keys.includes(key)), ...keys.filter((key) => !windowOrder.includes(key))]
    if (JSON.stringify(next) !== JSON.stringify(windowOrder)) setWindowOrder(next)
    try { localStorage.setItem('olympus.agentWindowOrder', JSON.stringify(next)) } catch { /* best effort */ }
  }, [openIdsBySpace, windowOrder])

  const [providers, setProviders] = useState<LocalProvider[]>([])
  const [rescanning, setRescanning] = useState(false)
  const [model, setModel] = useState<ModelRef | null>(null)
  const [stationIdsBySpace, setStationIdsBySpace] = useState<Record<string, string[]>>(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem('olympus.stationSessions') ?? '{}')
      if (saved && typeof saved === 'object') return Object.fromEntries(Object.entries(saved).map(([id, ids]) => [id, Array.isArray(ids) ? ids.filter((value): value is string => typeof value === 'string') : []]))
    } catch { /* start with an empty Station */ }
    return {}
  })
  const [stationModels, setStationModels] = useState<Record<string, { model: ModelRef; variant: string | null }>>(() => {
    try { return JSON.parse(localStorage.getItem('olympus.stationModels') ?? '{}') as Record<string, { model: ModelRef; variant: string | null }> }
    catch { return {} }
  })
  const [appError, setAppError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [stores, setStores] = useState<ProjectInfo[]>([])
  const [pausedStoreIds, setPausedStoreIds] = useState<string[]>(() => {
    try { const saved = JSON.parse(localStorage.getItem('olympus.pausedStores') ?? '[]'); return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === 'string') : [] } catch { return [] }
  })
  const [managedStoreChecks, setManagedStoreChecks] = useState<Record<string, number>>(() => {
    try { const saved = JSON.parse(localStorage.getItem('olympus.managedStoreChecks') ?? '{}'); return saved && typeof saved === 'object' ? saved : {} } catch { return {} }
  })
  const checkInFlight = useRef<Set<string>>(new Set())
  const [spaceId, setSpaceId] = useState<string>(GENERAL_SPACE)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('workspace')
  const [screen, setScreen] = useState<'workspace' | 'projects' | 'connections'>('workspace')
  // The picker either adds a window or changes the originating window's folder.
  const [picker, setPicker] = useState<{ purpose: 'agent' | 'pane'; inId: string; sessionId?: string } | null>(null)
  const [contextOpen, setContextOpen] = useState(() => localStorage.getItem('olympus.contextOpen') !== 'false' && window.innerWidth >= 1100)
  const [terminalOpen, setTerminalOpen] = useState(false)
  const [runCommand, setRunCommand] = useState<string | null>(null)
  const [runNonce, setRunNonce] = useState(0)
  const [permissionMode, setPermissionMode] = useState<PermissionMode>('ask')
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({})
  const [skills, setSkills] = useState<Skill[]>([])
  /**
   * Whether this machine can actually run Olympus. A missing `opencode` used to present as an
   * empty model picker with no explanation, which is indistinguishable from "no models found".
   */
  const [envIssue, setEnvIssue] = useState<{ version: string | null; supported: boolean; available: boolean } | null>(null)
  const startedWith = useRef<string>('')
  const booted = useRef(false)
  /** Shows the boot screen until settings, the project list, and the first space have loaded. */
  const [ready, setReady] = useState(false)
  const [bootProgress, setBootProgress] = useState(6)
  const openRequested = useRef(new Set<string>())
  const startFailures = useRef(new Map<string, { count: number; notBefore: number }>())
  const [retryTick, setRetryTick] = useState(0)
  const noteStartFailure = (id: string) => {
    const count = (startFailures.current.get(id)?.count ?? 0) + 1
    const wait = 2000 * 2 ** (count - 1)
    startFailures.current.set(id, { count, notBefore: Date.now() + wait })
    if (count < MAX_START_RETRIES) window.setTimeout(() => setRetryTick((tick) => tick + 1), wait)
  }
  const daemon = daemonBySpace[spaceId] ?? STOPPED
  const activeSessionId = activeSessionIdBySpace[spaceId] ?? null
  const running = daemon.status === 'running'
  const stream = useSessionStream(spaceId, activeSessionId, running)
  const busy = stream.status.type !== 'idle'
  const availableVariants = model
    ? providers.find((provider) => provider.id === model.providerID)?.variants?.[model.modelID] ?? []
    : []
  const savedVariant = model ? selectedVariants[modelKey(model)] : undefined
  const selectedVariant = savedVariant && availableVariants.includes(savedVariant) ? savedVariant : null

  // ---- spaces & daemon lifecycle ----------------------------------------
  // A "space" is either the folder-less General chats area or a saved project. Each one
  // gets its own opencode daemon (see electron/spacePool.ts), so focusing a different
  // space never interrupts whatever another open space's agent is doing.

  const editorSwitchGuard = useRef<(() => Promise<boolean>) | null>(null)
  const switching = useRef(false)
  const startSpace = useCallback(async (id: string, force = false) => {
    if (switching.current) return false
    switching.current = true
    try {
    if (editorSwitchGuard.current && !(await editorSwitchGuard.current())) return false
    setSpaceId(id)
    setScreen('workspace')
    // The Workspace tab spans every open project, so switching focus shouldn't
    // knock you out of it - only the per-project tabs (code/thread/edits) reset.
    setWorkspaceView('workspace')
    setRunCommand(null)
    setRunNonce(0)
    setTerminalOpen(false)
    setAppError(null)
    const result = await window.electronAPI.startSpace(id, force)
    setDaemonBySpace((prev) => ({ ...prev, [id]: result.state }))
    setProviders(result.providers)
    startedWith.current = providersKey(result.providers)
    const settings = await window.electronAPI.getSettings()
    setPermissionMode(result.state.permissionMode ?? settings.permissionMode)
    setSelectedVariants(settings.selectedVariants)
    const chosen = pickModel(result.providers, settings.selectedModel)
    setModel(chosen)
    if (chosen) void window.electronAPI.setSettings({ selectedModel: chosen })
    return true
    } finally { switching.current = false }
  }, [])

  useEffect(() => {
    const offDaemon = window.electronAPI.onDaemonState((id, state) => setDaemonBySpace((prev) => ({ ...prev, [id]: state })))
    const offProjects = window.electronAPI.onProjectsChanged(setProjects)
    // One listener for every open space's events - this is what lets a background
    // project's chat list and busy indicator update while you're focused elsewhere.
    const offEvents = window.electronAPI.onEvent((id, ev) => {
      if (ev.type === 'session.created' || ev.type === 'session.updated') {
        const info = ev.properties.info
        if (info.parentID) return
        setSessionsBySpace((prev) => ({ ...prev, [id]: topLevelByRecent([info, ...(prev[id] ?? []).filter((s) => s.id !== info.id)]) }))
      } else if (ev.type === 'session.deleted') {
        const deletedId = ev.properties.info.id
        setSessionsBySpace((prev) => ({ ...prev, [id]: (prev[id] ?? []).filter((s) => s.id !== deletedId) }))
      } else if (ev.type === 'session.status') {
        const nextBusy = ev.properties.status.type !== 'idle'
        setSpaceSessionBusy(id, ev.properties.sessionID, nextBusy)
      } else if (ev.type === 'session.idle') {
        setSpaceSessionBusy(id, ev.properties.sessionID, false)
      }
    })

    // The event stream dropped and reconnected: whatever we believed about busy state
    // may have missed an event while it was down, so re-read it from the daemon.
    const offResync = window.electronAPI.onResync((id) => void reconcileBusy(id))
    return () => {
      offDaemon()
      offProjects()
      offEvents()
      offResync()
    }
  }, [reconcileBusy])

  useEffect(() => {
    if (booted.current) return
    booted.current = true
    void (async () => {
      setBootProgress(20)
      const [settings, projectList, storeList] = await Promise.all([window.electronAPI.getSettings(), window.electronAPI.listProjects(), window.electronAPI.listStores()])
      setBootProgress(55)
      setProjects(projectList)
      setStores(storeList)
      setPermissionMode(settings.permissionMode)
      setSelectedVariants(settings.selectedVariants)
      // Starting the local agent process is the slowest step (it can take tens of seconds on
      // a cold start) and used to leave the bar sitting dead on 55% the whole time it ran -
      // this checkpoint exists purely so the number itself still moves during that wait.
      setBootProgress(70)
      // Start straight into a space so you can chat immediately (General by default).
      await startSpace(settings.lastSpace ?? GENERAL_SPACE)
      setBootProgress(100)
    })()
      .catch((error) => setAppError(error instanceof Error ? error.message : String(error)))
      .finally(() => setReady(true))
    void api.opencodeStatus().then(setEnvIssue).catch(() => {})
  }, [startSpace])

  // A daemon that just came up (or came back) is the authority on who is busy. Reconciling
  // here also clears a space that was left marked busy by a daemon that died mid-run.
  useEffect(() => {
    for (const [id, state] of Object.entries(daemonBySpace)) {
      if (state.status === 'running') void reconcileBusy(id)
      else if (state.status === 'stopped') {
        setBusySessionsBySpace((prev) => (prev[id] ? { ...prev, [id]: {} } : prev))
      }
    }
  }, [daemonBySpace, reconcileBusy])

  // Spaces with open agent windows are pinned in the main process so the daemon cap never
  // evicts them. Declared before the reopen effect below so the pin lands first.
  useEffect(() => {
    const pinned = [...new Set([...Object.entries(openIdsBySpace), ...Object.entries(stationIdsBySpace)]
      .filter(([id, ids]) => ids.length > 0 && !pausedStoreIds.includes(id))
      .map(([id]) => id))]
    void window.electronAPI.setPinnedSpaces(pinned).catch(() => {})
  }, [openIdsBySpace, stationIdsBySpace, pausedStoreIds])

  // Any project with open agent windows needs its daemon running, even if you've never
  // focused it this session (e.g. windows restored from a previous run) - otherwise its
  // agent panes sit at "Connecting" forever. A daemon that fails to start is retried with a
  // backoff (2s, 4s, 8s) and then left alone, so a broken project cannot spin in a loop;
  // its windows show the error and a Retry button instead.
  useEffect(() => {
    const ids = new Set([...Object.keys(openIdsBySpace), ...Object.keys(stationIdsBySpace)])
    for (const id of ids) {
      if (!(openIdsBySpace[id]?.length || stationIdsBySpace[id]?.length) || (pausedStoreIds.includes(id) && !openIdsBySpace[id]?.length) || openRequested.current.has(id)) continue
      const state = daemonBySpace[id]
      if (state?.status === 'running' || state?.status === 'starting') {
        if (state.status === 'running') startFailures.current.delete(id)
        continue
      }
      const failure = startFailures.current.get(id)
      if (failure && (failure.count >= MAX_START_RETRIES || Date.now() < failure.notBefore)) continue
      openRequested.current.add(id)
      window.electronAPI.openSpace(id)
        .then((result) => {
          if (result.state.status === 'error') noteStartFailure(id)
          setDaemonBySpace((prev) => ({ ...prev, [id]: result.state }))
        })
        .catch((error) => {
          noteStartFailure(id)
          setDaemonBySpace((prev) => ({ ...prev, [id]: { status: 'error', port: null, cwd: prev[id]?.cwd ?? null, error: error instanceof Error ? error.message : String(error) } }))
        })
        .finally(() => openRequested.current.delete(id))
    }
  }, [openIdsBySpace, stationIdsBySpace, daemonBySpace, retryTick, pausedStoreIds])

  /** Clears a space's failure record and starts its daemon again, for the window's Retry button. */
  const retryStart = (id: string) => {
    startFailures.current.delete(id)
    setRetryTick((tick) => tick + 1)
  }

  // Loads (or refreshes) the focused space's chat list.
  useEffect(() => {
    if (!running) return
    let cancelled = false
    api
      .listSessions(spaceId)
      .then((list) => {
        if (cancelled) return
        setSessionsBySpace((prev) => ({ ...prev, [spaceId]: topLevelByRecent(list) }))
      })
      .catch((error) => {
        if (!cancelled) setAppError(error instanceof Error ? error.message : String(error))
      })
    return () => {
      cancelled = true
    }
  }, [spaceId, running])

  // Every other running space (e.g. one the Workspace tab auto-started in the background)
  // also needs its chat list at least once, so agent titles resolve and stale windows
  // (from a previous run) get dropped even if you never focus that project directly.
  const sessionsRequested = useRef(new Set<string>())
  useEffect(() => {
    for (const [id, state] of Object.entries(daemonBySpace)) {
      if (state.status !== 'running' || sessionsBySpace[id] !== undefined || sessionsRequested.current.has(id)) continue
      sessionsRequested.current.add(id)
      api
        .listSessions(id)
        .then((list) => setSessionsBySpace((prev) => (prev[id] !== undefined ? prev : { ...prev, [id]: topLevelByRecent(list) })))
        .catch(() => {})
        .finally(() => sessionsRequested.current.delete(id))
    }
  }, [daemonBySpace, sessionsBySpace])

  useEffect(() => {
    setOpenIdsBySpace((prev) => {
      const next = Object.fromEntries(Object.entries(prev).map(([id, ids]) => [id,
        sessionsBySpace[id] ? ids.filter((sessionId) => sessionsBySpace[id].some((session) => session.id === sessionId)) : ids,
      ]))
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev
      try { localStorage.setItem('olympus.agentWindows', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })
  }, [sessionsBySpace])

  useEffect(() => {
    setStationIdsBySpace((prev) => {
      const next = Object.fromEntries(Object.entries(prev).map(([id, ids]) => [id,
        sessionsBySpace[id] ? ids.filter((sessionId) => sessionsBySpace[id].some((session) => session.id === sessionId)) : ids,
      ]))
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev
      try { localStorage.setItem('olympus.stationSessions', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })
  }, [sessionsBySpace])

  // Keeps the focused session pointed at something that still exists in that space.
  useEffect(() => {
    const list = sessionsBySpace[spaceId]
    if (!list) return
    setActiveSessionIdBySpace((prev) => {
      const current = prev[spaceId]
      if (current === null) return prev
      if (current && list.some((s) => s.id === current)) return prev
      return { ...prev, [spaceId]: list[0]?.id ?? null }
    })
  }, [spaceId, sessionsBySpace])

  const switchSpace = (id: string) => {
    if (id === spaceId) {
      setWorkspaceView('workspace')
      setScreen('workspace')
      return
    }
    void startSpace(id).catch((error) => setAppError(error instanceof Error ? error.message : String(error)))
  }

  /** The pane's folder chip changes that pane, not the focused project in the sidebar. */
  const goToProject = (id: string, sessionId: string) => setPicker({ purpose: 'pane', inId: id, sessionId })

  const navigationLocked = busy || daemon.status === 'starting'
  /**
   * Adds a folder as a project and returns its space id, or null if the dialog was cancelled.
   * Returning the id is what lets the folder picker adopt a brand-new folder immediately
   * instead of making you close the picker and go pick it again.
   */
  const addProject = async (openAfterAdd = true): Promise<string | null> => {
    try {
      const dir = await window.electronAPI.selectDirectory()
      if (!dir) return null
      setAppError(null)
      const list = await window.electronAPI.addProject(dir)
      setProjects(list)
      const norm = (value: string) => value.replace(/[\\/]+$/, '').toLowerCase()
      const added = list.find((p) => norm(p.path) === norm(dir)) ?? list[list.length - 1]
      const id = added?.id ?? null
      if (openAfterAdd && id) await startSpace(id)
      return id
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error))
      return null
    }
  }

  const rescan = async () => {
    setRescanning(true)
    try {
      const found = await window.electronAPI.discoverModels()
      const changed = !!daemon.cwd && providersKey(found) !== startedWith.current
      if (changed && (busy || busyBySpace[spaceId])) {
        setAppError('Model availability changed. Finish or stop the current response, then rescan to restart the agent.')
        return
      }
      setAppError(null)
      setProviders(found)
      const settings = await window.electronAPI.getSettings()
      setModel(pickModel(found, model ?? settings.selectedModel))
      if (changed && daemon.cwd) await startSpace(spaceId, true)
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error))
    } finally {
      setRescanning(false)
    }
  }

  // Surface the agent's skills for the focused space.
  useEffect(() => {
    if (!running) {
      setSkills([])
      return
    }
    let cancelled = false
    api
      .skills(spaceId)
      .then((list) => !cancelled && setSkills(Array.isArray(list) ? list : []))
      .catch(() => !cancelled && setSkills([]))
    return () => {
      cancelled = true
    }
  }, [running, spaceId])

  const openPicker = (purpose: 'agent', inId = spaceId) => setPicker({ purpose, inId })

  /** Adds a folder, then does whatever the picker was opened for, in the new folder. */
  const addFolderFromPicker = async () => {
    const pending = picker
    // Keep the dialog open while the OS folder chooser is up so cancelling that returns you
    // to the list rather than dismissing the picker entirely.
    const id = await addProject(false)
    if (!id || !pending) return
    setPicker(null)
    if (pending.purpose === 'agent') await startAgentInSpace(id)
    else if (pending.purpose === 'pane' && pending.sessionId) await changePaneProject(pending.inId, pending.sessionId, id)
  }

  /**
   * Starts a new agentic chat in `id` and puts it on screen.
   *
   * Focusing and starting are one call (`space:start` does both), and it is awaited: the
   * session below needs the daemon already up, and firing both at once produced a
   * session-creation failure whenever the space was cold.
   */
  const startAgentInSpace = async (id: string) => {
    try {
      if (id !== spaceId && !(await startSpace(id))) return
      else {
        const result = await window.electronAPI.openSpace(id)
        setDaemonBySpace((prev) => ({ ...prev, [id]: result.state }))
        setScreen('workspace')
      }
      setWorkspaceView('workspace')
      await addAgentToSpace(id)
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error))
    }
  }

  // ---- human-in-the-loop edits --------------------------------------------

  const editRequests = useMemo(() => stream.permissions.filter((p) => p.permission === 'edit'), [stream.permissions])
  const openEditReview = () => { setScreen('workspace'); setWorkspaceView('edits') }

  const hasProject = spaceId !== GENERAL_SPACE
  const project = projects.find((item) => item.id === spaceId)
  const workspaceTitle = project?.name ?? ''

  const changePermissionMode = async (next: PermissionMode) => {
    if (busy || busyBySpace[spaceId]) return
    if (next === permissionMode) return
    try {
      await window.electronAPI.setSettings({ permissionMode: next })
      setPermissionMode(next)
      await startSpace(spaceId, true)
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error))
    }
  }

  const runProject = async () => {
    try {
      const command = await window.electronAPI.getRunCommand()
      if (!command) {
        setAppError('No run target found. Add a dev or start script to package.json, or open the terminal.')
        setWorkspaceView('workspace')
        return
      }
      setAppError(null)
      setRunCommand(command)
      setRunNonce((value) => value + 1)
      setTerminalOpen(true)
      if (command.endsWith('run dev')) setContextOpen(true)
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error))
      setWorkspaceView('workspace')
    }
  }

  const onSessionCreated = (id: string, session: Session) => setSessionsBySpace((prev) => ({ ...prev, [id]: topLevelByRecent([session, ...(prev[id] ?? []).filter((item) => item.id !== session.id)]) }))
  /** Adds a new agent to a project directly from the Workspace hub, starting its daemon first if needed. */
  const addAgentToSpace = async (id: string) => {
    const result = await window.electronAPI.openSpace(id)
    setDaemonBySpace((prev) => ({ ...prev, [id]: result.state }))
    const session = await api.createSession(id, `Agent ${(openIdsBySpace[id]?.length ?? 0) + 1}`)
    onSessionCreated(id, session)
    setOpenIdsBySpace((prev) => {
      const next = { ...prev, [id]: [...(prev[id] ?? []), session.id] }
      try { localStorage.setItem('olympus.agentWindows', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })
  }
  /** A session belongs to its original daemon directory. Open a replacement in the
   * selected project, then close the old window while keeping its chat saved there. */
  const changePaneProject = async (fromId: string, sessionId: string, toId: string) => {
    if (fromId === toId) return
    try {
      setAppError(null)
      const status = await api.sessionStatus(fromId)
      if (status[sessionId] && status[sessionId].type !== 'idle') {
        throw new Error('This agent is still working. Stop it before changing folders.')
      }
      const result = await window.electronAPI.openSpace(toId)
      if (result.state.status !== 'running') throw new Error(result.state.error || 'The selected project could not start.')
      setDaemonBySpace((prev) => ({ ...prev, [toId]: result.state }))
      const original = sessionsBySpace[fromId]?.find((item) => item.id === sessionId)
      const replacement = await api.createSession(toId, original?.title || 'New agent')
      onSessionCreated(toId, replacement)
      setWindowOrder((prev) => prev.map((key) => key === JSON.stringify([fromId, sessionId]) ? JSON.stringify([toId, replacement.id]) : key))
      setOpenIdsBySpace((prev) => {
        const next = {
          ...prev,
          [fromId]: (prev[fromId] ?? []).filter((item) => item !== sessionId),
          [toId]: [...(prev[toId] ?? []), replacement.id],
        }
        try { localStorage.setItem('olympus.agentWindows', JSON.stringify(next)) } catch { /* best effort */ }
        return next
      })
      setWorkspaceView('workspace')
      setScreen('workspace')
    } catch (error) {
      setAppError(`Could not change agent folder: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  /** Station conversations are deliberately separate from Workspace windows. */
  const launchStation = async (target: StationTarget, title: string, brief: string, selectedModel: ModelRef, variant: string | null): Promise<string> => {
    let id: string
    if ('projectId' in target) id = target.projectId
    else {
      const created = await window.electronAPI.createStore(target.root, target.name, title)
      setStores(created.stores)
      id = created.id
    }
    const result = await window.electronAPI.openSpace(id)
    setDaemonBySpace((prev) => ({ ...prev, [id]: result.state }))
    if (result.state.status !== 'running') throw new Error(result.state.error || 'That project could not start.')
    const session = await api.createSession(id, title)
    onSessionCreated(id, session)
    const key = JSON.stringify([id, session.id])
    setStationModels((prev) => {
      const next = { ...prev, [key]: { model: selectedModel, variant } }
      try { localStorage.setItem('olympus.stationModels', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })
    setStationIdsBySpace((prev) => {
      const next = { ...prev, [id]: [...(prev[id] ?? []), session.id] }
      try { localStorage.setItem('olympus.stationSessions', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })
    try { await api.prompt(id, session.id, brief, selectedModel, variant) }
    catch (error) { setAppError(`Store request was not sent: ${error instanceof Error ? error.message : String(error)}. Your Station chat is saved; send the request again there.`) }
    return key
  }
  const setStationPaused = async (id: string, paused: boolean) => {
    setPausedStoreIds((current) => {
      const next = paused ? [...new Set([...current, id])] : current.filter((item) => item !== id)
      localStorage.setItem('olympus.pausedStores', JSON.stringify(next))
      return next
    })
    if (paused) {
      try {
        for (const sessionId of stationIdsBySpace[id] ?? []) {
          if (busySessionsBySpace[id]?.[sessionId]) await api.abort(id, sessionId).catch(() => {})
        }
        await window.electronAPI.closeSpace(id)
      } catch (error) {
        setPausedStoreIds((current) => {
          const next = current.filter((item) => item !== id)
          localStorage.setItem('olympus.pausedStores', JSON.stringify(next))
          return next
        })
        throw error
      }
    }
    if (!paused) retryStart(id)
  }
  /** Stops the store's agent, unlists it, and prunes every bit of renderer-side state keyed by
   * its id - otherwise a deleted store's ghost lingers in the 24/7 management loop or the
   * paused-stores list until the next full reload. */
  const deleteStore = async (id: string, deleteFiles: boolean) => {
    for (const sessionId of stationIdsBySpace[id] ?? []) {
      if (busySessionsBySpace[id]?.[sessionId]) await api.abort(id, sessionId).catch(() => {})
    }
    await window.electronAPI.closeSpace(id).catch(() => {})
    const nextStores = await window.electronAPI.removeStore(id, deleteFiles)
    setStores(nextStores)
    setStationIdsBySpace((prev) => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      try { localStorage.setItem('olympus.stationSessions', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })
    setPausedStoreIds((current) => {
      if (!current.includes(id)) return current
      const next = current.filter((item) => item !== id)
      localStorage.setItem('olympus.pausedStores', JSON.stringify(next))
      return next
    })
    setManagedStoreChecks((current) => {
      if (!(id in current)) return current
      const next = { ...current }
      delete next[id]
      try { localStorage.setItem('olympus.managedStoreChecks', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })
    setStationModels((prev) => {
      const staleKeys = Object.keys(prev).filter((key) => JSON.parse(key)[0] === id)
      if (!staleKeys.length) return prev
      const next = { ...prev }
      for (const key of staleKeys) delete next[key]
      try { localStorage.setItem('olympus.stationModels', JSON.stringify(next)) } catch { /* best effort */ }
      return next
    })
  }
  const onSessionDeleted = (id: string, sessionId: string) => {
    setSessionsBySpace((prev) => ({ ...prev, [id]: (prev[id] ?? []).filter((item) => item.id !== sessionId) }))
    setSpaceOpenIds(id, (openIdsBySpace[id] ?? []).filter((item) => item !== sessionId))
    setActiveSessionIdBySpace((prev) => (prev[id] === sessionId ? { ...prev, [id]: null } : prev))
  }

  const runningBySpace = useMemo(
    () => Object.fromEntries(Object.entries(daemonBySpace).map(([id, state]) => [id, state.status === 'running'])),
    [daemonBySpace],
  )
  // Which agents are open in each project, by title, so the Projects page can name
  // them instead of just saying "Open". A project with a running daemon but no
  // open agent window is not open in any sense the reader can act on.
  const openAgentsByProject = useMemo(() => {
    const out: Record<string, string[]> = {}
    for (const [id, openIds] of Object.entries(openIdsBySpace)) {
      if (id === GENERAL_SPACE || openIds.length === 0) continue
      const sessions = sessionsBySpace[id] ?? []
      const titles = openIds
        .map((sessionId) => sessions.find((session) => session.id === sessionId)?.title?.trim())
        .filter((title): title is string => !!title)
      if (titles.length) out[id] = titles
    }
    return out
  }, [openIdsBySpace, sessionsBySpace])

  const agentGridEntries: AgentGridEntry[] = Object.entries(openIdsBySpace).flatMap(([id, ids]) => {
    const paneProject = projects.find((item) => item.id === id)
    const list = sessionsBySpace[id]
    const daemonState = daemonBySpace[id]
    return ids.map((sessionId, index) => {
      // Auto-named agents are numbered by their place among this project's open windows,
      // so two Voice2Text agents read "Agent 1" and "Agent 2" whatever else is open.
      return {
        spaceId: id,
        sessionId,
        title: agentDisplayTitle(list?.find((session) => session.id === sessionId)?.title, index),
        projectName: paneProject?.name ?? (id === GENERAL_SPACE ? 'General' : id),
        projectPath: paneProject?.path,
        ready: daemonState?.status === 'running',
        startError: daemonState?.status === 'error' ? daemonState.error || 'The agent could not start.' : undefined,
        onRetryStart: daemonState?.status === 'error' ? () => retryStart(id) : undefined,
      }
    })
  })

  agentGridEntries.sort((a, b) => {
    const rank = (entry: AgentGridEntry) => {
      const index = windowOrder.indexOf(JSON.stringify([entry.spaceId, entry.sessionId]))
      return index < 0 ? Number.MAX_SAFE_INTEGER : index
    }
    return rank(a) - rank(b)
  })

  const stationEntries: AgentGridEntry[] = Object.entries(stationIdsBySpace).flatMap(([id, ids]) => {
    const stationProject = stores.find((item) => item.id === id) ?? projects.find((item) => item.id === id)
    return ids.map((sessionId) => ({
      spaceId: id, sessionId,
      title: sessionsBySpace[id]?.find((session) => session.id === sessionId)?.title || 'Store project',
      projectName: stationProject?.name ?? id,
      projectPath: stationProject?.path,
      ready: daemonBySpace[id]?.status === 'running' && !pausedStoreIds.includes(id),
      startError: daemonBySpace[id]?.status === 'error' ? daemonBySpace[id].error || 'The agent could not start.' : undefined,
      onRetryStart: daemonBySpace[id]?.status === 'error' ? () => retryStart(id) : undefined,
    }))
  })
  const stationKeys = new Set(stationEntries.map((entry) => JSON.stringify([entry.spaceId, entry.sessionId])))
  const stationWorkingCount = stationEntries.filter((entry) => busySessionsBySpace[entry.spaceId]?.[entry.sessionId]).length
  useEffect(() => {
    const runChecks = async () => {
      for (const [id, lastRun] of Object.entries(managedStoreChecks)) {
        if (pausedStoreIds.includes(id) || Date.now() - lastRun < MANAGEMENT_CHECK_INTERVAL_MS || checkInFlight.current.has(id)) continue
        const agent = stationEntries.find((entry) => entry.spaceId === id && entry.ready)
        if (!agent) continue
        const assigned = stationModels[JSON.stringify([id, agent.sessionId])]?.model ?? model
        if (!assigned) continue
        checkInFlight.current.add(id)
        try {
          const status = await api.sessionStatus(id)
          if (status[agent.sessionId] && status[agent.sessionId].type !== 'idle') continue
          setManagedStoreChecks((current) => {
            const next = { ...current, [id]: Date.now() }
            localStorage.setItem('olympus.managedStoreChecks', JSON.stringify(next))
            return next
          })
          await api.prompt(id, agent.sessionId, buildStationCheckBrief(), assigned, stationModels[JSON.stringify([id, agent.sessionId])]?.variant)
        } catch (error) {
          setAppError(`Store check failed for ${agent.title}: ${error instanceof Error ? error.message : String(error)}`)
        } finally { checkInFlight.current.delete(id) }
      }
    }
    void runChecks()
    const interval = window.setInterval(() => void runChecks(), 60_000)
    return () => window.clearInterval(interval)
  }, [managedStoreChecks, pausedStoreIds, daemonBySpace, stationModels, model, stationIdsBySpace, sessionsBySpace])
  const setStoreManaged = (id: string, enabled: boolean) => {
    setManagedStoreChecks((current) => {
      const next = { ...current }
      if (enabled) next[id] = 0
      else delete next[id]
      localStorage.setItem('olympus.managedStoreChecks', JSON.stringify(next))
      return next
    })
  }
  const workspaceProjects = projects.filter((item) => !(stationIdsBySpace[item.id]?.length))
  const sidebarStores = [...stores, ...projects.filter((item) => stationIdsBySpace[item.id]?.length && !stores.some((store) => store.id === item.id))]

  const savedConversations = Object.entries(sessionsBySpace).flatMap(([id, sessions]) =>
    sessions.filter((session) => !stationKeys.has(JSON.stringify([id, session.id]))).map((session) => ({ spaceId: id, sessionId: session.id, title: session.title,
      projectName: projects.find((project) => project.id === id)?.name ?? 'General',
      open: (openIdsBySpace[id] ?? []).includes(session.id) })),
  )
  const openConversation = (id: string, sessionId: string) => {
    setSpaceOpenIds(id, [...new Set([...(openIdsBySpace[id] ?? []), sessionId])])
    setScreen('workspace')
    setWorkspaceView('workspace')
  }

  const toggleContext = () => setContextOpen((open) => { localStorage.setItem('olympus.contextOpen', String(!open)); return !open })

  const [stationOverviewSignal, setStationOverviewSignal] = useState(0)
  /** Opens Station straight to its overview grid, e.g. from the sidebar's Stores label. */
  // Opening a specific store: the store's id, plus a counter so opening the same store
  // twice in a row still re-selects it rather than looking like a no-op.
  const [stationFocus, setStationFocus] = useState<{ id: string; signal: number } | null>(null)
  const openStationStore = (storeId: string) => {
    setScreen('workspace')
    setWorkspaceView('station')
    setStationFocus((prev) => ({ id: storeId, signal: (prev?.signal ?? 0) + 1 }))
  }

  const openStationOverview = () => {
    setScreen('workspace')
    setWorkspaceView('station')
    setStationOverviewSignal((n) => n + 1)
  }

  const pickerRows = useMemo(
    () => pickerSpaces(workspaceProjects, { busyBySpace, openIdsBySpace }),
    [workspaceProjects, busyBySpace, openIdsBySpace],
  )

  // Panel toggles live here, not in the header: Ctrl/⌘ J terminal, Ctrl/⌘ B preview.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.altKey) return
      const key = event.key.toLowerCase()
      if (key === 'j') {
        event.preventDefault()
        setTerminalOpen((open) => !open)
      } else if (key === 'b') {
        event.preventDefault()
        setContextOpen((open) => {
          localStorage.setItem('olympus.contextOpen', String(!open))
          return !open
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
    <AnimatePresence>{!ready && <OlympusBoot progress={bootProgress} />}</AnimatePresence>
    <div className="workspace-shell flex h-screen w-screen gap-3 overflow-hidden bg-midnight p-2 text-slate-900">
      <Sidebar daemon={daemon} projects={workspaceProjects.filter((item) => !item.hidden)} stores={sidebarStores} projectsActive={screen === 'projects'} spaceId={spaceId}
        busy={busy || !!busyBySpace[spaceId]} busyBySpace={busyBySpace} runningBySpace={runningBySpace} openIdsBySpace={openIdsBySpace} navigationLocked={navigationLocked}
        workspaceActive={screen === 'workspace' && workspaceView === 'workspace'} workspaceAgentCount={agentGridEntries.length}
        stationActive={screen === 'workspace' && workspaceView === 'station'} stationAgentCount={stationEntries.length} stationWorkingCount={stationWorkingCount}
        onOpenWorkspace={() => { setScreen('workspace'); setWorkspaceView('workspace') }}
        onOpenStation={openStationOverview}
        onOpenStore={openStationStore}
        onOpenProjects={() => setScreen('projects')}
        onOpenConnections={() => setScreen('connections')} connectionsActive={screen === 'connections'}
        onNewAgent={() => openPicker('agent')} skills={skills} />
      <div className="flex min-w-0 flex-1 flex-col">
        {screen === 'workspace' ? <WorkspaceBar projectId={hasProject ? spaceId : null} editCount={editRequests.length} view={workspaceView} title={workspaceView === 'station' ? 'Station' : workspaceTitle || 'General'}
          permissionMode={permissionMode} permissionDisabled={navigationLocked || busy || !!busyBySpace[spaceId]} onPermissionModeChange={(mode) => void changePermissionMode(mode)}
          onChange={setWorkspaceView}
        /> : <header className="flex h-11 shrink-0 items-center px-2 text-xs text-slate-500"><span>{screen === 'connections' ? 'Connections' : 'Project manager'}</span></header>}
        {envIssue && !envIssue.available && (
          <div role="alert" className="mb-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-800">
            <strong className="font-semibold">opencode was not found.</strong> Olympus runs the opencode agent, so it needs that installed first:{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">npm i -g opencode-ai</code> - then restart Olympus. If opencode lives somewhere else, point{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">OLYMPUS_OPENCODE_BIN</code> at it.
          </div>
        )}
        {envIssue?.available && !envIssue.supported && (
          <div role="alert" className="mb-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-800">
            <strong className="font-semibold">opencode {envIssue.version} is outside the range Olympus was built against.</strong> Olympus targets opencode 1.18 and later. It may still work, but if a project behaves oddly, update opencode or install 1.18 with{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">npm i -g opencode-ai@1.18</code>.
          </div>
        )}
        {appError && <div role="alert" className="mb-2 flex items-start gap-3 rounded-md border border-rose-400/20 bg-rose-400/5 px-3 py-2 text-xs text-rose-600"><span className="flex-1">{appError}</span><button aria-label="Dismiss error" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-slate-100" onClick={() => setAppError(null)}><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>}
        {screen === 'projects' && <div className="workspace-center min-h-0 flex-1"><ProjectsPage projects={workspaceProjects} activeId={hasProject && project?.exists ? spaceId : null} openAgentsByProject={openAgentsByProject} onProjectsChange={setProjects} onOpen={switchSpace} onAdd={() => void addProject(false)} /></div>}
        {screen === 'connections' && <div className="workspace-center min-h-0 flex-1"><ConnectionsSettings /></div>}
        <div className="workspace-body" style={{ display: screen === 'workspace' ? 'flex' : 'none' }}>
          <div className="workspace-center flex min-w-0 flex-1 flex-col bg-slate-50">
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0" style={{ display: workspaceView === 'workspace' ? 'block' : 'none' }}>
                <AllAgentsGrid conversations={savedConversations} onOpenConversation={openConversation} entries={agentGridEntries} hasProjects={workspaceProjects.some((item) => !item.hidden)} mode="agent"
                  defaultModel={model} defaultVariant={selectedVariant} providers={providers} rescanning={rescanning} onRescan={rescan}
                  onAddEndpoint={async (name, baseURL) => { await window.electronAPI.addEndpoint({ name, baseURL }); await rescan() }}
                  onRemoveEndpoint={async (endpointId) => { await window.electronAPI.removeEndpoint(endpointId); await rescan() }}
                  onReviewEdits={openEditReview} onOpenProjects={() => setScreen('projects')} goToProject={goToProject}
                  onRequestAddAgent={() => openPicker('agent')} onDelete={(id, sessionId) => api.deleteSession(id, sessionId).then(() => onSessionDeleted(id, sessionId))}
                  onClose={(id, sessionId) => setSpaceOpenIds(id, (openIdsBySpace[id] ?? []).filter((item) => item !== sessionId))} />
              </div>
              {workspaceView === 'edits' && <div className="absolute inset-0"><DiffViewer spaceId={spaceId} requests={editRequests} /></div>}
              <div className="absolute inset-0" style={{ display: workspaceView === 'code' ? 'block' : 'none' }}>
                <EditorWorkspace spaceId={spaceId} visible={workspaceView === 'code'} switchGuardRef={editorSwitchGuard} projectKey={`${spaceId}:${daemon.cwd ?? ''}`} available={hasProject && running} onRun={() => void runProject()} runDisabled={!running} />
              </div>
              <div className="absolute inset-0" style={{ display: workspaceView === 'station' ? 'block' : 'none' }}>
                <StationView visible={workspaceView === 'station'} focusStoreId={stationFocus?.id ?? null} focusSignal={stationFocus?.signal ?? 0} overviewSignal={stationOverviewSignal} agents={stationEntries} busy={busySessionsBySpace} pausedStoreIds={pausedStoreIds} onSetPaused={setStationPaused} onDeleteStore={deleteStore} managedStoreChecks={managedStoreChecks} onSetManaged={setStoreManaged} model={model} variant={selectedVariant} stationModels={stationModels}
                  stores={sidebarStores} providers={providers} rescanning={rescanning} onRescan={rescan}
                  onAddEndpoint={async (name, baseURL) => { await window.electronAPI.addEndpoint({ name, baseURL }); await rescan() }}
                  onRemoveEndpoint={async (endpointId) => { await window.electronAPI.removeEndpoint(endpointId); await rescan() }}
                  onLaunch={launchStation}
                  onModelChange={(key, nextModel, variant) => setStationModels((prev) => {
                    const next = { ...prev, [key]: { model: nextModel, variant } }
                    try { localStorage.setItem('olympus.stationModels', JSON.stringify(next)) } catch { /* best effort */ }
                    return next
                  })} />
              </div>
            </div>
            <div className="h-[34%] min-h-[160px] shrink-0 border-t border-slate-200" style={{ display: terminalOpen && workspaceView !== 'station' ? 'block' : 'none' }}>
              <TerminalPanel key={spaceId} spaceId={spaceId} connected={running} daemonKey={String(daemon.port)} visible={screen === 'workspace' && terminalOpen} initialView="shell" runNonce={runNonce} runCommand={runCommand} onClose={() => setTerminalOpen(false)} />
            </div>
          </div>
          {hasProject && project && <aside aria-label="Preview" className="context-panel flex flex-col" style={{ display: contextOpen && workspaceView !== 'station' ? 'flex' : 'none' }}>
            <ContextPanel projectId={spaceId} onClose={toggleContext}>
              <PreviewPanel projectKey={`${spaceId}:${daemon.cwd ?? ''}`} available={running} visible={screen === 'workspace' && contextOpen} />
            </ContextPanel>
          </aside>}
        </div>
      </div>
      {picker && (
        <ProjectPicker
          spaces={picker.purpose === 'pane' ? pickerRows.filter((row) => row.id !== GENERAL_SPACE) : pickerRows}
          currentId={picker.inId}
          title={picker.purpose === 'agent' ? 'New agent' : 'Change agent folder'}
          hint={
            picker.purpose === 'agent'
              ? 'Pick the folder this agent works in. Each project runs its own agent, so this also decides which files it can see.'
              : 'Change the folder for this window without moving its position. A new conversation starts there; the previous conversation stays saved in its original project.'
          }
          onPick={(id) => {
            setPicker(null)
            if (picker.purpose === 'agent') void startAgentInSpace(id)
            else if (picker.purpose === 'pane' && picker.sessionId) void changePaneProject(picker.inId, picker.sessionId, id)
          }}
          onAddFolder={() => void addFolderFromPicker()}
          onClose={() => setPicker(null)}
        />
      )}
    </div>
    </>
  )
}
