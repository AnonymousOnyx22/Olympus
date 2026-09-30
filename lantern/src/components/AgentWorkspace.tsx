import { useEffect, useRef, useState } from 'react'
import ChatCanvas from './ChatCanvas'
import StatusOrb, { type OrbKind } from './StatusOrb'
import { api } from '../services/api'
import { describeActivity, useSessionStream } from '../services/streamHandler'
import type { LocalProvider, ModelRef, Session } from '../types/opencode'

/** Everything shared by every agent pane, regardless of which project it belongs to. */
export interface AgentPaneShared {
  mode: 'agent' | 'thread'
  defaultModel: ModelRef | null
  defaultVariant: string | null
  providers: LocalProvider[]
  rescanning: boolean
  onRescan: () => void
  onAddEndpoint: (name: string, baseURL: string) => Promise<void>
  onRemoveEndpoint: (id: string) => Promise<void>
  onReviewEdits: () => void
  onOpenProjects: () => void
  /** Focuses a specific project's own view — what the folder chip in an agent's composer jumps to. */
  goToProject: (spaceId: string) => void
}

interface Props extends AgentPaneShared {
  spaceId: string
  projectName: string
  projectPath?: string
  ready: boolean
  /** Set when the project's daemon failed to start (not just "still starting"). */
  daemonError?: string
  onRetry: () => void
  sessions: Session[] | undefined
  /** Which of this project's sessions have an open agent window — owned by the caller so a
   * cross-project view can show and close the same windows. */
  openIds: string[]
  onOpenIdsChange: (ids: string[]) => void
  onSessionCreated: (spaceId: string, session: Session) => void
  onSessionDeleted: (spaceId: string, sessionId: string) => void
}

const buttonClass = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-40'

export default function AgentWorkspace(props: Props) {
  const { openIds, onOpenIdsChange } = props
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const creatingRef = useRef(false)
  const restored = useRef(false)

  const deleteSession = async (id: string) => {
    if (deletingId) return
    setDeletingId(id)
    setError('')
    try {
      await api.deleteSession(props.spaceId, id)
      props.onSessionDeleted(props.spaceId, id)
    } catch (reason) { setError(String(reason)) }
    finally { setDeletingId(null) }
  }

  // Drop windows for sessions that no longer exist, once the session list has loaded.
  useEffect(() => {
    if (!props.sessions || restored.current) return
    restored.current = true
    const filtered = openIds.filter((id) => props.sessions!.some((session) => session.id === id))
    if (filtered.length !== openIds.length) onOpenIdsChange(filtered)
  }, [props.sessions, openIds, onOpenIdsChange])

  const addAgent = async () => {
    if (!props.ready || creatingRef.current) return
    creatingRef.current = true
    setCreating(true)
    setError('')
    try {
      const session = await api.createSession(props.spaceId, `Agent ${(props.sessions?.length ?? 0) + 1}`)
      props.onSessionCreated(props.spaceId, session)
      onOpenIdsChange(openIds.includes(session.id) ? openIds : [...openIds, session.id])
    } catch (reason) { setError(String(reason)) }
    finally { creatingRef.current = false; setCreating(false) }
  }

  return <section aria-label={`${props.projectName} agent workspace`} className="flex h-full min-h-0 flex-col">
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <span className="mr-auto text-xs text-slate-500">{openIds.length} agent window{openIds.length === 1 ? '' : 's'}</span>
      <button onClick={() => void addAgent()} disabled={!props.ready || creating || !props.sessions} className={`${buttonClass} bg-slate-50`}>{creating ? 'Opening...' : '+ Add agent'}</button>
    </header>
    {error && <p role="alert" className="px-3 py-2 text-xs text-rose-600">{error}</p>}
    {openIds.length === 0 ? <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
      <h1 className="text-lg font-medium text-slate-900">{props.projectName} workspace</h1>
      {props.daemonError ? (
        <>
          <p className="max-w-sm text-xs leading-relaxed text-rose-600">Couldn't start this project's agent. {props.daemonError}</p>
          <button onClick={props.onRetry} className={`${buttonClass} mt-2`}>Try again</button>
        </>
      ) : (
        <>
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">Open agent windows for the work you want to do. Each chat runs independently in this project's folder.</p>
          <button onClick={() => void addAgent()} disabled={!props.ready || creating || !props.sessions} className={`${buttonClass} mt-2`}>{props.ready ? 'Add your first agent' : 'Starting workspace...'}</button>
        </>
      )}
      <p className="text-[11px] text-slate-400">Ctrl/⌘ J terminal · Ctrl/⌘ B preview</p>
    </div> : <div className="agent-grid min-h-0 flex-1 overflow-auto p-2">
      {openIds.map((id, index) => <div key={id} className="agent-grid-cell p-1">
        <AgentPane {...props} sessionID={id} title={props.sessions?.find((session) => session.id === id)?.title ?? `Agent ${index + 1}`}
          onClose={() => onOpenIdsChange(openIds.filter((item) => item !== id))}
          onDelete={() => void deleteSession(id)} deleting={deletingId === id} />
      </div>)}
    </div>}
  </section>
}

interface QueuedPrompt { id: string; text: string; priority: boolean; model: ModelRef; variant: string | null }

export interface AgentPaneProps extends AgentPaneShared {
  spaceId: string
  projectName: string
  projectPath?: string
  ready: boolean
  sessionID: string
  title: string
  onClose: () => void
  onDelete: () => void
  deleting: boolean
}

