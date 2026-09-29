import { useState } from 'react'
import { AgentPane, type AgentPaneShared } from './AgentWorkspace'

export interface AgentGridEntry {
  spaceId: string
  sessionId: string
  title: string
  projectName: string
  projectPath?: string
  ready: boolean
}

export interface AgentGridProject {
  id: string
  name: string
}

interface Props extends AgentPaneShared {
  entries: AgentGridEntry[]
  projects: AgentGridProject[]
  /** The currently-focused project, if any — preselected so "+ Add agent" works in one click. */
  focusedProjectId: string | null
  onClose: (spaceId: string, sessionId: string) => void
  onDelete: (spaceId: string, sessionId: string) => Promise<void>
  onAddAgent: (spaceId: string) => Promise<void>
  onOpenProjects: () => void
}

const buttonClass = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-40'

/** Every open agent window from every open project, side by side in one grid. */
export default function AllAgentsGrid({ entries, projects, focusedProjectId, onClose, onDelete, onAddAgent, ...shared }: Props) {
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const [deletingKey, setDeletingKey] = useState<string | null>(null)

  const deleteAgent = async (spaceId: string, sessionId: string) => {
    const key = `${spaceId}:${sessionId}`
    if (deletingKey) return
    setDeletingKey(key)
    setError('')
    try {
      await onDelete(spaceId, sessionId)
    } catch (reason) { setError(String(reason)) }
    finally { setDeletingKey(null) }
  }

  // Always add to whichever project is focused; fall back to the first known
  // project if none is (e.g. you're on General). No picker needed for the common case.
  const target = (focusedProjectId && projects.some((p) => p.id === focusedProjectId) ? focusedProjectId : projects[0]?.id) ?? ''
  const targetName = projects.find((p) => p.id === target)?.name

  const addAgent = async () => {
    if (!target || adding) return
    setAdding(true)
    setError('')
    try {
      await onAddAgent(target)
    } catch (reason) { setError(String(reason)) }
    finally { setAdding(false) }
  }

  const header = (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <span className="mr-auto text-xs text-slate-500">{entries.length} agent window{entries.length === 1 ? '' : 's'}</span>
      <button disabled={!target || adding} onClick={() => void addAgent()} title={targetName ? `Add an agent to ${targetName}` : 'Add a project first'} className={`${buttonClass} bg-slate-50`}>
        {adding ? 'Opening...' : '+ Add agent'}
      </button>
    </header>
  )

  if (!entries.length) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {header}
        {error && <p role="alert" className="px-3 py-2 text-xs text-rose-600">{error}</p>}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <h1 className="text-lg font-medium text-slate-900">No agents open yet</h1>
          <p className="max-w-sm text-xs leading-relaxed text-slate-500">
            Pick a project above and add an agent. Every project's agents show up here together.
          </p>
          {!projects.length && (
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
      <div className="agent-grid min-h-0 flex-1 overflow-auto p-2">
        {entries.map((entry) => (
          <div key={`${entry.spaceId}:${entry.sessionId}`} className="agent-grid-cell p-1">
            <AgentPane
              {...shared}
              spaceId={entry.spaceId}
              sessionID={entry.sessionId}
              title={entry.title}
              projectName={entry.projectName}
              projectPath={entry.projectPath}
              ready={entry.ready}
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
