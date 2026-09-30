import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AgentStatus from './AgentStatus'
import ModelPicker from './ModelPicker'
import StatusOrb from './StatusOrb'
import TodoPanel, { extractTodos } from './TodoPanel'
import { api } from '../services/api'
import type { MessageEntry } from '../services/streamHandler'
import type { LocalProvider, ModelRef, Part, PermissionReply, PermissionRequest, ReasoningPart, Session, ToolPart } from '../types/opencode'

interface ChatCanvasProps {
  compact?: boolean
  spaceId: string
  mode: 'agent' | 'thread'
  projectName: string
  projectPath?: string
  onNewSession: () => void
  /**
   * This space's chats, newest first. Omitted in compact (agent pane) mode — a pane owns a
   * single session, so a switcher there would be a lie.
   */
  sessions?: Session[]
  activeSessionId?: string | null
  onSelectSession?: (sessionId: string) => void
  navigationLocked: boolean
  messages: MessageEntry[]
  busy: boolean
  activity: string
  error: string | null
  onDismissError: () => void
  permissions: PermissionRequest[]
  onReviewEdits: () => void

  model: ModelRef | null
  variant: string | null
  providers: LocalProvider[]
  onSelectModel: (model: ModelRef) => void
  onSelectVariant: (variant: string | null) => void
  onRescan: () => void
  rescanning: boolean
  onAddEndpoint: (name: string, baseURL: string) => Promise<void>
  onRemoveEndpoint: (id: string) => Promise<void>

