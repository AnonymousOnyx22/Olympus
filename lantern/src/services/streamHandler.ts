import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { api } from './api'
import type {
  MessageInfo,
  MessageWithParts,
  OpencodeEvent,
  Part,
  PermissionRequest,
  SessionStatus,
  ToolPart,
} from '../types/opencode'

// ---------------------------------------------------------------------------
// Agent terminal bus: streams the output of the agent's `bash` tool calls to xterm.
// ---------------------------------------------------------------------------

type TerminalListener = (chunk: string) => void
const terminalListeners = new Set<TerminalListener>()

/**
 * How much of each bash tool call has already been written to the agent terminal, keyed by
 * part id. The keys are needed to stay idempotent (a completed part must never re-pipe its
 * output), so this cannot simply be cleared — but it must be bounded, or a long session
 * grows the map without limit. Oldest entries are dropped first.
 */
const MAX_TRACKED_OUTPUT_PARTS = 2000
const writtenOutput = new Map<string, { header: boolean; length: number; done: boolean }>()

function trackOutput(partID: string, state: { header: boolean; length: number; done: boolean }) {
  // Re-insert so Map's insertion order doubles as a recency list.
  writtenOutput.delete(partID)
  writtenOutput.set(partID, state)
  while (writtenOutput.size > MAX_TRACKED_OUTPUT_PARTS) {
    const oldest = writtenOutput.keys().next()
    if (oldest.done) break
    writtenOutput.delete(oldest.value)
  }
}

export function onAgentTerminal(listener: TerminalListener): () => void {
  terminalListeners.add(listener)
  return () => terminalListeners.delete(listener)
}

const emitTerminal = (chunk: string) => {
  const normalized = chunk.replace(/\r?\n/g, '\r\n')
  for (const l of terminalListeners) l(normalized)
}

function pipeBashPart(part: ToolPart) {
  if (part.tool !== 'bash') return
  const s = part.state
  const seen = writtenOutput.get(part.id) ?? { header: false, length: 0, done: false }
  if (seen.done) return

  const command = typeof s.input.command === 'string' ? s.input.command : ''
  if (!seen.header && command && s.status !== 'pending') {
    emitTerminal(`\n\x1b[38;5;111m❯\x1b[0m \x1b[1m${command}\x1b[0m\n`)
    seen.header = true
  }

  let output = ''
  if (s.status === 'running') output = typeof s.metadata?.output === 'string' ? s.metadata.output : ''
  if (s.status === 'completed') output = s.output ?? ''
  if (output.length > seen.length) {
    emitTerminal(output.slice(seen.length))
    seen.length = output.length
  }
  if (s.status === 'error') emitTerminal(`\x1b[31m${s.error}\x1b[0m\n`)
  if (s.status === 'completed' || s.status === 'error') {
    seen.done = true
    const exit = s.metadata?.exit
    if (typeof exit === 'number' && exit !== 0) emitTerminal(`\x1b[31m[exit ${exit}]\x1b[0m\n`)
  }
  trackOutput(part.id, seen)
}
// ---------------------------------------------------------------------------
// Session stream state
// ---------------------------------------------------------------------------

export interface MessageEntry {
  info: MessageInfo
  parts: Part[]
}

export interface StreamState {
  sessionID: string | null
  messages: MessageEntry[]
  status: SessionStatus
  /** Pending permission requests for every session in the project (sub-agents included). */
  permissions: PermissionRequest[]
  error: string | null
}

type Action =
  | { type: 'reset'; sessionID: string | null; messages: MessageWithParts[]; permissions: PermissionRequest[]; status: SessionStatus }
  | { type: 'event'; event: OpencodeEvent }
  | { type: 'clearError' }

const initialState: StreamState = {
  sessionID: null,
  messages: [],
  status: { type: 'idle' },
  permissions: [],
  error: null,
}

const byCreated = (a: MessageEntry, b: MessageEntry) =>
  a.info.time.created - b.info.time.created || a.info.id.localeCompare(b.info.id)

function upsertPart(parts: Part[], part: Part): Part[] {
  const i = parts.findIndex((p) => p.id === part.id)
  if (i === -1) return [...parts, part].sort((a, b) => a.id.localeCompare(b.id))
  const next = parts.slice()
  next[i] = part
  return next
}

