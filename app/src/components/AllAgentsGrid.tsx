import { useEffect, useState } from 'react'
import { useDialogFocus } from './useDialogFocus'
import { AgentPane, type AgentPaneShared } from './AgentWorkspace'
import { errorText } from '../errorText'

export interface AgentGridEntry {
  spaceId: string
  sessionId: string
  title: string
  projectName: string
  projectPath?: string
  ready: boolean
  /** No engine has been started for this project yet; it starts when the user connects the chat. */
  idle?: boolean
  onStartEngine?: () => void
  /** Why this project's agent could not start, if it failed; replaces an endless "Connecting". */
  startError?: string
  onRetryStart?: () => void
}

interface Conversation {
  spaceId: string
  sessionId: string
  projectName: string
  title: string
  /** When the conversation last changed, in ms. */
  updated: number
  open: boolean
}

interface Props extends AgentPaneShared {
  conversations: Conversation[]
  onOpenConversation: (spaceId: string, sessionId: string) => void
  entries: AgentGridEntry[]
  hasProjects: boolean
  onClose: (spaceId: string, sessionId: string) => void
  onDelete: (spaceId: string, sessionId: string) => Promise<void>
  /** Always opens the project picker - never guesses which project you meant. */
  onRequestAddAgent: () => void
  onOpenProjects: () => void
}

/** "just now", "5m ago", "3h ago", "2d ago" - enough to tell identically titled chats apart. */
function timeAgo(time: number): string {
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000))
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

const buttonClass = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-40'

/** Every open agent window from every open project, side by side in one grid. */
export default function AllAgentsGrid({ entries, hasProjects, conversations, onOpenConversation, onClose, onDelete, onRequestAddAgent, ...shared }: Props) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const [error, setError] = useState('')
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const deleteAgent = async (spaceId: string, sessionId: string) => {
    const key = `${spaceId}:${sessionId}`
    if (deletingKey) return
    setDeletingKey(key)
    setError('')
    try {
      await onDelete(spaceId, sessionId)
    } catch (reason) { setError(errorText(reason)) }
    finally { setDeletingKey(null) }
  }

  const header = (
    <>
    {historyOpen && <ConversationPicker conversations={conversations} onClose={() => setHistoryOpen(false)} onPick={(entry) => { onOpenConversation(entry.spaceId, entry.sessionId); setHistoryOpen(false) }} />}
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <span className="mr-auto text-xs text-slate-500">{entries.length} agent window{entries.length === 1 ? '' : 's'}</span>
      <button onClick={() => setHistoryOpen(true)} className={buttonClass}>Open conversation</button>
      <button onClick={onRequestAddAgent} title="Choose which project to add an agent to" className={`${buttonClass} bg-slate-50`}>
        + Add agent
      </button>
    </header>
    </>
  )

  if (!entries.length) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        {error && <p role="alert" className="px-3 py-2 text-xs text-rose-600">{error}</p>}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-lg font-medium text-slate-900">No agents open yet</h1>
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">
            Choose Add agent, pick a project, and give it a task. Agents from every project show up here side by side.
          </p>
          {!hasProjects && (
            <button onClick={shared.onOpenProjects} className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50">
              Browse projects
            </button>
          )}
        </div>
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      {header}
      {error && <p role="alert" className="px-3 py-2 text-xs text-rose-600">{error}</p>}
      <div className="agent-grid min-h-0 flex-1 overflow-auto">
        {entries.map((entry) => (
          <div key={`${entry.spaceId}:${entry.sessionId}`} className="agent-grid-cell">
            <AgentPane
              {...shared}
              spaceId={entry.spaceId}
              sessionID={entry.sessionId}
              title={entry.title}
              projectName={entry.projectName}
              projectPath={entry.projectPath}
              ready={entry.ready}
              idle={entry.idle}
              onStartEngine={entry.onStartEngine}
              startError={entry.startError}
              onRetryStart={entry.onRetryStart}
              onClose={() => onClose(entry.spaceId, entry.sessionId)}
              onDelete={() => void deleteAgent(entry.spaceId, entry.sessionId)}
              deleting={deletingKey === `${entry.spaceId}:${entry.sessionId}`}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function ConversationPicker({ conversations, onPick, onClose }: {
  conversations: Conversation[]
  onPick: (entry: Conversation) => void
  onClose: () => void
}) {
  const dialogRef = useDialogFocus<HTMLDivElement>()
  const [query, setQuery] = useState('')
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [onClose])
  const matches = conversations.filter((entry) => `${entry.projectName} ${entry.title}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-midnight/70 p-4" onClick={onClose}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="conversation-title" tabIndex={-1} onClick={(event) => event.stopPropagation()} className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl bg-white p-5 shadow-float-lg">
      <h2 id="conversation-title" className="text-lg font-medium">Open conversation</h2>
      <p className="mt-1 text-xs text-slate-500">Reopen a saved conversation alongside your other agents. Open a project to load its saved conversations.</p>
      <input aria-label="Search conversations" placeholder="Search conversations" value={query} onChange={(event) => setQuery(event.target.value)} className="my-4 rounded-lg border border-slate-200 p-2 text-sm" />
      <div className="min-h-0 overflow-auto">
        {matches.map((entry) => <button key={`${entry.spaceId}:${entry.sessionId}`} onClick={() => onPick(entry)} className="mb-1 block w-full rounded-lg p-3 text-left hover:bg-slate-50">
          <span className="block text-sm font-medium">{entry.title}{entry.open && <span className="ml-2 rounded bg-slate-100 px-1.5 py-px align-middle text-[10px] font-normal text-slate-500">Open</span>}</span>
          <span className="text-xs text-slate-500">{entry.projectName} · <span title={new Date(entry.updated).toLocaleString()}>{timeAgo(entry.updated)}</span></span>
        </button>)}
        {!matches.length && <p className="py-4 text-sm text-slate-500">No saved conversations found.</p>}
      </div>
      <button onClick={onClose} className={`${buttonClass} mt-4 self-end`}>Cancel</button>
    </div>
  </div>
}
