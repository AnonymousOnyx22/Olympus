import { useDialogFocus } from './useDialogFocus'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ProjectInfo } from '../types/opencode'

interface ProjectsPageProps {
  projects: ProjectInfo[]
  /** The project currently open in the workspace, if any. */
  activeId: string | null
  /**
   * Titles of the agent windows open in each project, keyed by project id. A
   * project is "open" in the only sense a reader cares about once it has an
   * agent actually running, so the list names them.
   */
  openAgentsByProject: Record<string, string[]>
  onProjectsChange: (projects: ProjectInfo[]) => void
  onOpen: (id: string) => void
  onAdd: () => void
}

type SortKey = 'recent' | 'modified' | 'name'
type Layout = 'grid' | 'list'

const PREFS_KEY = 'olympus.projects.view'

function loadPrefs(): { sort: SortKey; layout: Layout } {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}') as { sort?: string; layout?: string }
    return {
      sort: raw.sort === 'modified' || raw.sort === 'name' ? raw.sort : 'recent',
      layout: raw.layout === 'grid' ? 'grid' : 'list',
    }
  } catch {
    return { sort: 'recent', layout: 'list' }
  }
}

const baseName = (p: string) => p.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || p

function ago(time: number | null): string {
  if (!time) return '-'
  const s = Math.max(0, (Date.now() - time) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`
  return new Date(time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const errorText = (error: unknown) => (error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') : String(error))

const Icon = {
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />,
  plus: <path d="M12 5v14M5 12h14" strokeLinecap="round" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
  pin: <path d="M9 4h6l-1 5 3 3v2H7v-2l3-3-1-5ZM12 14v6" strokeLinejoin="round" strokeLinecap="round" />,
  reveal: <path d="M14 4h6v6M20 4l-8 8M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" strokeLinecap="round" strokeLinejoin="round" />,
  close: <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />,
  branch: <><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="18" cy="8" r="2" /><path d="M6 8v8M18 10c0 4-6 3-12 6" /></>,
  grid: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" />,
  list: <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />,
  radar: <><circle cx="12" cy="12" r="2" /><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4M19 5a10 10 0 0 1 0 14M5 19A10 10 0 0 1 5 5" strokeLinecap="round" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" /></>,
}

function Svg({ children, className = 'h-3.5 w-3.5', width = 1.9 }: { children: React.ReactNode; className?: string; width?: number }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} aria-hidden="true">{children}</svg>
}

export default function ProjectsPage({ projects, activeId, openAgentsByProject, onProjectsChange, onOpen, onAdd }: ProjectsPageProps) {
  const [query, setQuery] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [{ sort, layout }, setPrefs] = useState(loadPrefs)
  const [roots, setRoots] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    void window.electronAPI.listProjectRoots().then(setRoots).catch(() => setRoots([]))
    // Pick up anything that changed on disk while the page was closed (new files, git branch…).
    void window.electronAPI.listProjects().then(onProjectsChange).catch(() => undefined)
  }, [onProjectsChange])

  const updatePrefs = (patch: Partial<{ sort: SortKey; layout: Layout }>) =>
    setPrefs((current) => {
      const next = { ...current, ...patch }
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next))
      } catch {
        // Preference just won't persist.
      }
      return next
    })

  const run = async (action: () => Promise<void>) => {
    try {
      setError(null)
      await action()
    } catch (err) {
      setError(errorText(err))
    }
  }

  const watchFolder = () =>
    run(async () => {
      const dir = await window.electronAPI.selectDirectory()
      if (!dir) return
      const result = await window.electronAPI.addProjectRoot(dir)
      setRoots(result.roots)
      onProjectsChange(result.projects)
    })

  const unwatchFolder = (root: string) =>
    run(async () => {
      const result = await window.electronAPI.removeProjectRoot(root)
      setRoots(result.roots)
      onProjectsChange(result.projects)
    })

  const togglePin = (project: ProjectInfo) =>
    run(async () => onProjectsChange(await window.electronAPI.pinProject(project.id, !project.pinned)))

  const reveal = (project: ProjectInfo) => run(() => window.electronAPI.revealProject(project.id))

  const unhide = (project: ProjectInfo) => run(async () => onProjectsChange(await window.electronAPI.unhideProject(project.id)))

  const hiddenCount = projects.filter((p) => p.hidden).length

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = projects.filter((p) => {
      if (p.hidden && !showHidden) return false
      if (q && !`${p.name} ${p.path} ${p.stack.join(' ')} ${p.description ?? ''}`.toLowerCase().includes(q)) return false
      return true
    })
    const byName = (a: ProjectInfo, b: ProjectInfo) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
    const compare = {
      name: byName,
      modified: (a: ProjectInfo, b: ProjectInfo) => (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0) || byName(a, b),
      recent: (a: ProjectInfo, b: ProjectInfo) =>
        (b.lastOpened ?? 0) - (a.lastOpened ?? 0) || (b.modifiedAt ?? 0) - (a.modifiedAt ?? 0) || byName(a, b),
    }[sort]
    return list.sort((a, b) => Number(b.pinned) - Number(a.pinned) || compare(a, b))
  }, [projects, query, sort, showHidden])

  const countIn = (root: string) => projects.filter((p) => !p.hidden && p.root === root).length

  return (
    <main className="h-full overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-6xl px-8 py-8">
        {/* header */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold tracking-tight text-slate-900">Projects</h1>
            <p className="mt-1 text-[12px] text-slate-500">
              {projects.length - hiddenCount} project{projects.length - hiddenCount === 1 ? '' : 's'}
              {roots.length > 0 && ` · watching ${roots.length} folder${roots.length === 1 ? '' : 's'}`}
              {hiddenCount > 0 && (
                <>
                  {' · '}
                  <button type="button" onClick={() => setShowHidden((v) => !v)} className="text-aether-600 hover:underline">
                    {showHidden ? 'hide' : `show ${hiddenCount} hidden`}
                  </button>
                </>
              )}
            </p>
          </div>
          <button type="button" onClick={onAdd} className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-[11.5px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 active:scale-[0.98]">
            <Svg>{Icon.folder}</Svg>
            Add folder
          </button>
          <button
            type="button"
            onClick={() => (roots.length ? setCreating(true) : void watchFolder())}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-aether-50 px-3 text-[11.5px] font-medium text-aether-700 ring-1 ring-aether-200 transition hover:bg-aether-100 active:scale-[0.98]"
            title={roots.length ? 'Create a new folder inside a watched projects folder' : 'Watch a projects folder first'}
          >
            <Svg>{Icon.plus}</Svg>
            New project
          </button>
        </div>

        {/* watched folders */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center gap-2 px-1">
            <span className="text-aether-600"><Svg>{Icon.radar}</Svg></span>
            <h2 className="text-[11.5px] font-medium text-slate-700">Watched folders</h2>
            <span className="text-[11px] text-slate-400">Every folder inside becomes a project. New ones appear automatically.</span>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {roots.map((root) => (
              <div key={root} className="group flex h-8 min-w-0 max-w-full items-center gap-2 rounded-xl bg-white pl-2.5 pr-1 ring-1 ring-slate-200">
                <span className="text-slate-500"><Svg>{Icon.folder}</Svg></span>
                <span className="truncate text-[11.5px] text-slate-700" title={root}>{baseName(root)}</span>
                <span className="font-mono text-[10px] text-slate-400">{countIn(root)}</span>
                <button type="button" onClick={() => void unwatchFolder(root)} title={`Stop watching ${root}`} className="grid h-6 w-6 place-items-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600">
                  <Svg className="h-3 w-3" width={2.2}>{Icon.close}</Svg>
                </button>
              </div>
            ))}
            <button type="button" onClick={() => void watchFolder()} className="flex h-8 items-center gap-1.5 rounded-xl border border-dashed border-slate-200 px-3 text-[11.5px] text-slate-500 transition hover:border-aether-300 hover:text-aether-600">
              <Svg>{Icon.plus}</Svg>
              {roots.length ? 'Watch another folder' : 'Watch your projects folder'}
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-[12px] text-rose-700 ring-1 ring-rose-200">
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} className="rounded text-rose-600 hover:text-rose-700" title="Dismiss"><Svg className="h-3 w-3" width={2.4}>{Icon.close}</Svg></button>
          </div>
        )}

        {/* toolbar */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 sm:max-w-sm">
            <span className="text-slate-400"><Svg>{Icon.search}</Svg></span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search name, path or stack"
              aria-label="Search projects"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none"
              autoFocus
            />
          </div>

          <div className="ml-auto flex h-8 items-center rounded-xl bg-slate-50 p-0.5 ring-1 ring-slate-200">
            {(['grid', 'list'] as const).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => updatePrefs({ layout: key })}
                title={key === 'grid' ? 'Grid view' : 'List view'}
                aria-pressed={layout === key}
                className={`grid h-full w-7 place-items-center rounded-lg transition ${layout === key ? 'bg-white text-slate-900 shadow-aegean' : 'text-slate-500 hover:text-slate-900'}`}
              >
                <Svg>{Icon[key]}</Svg>
              </button>
            ))}
          </div>
        </div>

        {/* projects */}
        {visible.length > 0 ? (
          <div className={layout === 'grid' ? 'mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3' : 'mt-4 flex flex-col divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white'}>
            {visible.map((project) => (
              <ProjectItem
                key={project.id}
                project={project}
                layout={layout}
        active={project.id === activeId}
        openAgents={openAgentsByProject[project.id] ?? []}
        onOpen={() => onOpen(project.id)}
                onPin={() => void togglePin(project)}
                onReveal={() => void reveal(project)}
                onUnhide={() => void unhide(project)}
              />
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-aether-50 text-aether-500 ring-1 ring-aether-100">
              <Svg className="h-5 w-5" width={1.6}>{Icon.folder}</Svg>
            </div>
            <p className="mt-3 text-[12.5px] text-slate-500">
              {projects.length === 0 ? 'No projects yet.' : 'No matching projects.'}
            </p>
            {projects.length === 0 && (
              <p className="mt-1 text-[11.5px] text-slate-400">
                <button type="button" onClick={() => void watchFolder()} className="text-aether-600 hover:underline">Watch your projects folder</button>
                {' '}or{' '}
                <button type="button" onClick={onAdd} className="text-aether-600 hover:underline">add a single folder</button>.
              </p>
            )}
          </div>
        )}
      </div>

      {creating && (
        <NewProjectDialog
          roots={roots}
          defaultRoot={roots[0]}
          onCancel={() => setCreating(false)}
          onCreate={async (root, name, open) => {
            const result = await window.electronAPI.createProject(root, name)
            onProjectsChange(result.projects)
            setCreating(false)
            if (open) onOpen(result.id)
          }}
        />
      )}
    </main>
  )
}

interface ProjectItemProps {
  project: ProjectInfo
  layout: Layout
  active: boolean
  /** Titles of the agent windows currently open in this project, in open order. */
  openAgents: string[]
  onOpen: () => void
  onPin: () => void
  onReveal: () => void
  onUnhide: () => void
}

const MAX_AGENT_CHIPS = 3

function ProjectItem({ project, layout, active, openAgents, onOpen, onPin, onReveal, onUnhide }: ProjectItemProps) {
  const shown = openAgents.slice(0, MAX_AGENT_CHIPS)
  const overflow = openAgents.length - shown.length

  const badge = (
    <>
      {openAgents.length > 0 ? (
        // "Open" on its own told you nothing: the question this page actually
        // answers is what is running, so the agents are named outright.
        <span
          className="flex min-w-0 flex-wrap items-center gap-1"
          title={openAgents.length === 1 ? '1 agent open' : `${openAgents.length} agents open`}
        >
          {shown.map((title) => (
            <span
              key={title}
              className="flex min-w-0 max-w-[190px] items-center gap-1.5 rounded-md bg-amber-400 px-1.5 py-px text-[9.5px] font-semibold text-midnight"
            >
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
              <span className="truncate">{title}</span>
            </span>
          ))}
          {overflow > 0 && (
            <span className="rounded-md bg-amber-400 px-1.5 py-px text-[9.5px] font-semibold text-midnight">
              +{overflow}
            </span>
          )}
        </span>
      ) : active ? (
        <span className="rounded-md bg-emerald-50 px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-emerald-700 ring-1 ring-inset ring-emerald-200">Open</span>
      ) : null}
      {project.firstSeen && <span className="rounded-md bg-aether-50 px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-aether-700 ring-1 ring-inset ring-aether-200">New</span>}
      {!project.exists && <span className="rounded-md bg-amber-50 px-1.5 py-px text-[9.5px] font-medium text-amber-600 ring-1 ring-inset ring-amber-400/20">Folder missing</span>}
    </>
  )

  const avatar = (
    <span
      className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-aether-50 text-[12px] font-semibold text-aether-700 ring-1 ring-aether-100"
    >
      {project.name.slice(0, 1).toUpperCase()}
    </span>
  )

  const meta = (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-[10.5px] text-slate-500">
      {project.stack.map((tech) => (
        <span key={tech} className="rounded-md bg-aether-100 px-1.5 py-px text-aether-700 ring-1 ring-inset ring-aether-500/30">{tech}</span>
      ))}
      {project.gitBranch && (
        <span className="flex items-center gap-1 font-mono" title="Git branch">
          <Svg className="h-3 w-3" width={1.8}>{Icon.branch}</Svg>
          <span className="max-w-[110px] truncate">{project.gitBranch}</span>
        </span>
      )}
      <span title={project.modifiedAt ? `Modified ${new Date(project.modifiedAt).toLocaleString()}` : undefined}>edited {ago(project.modifiedAt)}</span>
    </div>
  )

  const actions = (
    <div className="flex items-center gap-0.5">
          {project.hidden ? (
            <IconButton label="Show in projects again" onClick={onUnhide}>{Icon.eye}</IconButton>
          ) : (
            <>
              <IconButton label={project.pinned ? 'Unpin' : 'Pin to top'} onClick={onPin} on={project.pinned}>{Icon.pin}</IconButton>
              <IconButton label="Show in Explorer" onClick={onReveal} disabled={!project.exists}>{Icon.reveal}</IconButton>
            </>
          )}
        </div>
  )

  const openable = project.exists && !project.hidden

  if (layout === 'list') {
    return (
      <div className={`group flex min-w-0 items-center gap-3 px-3 py-2.5 transition ${project.exists ? '' : 'opacity-60'} ${active ? 'bg-aether-50' : 'hover:bg-slate-50'}`}>
        <button type="button" onClick={onOpen} disabled={!openable} className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none disabled:cursor-default">
          {avatar}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-medium text-slate-900">{project.name}</span>
              {badge}
            </div>
            <span className="block truncate font-mono text-[10px] text-slate-400" title={project.path}>{project.path}</span>
          </div>
          <div className="hidden max-w-[45%] shrink-0 lg:block">{meta}</div>
        </button>
        <div className={project.pinned ? '' : 'opacity-0 transition group-hover:opacity-100 focus-within:opacity-100'}>{actions}</div>
      </div>
    )
  }

  return (
    <div className={`group relative min-w-0 ${project.exists ? '' : 'opacity-60'}`}>
      <button
        type="button"
        onClick={onOpen}
        disabled={!openable}
        className={`flex h-[132px] w-full min-w-0 flex-col justify-between rounded-2xl bg-white px-4 py-3.5 text-left shadow-aegean ring-1 transition hover:bg-slate-50 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-aether-400 disabled:cursor-default disabled:active:scale-100 ${active ? 'bg-aether-50 ring-aether-200' : 'ring-slate-200'}`}
      >
        <div className="flex w-full min-w-0 items-start gap-2.5 pr-20">
          {avatar}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[13px] font-medium text-slate-900">{project.name}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">{badge}</div>
            {project.description && <p className="mt-0.5 truncate text-[11px] text-slate-500">{project.description}</p>}
          </div>
        </div>
        <div className="w-full min-w-0 space-y-1.5">
          {meta}
          <span className="block truncate font-mono text-[10px] text-slate-400" title={project.path}>{project.path}</span>
        </div>
      </button>
      <div className={`absolute right-2 top-2 ${project.pinned ? '' : 'opacity-0 transition group-hover:opacity-100 focus-within:opacity-100'}`}>{actions}</div>
    </div>
  )
}

function IconButton({ label, onClick, children, on, danger, disabled }: { label: string; onClick: () => void; children: React.ReactNode; on?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      disabled={disabled}
      className={`grid h-6 w-6 place-items-center rounded-lg transition disabled:opacity-30 ${
        on ? 'text-aether-600 hover:bg-aether-50' : danger ? 'text-slate-400 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Svg className="h-3.5 w-3.5" width={on ? 2.2 : 1.9}>{children}</Svg>
    </button>
  )
}

function NewProjectDialog({ roots, defaultRoot, onCancel, onCreate }: {
  roots: string[]
  defaultRoot: string
  onCancel: () => void
  onCreate: (root: string, name: string, open: boolean) => Promise<void>
}) {
  const [root, setRoot] = useState(defaultRoot)
  const [name, setName] = useState('')
  const [openAfter, setOpenAfter] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const dialogRef = useDialogFocus<HTMLFormElement>()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      await onCreate(root, name.trim(), openAfter)
    } catch (err) {
      setError(errorText(err))
      setBusy(false)
    }
  }

  const sep = root.includes('\\') ? '\\' : '/'

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-midnight/70 p-4" onMouseDown={(event) => event.target === event.currentTarget && onCancel()}>
      <form ref={dialogRef} tabIndex={-1} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="new-project-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-aegean-lg">
        <h2 id="new-project-title" className="text-[14px] font-semibold text-slate-900">New project</h2>
        <p className="mt-1 text-[11.5px] text-slate-500">Creates an empty folder in a watched folder.</p>

        <label className="mt-4 block text-[11px] font-medium text-slate-500" htmlFor="new-project-name">Name</label>
        <input
          id="new-project-name"
          ref={input}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="my-new-app"
          className="mt-1 w-full rounded-xl bg-slate-50 px-3 py-2 text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-aether-400"
        />

        {roots.length > 1 && (
          <>
            <label className="mt-3 block text-[11px] font-medium text-slate-500" htmlFor="new-project-root">Location</label>
            <select
              id="new-project-root"
              value={root}
              onChange={(event) => setRoot(event.target.value)}
              className="mt-1 w-full rounded-xl bg-slate-50 px-2 py-2 text-[12px] text-slate-900 outline-none ring-1 ring-slate-200"
            >
              {roots.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </>
        )}

        <p className="mt-2 truncate font-mono text-[10.5px] text-slate-400" title={`${root}${sep}${name}`}>
          {root}{sep}<span className="text-slate-500">{name.trim() || '…'}</span>
        </p>

        <label className="mt-3 flex items-center gap-2 text-[11.5px] text-slate-500">
          <input type="checkbox" checked={openAfter} onChange={(event) => setOpenAfter(event.target.checked)} className="accent-aether-600" />
          Open it after creating
        </label>

        {error && <p role="alert" className="mt-3 text-[11.5px] text-rose-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="h-8 rounded-xl bg-slate-100 px-3 text-[11.5px] font-medium text-slate-700 transition hover:bg-slate-200">Cancel</button>
          <button type="submit" disabled={!name.trim() || busy} className="h-8 rounded-xl bg-aether-600 px-3 text-[11.5px] font-medium text-white transition hover:bg-aether-500 disabled:opacity-40">
            {busy ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}