  ready: boolean
  hasProject: boolean
  hasModels: boolean
  /** Opens the project/folder picker — either from the composer's folder chip or the empty state. */
  onChooseProject: () => void
  onSend: (text: string, priority?: boolean) => Promise<void>
  onAbort: () => void
  queuedMessages: { id: string; text: string; priority: boolean }[]
  onRemoveQueued: (id: string) => void
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

const Markdown = memo(function Markdown({ text }: { text: string }) {
  return (
    <div className="md">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
    </div>
  )
})

/**
 * Reasoning is shown inline as it streams, the way the opencode transcript does it, rather
 * than hidden behind a "Thought for 12s" disclosure. Seeing the chain while it happens is the
 * point: a reasoning block you have to click to reveal tells you nothing about progress.
 */
const Reasoning = memo(function Reasoning({ part }: { part: ReasoningPart }) {
  const secs = part.time?.end ? Math.max(1, Math.round((part.time.end - part.time.start) / 1000)) : null
  const streaming = !part.time?.end
  if (!part.text.trim()) return null
  return (
    <div className="group/reasoning relative py-0.5 pl-5">
      <span
        aria-hidden="true"
        className={`absolute left-0 top-px select-none text-[13px] leading-5 transition-colors ${streaming ? 'text-aether-500' : 'text-slate-300'}`}
      >
        →
      </span>
      <p className="whitespace-pre-wrap break-words text-[12.5px] italic leading-relaxed text-slate-500">
        {part.text}
        {streaming && <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-aether-400 align-middle" />}
      </p>
      {secs !== null && (
        <span className="mt-0.5 block text-[10px] tabular-nums text-slate-300 opacity-0 transition-opacity group-hover/reasoning:opacity-100">
          thought for {secs}s
        </span>
      )}
    </div>
  )
})

/** Per-tool glyphs, in the spirit of the opencode transcript's tool legend. */
const TOOL_ICON: Record<string, string> = {
  read: 'M4 5h16M4 12h16M4 19h10',
  edit: 'M4 20h4L19 9l-4-4L4 16v4Z',
  write: 'M4 20h4L19 9l-4-4L4 16v4Z',
  patch: 'M4 20h4L19 9l-4-4L4 16v4Z',
  apply_patch: 'M4 20h4L19 9l-4-4L4 16v4Z',
  bash: 'M4 17l6-5-6-5M12 19h8',
  grep: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 3-4.3-4.3',
  glob: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 3-4.3-4.3',
  list: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  todowrite: 'M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9',
  task: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  webfetch: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 0c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z',
  todoread: 'M6 3h9l4 4v14H6V3Zm9 0v5h4',
}

/** Human labels, so the row reads "Grep" rather than "grep". */
const TOOL_LABEL: Record<string, string> = {
  grep: 'Grep',
  glob: 'Glob',
  read: 'Read',
  edit: 'Edit',
  write: 'Write',
  patch: 'Patch',
  apply_patch: 'Apply patch',
  bash: 'Shell',
  list: 'List',
  todowrite: 'Todo',
  todoread: 'Todo read',
  task: 'Task',
  webfetch: 'Fetch',
}

function toolSubtitle(part: ToolPart): string {
  const s = part.state
  const i = s.input ?? {}
  const v = i.filePath ?? i.command ?? i.pattern ?? i.path ?? i.description ?? i.url
  return typeof v === 'string' ? v : (s.status === 'completed' || s.status === 'running') ? s.title ?? '' : ''
}

const ToolCard = memo(function ToolCard({ part }: { part: ToolPart }) {
  const [open, setOpen] = useState(false)
  const reducedMotion = useReducedMotion()
  const s = part.state
  const running = s.status === 'running' || s.status === 'pending'
  const output = s.status === 'completed' ? s.output : s.status === 'error' ? s.error : ''
  const diag = s.status === 'completed' && typeof s.metadata?.diagnostics === 'object' ? s.metadata.diagnostics : null
  const diff = 'metadata' in s && typeof s.metadata?.diff === 'string' ? s.metadata.diff : null
  const duration = 'time' in s && s.time && 'end' in s.time ? ((s.time.end - s.time.start) / 1000).toFixed(1) : null
  const subtitle = toolSubtitle(part)
  const hasDetail = output.length > 0 || Object.keys(s.input ?? {}).length > 0

  const row = (
    <div className="tool-row">
      <button
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left transition hover:bg-slate-50"
      >
        <span className={`grid h-4 w-4 shrink-0 place-items-center ${running ? 'text-aether-500' : s.status === 'error' ? 'text-rose-500' : 'text-slate-400'}`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={TOOL_ICON[part.tool] ?? 'M12 3v18M3 12h18'} />
          </svg>
        </span>
        <span className="shrink-0 text-[11px] font-medium text-slate-400">{TOOL_LABEL[part.tool] ?? part.tool}</span>
        {subtitle && (
          <>
            <span aria-hidden="true" className="shrink-0 text-[11px] text-slate-300">·</span>
            <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-slate-600">{subtitle}</span>
          </>
        )}
        {!subtitle && <span className="flex-1" />}
        {diag && Object.keys(diag).length > 0 && <span className="shrink-0 rounded bg-amber-400/10 px-1.5 text-[10px] text-amber-600">LSP</span>}
        {s.status === 'error' && <span className="shrink-0 text-[10px] text-rose-600">failed</span>}
        {running && <span className="shrink-0 animate-pulse text-[10px] text-aether-600">running</span>}
        {!running && duration && <span className="shrink-0 text-[10px] tabular-nums text-slate-300">{duration}s</span>}
        {hasDetail && (
          <motion.svg
            aria-hidden="true"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: open ? 90 : 0 }}
            className="shrink-0 text-slate-300 transition-colors group-hover:text-slate-500"
          >
            <path d="m9 6 6 6-6 6" />
          </motion.svg>
        )}
      </button>
      {diff && <pre aria-label="File changes" className="my-0.5 max-h-48 overflow-auto rounded-md border border-slate-100 bg-slate-50 py-1 font-mono text-[11px] leading-5">{diff.split('\n').slice(0, 100).map((line, index) => <div key={index} className={`px-3 ${line.startsWith('+') ? 'bg-emerald-400/10 text-emerald-600' : line.startsWith('-') ? 'bg-rose-400/10 text-rose-600' : 'text-slate-500'}`}>{line || ' '}</div>)}{diff.split('\n').length > 100 && <span className="px-3 text-slate-500">Diff preview truncated.</span>}</pre>}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="space-y-2 rounded-md border border-slate-100 bg-slate-50/70 p-3">
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all font-mono text-[10.5px] text-slate-500">{JSON.stringify(s.input, null, 2)}</pre>
              {output && (
                <pre className={`max-h-72 overflow-auto whitespace-pre-wrap break-all font-mono text-[10.5px] ${s.status === 'error' ? 'text-rose-600' : 'text-slate-700'}`}>
                  {output.length > 20000 ? output.slice(0, 20000) + '\n… (truncated)' : output}
                </pre>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )

  if (running && !reducedMotion) {
    return (
      <motion.div
        layout="position"
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-md bg-aether-50/40 ring-1 ring-aether-100"
      >
        {row}
      </motion.div>
    )
  }

  return (
    <motion.div layout="position" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
      {row}
    </motion.div>
  )
})

const PartView = memo(function PartView({ part }: { part: Part }) {
  switch (part.type) {
    case 'text':
      return part.synthetic || part.ignored || !part.text ? null : <Markdown text={part.text} />
    case 'reasoning':
      return <Reasoning part={part} />
    case 'tool':
      return <ToolCard part={part} />
    default:
      return null
  }
})

function PermissionCard({ spaceId, request, onReviewEdits }: { spaceId: string; request: PermissionRequest; onReviewEdits: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const reply = async (r: PermissionReply) => {
    setBusy(true)
    try {
      await api.replyPermission(spaceId, request.id, r)
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }
  const isEdit = request.permission === 'edit'
  const command = typeof request.metadata.command === 'string' ? request.metadata.command : null
  const subject = command ?? request.patterns.join(', ')
  const label =
    isEdit ? 'wants to edit' : request.permission === 'bash' ? 'wants to run' : request.permission === 'external_directory' ? 'wants to access outside the project' : `requests “${request.permission}”`

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} className="rounded-xl bg-amber-50 p-3 ring-1 ring-amber-400/20">
      <div className="flex items-center gap-2 text-[11px]">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
        <span className="font-medium text-amber-600">Agent paused</span>
        <span className="text-slate-500">{label}</span>
      </div>
      {subject && <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-white px-2.5 py-1.5 font-mono text-[11px] text-slate-900 ring-1 ring-slate-200">{subject}</pre>}
      {request.permission === 'bash' && (
        <p className="mt-1.5 text-[11px] text-amber-600">Commands can change files. Review the command before allowing it.</p>
      )}
      {error && <p className="mt-1.5 text-[11px] text-rose-600">{error}</p>}
      <div className="mt-2.5 flex gap-2">
        {isEdit ? (
          <button onClick={onReviewEdits} className="rounded-lg bg-amber-400 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-amber-300">
            Review diff →
          </button>
        ) : (
          <>
            <button disabled={busy} onClick={() => reply('once')} className="rounded-lg bg-emerald-500 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-50">Allow</button>
            <button disabled={busy} onClick={() => reply('reject')} className="rounded-lg bg-rose-500 px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50">Deny</button>
          </>
        )}
      </div>
    </motion.div>
  )
}

const MessageView = memo(function MessageView({ entry, mode }: { entry: MessageEntry; mode: 'agent' | 'thread' }) {
  const { info, parts } = entry
  if (info.role === 'user') {
    const text = parts.filter((p): p is Extract<Part, { type: 'text' }> => p.type === 'text' && !p.synthetic).map((p) => p.text).join('\n')
    if (!text) return null
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="prompt-line flex justify-end">
        <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-aether-50 px-4 py-2.5 text-[13.5px] leading-relaxed text-slate-900 ring-1 ring-aether-100">{text}</div>
      </motion.div>
    )
  }
  const err = info.error && info.error.name !== 'MessageAbortedError' ? info.error.data?.message || info.error.name : null
  const aborted = info.error?.name === 'MessageAbortedError'
  return (
    <div className="space-y-1.5">
      {parts.filter((part) => (mode === 'agent' || part.type !== 'tool') && !(part.type === 'tool' && part.tool === 'todowrite')).map((part) => <PartView key={part.id} part={part} />)}
      {mode === 'thread' && parts.some((part) => part.type === 'tool') && <details className="text-xs text-slate-500"><summary className="cursor-pointer py-1">Tool activity ({parts.filter((part) => part.type === 'tool').length})</summary><div className="space-y-0.5 py-1">{parts.filter((part) => part.type === 'tool').map((part) => <PartView key={part.id} part={part} />)}</div></details>}
      {aborted && <p className="pt-1 text-[11px] italic text-slate-400">Stopped.</p>}
      {err && <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 ring-1 ring-rose-200">{err}</div>}
    </div>
  )
})

interface ComposerProps extends Pick<ChatCanvasProps, 'model' | 'variant' | 'providers' | 'onSelectModel' | 'onSelectVariant' | 'onRescan' | 'rescanning' | 'onAddEndpoint' | 'onRemoveEndpoint' | 'projectName' | 'hasProject' | 'hasModels' | 'ready' | 'busy' | 'onChooseProject' | 'onAbort'> {
  onSubmit: (text: string, priority?: boolean) => Promise<void>
  autoFocus?: boolean
}

function Composer(props: ComposerProps) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 220) + 'px'
  }, [draft])

