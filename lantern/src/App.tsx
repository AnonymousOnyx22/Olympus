import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatCanvas from './components/ChatCanvas'
import AgentWorkspace from './components/AgentWorkspace'
import AllAgentsGrid, { type AgentGridEntry } from './components/AllAgentsGrid'
import DiffViewer from './components/DiffViewer'
import EditorWorkspace from './components/EditorWorkspace'
import PreviewPanel from './components/PreviewPanel'
import ContextPanel from './components/ContextPanel'
import ProjectsPage from './components/ProjectsPage'
import TerminalPanel from './components/TerminalPanel'
import WorkspaceBar, { type WorkspaceView } from './components/WorkspaceBar'
import { api } from './services/api'
import { describeActivity, useSessionStream } from './services/streamHandler'
import { GENERAL_SPACE } from './constants'
import type { DaemonState, LocalProvider, ModelRef, PermissionMode, ProjectInfo, Session, Skill } from './types/opencode'

const STOPPED: DaemonState = { status: 'stopped', port: null, cwd: null }

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

interface QueuedMessage {
  id: string
  /** The space this message belongs to, captured at queue time so a focus switch can't misdeliver it. */
  spaceId: string
  text: string
  sessionID: string | null
  model: ModelRef
  variant: string | null
  priority: boolean
}

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
  const [addAgentBySpace, setAddAgentBySpace] = useState<Record<string, number>>({})
  // Which of each project's sessions have an open agent window — the single source of truth
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

  const [providers, setProviders] = useState<LocalProvider[]>([])
  const [rescanning, setRescanning] = useState(false)
  const [model, setModel] = useState<ModelRef | null>(null)
  const [appError, setAppError] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectInfo[]>([])
  const [spaceId, setSpaceId] = useState<string>(GENERAL_SPACE)
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('agent')
  const [screen, setScreen] = useState<'workspace' | 'projects'>('workspace')
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
  const [messageQueue, setMessageQueue] = useState<QueuedMessage[]>([])
  const startedWith = useRef<string>('')
  const booted = useRef(false)
  const openRequested = useRef(new Set<string>())
  /** Spaces with a send in flight right now, so two rapid sends cannot fork a session. */
  const inFlightSends = useRef(new Set<string>())
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

  const startSpace = useCallback(async (id: string, force = false) => {
    setSpaceId(id)
    setScreen('workspace')
    // The Workspace tab spans every open project, so switching focus shouldn't
    // knock you out of it — only the per-project tabs (code/thread/edits) reset.
    setWorkspaceView((view) => (view === 'workspace' ? 'workspace' : 'agent'))
    setRunCommand(null)
    setRunNonce(0)
    setTerminalOpen(false)
    setAppError(null)
    const result = await window.electronAPI.startSpace(id, force)
    setDaemonBySpace((prev) => ({ ...prev, [id]: result.state }))
    setProviders(result.providers)
    startedWith.current = providersKey(result.providers)
    const settings = await window.electronAPI.getSettings()
    setPermissionMode(settings.permissionMode)
    setSelectedVariants(settings.selectedVariants)
    const chosen = pickModel(result.providers, settings.selectedModel)
    setModel(chosen)
    if (chosen) void window.electronAPI.setSettings({ selectedModel: chosen })
  }, [])

  useEffect(() => {
    const offDaemon = window.electronAPI.onDaemonState((id, state) => setDaemonBySpace((prev) => ({ ...prev, [id]: state })))
    const offProjects = window.electronAPI.onProjectsChanged(setProjects)
    // One listener for every open space's events — this is what lets a background
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
      const [settings, projectList] = await Promise.all([window.electronAPI.getSettings(), window.electronAPI.listProjects()])
      setProjects(projectList)
      setPermissionMode(settings.permissionMode)
      setSelectedVariants(settings.selectedVariants)
      // Start straight into a space so you can chat immediately (General by default).
      await startSpace(settings.lastSpace ?? GENERAL_SPACE)
    })().catch((error) => setAppError(error instanceof Error ? error.message : String(error)))
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

  // Any project with open agent windows needs its daemon running, even if you've never
  // focused it this session (e.g. windows restored from a previous run) — otherwise its
  // agent panes sit at "Connecting" forever.
  useEffect(() => {
    for (const [id, ids] of Object.entries(openIdsBySpace)) {
      if (id === GENERAL_SPACE || ids.length === 0 || openRequested.current.has(id)) continue
      const state = daemonBySpace[id]
      if (state?.status === 'running' || state?.status === 'starting') continue
      openRequested.current.add(id)
      window.electronAPI.openSpace(id)
        .then((result) => setDaemonBySpace((prev) => ({ ...prev, [id]: result.state })))
        .catch((error) => setAppError(error instanceof Error ? error.message : String(error)))
        .finally(() => openRequested.current.delete(id))
    }
  }, [openIdsBySpace, daemonBySpace])

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

  /** Retries a space whose daemon failed to start. */
  const retrySpace = (id: string) => {
    setDaemonBySpace((prev) => ({ ...prev, [id]: STOPPED }))
    window.electronAPI.openSpace(id)
      .then((result) => setDaemonBySpace((prev) => ({ ...prev, [id]: result.state })))
      .catch((error) => setAppError(error instanceof Error ? error.message : String(error)))
  }

  const switchSpace = (id: string) => {
    if (id === spaceId) {
      setScreen('workspace')
      return
    }
    void startSpace(id).catch((error) => setAppError(error instanceof Error ? error.message : String(error)))
  }

  /** The composer's folder chip: jumps to that pane's project (a no-op if already there). */
  const goToProject = (id: string) => {
    setWorkspaceView('agent')
    switchSpace(id)
  }

  const navigationLocked = busy || messageQueue.some((item) => item.spaceId === spaceId) || daemon.status === 'starting'
  const addProject = async (openAfterAdd = true) => {
    try {
      const dir = await window.electronAPI.selectDirectory()
      if (!dir) return
      setAppError(null)
      const list = await window.electronAPI.addProject(dir)
      setProjects(list)
      const norm = (value: string) => value.replace(/[\\/]+$/, '').toLowerCase()
      const added = list.find((p) => norm(p.path) === norm(dir)) ?? list[list.length - 1]
      if (openAfterAdd) await startSpace(added?.id ?? GENERAL_SPACE)
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error))
    }
  }

  const removeProject = async (id: string) => {
    if (busyBySpace[id] || (id === spaceId && busy)) { setAppError('Stop this project agent before removing the project.'); return }
    try {
      const list = await window.electronAPI.removeProject(id)
      setProjects(list)
      void window.electronAPI.closeSpace(id).catch(() => {})
      if (spaceId === id) await startSpace(GENERAL_SPACE)
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error))
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

  const selectModel = (ref: ModelRef) => {
    setModel(ref)
    void window.electronAPI.setSettings({ selectedModel: ref })
  }

  const selectVariant = (variant: string | null) => {
    if (!model) return
    setSelectedVariants((current) => {
      const next = { ...current }
      if (variant) next[modelKey(model)] = variant
      else delete next[modelKey(model)]
      void window.electronAPI.setSettings({ selectedVariants: next })
      return next
    })
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

  const newSession = () => {
    if (spaceId !== GENERAL_SPACE) {
      setScreen('workspace')
      setWorkspaceView('agent')
      setAddAgentBySpace((prev) => ({ ...prev, [spaceId]: (prev[spaceId] ?? 0) + 1 }))
      return
    }
    if (navigationLocked) return
    setScreen('workspace')
    setWorkspaceView('agent')
    setActiveSessionIdBySpace((prev) => ({ ...prev, [spaceId]: null }))
  }

  const deliverMessage = async (
    targetSpaceId: string,
    text: string,
    targetSessionID: string | null,
    targetModel: ModelRef,
    targetVariant: string | null,
  ) => {
    let id = targetSessionID
    if (!id) {
      const session = await api.createSession(targetSpaceId, text.length > 48 ? text.slice(0, 47) + '…' : text)
      id = session.id
      if (targetSpaceId === spaceId) stream.adoptNew(id)
      setActiveSessionIdBySpace((prev) => ({ ...prev, [targetSpaceId]: id }))
      setSessionsBySpace((prev) => ({ ...prev, [targetSpaceId]: topLevelByRecent([session, ...(prev[targetSpaceId] ?? []).filter((s) => s.id !== session.id)]) }))
    }
    await api.prompt(targetSpaceId, id, text, targetModel, targetVariant)
  }

  const send = async (text: string, priority = false) => {
    if (!model) return
    if (busy || busyBySpace[spaceId] || messageQueue.some((item) => item.spaceId === spaceId)) {
      const item: QueuedMessage = {
        id: crypto.randomUUID(),
        spaceId,
        text,
        sessionID: activeSessionId,
        model,
        variant: selectedVariant,
        priority,
      }
      setMessageQueue((current) => (priority ? [item, ...current] : [...current, item]))
      return
    }
    // Two sends in quick succession both saw "not busy" before either had created its
    // session, so both forked off a new session and the first reply landed in a window
    // nobody was looking at. A synchronous in-flight guard closes that window.
    if (inFlightSends.current.has(spaceId)) {
      setMessageQueue((current) => [
        ...current,
        { id: crypto.randomUUID(), spaceId, text, sessionID: activeSessionId, model, variant: selectedVariant, priority },
      ])
      return
    }
    inFlightSends.current.add(spaceId)
    try {
      await deliverMessage(spaceId, text, activeSessionId, model, selectedVariant)
    } finally {
      inFlightSends.current.delete(spaceId)
      void reconcileBusy(spaceId)
    }
  }

  useEffect(() => {
    const next = messageQueue.find(
      (item) =>
        !inFlightSends.current.has(item.spaceId) &&
        daemonBySpace[item.spaceId]?.status === 'running' &&
        !busyBySpace[item.spaceId] &&
        (item.spaceId !== spaceId || !busy),
    )
    if (!next) return
    // Deliberately no optimistic busy flag here. Writing a synthetic key meant no
    // `session.idle` would ever clear it, so a single drained queue could wedge the space
    // forever. The daemon reports busy over `/session/status`, which is what we reconcile
    // against as soon as the send lands.
    inFlightSends.current.add(next.spaceId)
    setMessageQueue((current) => current.filter((item) => item.id !== next.id))
    void deliverMessage(next.spaceId, next.text, next.sessionID, next.model, next.variant)
      .then(() => {
        inFlightSends.current.delete(next.spaceId)
        void reconcileBusy(next.spaceId)
      })
      .catch((error) => {
        inFlightSends.current.delete(next.spaceId)
        setAppError(`Queued message failed: ${String(error)}`)
      })
  }, [busy, busyBySpace, daemonBySpace, messageQueue, spaceId, reconcileBusy])

  const abort = () => {
    if (activeSessionId) {
      void api.abort(spaceId, activeSessionId).catch((error) => setAppError(error instanceof Error ? error.message : String(error)))
    }
  }

  // ---- human-in-the-loop edits --------------------------------------------

  const editRequests = useMemo(() => stream.permissions.filter((p) => p.permission === 'edit'), [stream.permissions])
  const openEditReview = () => { setScreen('workspace'); setWorkspaceView('edits') }

  const hasModels = providers.some((p) => p.online && p.models.length > 0)
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
        setWorkspaceView('agent')
        return
      }
      setAppError(null)
      setRunCommand(command)
      setRunNonce((value) => value + 1)
      setTerminalOpen(true)
      if (command.endsWith('run dev')) setContextOpen(true)
    } catch (error) {
      setAppError(error instanceof Error ? error.message : String(error))
      setWorkspaceView('agent')
    }
  }

  const onSessionCreated = (id: string, session: Session) => setSessionsBySpace((prev) => ({ ...prev, [id]: topLevelByRecent([session, ...(prev[id] ?? []).filter((item) => item.id !== session.id)]) }))
  /** Adds a new agent to a project directly from the Workspace hub, starting its daemon first if needed. */
  const addAgentToSpace = async (id: string) => {
    const result = await window.electronAPI.openSpace(id)
    setDaemonBySpace((prev) => ({ ...prev, [id]: result.state }))
    const session = await api.createSession(id, `Agent ${(sessionsBySpace[id]?.length ?? 0) + 1}`)
    onSessionCreated(id, session)
    setSpaceOpenIds(id, [...(openIdsBySpace[id] ?? []), session.id])
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
  // The focused project's pane must exist the instant you click it, before its daemon has
  // even started (that's async) — otherwise the screen goes blank until it comes up, which
  // reads as "switching did nothing." Any other project with a daemon entry stays mounted too
  // (kept alive in the background, e.g. for the Workspace hub).
  const openProjectIds = useMemo(() => {
    const ids = new Set(Object.keys(daemonBySpace))
    if (hasProject) ids.add(spaceId)
    ids.delete(GENERAL_SPACE)
    return [...ids]
  }, [daemonBySpace, hasProject, spaceId])

  const agentGridEntries: AgentGridEntry[] = Object.entries(openIdsBySpace).flatMap(([id, ids]) => {
    if (id === GENERAL_SPACE) return []
    const paneProject = projects.find((item) => item.id === id)
    const list = sessionsBySpace[id]
    return ids.map((sessionId, index) => ({
      spaceId: id,
      sessionId,
      title: list?.find((session) => session.id === sessionId)?.title || `Agent ${index + 1}`,
      projectName: paneProject?.name ?? id,
      projectPath: paneProject?.path,
      ready: daemonBySpace[id]?.status === 'running',
    }))
  })

  const toggleContext = () => setContextOpen((open) => { localStorage.setItem('olympus.contextOpen', String(!open)); return !open })

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
    <div className="workspace-shell flex h-screen w-screen gap-3 overflow-hidden bg-white p-2 text-slate-900">
      <Sidebar daemon={daemon} projects={projects.filter((item) => !item.hidden)} projectsActive={screen === 'projects'} spaceId={spaceId}
        busy={busy || !!busyBySpace[spaceId]} busyBySpace={busyBySpace} runningBySpace={runningBySpace} navigationLocked={navigationLocked}
        workspaceActive={screen === 'workspace' && workspaceView === 'workspace'} workspaceAgentCount={agentGridEntries.length}
        onOpenWorkspace={() => { setScreen('workspace'); setWorkspaceView('workspace') }}
        onOpenProjects={() => setScreen('projects')} onOpenProject={switchSpace}
        onNewSession={newSession} onAddProject={() => void addProject(true)} skills={skills} />
      <div className="flex min-w-0 flex-1 flex-col">
        {screen === 'workspace' ? <WorkspaceBar projectId={hasProject ? spaceId : null} editCount={editRequests.length} view={workspaceView} title={workspaceTitle || 'General'}
          permissionMode={permissionMode} permissionDisabled={navigationLocked || busy || !!busyBySpace[spaceId]} onPermissionModeChange={(mode) => void changePermissionMode(mode)}
          onChange={setWorkspaceView}
        /> : <header className="flex h-11 shrink-0 items-center justify-between px-2 text-xs text-slate-500"><span>Project manager</span><button onClick={() => setScreen('workspace')} className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-100">Back to {workspaceTitle || 'General'}</button></header>}
        {envIssue && !envIssue.available && (
          <div role="alert" className="mb-2 rounded-md border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-800">
            <strong className="font-semibold">opencode was not found.</strong> Olympus runs the opencode agent, so it needs that installed first:{' '}
            <code className="rounded bg-white/70 px-1 py-0.5 font-mono text-[11px]">npm i -g opencode-ai</code> — then restart Olympus. If opencode lives somewhere else, point{' '}
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
        {screen === 'projects' && <div className="workspace-center min-h-0 flex-1"><ProjectsPage projects={projects} activeId={hasProject && project?.exists ? spaceId : null} onProjectsChange={setProjects} onOpen={switchSpace} onAdd={() => void addProject(false)} onRemove={(id) => void removeProject(id)} /></div>}
        <div className="workspace-body" style={{ display: screen === 'workspace' ? 'flex' : 'none' }}>
          <div className="workspace-center flex min-w-0 flex-1 flex-col bg-slate-50">
            <div className="relative min-h-0 flex-1">
              <div className="absolute inset-0 flex" style={{ display: workspaceView === 'agent' || workspaceView === 'thread' ? 'flex' : 'none' }}>
            {!hasProject && <ChatCanvas
              spaceId={spaceId}
              key={spaceId}
              mode={workspaceView === 'thread' ? 'thread' : 'agent'}
              projectName={project?.name ?? 'General'}
              projectPath={project?.path}
              onNewSession={newSession}
              navigationLocked={navigationLocked}
              messages={stream.messages}
              busy={busy}
              activity={describeActivity(stream)}
              error={stream.error}
              onDismissError={() => {
                setAppError(null)
                stream.clearError()
              }}
              permissions={stream.permissions}
              onReviewEdits={openEditReview}
              model={model}
              variant={selectedVariant}
              providers={providers}
              onSelectModel={selectModel}
              onSelectVariant={selectVariant}
              onRescan={rescan}
              rescanning={rescanning}
              onAddEndpoint={async (name, baseURL) => {
                await window.electronAPI.addEndpoint({ name, baseURL })
                await rescan()
              }}
              onRemoveEndpoint={async (id) => {
                await window.electronAPI.removeEndpoint(id)
                await rescan()
              }}
              ready={running}
              hasProject={hasProject}
              hasModels={hasModels}
               onOpenProject={() => setScreen('projects')}
              onSend={send}
              onAbort={abort}
              queuedMessages={messageQueue.filter((item) => item.spaceId === spaceId).map(({ id, text, priority }) => ({ id, text, priority }))}
              onRemoveQueued={(id) => setMessageQueue((current) => current.filter((item) => item.id !== id))}
            />}
                {openProjectIds.map((id) => {
                  const paneProject = projects.find((item) => item.id === id)
                  return <div key={id} className="h-full min-w-0 flex-1" style={{ display: id === spaceId ? 'block' : 'none' }}>
                    <AgentWorkspace spaceId={id} projectName={paneProject?.name ?? id} projectPath={paneProject?.path}
                      ready={daemonBySpace[id]?.status === 'running'}
                      daemonError={daemonBySpace[id]?.status === 'error' ? (daemonBySpace[id]?.error || 'The agent process failed to start.') : undefined}
                      onRetry={() => retrySpace(id)}
                      sessions={sessionsBySpace[id]} mode={workspaceView === 'thread' ? 'thread' : 'agent'}
                      addNonce={addAgentBySpace[id] ?? 0} defaultModel={model} defaultVariant={selectedVariant}
                      openIds={openIdsBySpace[id] ?? []} onOpenIdsChange={(ids) => setSpaceOpenIds(id, ids)}
                      providers={providers} rescanning={rescanning} onRescan={rescan}
                      onAddEndpoint={async (name, baseURL) => { await window.electronAPI.addEndpoint({ name, baseURL }); await rescan() }}
                      onRemoveEndpoint={async (endpointId) => { await window.electronAPI.removeEndpoint(endpointId); await rescan() }}
                      onSessionCreated={onSessionCreated} onSessionDeleted={onSessionDeleted} onReviewEdits={openEditReview} onOpenProjects={() => setScreen('projects')} goToProject={goToProject} />
                  </div>
                })}
              </div>
              <div className="absolute inset-0" style={{ display: workspaceView === 'workspace' ? 'block' : 'none' }}>
                <AllAgentsGrid entries={agentGridEntries} projects={projects.filter((item) => !item.hidden).map(({ id, name }) => ({ id, name }))} focusedProjectId={hasProject ? spaceId : null} mode="agent"
                  defaultModel={model} defaultVariant={selectedVariant} providers={providers} rescanning={rescanning} onRescan={rescan}
                  onAddEndpoint={async (name, baseURL) => { await window.electronAPI.addEndpoint({ name, baseURL }); await rescan() }}
                  onRemoveEndpoint={async (endpointId) => { await window.electronAPI.removeEndpoint(endpointId); await rescan() }}
                  onReviewEdits={openEditReview} onOpenProjects={() => setScreen('projects')} goToProject={goToProject}
                  onAddAgent={addAgentToSpace} onDelete={(id, sessionId) => api.deleteSession(id, sessionId).then(() => onSessionDeleted(id, sessionId))}
                  onClose={(id, sessionId) => setSpaceOpenIds(id, (openIdsBySpace[id] ?? []).filter((item) => item !== sessionId))} />
              </div>
              {workspaceView === 'edits' && <div className="absolute inset-0"><DiffViewer spaceId={spaceId} requests={editRequests} /></div>}
              <div className="absolute inset-0" style={{ display: workspaceView === 'code' ? 'block' : 'none' }}>
                <EditorWorkspace projectKey={`${spaceId}:${daemon.cwd ?? ''}`} available={hasProject && running} onRun={() => void runProject()} runDisabled={!running} />
              </div>
            </div>
            <div className="h-[34%] min-h-[160px] shrink-0 border-t border-slate-200" style={{ display: terminalOpen ? 'block' : 'none' }}>
              <TerminalPanel key={spaceId} spaceId={spaceId} connected={running} daemonKey={String(daemon.port)} visible={screen === 'workspace' && terminalOpen} initialView="shell" runNonce={runNonce} runCommand={runCommand} onClose={() => setTerminalOpen(false)} />
            </div>
          </div>
          {hasProject && project && <aside aria-label="Preview" className="context-panel flex flex-col" style={{ display: contextOpen ? 'flex' : 'none' }}>
            <ContextPanel projectId={spaceId} onClose={toggleContext}>
              <PreviewPanel projectKey={`${spaceId}:${daemon.cwd ?? ''}`} available={running} visible={screen === 'workspace' && contextOpen} />
            </ContextPanel>
          </aside>}
        </div>
      </div>
    </div>
  )
}
