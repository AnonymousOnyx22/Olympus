import { useEffect, useState } from 'react'
import { api } from '../services/api'
import type { Session, SessionStatus } from '../types/opencode'

interface TreeNode {
  session: Session
  status: SessionStatus
  children: TreeNode[]
}

function buildTree(sessions: Session[], statuses: Record<string, SessionStatus>, rootId: string): TreeNode[] {
  const byParent = new Map<string, Session[]>()
  for (const session of sessions) {
    if (!session.parentID) continue
    const siblings = byParent.get(session.parentID) ?? []
    siblings.push(session)
    byParent.set(session.parentID, siblings)
  }
  const build = (id: string): TreeNode[] =>
    (byParent.get(id) ?? [])
      .sort((a, b) => a.time.created - b.time.created)
      .map((session) => ({ session, status: statuses[session.id] ?? { type: 'idle' }, children: build(session.id) }))
  return build(rootId)
}

const dotClass = (status: SessionStatus) =>
  status.type === 'retry' ? 'animate-pulse bg-amber-500' : status.type === 'busy' ? 'animate-pulse bg-aether-500' : 'bg-emerald-500'
// Idle can also mean cancelled or failed; it is not evidence that the task succeeded.
const statusWord = (status: SessionStatus) => (status.type === 'busy' ? 'Working' : status.type === 'retry' ? 'Retrying' : 'Idle')

function Row({ node, depth }: { node: TreeNode; depth: number }) {
  return <>
    <div className="flex items-center gap-2 py-1 text-[11px]" style={{ paddingLeft: depth * 16 }}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotClass(node.status)}`} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-slate-700">{node.session.title || 'Sub-agent'}</span>
      <span className="shrink-0 text-[10px] text-slate-400">{statusWord(node.status)}</span>
    </div>
    {node.children.map((child) => <Row key={child.session.id} node={child} depth={depth + 1} />)}
  </>
}

/**
 * Sub-agents the lead agent delegated to, as a real tree: opencode gives each a session with
 * `parentID` set to whoever started it, so this is the actual delegation graph, not a flat
 * guess from tool-call names. A sub-agent can itself delegate further, hence the recursion.
 */
export default function SubagentTree({ spaceId, rootSessionId }: { spaceId: string; rootSessionId: string }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [statuses, setStatuses] = useState<Record<string, SessionStatus>>({})
  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const [list, status] = await Promise.all([api.listSessions(spaceId), api.sessionStatus(spaceId)])
        if (active) { setSessions(list); setStatuses(status) }
      } catch {
        // Leave the last known tree up rather than clearing it on one failed poll.
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 3000)
    return () => { active = false; window.clearInterval(interval) }
  }, [spaceId])

  const tree = buildTree(sessions, statuses, rootSessionId)
  if (!tree.length) return <p className="text-[11px] text-slate-500">No sub-agents yet. They appear here once this agent delegates a task.</p>

  return <div role="tree" aria-label="Sub-agents">{tree.map((node) => <Row key={node.session.id} node={node} depth={0} />)}</div>
}