  const canSend = props.ready && props.hasModels && !!props.model && draft.trim().length > 0 && !sending
  const submit = async (priority = false) => {
    if (!canSend) return
    const text = draft.trim()
    setSending(true)
    setSendError(null)
    try {
      await props.onSubmit(text, priority)
      setDraft('')
    } catch (error) {
      setSendError(error instanceof Error ? error.message : String(error))
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-2xl bg-white p-2.5 ring-1 ring-slate-200 transition focus-within:ring-aether-400">
      <div className="flex items-end gap-2 pl-1.5">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              void submit(e.ctrlKey || e.metaKey)
            }
          }}
          rows={1}
          autoFocus={props.autoFocus}
          disabled={!props.ready}
          aria-label="Message agent"
          placeholder={!props.hasModels ? 'Connect a model to start' : props.busy ? 'Type another message to queue it' : !props.hasProject ? 'Ask anything, or add a project for code' : 'Give the agent a task...'}
          className="max-h-[220px] min-h-[26px] flex-1 resize-none bg-transparent py-1.5 text-[14px] leading-6 text-slate-900 placeholder-slate-400 outline-none disabled:cursor-not-allowed"
        />
        {props.busy ? (
          <button onClick={props.onAbort} title="Stop" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-900 transition hover:bg-rose-500/80 hover:text-white active:scale-90">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16" rx="3" /></svg>
          </button>
        ) : (
          <button onClick={() => void submit()} disabled={!canSend} title="Send (Enter)" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-aether-600 text-white transition hover:bg-aether-500 active:scale-90 disabled:bg-slate-100 disabled:text-slate-400 disabled:active:scale-100">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
          </button>
        )}
      </div>

      {sendError && <p className="px-2 pb-1 pt-2 text-[11px] text-rose-600">Could not send: {sendError}</p>}
      {props.busy && draft.trim() && (
        <p className="px-2 pb-1 pt-1 text-[10.5px] text-slate-500">Enter queues · Ctrl/⌘+Enter sends next</p>
      )}

      {/* controls row — project on the left, model picker on the right (like the reference GUI) */}
      <div className="mt-1 flex items-center justify-between gap-2">
        <button onClick={props.onChooseProject} className="flex max-w-[45%] items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.97]" title={props.hasProject ? 'Change project folder' : 'Open a project folder'}>
          <svg className="h-3.5 w-3.5 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" /></svg>
          <span className="truncate">{props.hasProject ? props.projectName : 'Choose project'}</span>
        </button>
        <ModelPicker
          providers={props.providers}
          selected={props.model}
          variant={props.variant}
          onSelect={props.onSelectModel}
          onSelectVariant={props.onSelectVariant}
          onRescan={props.onRescan}
          rescanning={props.rescanning}
          onAddEndpoint={props.onAddEndpoint}
          onRemoveEndpoint={props.onRemoveEndpoint}
          direction="up"
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------

