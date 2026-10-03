import { useState } from 'react'
import OlympusLogo from './OlympusLogo'
import StatusOrb, { type OrbKind } from './StatusOrb'
import type { DaemonState, ProjectInfo, Skill } from '../types/opencode'

interface SidebarProps {
  daemon: DaemonState
  projects: ProjectInfo[]
  stores: ProjectInfo[]
  projectsActive: boolean
  spaceId: string
  busyBySpace: Record<string, boolean>
  runningBySpace: Record<string, boolean>
  /** Open agent window ids per project - a running daemon with none open isn't "open" to the
   * reader, just a background process they can't see or act on from here. */
  openIdsBySpace: Record<string, string[]>
  busy: boolean
  workspaceActive: boolean
  stationActive: boolean
  /** Station agents open, shown as the tab's count like the other tabs. */
  stationAgentCount: number
  /** How many of them are working right now; drives the green light. */
  stationWorkingCount: number
  workspaceAgentCount: number
  onOpenWorkspace: () => void
  onOpenStation: () => void
  /** Opens one specific store's manager in Station. */
  onOpenStore: (storeId: string) => void
  /** Opens Station straight to the overview grid of every store, not wherever Station last was. */
  navigationLocked: boolean
  onOpenProjects: () => void
  onOpenConnections: () => void
  connectionsActive: boolean
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
  open: { label: 'Open, waiting for a task', className: 'bg-amber-400 shadow-[0_0_4px_rgba(251,191,36,0.8)]' },
  working: { label: 'Agent working', className: 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.85)] animate-pulse' },
} as const
function ProjectLight({ state }: { state: keyof typeof LIGHTS }) {
  const light = LIGHTS[state]
  return <span role="img" title={light.label} aria-label={light.label} className={`h-1.5 w-1.5 shrink-0 rounded-full ${light.className}`} />
}
function Icon({ path }: { path: string }) { return <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg> }

