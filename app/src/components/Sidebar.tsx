import { useState } from 'react'
import KernLogo from './KernLogo'
import StatusOrb, { type OrbKind } from './StatusOrb'
import type { DaemonState, ProjectInfo, Skill } from '../types/opencode'

interface SidebarProps {
  daemon: DaemonState
  projects: ProjectInfo[]
  projectsActive: boolean
  spaceId: string
  busyBySpace: Record<string, boolean>
  runningBySpace: Record<string, boolean>
  /** Open agent window ids per project - a running daemon with none open isn't "open" to the
   * reader, just a background process they can't see or act on from here. */
  openIdsBySpace: Record<string, string[]>
  busy: boolean
  workspaceActive: boolean
  workspaceAgentCount: number
  onOpenWorkspace: () => void
  navigationLocked: boolean
  onOpenProjects: () => void
  /** Focuses a project: its files, terminal and preview become the ones on screen. */
  onOpenProject: (projectId: string) => void
  onOpenConnections: () => void
  connectionsActive: boolean
  /** Saved connections that are not known to be failing. */
  connectionCount: number
  /**
   * Opens the folder picker for a new agentic chat. It is a picker rather than an immediate
   * action because the folder is the one thing you cannot infer: an agent started without
   * being told where to work is working in the wrong place.
   */
  onNewAgent: () => void
  skills: Skill[]
}
const iconClass = 'grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40'
const LIGHTS = {
  closed: { label: 'Not open', className: 'bg-slate-300' },
  open: { label: 'Open, waiting for a task', className: 'bg-slate-400' },
  working: { label: 'Agent working', className: 'bg-emerald-500' },
} as const
function ProjectLight({ state }: { state: keyof typeof LIGHTS }) {
  const light = LIGHTS[state]
  return <span role="img" title={light.label} aria-label={light.label} className={`h-1.5 w-1.5 shrink-0 rounded-full ${light.className}`} />
}
function Chevron({ open }: { open: boolean }) { return <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg> }
function Icon({ path }: { path: string }) { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg> }

export default function Sidebar(props: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kern.sidebarCollapsed') === 'true')
  const [query, setQuery] = useState('')
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [skillsOpen, setSkillsOpen] = useState(false)
  const toggle = () => setCollapsed(value => { localStorage.setItem('kern.sidebarCollapsed', String(!value)); return !value })
  const daemonOrb: OrbKind = props.busy ? 'working' : props.daemon.status === 'running' ? 'ready' : props.daemon.status === 'starting' ? 'connecting' : props.daemon.status === 'error' ? 'attention' : 'idle'
  const destinations = [
    { label: 'Agents', active: props.workspaceActive, action: props.onOpenWorkspace, path: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
    { label: 'Projects', active: props.projectsActive, action: props.onOpenProjects, path: 'M3 7V5h6l2 2h10v12H3Z' },
    { label: 'Connections', active: props.connectionsActive, action: props.onOpenConnections, path: 'M8 12h8M9 7l-3 5 3 5M15 7l3 5-3 5' },
  ]
  const needle = query.trim().toLowerCase()
  const matches = (item: ProjectInfo) => !needle || `${item.name} ${item.path}`.toLowerCase().includes(needle)
  const byName = (a: ProjectInfo, b: ProjectInfo) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  const projects = props.projects.filter(project => !project.hidden && matches(project)).sort(byName)
  return <>
    <aside aria-label="Workspaces" className={`app-sidebar sidebar-refined flex h-full shrink-0 flex-col overflow-hidden ${collapsed ? 'sidebar-collapsed w-14' : 'w-[242px] max-w-[65vw]'}`}>
      <div className="sidebar-brand">
        {!collapsed && <><KernLogo size={19} /><span className="flex-1 text-sm font-semibold">Kern</span></>}
        <button onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={iconClass}><Icon path="M3 3h18v18H3zM9 3v18" /></button>
      </div>
      <button onClick={props.onNewAgent} className="sidebar-new" aria-label="New agent" title="New agent"><Icon path="M12 5v14M5 12h14" />{!collapsed && 'New agent'}</button>
      <nav aria-label="Workspace controls" className="sidebar-destinations">
        {destinations.map(item => <button type="button" key={item.label} onClick={item.action} aria-label={item.label} title={item.label} aria-pressed={item.active} className="sidebar-destination"><Icon path={item.path} />{!collapsed && <span>{item.label}</span>}</button>)}
      </nav>
      {!collapsed && <>
        <div className="sidebar-search"><input type="search" aria-label="Find projects" placeholder="Find projects" value={query} onChange={event => setQuery(event.target.value)} /></div>
        <div className="sidebar-library">
          <button className="sidebar-section-toggle" aria-expanded={projectsOpen || !!needle} aria-controls="sidebar-projects" onClick={() => setProjectsOpen(value => !value)}>Projects<span>{projects.length}</span><Chevron open={projectsOpen || !!needle} /></button>
          {(projectsOpen || needle) && <ul id="sidebar-projects" aria-label="Projects">
            {projects.map(project => <li key={project.id}><button type="button" onClick={() => props.onOpenProject(project.id)} title={project.path} aria-current={project.id === props.spaceId ? 'true' : undefined} className="sidebar-library-row"><Icon path="M3 7V5h6l2 2h10v12H3Z" /><span className="min-w-0 flex-1 truncate">{project.name}</span><ProjectLight state={props.busyBySpace[project.id] ? 'working' : (props.openIdsBySpace[project.id]?.length ?? 0) > 0 ? 'open' : 'closed'} /></button></li>)}
            {!projects.length && <li className="sidebar-empty">{needle ? 'No matching projects' : 'No projects yet'}</li>}
          </ul>}
        </div>
        <div className="sidebar-footer">
          <button type="button" onClick={() => setSkillsOpen(value => !value)} aria-expanded={skillsOpen} className="sidebar-section-toggle">Skills<span>{props.skills.length}</span><Chevron open={skillsOpen} /></button>
          {skillsOpen && <div className="sidebar-skills">{props.skills.length ? props.skills.map(skill => <p key={skill.name} title={skill.description}>{skill.name}</p>) : <p>No skills available</p>}</div>}
          <div className="sidebar-status"><StatusOrb kind={daemonOrb} size={10} /><span role="status">{props.busy ? 'Agents working' : props.daemon.status === 'running' ? 'Ready' : props.daemon.status === 'starting' ? 'Starting' : props.daemon.status === 'error' ? 'Failed to start' : 'Offline'}</span></div>
        </div>
      </>}
    </aside>
  </>
}
