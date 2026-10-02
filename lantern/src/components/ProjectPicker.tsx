import { useDialogFocus } from './useDialogFocus'
import { useEffect, useMemo, useRef, useState } from 'react'
import StatusOrb from './StatusOrb'
import { GENERAL_SPACE } from '../constants'
import type { ProjectInfo } from '../types/opencode'

export interface PickerSpace {
  id: string
  name: string
  path?: string
  /** False when the folder is gone, or when the space's daemon hasn't come up yet. */
  available: boolean
  busy: boolean
  /** How many agent windows are already open in this space. */
  agentCount: number
  stack?: string[]
}

interface ProjectPickerProps {
  spaces: PickerSpace[]
  /** Highlighted as the current selection (the focused space). */
  currentId: string
  /** Prefilled from a search box elsewhere, e.g. typing "lan" in the sidebar. */
  initialQuery?: string
  /** Shown as the dialog's heading and explained by `hint`. */
  title: string
  hint: string
  onPick: (spaceId: string) => void
  /** Opens the OS folder chooser and adds whatever comes back as a project. */
  onAddFolder: () => void
  onClose: () => void
}

const Paths = {
  folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Zm9 3-4.3-4.3',
}

function Glyph({ path, className = 'h-4 w-4', width = 1.7 }: { path: string; className?: string; width?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  )
}

/**
 * The folder chooser for both entry points that need one: starting a new agent (pick the
 * folder it works in) and moving an existing chat to a different project.
 *
 * It is a dialog rather than a dropdown because picking a space means starting a daemon for
 * it — too slow and too consequential to trigger from a hover. The space you're already in
 * is still selectable: "New agent" means a new agent *here* if that's the folder you meant.
 */
export default function ProjectPicker({ spaces, currentId, initialQuery, title, hint, onPick, onAddFolder, onClose }: ProjectPickerProps) {
  const [query, setQuery] = useState(initialQuery ?? '')
  const searchRef = useRef<HTMLInputElement>(null)

  const dialogRef = useDialogFocus<HTMLDivElement>()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return spaces
      .filter((space) => !needle || `${space.name} ${space.path ?? ''} ${(space.stack ?? []).join(' ')}`.toLowerCase().includes(needle))
      .sort((a, b) => {
        // Keep the space you're in on top — it's the one you most often mean to stay on.
        if (a.id === currentId) return -1
        if (b.id === currentId) return 1
        return b.agentCount - a.agentCount || a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true })
      })
  }, [spaces, query, currentId])

  const pick = (space: PickerSpace) => {
    if (space.available) onPick(space.id)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/40 p-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="flex max-h-[70vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-aegean-lg">
        <header className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-4">
          <h2 className="text-[14px] font-semibold text-slate-900">{title}</h2>
          <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{hint}</p>
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-aether-400">
            <span className="shrink-0 text-slate-400">
              <Glyph path={Paths.search} className="h-3.5 w-3.5" />
            </span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-slate-900 placeholder:text-slate-400 outline-none"
            />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <nav aria-label="Projects" className="space-y-1">
            {visible.map((space) => {
              const isCurrent = space.id === currentId
              const select = () => pick(space)
              return (
                <div key={space.id} className={`flex items-center gap-2 rounded-xl transition ${isCurrent ? 'bg-aether-50 ring-1 ring-aether-200' : 'hover:bg-slate-50'}`}>
                  <button
                    type="button"
                    onClick={select}
                    disabled={!space.available}
                    title={space.available ? (space.path ? `${space.name} — ${space.path}` : space.name) : 'This folder is missing'}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2.5 py-2.5 text-left disabled:cursor-default disabled:opacity-50"
                  >
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl text-[12px] font-semibold uppercase ${isCurrent ? 'bg-aether-100 text-aether-700' : 'bg-slate-100 text-slate-500'}`}>
                      {space.id === GENERAL_SPACE ? <Glyph path={Paths.folder} className="h-3.5 w-3.5" /> : space.name.slice(0, 1)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-slate-900">{space.name}</span>
                        {isCurrent && <span className="shrink-0 rounded-md bg-aether-100 px-1.5 py-px text-[9.5px] font-medium uppercase tracking-wide text-aether-700">Current</span>}
                        {!!space.agentCount && (
                          <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-px font-mono text-[9.5px] text-slate-500" title="Open agent windows">
                            {space.agentCount} agent{space.agentCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-[10px] text-slate-400" title={space.path}>
                        {space.id === GENERAL_SPACE ? 'No project folder' : space.path}
                      </span>
                    </span>
                    {space.busy ? (
                      <span title="An agent here is working" className="shrink-0">
                        <StatusOrb kind="working" size={12} />
                      </span>
                    ) : space.available ? (
                      <Glyph path={Paths.folder} className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                    ) : (
                      <span className="shrink-0 rounded-md bg-amber-50 px-1.5 py-px text-[9.5px] font-medium text-amber-600 ring-1 ring-amber-400/20">Missing</span>
                    )}
                  </button>
                </div>
              )
            })}
            {visible.length === 0 && <p className="px-2.5 py-4 text-center text-[12px] text-slate-500">No projects match “{query.trim()}”.</p>}
          </nav>
        </div>

        <footer className="flex shrink-0 items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2.5">
          <button
            type="button"
            onClick={onAddFolder}
            className="flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-[11.5px] font-medium text-aether-700 ring-1 ring-aether-200 transition hover:bg-aether-50"
          >
            <Glyph path={Paths.plus} className="h-3.5 w-3.5" />
            Add a folder…
          </button>
          <button type="button" onClick={onClose} className="ml-auto h-8 rounded-xl bg-white px-3 text-[11.5px] font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-100">
            Cancel
          </button>
        </footer>
      </div>
    </div>
  )
}

/** Builds the picker's rows from the app's project list plus the folder-less General space. */
export function pickerSpaces(projects: ProjectInfo[], opts: { busyBySpace: Record<string, boolean>; openIdsBySpace: Record<string, string[]> }): PickerSpace[] {
  const general: PickerSpace = {
    id: GENERAL_SPACE,
    name: 'General',
    // General is a scratch workspace, so it is always selectable — picking it just starts
    // its daemon, which is cheap and loses nothing if it was already up.
    available: true,
    busy: !!opts.busyBySpace[GENERAL_SPACE],
    agentCount: 0,
  }
  return [
    general,
    ...projects
      .filter((project) => !project.hidden)
      .map((project) => ({
        id: project.id,
        name: project.name,
        path: project.path,
        available: project.exists,
        busy: !!opts.busyBySpace[project.id],
        agentCount: (opts.openIdsBySpace[project.id] ?? []).length,
        stack: project.stack,
      })),
  ]
}