function errorText(error: { name?: string; data?: { message?: string } } | undefined): string | null {
  if (!error) return null
  if (error.name === 'MessageAbortedError') return null
  return error.data?.message || error.name || 'Unknown error'
}

function reduce(state: StreamState, action: Action): StreamState {
  if (action.type === 'reset') {
    return {
      sessionID: action.sessionID,
      messages: action.messages.map((m) => ({ info: m.info, parts: m.parts })).sort(byCreated),
      permissions: action.permissions,
      status: action.status,
      error: null,
    }
  }
  if (action.type === 'clearError') return { ...state, error: null }

  const ev = action.event
  const active = state.sessionID
  switch (ev.type) {
    case 'message.updated': {
      if (ev.properties.sessionID !== active) return state
      const info = ev.properties.info
      const i = state.messages.findIndex((m) => m.info.id === info.id)
      const messages =
        i === -1
          ? [...state.messages, { info, parts: [] }].sort(byCreated)
          : state.messages.map((m, j) => (j === i ? { ...m, info } : m))
      return { ...state, messages }
    }
    case 'message.removed': {
      if (ev.properties.sessionID !== active) return state
      return { ...state, messages: state.messages.filter((m) => m.info.id !== ev.properties.messageID) }
    }
    case 'message.part.updated': {
      const part = ev.properties.part
      if (part.sessionID !== active) return state
      const i = state.messages.findIndex((m) => m.info.id === part.messageID)
      if (i === -1) {
        // Part arrived before its message; create a placeholder assistant entry.
        const info: MessageInfo = {
          id: part.messageID,
          sessionID: part.sessionID,
          role: 'assistant',
          time: { created: Date.now() },
        }
        return { ...state, messages: [...state.messages, { info, parts: [part] }].sort(byCreated) }
      }
      return {
        ...state,
        messages: state.messages.map((m, j) => (j === i ? { ...m, parts: upsertPart(m.parts, part) } : m)),
      }
    }
    case 'message.part.delta': {
      const { sessionID, messageID, partID, field, delta } = ev.properties
      if (sessionID !== active) return state
      return {
        ...state,
        messages: state.messages.map((m) => {
          if (m.info.id !== messageID) return m
          return {
            ...m,
            parts: m.parts.map((p) => {
              if (p.id !== partID) return p
              const current = (p as unknown as Record<string, unknown>)[field]
              return { ...p, [field]: (typeof current === 'string' ? current : '') + delta } as Part
            }),
          }
        }),
      }
    }
    case 'message.part.removed': {
      if (ev.properties.sessionID !== active) return state
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.info.id === ev.properties.messageID
            ? { ...m, parts: m.parts.filter((p) => p.id !== ev.properties.partID) }
            : m,
        ),
      }
    }
    case 'session.status':
      if (ev.properties.sessionID !== active) return state
      return { ...state, status: ev.properties.status }
    case 'session.idle':
      if (ev.properties.sessionID !== active) return state
      return { ...state, status: { type: 'idle' } }
    case 'session.error': {
      if (ev.properties.sessionID && ev.properties.sessionID !== active) return state
      const text = errorText(ev.properties.error)
      return text ? { ...state, error: text } : state
    }
    case 'permission.asked': {
      const req = ev.properties
      if (state.permissions.some((p) => p.id === req.id)) return state
      return { ...state, permissions: [...state.permissions, req] }
    }
    case 'permission.replied':
      return { ...state, permissions: state.permissions.filter((p) => p.id !== ev.properties.requestID) }
    default:
      return state
  }
}

/**
 * Subscribes to the opencode SSE stream (forwarded by the main process) and keeps a live
 * view of one session: messages with streaming parts, busy/idle status and pending approvals.
 */