/**
 * Picks which chat in this space is on screen. A single-chat space otherwise strands you on
 * whichever session happened to be last active with no way back to the rest, so the list is
 * the difference between a transcript viewer and a usable chat.
 */
function ChatSwitcher({ spaceName, sessions, activeSessionId, onSelect, onNew }: {
  spaceName: string
  sessions: Session[]
  activeSessionId: string | null
  onSelect: (id: string) => void
  onNew: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape) }
  }, [open])

  const active = sessions.find((session) => session.id === activeSessionId)
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Chats in ${spaceName}`}
        className="flex h-6 max-w-[190px] items-center gap-1.5 rounded-lg px-1.5 text-[11px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
      >
        <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5" />
        </svg>
        <span className="truncate">{active?.title ?? 'New chat'}</span>
        <span aria-hidden="true" className="shrink-0 text-[9px] text-slate-300">▼</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-2 max-h-72 w-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-aegean-lg">
          <button
            role="menuitem"
            onClick={() => { setOpen(false); onNew() }}
            className="mb-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-[12px] font-medium text-aether-700 transition hover:bg-aether-50"
          >
            <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
            New chat
          </button>
          {sessions.map((session) => {
            const selected = session.id === activeSessionId
            return (
              <button
                key={session.id}
                role="menuitem"
                onClick={() => { setOpen(false); onSelect(session.id) }}
                className={`flex w-full items-start gap-2 rounded-xl px-2 py-1.5 text-left transition hover:bg-slate-50 ${selected ? 'bg-aether-50 ring-1 ring-aether-200' : ''}`}
              >
                <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${selected ? 'bg-aether-500' : 'bg-slate-200'}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[12px] ${selected ? 'font-medium text-slate-900' : 'text-slate-700'}`}>{session.title}</span>
                  <span className="block truncate font-mono text-[9.5px] text-slate-400">{new Date(session.time.updated).toLocaleString()}</span>
                </span>
              </button>
            )
          })}
          {sessions.length === 0 && <p className="px-2 py-3 text-center text-[11.5px] text-slate-400">No chats here yet.</p>}
        </div>
      )}
    </div>
  )
}