export function AgentPane(props: AgentPaneProps) {
  const stream = useSessionStream(props.spaceId, props.sessionID, props.ready)
  const [model, setModel] = useState(props.defaultModel)
  const [variant, setVariant] = useState(props.defaultVariant)
  const [queue, setQueue] = useState<QueuedPrompt[]>([])
  const [queuePaused, setQueuePaused] = useState(false)
  const [error, setError] = useState('')
  const sending = useRef(false)
  const aborting = useRef(false)
  const busy = stream.status.type !== 'idle'
  const permissions = stream.permissions.filter((request) => request.sessionID === props.sessionID)
  useEffect(() => { if (!model && props.defaultModel) setModel(props.defaultModel) }, [model, props.defaultModel])

  const deliver = async (item: QueuedPrompt) => {
    sending.current = true
    stream.markBusy()
    try { await api.prompt(props.spaceId, props.sessionID, item.text, item.model, item.variant) }
    catch (reason) { stream.markIdle(); throw reason }
    finally { sending.current = false }
  }
  const send = async (text: string, priority = false) => {
    if (!model || !stream.loaded) throw new Error('Wait for this agent to connect and select a model.')
    const item = { id: crypto.randomUUID(), text, priority, model, variant }
    if (busy || sending.current || queue.length > 0 || queuePaused) {
      setQueue((items) => priority ? [item, ...items] : [...items, item])
      return
    }
    await deliver(item)
  }
  useEffect(() => {
    if (!props.ready || !stream.loaded || busy || queuePaused || sending.current || aborting.current || !queue.length) return
    const item = queue[0]
    setQueue((items) => items.filter((entry) => entry.id !== item.id))
    void deliver(item).catch((reason) => {
      setQueuePaused(true)
      setQueue((items) => [item, ...items])
      setError(`Queued message failed: ${String(reason)}`)
    })
  }, [busy, queue, queuePaused, props.ready, stream.loaded])

  const stop = async () => {
    aborting.current = true
    setQueuePaused(true)
    try { await api.abort(props.spaceId, props.sessionID); stream.markIdle() }
    catch (reason) { setError(String(reason)) }
    finally { aborting.current = false }
  }
  // A pending approval used to disable both Close and Delete outright. If the daemon died
  // while an approval was outstanding, that request stayed in local state forever and the
  // window could never be dismissed — a dead end with no way out. An approval the daemon is
  // no longer serving cannot block anything, so it does not block this.
  const effectivePermissions = props.ready ? permissions : []
  // Closing only removes the window (the chat is saved), so it never needs to wait for the
  // stream to finish loading — only for nothing to be at risk of loss (work in flight, a
  // queued message, or an approval waiting on you). A pane stuck on "Connecting" (e.g. no
  // model available yet) must still be closable, or it becomes a dead end.
  const canClose = !busy && !queue.length && !sending.current && !effectivePermissions.length
  const orbKind: OrbKind = !props.ready || !stream.loaded ? 'connecting' : effectivePermissions.length ? 'attention' : busy ? 'working' : 'ready'
  const statusLabel = !props.ready || !stream.loaded ? 'Connecting' : effectivePermissions.length ? 'Needs approval' : busy ? 'Working' : 'Ready'
  return <article aria-label={`Agent chat: ${props.title}`} data-session-id={props.sessionID} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl bg-white shadow-aegean ring-1 ring-slate-200 transition focus-within:ring-aether-400">
    <header className="flex h-9 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3">
      <StatusOrb kind={orbKind} size={13} />
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-900" title={`${props.projectName} · ${props.title}`}>{props.projectName} · {props.title}</span>
      <span role="status" className={`text-[10px] ${permissions.length ? 'text-amber-600' : busy ? 'text-aether-600' : 'text-slate-400'}`}>{statusLabel}</span>
      <button onClick={props.onDelete} disabled={!canClose || props.deleting} aria-label={`Delete ${props.title}`} title={canClose ? 'Permanently delete this chat' : 'Stop this agent and clear its queue or approvals before deleting'} className="grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-25">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13" /></svg>
      </button>
      <button onClick={props.onClose} disabled={!canClose} aria-label={`Close ${props.title}`} title={canClose ? 'Close window (chat is saved)' : 'Stop this agent and clear its queue or approvals before closing'} className="grid h-6 w-6 place-items-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-25"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
    </header>
    <ChatCanvas compact spaceId={props.spaceId} mode={props.mode} projectName={props.projectName} projectPath={props.projectPath}
      onNewSession={() => {}} navigationLocked={busy} messages={stream.messages} busy={busy} activity={describeActivity({ ...stream, permissions })}
      error={error || stream.error} onDismissError={() => { setError(''); stream.clearError() }} permissions={permissions} onReviewEdits={props.onReviewEdits}
      model={model} variant={variant} providers={props.providers} onSelectModel={(next) => { setModel(next); setVariant(null) }} onSelectVariant={setVariant}
      onRescan={props.onRescan} rescanning={props.rescanning} onAddEndpoint={props.onAddEndpoint} onRemoveEndpoint={props.onRemoveEndpoint}
      ready={props.ready && stream.loaded} hasProject hasModels={props.providers.some((provider) => provider.online && provider.models.length > 0)}
      onChooseProject={() => props.goToProject(props.spaceId)} onSend={send} onAbort={() => void stop()} queuedMessages={queue} onRemoveQueued={(id) => setQueue((items) => items.filter((item) => item.id !== id))} />
    {queuePaused && queue.length > 0 && <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500"><span>Queue paused</span><button onClick={() => { setQueuePaused(false); setError('') }} className="rounded-lg px-2 py-1 text-slate-900 transition hover:bg-white">Resume queue</button></div>}
  </article>
}
