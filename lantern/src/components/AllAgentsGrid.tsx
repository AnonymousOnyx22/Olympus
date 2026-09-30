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

interface Props extends AgentPaneShared {
  entries: AgentGridEntry[]
  hasProjects: boolean
  onClose: (spaceId: string, sessionId: string) => void
  onDelete: (spaceId: string, sessionId: string) => Promise<void>
  /** Always opens the project picker — never guesses which project you meant. */
  onRequestAddAgent: () => void
  onOpenProjects: () => void
}

const buttonClass = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-40'

/** Every open agent window from every open project, side by side in one grid. */
export default function AllAgentsGrid({ entries, hasProjects, onClose, onDelete, onRequestAddAgent, ...shared }: Props) {
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

  const header = (
    <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
      <span className="mr-auto text-xs text-slate-500">{entries.length} agent window{entries.length === 1 ? '' : 's'}</span>
      <button disabled={!hasProjects} onClick={onRequestAddAgent} title="Choose which project to add an agent to" className={`${buttonClass} bg-slate-50`}>
        + Add agent
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