export default function ChatCanvas(props: ChatCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)

  const onScroll = () => {
    const el = scrollRef.current
    if (el) stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }
  // Scoped to messages (not every render, e.g. composer keystrokes) so a long streaming
  // reply isn't fighting an unrelated re-render loop on top of its own delta updates.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [props.messages])

  const send = async (text: string, priority = false) => {
    stickToBottom.current = true
    await props.onSend(text, priority)
  }

  const composerProps: ComposerProps = {
    projectName: props.projectName,
    model: props.model,
    variant: props.variant,
    providers: props.providers,
    onSelectModel: props.onSelectModel,
    onSelectVariant: props.onSelectVariant,
    onRescan: props.onRescan,
    rescanning: props.rescanning,
    onAddEndpoint: props.onAddEndpoint,
    onRemoveEndpoint: props.onRemoveEndpoint,
    hasProject: props.hasProject,
    hasModels: props.hasModels,
    ready: props.ready,
    busy: props.busy,
    onChooseProject: props.onChooseProject,
    onAbort: props.onAbort,
    onSubmit: send,
  }

  const showWelcome = props.messages.length === 0 && !props.busy
  const todos = useMemo(() => extractTodos(props.messages), [props.messages])

  return (
    <main className={`flex min-h-0 min-w-0 flex-1 flex-col bg-white ${props.mode === 'agent' ? 'agent-transcript' : ''}`}>
      {!props.compact && <header className="flex h-10 shrink-0 items-center gap-2 border-b border-slate-200 px-3">
        <StatusOrb kind={props.busy ? 'working' : props.permissions.length ? 'attention' : props.ready ? 'ready' : 'connecting'} size={13} />
        <span className="min-w-0 truncate font-mono text-[11px] text-slate-500" title={props.projectPath}>{props.projectName}</span>
        <span role="status" className={`ml-auto shrink-0 text-[10px] ${props.permissions.length ? 'text-amber-600' : props.busy ? 'text-aether-600' : 'text-slate-400'}`}>{props.permissions.length ? 'Needs approval' : props.busy ? 'Working' : props.ready ? 'Ready' : 'Connecting'}</span>
        {props.sessions && <ChatSwitcher spaceName={props.projectName} sessions={props.sessions} activeSessionId={props.activeSessionId ?? null} onSelect={props.onSelectSession ?? (() => {})} onNew={props.onNewSession} />}
        <button onClick={props.onNewSession} disabled={props.navigationLocked || !props.ready} aria-label="New chat" title="New chat" className="grid h-6 w-6 shrink-0 place-items-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30">+</button>
      </header>}
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className={`mx-auto space-y-4 p-4 ${props.mode === 'thread' ? 'max-w-3xl' : ''}`}>
          {!props.compact && <div className="mb-6 border-b border-slate-200 pb-4">
            <h1 className="text-sm font-semibold text-slate-900">OpenCode <span className="ml-1 font-normal text-slate-500">{props.mode === 'thread' ? 'Thread' : 'Agent'}</span></h1>
            <p className="mt-1 font-mono text-[11px] text-slate-500">{props.model ? `${props.model.providerID} / ${props.model.modelID}` : 'No model connected'}</p>
            <p className="mt-1 truncate font-mono text-[11px] text-slate-500" title={props.projectPath}>{props.projectPath ?? 'General workspace'}</p>
          </div>}
          {showWelcome && <div className="max-w-lg space-y-3 py-4">
            <h2 className="text-base font-medium text-slate-900">{props.compact ? 'Give this agent a task' : props.hasProject ? 'What are we working on?' : 'Your next project starts here.'}</h2>
            <p className="text-xs leading-relaxed text-slate-500">{props.hasProject ? 'Give the agent a task. Follow its commands, file edits, and results here while you work.' : 'Open a project to work with files, run commands, and preview your app. Or start a conversation in General.'}</p>
            {!props.hasProject && <button onClick={props.onChooseProject} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 transition hover:bg-slate-50">Choose a project</button>}
            {!props.hasModels && <p className="border-l border-slate-200 pl-3 text-xs leading-relaxed text-slate-500">Start a local model server or connect a provider in OpenCode, then select a model below.</p>}
          </div>}
          {props.messages.map((entry) => <MessageView key={entry.info.id} entry={entry} mode={props.mode} />)}
          <AnimatePresence>{props.permissions.map((request) => <PermissionCard key={request.id} spaceId={props.spaceId} request={request} onReviewEdits={props.onReviewEdits} />)}</AnimatePresence>
          {props.error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-600 ring-1 ring-rose-200"><span className="flex-1">{props.error}</span><button aria-label="Dismiss agent error" className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded hover:bg-rose-100" onClick={props.onDismissError}><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button></div>}
          {todos && todos.length > 0 && <TodoPanel todos={todos} />}
          {props.busy && <AgentStatus label={props.activity} />}
        </div>
      </div>
      <div className="shrink-0 border-t border-slate-200 p-3">
        <div className={props.mode === 'thread' ? 'mx-auto max-w-3xl' : ''}>
              <AnimatePresence initial={false}>
                {props.queuedMessages.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                    exit={{ opacity: 0, y: 8, height: 0 }}
                    className="mb-2 overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200"
                  >
                    <div className="flex items-center px-3 py-1.5 text-[10.5px] text-slate-500">
                      <span>Queued messages</span>
                      <span className="ml-auto font-mono">{props.queuedMessages.length}</span>
                    </div>
                    <div className="max-h-28 space-y-px overflow-y-auto border-t border-slate-200 p-1.5">
                      {props.queuedMessages.map((message, index) => (
                        <motion.div
                          layout
                          key={message.id}
                          className="group flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-white"
                        >
                          <span className="w-4 shrink-0 text-center font-mono text-[9px] text-slate-400">{index + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-[11.5px] text-slate-700">{message.text}</span>
                          {message.priority && <span className="rounded bg-aether-100 px-1.5 py-0.5 text-[9px] font-medium text-aether-700">Next</span>}
                          <button
                            onClick={() => props.onRemoveQueued(message.id)}
                            className="grid h-5 w-5 place-items-center rounded text-slate-400 opacity-0 transition hover:bg-slate-200 hover:text-slate-700 group-hover:opacity-100"
                            title="Remove queued message"
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" /></svg>
                          </button>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
          <Composer {...composerProps} />
          <p className="mt-2 px-1 text-[10px] text-slate-500">Enter to send <span className="px-1">/</span> Shift+Enter for a new line{props.busy ? ' / Messages are queued while the agent works' : ''}</p>
        </div>
      </div>
    </main>
  )
}
