import { useState } from 'react'
import OlympusLogo from './OlympusLogo'
import StatusOrb, { type OrbKind } from './StatusOrb'
import { GENERAL_SPACE } from '../constants'
import type { DaemonState, ProjectInfo, Skill } from '../types/opencode'

interface SidebarProps {
  daemon: DaemonState
  projects: ProjectInfo[]
  projectsActive: boolean
  spaceId: string
  busyBySpace: Record<string, boolean>
  runningBySpace: Record<string, boolean>
  busy: boolean
  workspaceActive: boolean
  workspaceAgentCount: number
  onOpenWorkspace: () => void
  navigationLocked: boolean
  onOpenProjects: () => void
  onOpenProject: (id: string) => void
  onNewSession: () => void
  onAddProject: () => void
  skills: Skill[]
}
const iconClass = 'grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40'
function Icon({ path }: { path: string }) { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg> }

export default function Sidebar(props: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('olympus.sidebarCollapsed') === 'true')
  const [skillsOpen, setSkillsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const toggle = () => setCollapsed((value) => { localStorage.setItem('olympus.sidebarCollapsed', String(!value)); return !value })
  // General is an internal fallback space (used only if you somehow have zero projects
  // selected), not something to show or pick from the project list.
  const spaces = props.projects.map((project) => ({ id: project.id, name: project.name, path: project.path, exists: project.exists }))
  const needle = query.trim().toLowerCase()
  const daemonOrb: OrbKind = props.busy ? 'working' : props.daemon.status === 'running' ? 'ready' : props.daemon.status === 'starting' ? 'connecting' : props.daemon.status === 'error' ? 'attention' : 'idle'
  return (
    <aside aria-label="Workspaces" className={`flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 motion-reduce:transition-none ${collapsed ? 'w-12' : 'w-[242px] max-w-[65vw]'}`}>
      <div className="flex h-11 shrink-0 items-center gap-2 px-2">
        {!collapsed && <><OlympusLogo size={19} className="text-sky-600" /><span className="flex-1 text-sm font-semibold tracking-tight text-slate-900">Olympus</span></>}
        <button onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={iconClass}><Icon path={collapsed ? 'M3 3h18v18H3zM9 3v18m4-12 3 3-3 3' : 'M3 3h18v18H3zM9 3v18m7-12-3 3 3 3'} /></button>
      </div>
      {collapsed ? <nav aria-label="Quick navigation" className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-slate-50 py-3 ring-1 ring-slate-200">
        <button onClick={props.onNewSession} disabled={props.daemon.status !== 'running'} title="Add agent" aria-label="Add agent" className={iconClass}><Icon path="M12 5v14M5 12h14" /></button>
        <button onClick={props.onOpenProjects} title="Manage projects" aria-label="Manage projects" className={iconClass}><Icon path="M3 7V5h6l2 2h10v12H3Z" /></button>
        <button onClick={() => { setCollapsed(false); localStorage.setItem('olympus.sidebarCollapsed', 'false') }} title="Browse workspaces" aria-label="Browse workspaces" className={iconClass}><Icon path="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></button>
        <span className="mt-auto" title={`Agent ${props.daemon.status}`}><StatusOrb kind={daemonOrb} size={12} /></span>
      </nav> : <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-slate-50 ring-1 ring-slate-200">
        <nav aria-label="Workspace controls" className="space-y-1 border-b border-slate-200 p-3">
          <button onClick={props.onNewSession} disabled={props.daemon.status !== 'running'} className="flex w-full items-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-sky-500 disabled:opacity-40"><Icon path="M12 5v14M5 12h14" />{props.spaceId === GENERAL_SPACE ? 'New chat' : 'Add agent'}</button>
          <button onClick={props.onOpenProjects} aria-pressed={props.projectsActive} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${props.projectsActive ? 'bg-white text-slate-900 shadow-aegean ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}><Icon path="M3 7V5h6l2 2h10v12H3Z" />Manage projects<span className="ml-auto text-[10px]">{props.projects.length}</span></button>
          <button onClick={props.onOpenWorkspace} aria-pressed={props.workspaceActive} title="Every open project's agents, side by side" className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${props.workspaceActive ? 'bg-white text-slate-900 shadow-aegean ring-1 ring-slate-200' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}><Icon path="M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z" />Workspace<span className="ml-auto text-[10px]">{props.workspaceAgentCount}</span></button>
          <button onClick={() => setSkillsOpen(!skillsOpen)} aria-expanded={skillsOpen} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-600 transition hover:bg-white hover:text-slate-900"><Icon path="m12 3 2 6 6 3-6 2-2 7-2-7-6-2 6-3 2-6Z" /><span>Skills</span><span className="ml-auto text-[10px]">{props.skills.length}</span></button>
          {skillsOpen && <div className="max-h-36 overflow-auto px-3 text-[11px] text-slate-500">{props.skills.length ? props.skills.map((skill) => <p key={skill.name} title={skill.description} className="py-1">{skill.name}</p>) : <p className="py-2">No skills available in this workspace.</p>}</div>}
        </nav>
        <div className="flex items-center px-3 pt-2"><h2 className="flex-1 text-xs font-medium text-slate-500">Projects</h2><button onClick={props.onAddProject} title="Add project" aria-label="Add project" className={iconClass}><Icon path="M12 5v14M5 12h14" /></button></div>
        <div className="px-3 pb-3"><input aria-label="Find project" placeholder="Find project" value={query} onChange={(event) => setQuery(event.target.value)} className="h-8 w-full rounded-xl bg-white px-2.5 text-xs text-slate-900 outline-none ring-1 ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-sky-400" /></div>
        <nav aria-label="Projects" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2">
          {spaces.filter((space) => !needle || space.name.toLowerCase().includes(needle)).map((space) => <button key={space.id} disabled={!space.exists} onClick={() => props.onOpenProject(space.id)} title={space.path} aria-current={space.id === props.spaceId && !props.projectsActive ? 'page' : undefined} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] transition disabled:opacity-40 ${space.id === props.spaceId && !props.projectsActive ? 'bg-sky-50 text-slate-900 ring-1 ring-sky-200' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}>
            <Icon path="M3 7V5h6l2 2h10v12H3Z" /><span className="min-w-0 flex-1 truncate">{space.name}</span>
            {props.busyBySpace[space.id]
              ? <span title="Agents working" aria-label="Agents working"><StatusOrb kind="working" size={12} /></span>
              : props.runningBySpace[space.id] && <span title="Open, idle" aria-label="Open, idle"><StatusOrb kind="open" size={12} /></span>}
          </button>)}
          {needle && !spaces.some((space) => space.name.toLowerCase().includes(needle)) && <p className="px-3 py-2 text-xs text-slate-500">No matching projects.</p>}
        </nav>
        <div className="mx-3 mt-3 flex items-center gap-1.5 border-t border-slate-200 px-2 py-2.5">
          <StatusOrb kind={daemonOrb} size={13} />
          <span role="status" className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{props.busy ? 'Agents working' : props.daemon.status === 'running' ? 'Ready' : props.daemon.status === 'starting' ? 'Starting…' : props.daemon.status === 'error' ? 'Failed to start' : 'Offline'}</span>
        </div>
      </div>}
    </aside>
  )
}