export function useSessionStream(spaceId: string, sessionID: string | null, connected: boolean) {
  const [state, dispatch] = useReducer(reduce, initialState)
  const adopted = useRef<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const pendingEvents = useRef<OpencodeEvent[] | null>([])

  useEffect(() => {
    setLoaded(false)
    pendingEvents.current = []
    if (!connected) {
      dispatch({ type: 'reset', sessionID, messages: [], permissions: [], status: { type: 'idle' } })
      return
    }
    // A session we just created is known to be empty; fetching it would race the first stream events.
    if (sessionID && adopted.current === sessionID) {
      adopted.current = null
      pendingEvents.current = null
      setLoaded(true)
      return
    }
    let cancelled = false
    const load = async () => {
      const [messages, permissions, statuses] = await Promise.all([
        sessionID ? api.messages(spaceId, sessionID) : Promise.resolve([]),
        api.listPermissions(spaceId).catch(() => []),
        api.sessionStatus(spaceId).catch(() => ({}) as Record<string, SessionStatus>),
      ])
      if (cancelled) return
      const status = (sessionID && statuses[sessionID]) || { type: 'idle' as const }
      dispatch({ type: 'reset', sessionID, messages, permissions, status })
      pendingEvents.current?.forEach((event) => dispatch({ type: 'event', event }))
      pendingEvents.current = null
      setLoaded(true)
    }
    load().catch((err) => {
      if (!cancelled) { pendingEvents.current = null; setLoaded(true) }
      if (!cancelled) dispatch({ type: 'event', event: { type: 'session.error', properties: { error: { name: 'LoadError', data: { message: String(err.message ?? err) } } } } })
    })
    return () => {
      cancelled = true
    }
  }, [spaceId, sessionID, connected])

  useEffect(() => {
    if (!connected) return
    return window.electronAPI.onEvent((eventSpaceId, event) => {
      if (eventSpaceId !== spaceId) return
      if (event.type === 'message.part.updated' && event.properties.part.type === 'tool') {
        pipeBashPart(event.properties.part as ToolPart)
      }
      if (pendingEvents.current) pendingEvents.current.push(event)
      else dispatch({ type: 'event', event })
    })
  }, [spaceId, connected])

  const clearError = useCallback(() => dispatch({ type: 'clearError' }), [])

  /** Switches to a freshly created (empty) session immediately, so no early events are dropped. */
  const adoptNew = useCallback(
    (id: string) => {
      adopted.current = id
      dispatch({ type: 'reset', sessionID: id, messages: [], permissions: state.permissions, status: { type: 'busy' } })
    },
    [state.permissions],
  )

  const markBusy = useCallback(() => { if (sessionID) dispatch({ type: 'event', event: { type: 'session.status', properties: { sessionID, status: { type: 'busy' } } } }) }, [sessionID])
  const markIdle = useCallback(() => { if (sessionID) dispatch({ type: 'event', event: { type: 'session.idle', properties: { sessionID } } }) }, [sessionID])

  return { ...state, loaded, clearError, adoptNew, markBusy, markIdle }
}

// ---------------------------------------------------------------------------
// Human-readable activity label for the AgentStatus pill
// ---------------------------------------------------------------------------

const basename = (p: unknown) => (typeof p === 'string' ? p.split(/[\\/]/).pop() || p : '')
const clip = (s: string, n = 42) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

function describeTool(part: ToolPart): string {
  const input = part.state.input ?? {}
  switch (part.tool) {
    case 'read':
      return `Reading ${basename(input.filePath)}`
    case 'edit':
    case 'write':
    case 'patch':
    case 'apply_patch':
      return `Editing ${basename(input.filePath) || 'files'}`
    case 'bash':
      return `Running ${clip(String(input.command ?? 'command'), 32)}`
    case 'grep':
      return `Searching for “${clip(String(input.pattern ?? ''), 24)}”`
    case 'glob':
      return `Finding ${clip(String(input.pattern ?? 'files'), 28)}`
    case 'list':
      return 'Listing directory'
    case 'lsp':
    case 'lsp_diagnostics':
      return 'Checking diagnostics'
    case 'todowrite':
      return 'Updating plan'
    case 'task':
      return 'Delegating to sub-agent'
    default:
      return `Using ${part.tool}`
  }
}

export function describeActivity(state: StreamState): string {
  if (state.permissions.length > 0) return 'Awaiting your approval'
  if (state.status.type === 'retry') return clip(`Retrying: ${state.status.message}`, 48)

  const last = [...state.messages].reverse().find((m) => m.info.role === 'assistant')
  if (!last) return 'Starting'
  const running = [...last.parts]
    .reverse()
    .find((p): p is ToolPart => p.type === 'tool' && (p.state.status === 'running' || p.state.status === 'pending'))
  if (running) return describeTool(running)

  const tail = last.parts[last.parts.length - 1]
  if (!tail || tail.type === 'step-start') return 'Starting'
  if (tail.type === 'reasoning') return 'Reasoning'
  if (tail.type === 'text') return 'Composing reply'
  if (tail.type === 'tool') return 'Reviewing results'
  return 'Thinking'
}
