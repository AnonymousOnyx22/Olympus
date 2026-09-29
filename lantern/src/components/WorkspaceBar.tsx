import { useEffect, useRef, useState } from 'react'
import type { PermissionMode } from '../types/opencode'

export type WorkspaceView = 'agent' | 'code' | 'thread' | 'edits' | 'workspace'

interface WorkspaceBarProps {
  projectId: string | null
  editCount: number
  view: WorkspaceView
  title: string
  permissionMode: PermissionMode
  permissionDisabled: boolean
  onPermissionModeChange: (mode: PermissionMode) => void
  onChange: (view: WorkspaceView) => void
}

const approvalModes: { id: PermissionMode; label: string; short: string; description: string; icon: string; tone: string }[] = [
  { id: 'ask', label: 'Ask for approval', short: 'Ask', description: 'Always ask before edits or commands', icon: 'M8 12V6a2 2 0 1 1 4 0v5M12 11V5a2 2 0 1 1 4 0v6M16 11.5V7a2 2 0 1 1 4 0v7a6 6 0 0 1-6 6h-2a6 6 0 0 1-5-2.7L4 13.5a1.7 1.7 0 0 1 2.6-2.1L8 13', tone: 'text-slate-700' },
  { id: 'edit', label: 'Approve for me', short: 'Auto edit', description: 'Only ask about actions that look unsafe', icon: 'M12 3 5 6v5c0 4.6 2.8 8.2 7 10 4.2-1.8 7-5.4 7-10V6l-7-3Z', tone: 'text-slate-700' },
  { id: 'bypass', label: 'Full access', short: 'Bypass', description: 'Unrestricted access to files and commands', icon: 'M12 9v4M12 17h.01M10.3 3.9 2.7 17.5A2 2 0 0 0 4.4 20.5h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z', tone: 'text-amber-600' },
]

// The header does two jobs: switch modes, and set the approval level (which
// restarts the focused project's agent). The terminal and preview panels
// toggle via Ctrl+J / Ctrl+B; other project actions live in Code (Run) and
// the preview panel (Git).
export default function WorkspaceBar(props: WorkspaceBarProps) {
  const [approvalsOpen, setApprovalsOpen] = useState(false)
  const approvalRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!approvalsOpen) return
    const close = (event: MouseEvent) => { if (!approvalRef.current?.contains(event.target as Node)) setApprovalsOpen(false) }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setApprovalsOpen(false) }
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', escape)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('keydown', escape) }
  }, [approvalsOpen])

  const current = approvalModes.find((m) => m.id === props.permissionMode)

  // "Full access" lets the agent edit files and run shell commands with no per-action
  // review — the one option here that gives up the approval gate entirely, so a single
  // misclick into it deserves a speed bump the other two (still reviewed, or reviewed
  // only for risky-looking actions) don't need.
  const selectMode = (mode: PermissionMode) => {
    if (mode === 'bypass' && !window.confirm('Full access lets the agent edit files and run commands without asking first. Continue?')) return
    props.onPermissionModeChange(mode)
    setApprovalsOpen(false)
  }

  return <header className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 pb-1">
    <div className="workspace-title min-w-0 flex-1 truncate pl-1 text-xs text-slate-500" title={props.title}>{props.title || 'General'}</div>
    {(props.editCount > 0 || props.view === 'edits') && <button onClick={() => props.onChange(props.view === 'edits' ? 'agent' : 'edits')} className="flex h-7 shrink-0 items-center gap-1.5 rounded-xl bg-amber-400/10 px-2 text-[11px] font-medium text-amber-700 ring-1 ring-amber-400/30 transition hover:bg-amber-400/20">{props.view === 'edits' ? 'Back to agent' : `Pending edits ${props.editCount}`}</button>}
    <nav aria-label="Workspace mode" className="flex rounded-xl bg-slate-50 p-0.5 ring-1 ring-slate-200">
      {(['agent', 'code', 'thread'] as const).map((view) => <button key={view} onClick={() => props.onChange(view)} aria-pressed={props.view === view} disabled={view === 'code' && !props.projectId} className={`rounded-lg px-4 py-1 text-xs capitalize transition disabled:opacity-40 ${props.view === view ? 'bg-white text-slate-900 shadow-aegean font-medium' : 'text-slate-500 hover:text-slate-800'}`}>{view}</button>)}
    </nav>
    <div className="relative shrink-0" ref={approvalRef}>
      <button onClick={() => setApprovalsOpen((v) => !v)} disabled={props.permissionDisabled} aria-expanded={approvalsOpen} title="Agent approvals" className={`flex h-7 items-center gap-1 rounded-xl px-2.5 text-[11px] transition hover:bg-slate-100 disabled:opacity-40 ${props.permissionMode === 'bypass' ? 'text-amber-600' : 'text-slate-600 hover:text-slate-900'}`}>
        {current?.short}<span aria-hidden="true"> &#8964;</span>
      </button>
      {approvalsOpen && <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-aegean-lg">
        <div className="flex items-center justify-between px-2 py-1.5">
          <span className="text-xs font-medium text-slate-700">How should the agent be approved?</span>
        </div>
        {approvalModes.map((mode) => {
          const selected = props.permissionMode === mode.id
          return (
            <button key={mode.id} onClick={() => selectMode(mode.id)} className={`flex w-full items-start gap-2.5 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 ${selected ? 'bg-sky-50 ring-1 ring-sky-200' : ''}`}>
              <svg className={`mt-0.5 h-4 w-4 shrink-0 ${mode.tone}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={mode.icon} /></svg>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-medium ${selected ? 'text-slate-900' : mode.tone}`}>{mode.label}</span>
                <span className="block text-[11px] leading-snug text-slate-500">{mode.description}</span>
              </span>
              {selected && <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>}
            </button>
          )
        })}
        <p className="px-2 py-2 text-[10px] text-slate-500">Changing this restarts the agent.</p>
      </div>}
    </div>
  </header>
}