export default function Sidebar(props: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('olympus.sidebarCollapsed') === 'true')
  const [skillsOpen, setSkillsOpen] = useState(false)
  const toggle = () => setCollapsed((value) => { localStorage.setItem('olympus.sidebarCollapsed', String(!value)); return !value })
  const daemonOrb: OrbKind = props.busy ? 'working' : props.daemon.status === 'running' ? 'ready' : props.daemon.status === 'starting' ? 'connecting' : props.daemon.status === 'error' ? 'attention' : 'idle'
  return (
    <aside aria-label="Workspaces" className={`flex h-full shrink-0 flex-col overflow-hidden transition-[width] duration-200 motion-reduce:transition-none ${collapsed ? 'w-12' : 'w-[242px] max-w-[65vw]'}`}>
      <div className="flex h-11 shrink-0 items-center gap-2 px-2">
        {!collapsed && <><OlympusLogo size={19} className="text-aether-600" /><span className="flex-1 text-sm font-semibold tracking-tight text-slate-900">Olympus</span></>}
        <button onClick={toggle} aria-expanded={!collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} className={iconClass}><Icon path={collapsed ? 'M3 3h18v18H3zM9 3v18m4-12 3 3-3 3' : 'M3 3h18v18H3zM9 3v18m7-12-3 3 3 3'} /></button>
      </div>
      {collapsed ? <nav aria-label="Quick navigation" className="flex flex-1 flex-col items-center gap-2 rounded-2xl bg-slate-50 py-3 ring-1 ring-slate-200">
        <button onClick={props.onNewAgent} title="New agent in a project folder" aria-label="New agent in a project folder" className={iconClass}><Icon path="M12 5v14M5 12h14" /></button>
        <button onClick={props.onOpenProjects} title="Manage projects" aria-label="Manage projects" className={iconClass}><Icon path="M3 7V5h6l2 2h10v12H3Z" /></button>
        <button onClick={props.onOpenStation} title="Station" aria-label="Station" aria-pressed={props.stationActive} className={`${iconClass} ${props.stationActive ? 'bg-aether-50 text-aether-700' : ''}`}><Icon path="M4 20h16M6 20V8m6 12V8m6 12V8M3 8l9-5 9 5M3 8h18" /></button>
        <button onClick={() => { setCollapsed(false); localStorage.setItem('olympus.sidebarCollapsed', 'false') }} title="Browse workspaces" aria-label="Browse workspaces" className={iconClass}><Icon path="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" /></button>
        <button onClick={props.onOpenConnections} title="Connections" aria-label="Connections" aria-pressed={props.connectionsActive} className={`mt-auto ${iconClass} ${props.connectionsActive ? 'bg-aether-50 text-aether-700' : ''}`}><Icon path="M8 12h8M9 7l-3 5 3 5M15 7l3 5-3 5" /></button>
        <span title={`Agent ${props.daemon.status}`}><StatusOrb kind={daemonOrb} size={12} /></span>
      </nav> : <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-slate-50 ring-1 ring-slate-200">
        <nav aria-label="Workspace controls" className="space-y-1 border-b border-slate-200 p-3">
          <button onClick={props.onNewAgent} className="flex w-full items-center gap-2 rounded-xl bg-aether-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-aether-500 disabled:opacity-40"><Icon path="M12 5v14M5 12h14" />New agent</button>
          <button onClick={props.onOpenProjects} aria-pressed={props.projectsActive} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${props.projectsActive ? 'bg-aether-50 text-slate-900 ring-1 ring-aether-500/40' : 'text-slate-600 hover:bg-aether-50/60 hover:text-slate-900'}`}><Icon path="M3 7V5h6l2 2h10v12H3Z" />Manage projects<span className="ml-auto text-[10px]">{props.projects.length}</span></button>
          <button onClick={props.onOpenWorkspace} aria-pressed={props.workspaceActive} title="Every open project's agents, side by side" className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${props.workspaceActive ? 'bg-aether-50 text-slate-900 ring-1 ring-aether-500/40' : 'text-slate-600 hover:bg-aether-50/60 hover:text-slate-900'}`}><Icon path="M4 4h4v16H4zM10 4h4v16h-4zM16 4h4v16h-4z" />Workspace<span className="ml-auto text-[10px]">{props.workspaceAgentCount}</span></button>
          <button onClick={props.onOpenStation} aria-pressed={props.stationActive} title={props.stationWorkingCount > 0 ? `${props.stationWorkingCount} building in Station` : 'Build stores in separate Station chats'} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${props.stationActive ? 'bg-aether-50 text-aether-800 ring-1 ring-aether-200 font-medium' : 'text-slate-600 hover:bg-aether-50/60 hover:text-slate-900'}`}><Icon path="M4 20h16M6 20V8m6 12V8m6 12V8M3 8l9-5 9 5M3 8h18" />
            Station
            {/* The count matches every other tab. Working state is not repeated here as a
                second dot: each store row already carries a ProjectLight that says exactly
                that, and two indicators for one fact is noise. */}
            <span className="ml-auto text-[10px]">{props.stationAgentCount}</span>
          </button>
          <button onClick={props.onOpenConnections} aria-pressed={props.connectionsActive} title="Real API access and sign-ins for your stores: Stripe, Shopify, Etsy, Pinterest" className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs transition ${props.connectionsActive ? 'bg-aether-50 text-slate-900 ring-1 ring-aether-500/40' : 'text-slate-600 hover:bg-aether-50/60 hover:text-slate-900'}`}><Icon path="M8 12h8M9 7l-3 5 3 5M15 7l3 5-3 5" />Connections</button>
          <button onClick={() => setSkillsOpen(!skillsOpen)} aria-expanded={skillsOpen} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs text-slate-600 transition hover:bg-aether-50/60 hover:text-slate-900"><Icon path="m12 3 2 6 6 3-6 2-2 7-2-7-6-2 6-3 2-6Z" /><span>Skills</span><span className="ml-auto text-[10px]">{props.skills.length}</span>
            {/* The notch points left while the list is shut, then swings down as it opens. */}
            <svg aria-hidden="true" className={`h-3 w-3 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${skillsOpen ? 'rotate-0' : 'rotate-90'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
          </button>
          {/*
            Animating grid-template-rows from 0fr to 1fr gives a true height transition for a
            list of any length, rather than a guessed max-height that either clips a long list
            or leaves a gap under a short one.
          */}
          <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${skillsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
            <div className="overflow-hidden">
              <div className="max-h-36 overflow-auto px-3 text-[11px] text-slate-500">{props.skills.length ? props.skills.map((skill) => <p key={skill.name} title={skill.description} className="py-1">{skill.name}</p>) : <p className="py-2">No skills available in this workspace.</p>}</div>
            </div>
          </div>
        </nav>
        <div className="border-b border-slate-200 pb-2">
          <p className="px-3 pb-1 pt-3 text-xs font-medium text-slate-500">Stores <span className="ml-1 text-[10px]">{props.stores.length}</span></p>
          <ul aria-label="Stores" className="max-h-36 space-y-0.5 overflow-y-auto px-2">
            {props.stores.map((store) => <li key={store.id} title={store.path}>
              {/* A store row opens that store's manager, the same as clicking its card in the
                  Station grid. It is a button because it does something. */}
              <button type="button" onClick={() => props.onOpenStore(store.id)} title={`Open ${store.name} in Station`} className="flex w-full items-center gap-2 rounded-xl px-3 py-1.5 text-left text-[12px] text-slate-600 transition hover:bg-aether-50/60 hover:text-slate-900">
                <Icon path="M3 20h18M5 20V9l7-5 7 5v11M3 9h18" /><span className="min-w-0 flex-1 truncate">{store.name}</span><ProjectLight state={props.busyBySpace[store.id] ? 'working' : props.runningBySpace[store.id] ? 'open' : 'closed'} />
              </button>
            </li>)}
            {!props.stores.length && <li className="px-3 py-1 text-[11px] text-slate-500">Stores you create in Station appear here.</li>}
          </ul>
        </div>
        <h2 className="px-3 pb-1 pt-3 text-xs font-medium text-slate-500">Projects</h2>
        {/*
          Display only, on purpose. These rows used to be buttons that switched space and
          jumped straight into that project's grid of agent windows, so picking a folder by
          accident could open a second agent you never asked for. Nothing here starts an
          agent, a daemon or a chat - it reports which projects exist and which are busy.
          Use Manage projects to browse and open one; its agents share the Workspace.
        */}
        <ul aria-label="Projects" className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2">
          {props.projects.map((project) => {
            return (
              <li key={project.id} title={project.exists ? project.path : `${project.path} (folder missing)`}
                className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[13px] text-slate-600 ${project.exists ? '' : 'opacity-40'}`}>
                <Icon path="M3 7V5h6l2 2h10v12H3Z" />
                <span className="min-w-0 flex-1 truncate">{project.name}</span>
                <ProjectLight state={props.busyBySpace[project.id] ? 'working' : (props.openIdsBySpace[project.id]?.length ?? 0) > 0 ? 'open' : 'closed'} />
              </li>
            )
          })}
          {props.projects.length === 0 && <li className="px-3 py-2 text-xs text-slate-500">No projects yet.</li>}
        </ul>
        <div className="mx-3 mt-3 flex items-center gap-1.5 border-t border-slate-200 px-2 py-2.5">
          <StatusOrb kind={daemonOrb} size={13} />
          <span role="status" className="min-w-0 flex-1 truncate text-[10px] text-slate-500">{props.busy ? 'Agents working' : props.daemon.status === 'running' ? 'Ready' : props.daemon.status === 'starting' ? 'Starting…' : props.daemon.status === 'error' ? 'Failed to start' : 'Offline'}</span>
        </div>
      </div>}
    </aside>
  )
}
