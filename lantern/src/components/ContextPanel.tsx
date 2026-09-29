import type { ReactNode } from 'react'
import GitMenu from './GitMenu'

interface Props {
  projectId: string
  onClose: () => void
  children: ReactNode
}

// Preview-only panel. It opens itself when a run starts (dev server) and
// closes from here or with Ctrl/⌘ B — project meta lives in the manager.
export default function ContextPanel({ projectId, onClose, children }: Props) {
  return <>
    <header className="flex h-10 shrink-0 items-center gap-1 border-b border-slate-200 bg-slate-50 px-2">
      <span className="flex-1 px-1 text-xs text-slate-500">Preview</span>
      <GitMenu key={projectId} projectId={projectId} />
      <button onClick={onClose} aria-label="Close preview panel" title="Close preview panel (Ctrl/⌘ B)" className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-900"><svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
    </header>
    <div className="min-h-0 flex-1">{children}</div>
  </>
}
